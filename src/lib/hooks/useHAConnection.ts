import { useEffect, useState, useCallback } from 'react'
import * as ws from '@/lib/ha-websocket'
import { getStoredCredentials, getAuthMethod } from '@/lib/config'
import { getValidAccessToken, isUsingOAuth } from '@/lib/ha-oauth'
import { logger } from '@/lib/logger'
import type { HAEntity } from '@/types/ha'

export function useHAConnection() {
  const [isConnected, setIsConnected] = useState(() => ws.isConnected())
  const [entities, setEntities] = useState<Map<string, HAEntity>>(new Map())
  const [isConfigured, setIsConfigured] = useState(false)
  const [hasReceivedData, setHasReceivedData] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Get credentials from storage (async for native platform support)
    async function initConnection() {
      const result = await getStoredCredentials()
      const authMethod = await getAuthMethod()

      if (cancelled) return

      if (result.status !== 'valid') {
        logger.debug('useHAConnection', 'No valid credentials:', result.status)
        setIsConfigured(false)
        return
      }

      setIsConfigured(true)
      ws.configure(result.credentials.url, result.credentials.token, authMethod === 'oauth')
      ws.connect()
    }

    initConnection()

    const unsubMessage = ws.onMessage((newEntities) => {
      setEntities(new Map(newEntities))
      setHasReceivedData(true)
    })

    const unsubConnection = ws.onConnection((connected) => {
      setIsConnected(connected)
    })

    // Handle visibility change (for web - proactively refresh OAuth token on tab focus)
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return

      // Only handle OAuth
      const usingOAuth = await isUsingOAuth()
      if (!usingOAuth) return

      logger.debug('useHAConnection', 'Tab became visible, checking token')
      const result = await getValidAccessToken()

      if (result.status === 'valid' && !ws.isConnected()) {
        logger.debug('useHAConnection', 'Reconnecting with refreshed token')
        ws.configure(result.haUrl, result.token, true)
        ws.connect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      unsubMessage()
      unsubConnection()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const callService = useCallback(
    (domain: string, service: string, data?: Record<string, unknown>) => {
      return ws.callService(domain, service, data)
    },
    []
  )

  const getEntity = useCallback(
    (entityId: string) => {
      return entities.get(entityId)
    },
    [entities]
  )

  const getEntitiesByDomain = useCallback(
    (domain: string) => {
      return Array.from(entities.values()).filter((e) => e.entity_id.startsWith(`${domain}.`))
    },
    [entities]
  )

  // Reconnect with new credentials
  const reconnect = useCallback(async () => {
    const result = await getStoredCredentials()
    const authMethod = await getAuthMethod()
    if (result.status !== 'valid') {
      setIsConfigured(false)
      return
    }

    setIsConfigured(true)
    ws.disconnect()
    ws.configure(result.credentials.url, result.credentials.token, authMethod === 'oauth')
    ws.connect()
  }, [])

  // Disconnect and clear state
  const disconnect = useCallback(() => {
    ws.disconnect()
    setIsConnected(false)
    setIsConfigured(false)
    setEntities(new Map())
  }, [])

  return {
    isConnected,
    isConfigured,
    hasReceivedData,
    entities,
    callService,
    getEntity,
    getEntitiesByDomain,
    reconnect,
    disconnect,
  }
}
