import { useEffect, useState, useCallback } from 'react'
import { haWebSocket } from '@/lib/ha-websocket'
import { getStoredCredentials, getAuthMethod } from '@/lib/config'
import type { HAEntity } from '@/types/ha'

export function useHAConnection() {
  const [isConnected, setIsConnected] = useState(() => haWebSocket.isConnected())
  const [entities, setEntities] = useState<Map<string, HAEntity>>(new Map())
  const [isConfigured, setIsConfigured] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Get credentials from storage (async for native platform support)
    async function initConnection() {
      const result = await getStoredCredentials()
      const authMethod = await getAuthMethod()

      if (cancelled) return

      if (result.status !== 'valid') {
        console.log('[useHAConnection] No valid credentials:', result.status)
        setIsConfigured(false)
        return
      }

      setIsConfigured(true)
      haWebSocket.configure(result.credentials.url, result.credentials.token, authMethod === 'oauth')
      haWebSocket.connect()
    }

    initConnection()

    const unsubMessage = haWebSocket.onMessage((newEntities) => {
      setEntities(new Map(newEntities))
    })

    const unsubConnection = haWebSocket.onConnection((connected) => {
      setIsConnected(connected)
    })

    return () => {
      cancelled = true
      unsubMessage()
      unsubConnection()
    }
  }, [])

  const callService = useCallback(
    (domain: string, service: string, data?: Record<string, unknown>) => {
      haWebSocket.callService(domain, service, data)
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
      return Array.from(entities.values()).filter((e) =>
        e.entity_id.startsWith(`${domain}.`)
      )
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
    haWebSocket.disconnect()
    haWebSocket.configure(result.credentials.url, result.credentials.token, authMethod === 'oauth')
    haWebSocket.connect()
  }, [])

  // Disconnect and clear state
  const disconnect = useCallback(() => {
    haWebSocket.disconnect()
    setIsConnected(false)
    setIsConfigured(false)
    setEntities(new Map())
  }, [])

  return {
    isConnected,
    isConfigured,
    entities,
    callService,
    getEntity,
    getEntitiesByDomain,
    reconnect,
    disconnect,
  }
}
