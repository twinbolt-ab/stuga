import { useEffect, useState, useCallback } from 'react'
import * as ws from '@/lib/ha-websocket'
import { getStoredCredentials, getAuthMethod } from '@/lib/config'
import { getValidAccessToken, isUsingOAuth, getOAuthCredentials } from '@/lib/ha-oauth'
import { logger } from '@/lib/logger'
import type { HAEntity } from '@/types/ha'

// Refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000
// Minimum delay between refresh attempts to prevent infinite loops
const MIN_REFRESH_DELAY_MS = 30 * 1000

// Module-level singleton state for connection and token refresh (shared across all hook instances)
let refreshTimerRef: ReturnType<typeof setTimeout> | null = null
let connectionInitialized = false
let visibilityHandlerAttached = false

export function useHAConnection() {
  const [isConnected, setIsConnected] = useState(() => ws.isConnected())
  const [entities, setEntities] = useState<Map<string, HAEntity>>(new Map())
  const [isConfigured, setIsConfigured] = useState(false)
  const [hasReceivedData, setHasReceivedData] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Schedule proactive token refresh before expiry (singleton - only runs once globally)
    async function scheduleTokenRefresh() {
      const usingOAuth = await isUsingOAuth()
      if (!usingOAuth) return

      const creds = await getOAuthCredentials()
      if (!creds) return

      // Clear any existing timer
      if (refreshTimerRef) {
        clearTimeout(refreshTimerRef)
        refreshTimerRef = null
      }

      // Calculate when to refresh (5 minutes before expiry)
      const refreshAt = creds.expires_at - TOKEN_REFRESH_BUFFER_MS
      const delay = Math.max(MIN_REFRESH_DELAY_MS, refreshAt - Date.now())

      // If token is already expired, don't schedule proactive refresh - it will refresh on demand
      if (creds.expires_at <= Date.now()) {
        logger.debug(
          'useHAConnection',
          'Token already expired, skipping proactive refresh scheduling'
        )
        return
      }

      logger.debug(
        'useHAConnection',
        `Token expires at ${new Date(creds.expires_at).toISOString()}, scheduling refresh in ${Math.round(delay / 1000)}s`
      )

      refreshTimerRef = setTimeout(() => {
        if (cancelled) return
        logger.debug('useHAConnection', 'Proactive token refresh triggered')
        void (async () => {
          const result = await getValidAccessToken()
          if (result.status === 'valid') {
            // Update WebSocket with fresh token for next reconnect
            ws.updateToken(result.token)
            // Schedule next refresh
            void scheduleTokenRefresh()
          } else if (result.status === 'auth-error') {
            logger.warn('useHAConnection', 'Token refresh failed permanently')
          }
        })()
      }, delay)
    }

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

      // Only configure/connect once globally
      if (!connectionInitialized) {
        connectionInitialized = true
        ws.configure(result.credentials.url, result.credentials.token, authMethod === 'oauth')
        ws.connect()
        // Start proactive token refresh for OAuth
        void scheduleTokenRefresh()
      }
    }

    void initConnection()

    const unsubMessage = ws.onMessage((newEntities) => {
      setEntities(new Map(newEntities))
      setHasReceivedData(true)
    })

    const unsubConnection = ws.onConnection((connected) => {
      setIsConnected(connected)
    })

    // Handle visibility change (for web - proactively refresh OAuth token on tab focus)
    // Only set up once globally
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return

      void (async () => {
        // Only handle OAuth
        const usingOAuth = await isUsingOAuth()
        if (!usingOAuth) return

        logger.debug('useHAConnection', 'Tab became visible, checking token')
        const result = await getValidAccessToken()

        if (result.status === 'valid') {
          // Always update the token, even if connected (for next reconnect)
          ws.updateToken(result.token)
          // Reschedule refresh timer with updated expiry
          void scheduleTokenRefresh()

          if (!ws.isConnected()) {
            logger.debug('useHAConnection', 'Reconnecting with refreshed token')
            ws.configure(result.haUrl, result.token, true)
            ws.connect()
          }
        }
      })()
    }

    // Only attach visibility handler once globally
    if (!visibilityHandlerAttached) {
      visibilityHandlerAttached = true
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    return () => {
      cancelled = true
      // Don't clear the global refresh timer or visibility handler on individual hook unmount
      // They're managed globally and should persist
      unsubMessage()
      unsubConnection()
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
    // Connection info (sync access to already-configured values)
    url: ws.getUrl(),
    isOAuth: ws.isUsingOAuth(),
  }
}
