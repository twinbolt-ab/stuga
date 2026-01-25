import type { WebSocketMessage } from '@/types/ha'
import type { HAWebSocketState } from './types'
import { RECONNECT_DELAY } from '@/lib/constants'
import { getValidAccessToken } from '@/lib/ha-oauth'
import { logger } from '@/lib/logger'
import { notifyConnectionHandlers, clearPendingCallbacks, notifyConnectionErrorHandlers } from './message-router'
import { runConnectionDiagnostics } from '@/lib/connection-diagnostics'
import { logError, log, setUserContext, getConnectionType } from '@/lib/crashlytics'
import { Capacitor } from '@capacitor/core'

type MessageCallback = (message: WebSocketMessage) => void

export function configure(
  state: HAWebSocketState,
  url: string,
  token: string,
  useOAuth = false
): void {
  state.url = url.replace('http', 'ws') + '/api/websocket'
  state.token = token
  state.useOAuth = useOAuth
}

export function connect(state: HAWebSocketState, onMessage: MessageCallback): void {
  if (state.ws?.readyState === WebSocket.OPEN) return

  try {
    state.ws = new WebSocket(state.url)

    state.ws.onopen = () => {
      logger.debug('HA WS', 'Connected')
    }

    state.ws.onmessage = (event) => {
      onMessage(JSON.parse(event.data as string) as WebSocketMessage)
    }

    state.ws.onclose = () => {
      logger.debug('HA WS', 'Disconnected')
      state.isAuthenticated = false
      notifyConnectionHandlers(state, false)
      handleConnectionFailure(state, onMessage)
    }

    state.ws.onerror = (error) => {
      logger.error('HA WS', 'Error:', error)
      void logError(new Error('WebSocket error event'), 'websocket-error')
    }
  } catch (error) {
    logger.error('HA WS', 'Connection failed:', error)
    void logError(
      error instanceof Error ? error : new Error(String(error)),
      'websocket-connect'
    )
    handleConnectionFailure(state, onMessage)
  }
}

async function handleConnectionFailure(
  state: HAWebSocketState,
  onMessage: MessageCallback
): Promise<void> {
  // Run diagnostics only on initial connection failure
  if (state.isInitialConnection && state.url && state.token) {
    logger.debug('HA WS', 'Running connection diagnostics...')
    void log('WebSocket connection failed, running diagnostics')
    const httpUrl = state.url.replace(/^ws/, 'http').replace('/api/websocket', '')
    const diagnostic = await runConnectionDiagnostics(httpUrl, state.token)
    state.lastDiagnostic = diagnostic
    notifyConnectionErrorHandlers(state, diagnostic)

    // Log the diagnostic result if there's a failure
    if (!diagnostic.httpsReachable || !diagnostic.websocketReachable || !diagnostic.authValid) {
      void logError(
        new Error(`Connection diagnostic: https=${diagnostic.httpsReachable}, ws=${diagnostic.websocketReachable}, auth=${diagnostic.authValid}, error=${diagnostic.errorType}`),
        'websocket-diagnostic'
      )
    }
  }

  scheduleReconnect(state, onMessage)
}

export function disconnect(state: HAWebSocketState): void {
  if (state.reconnectTimeout) {
    clearTimeout(state.reconnectTimeout)
    state.reconnectTimeout = null
  }
  clearPendingCallbacks(state)
  state.ws?.close()
  state.ws = null
  state.isAuthenticated = false
}

function scheduleReconnect(state: HAWebSocketState, onMessage: MessageCallback): void {
  if (state.reconnectTimeout) return

  state.reconnectTimeout = setTimeout(() => {
    state.reconnectTimeout = null
    logger.debug('HA WS', 'Attempting reconnect...')
    connect(state, onMessage)
  }, RECONNECT_DELAY)
}

/** For OAuth, refreshes the access token before sending auth message. */
export async function authenticate(state: HAWebSocketState): Promise<boolean> {
  // If using OAuth, get a fresh token (handles refresh automatically)
  if (state.useOAuth) {
    void log('Authenticating with OAuth')
    const result = await getValidAccessToken()
    if (result.status === 'valid') {
      state.token = result.token
    } else if (result.status === 'network-error') {
      // Network error - keep trying to reconnect, credentials are still valid
      logger.warn('HA WS', 'Network error getting token, will retry on reconnect')
      void logError(new Error('OAuth network error during authentication'), 'websocket-auth-network')
      disconnect(state)
      return false
    } else {
      // Auth error or no credentials - stop trying
      logger.error('HA WS', 'OAuth token unavailable:', result.status)
      void logError(new Error(`OAuth token unavailable: ${result.status}`), 'websocket-auth-failed')
      disconnect(state)
      return false
    }
  }

  send(state, {
    type: 'auth',
    access_token: state.token,
  })
  return true
}

/** Call after successful authentication to set user context for crash reporting */
export function setConnectionContext(state: HAWebSocketState): void {
  if (!state.url) return

  const httpUrl = state.url.replace(/^ws/, 'http').replace('/api/websocket', '')
  const platform = Capacitor.getPlatform() as 'web' | 'ios' | 'android'
  const connectionType = getConnectionType(httpUrl)
  const authMethod = state.useOAuth ? 'oauth' : 'token'

  void setUserContext({
    platform,
    connectionType,
    authMethod,
    entityCount: state.entities?.size,
    areaCount: state.areas?.size,
    floorCount: state.floors?.size,
  })
}

export function send(state: HAWebSocketState, message: Record<string, unknown>): void {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(message))
  }
}

export function getNextMessageId(state: HAWebSocketState): number {
  return state.messageId++
}

export function isConnected(state: HAWebSocketState): boolean {
  return state.isAuthenticated
}
