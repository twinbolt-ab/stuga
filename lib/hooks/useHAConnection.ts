'use client'

import { useEffect, useState, useCallback } from 'react'
import { haWebSocket } from '@/lib/ha-websocket'
import type { HAEntity } from '@/types/ha'

export function useHAConnection() {
  const [isConnected, setIsConnected] = useState(() => haWebSocket.isConnected())
  const [entities, setEntities] = useState<Map<string, HAEntity>>(new Map())

  useEffect(() => {
    // Configure with environment variables
    const url = process.env.NEXT_PUBLIC_HA_URL || ''
    const token = process.env.NEXT_PUBLIC_HA_TOKEN || ''

    if (!url || !token) {
      console.error('[useHAConnection] Missing HA_URL or HA_TOKEN')
      return
    }

    haWebSocket.configure(url, token)
    haWebSocket.connect()

    const unsubMessage = haWebSocket.onMessage((newEntities) => {
      setEntities(new Map(newEntities))
    })

    const unsubConnection = haWebSocket.onConnection((connected) => {
      setIsConnected(connected)
    })

    return () => {
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

  return {
    isConnected,
    entities,
    callService,
    getEntity,
    getEntitiesByDomain,
  }
}
