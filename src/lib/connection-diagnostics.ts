import { logError, setCustomKey, log } from '@/lib/crashlytics'

export type ConnectionErrorType =
  | 'network'
  | 'websocket-blocked'
  | 'auth'
  | 'server-down'
  | 'unknown'

export interface DiagnosticResult {
  httpsReachable: boolean
  websocketReachable: boolean
  authValid: boolean
  errorType: ConnectionErrorType
  timestamp: number
}

const HTTPS_TIMEOUT = 10000
const WS_TIMEOUT = 10000

/**
 * Run connection diagnostics to determine why a connection failed.
 * Tests HTTPS and WebSocket connectivity separately to identify the issue.
 */
export async function runConnectionDiagnostics(
  url: string,
  token: string
): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    httpsReachable: false,
    websocketReachable: false,
    authValid: false,
    errorType: 'unknown',
    timestamp: Date.now(),
  }

  // Log that we're running diagnostics
  await log('Running connection diagnostics')

  // Test HTTPS connectivity first
  result.httpsReachable = await testHttpsConnectivity(url)

  if (!result.httpsReachable) {
    // Can't reach the server at all
    result.errorType = 'network'
    await logDiagnosticResult(result, url)
    return result
  }

  // HTTPS works, now test WebSocket
  const wsResult = await testWebSocketConnectivity(url, token)
  result.websocketReachable = wsResult.connected
  result.authValid = wsResult.authValid

  if (!result.websocketReachable) {
    // HTTPS works but WebSocket doesn't - likely blocked
    result.errorType = 'websocket-blocked'
  } else if (!result.authValid) {
    // WebSocket connects but auth fails
    result.errorType = 'auth'
  } else {
    // Everything works - the original error may have been transient
    result.errorType = 'unknown'
  }

  await logDiagnosticResult(result, url)
  return result
}

/**
 * Test if the Home Assistant server is reachable via HTTPS/HTTP.
 */
async function testHttpsConnectivity(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HTTPS_TIMEOUT)

    // Try to fetch the API root - this should work even without auth
    const response = await fetch(`${url}/api/`, {
      method: 'GET',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // 401 is fine - it means the server is reachable but needs auth
    // 200 would be unexpected without auth, but also fine
    return response.status === 401 || response.status === 200 || response.status === 403
  } catch (error) {
    // Network error, timeout, or CORS issue
    return false
  }
}

interface WebSocketTestResult {
  connected: boolean
  authValid: boolean
}

/**
 * Test WebSocket connectivity and authentication.
 */
async function testWebSocketConnectivity(
  url: string,
  token: string
): Promise<WebSocketTestResult> {
  return new Promise((resolve) => {
    const wsUrl = url.replace(/^http/, 'ws') + '/api/websocket'
    let ws: WebSocket | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (ws) {
        ws.onopen = null
        ws.onmessage = null
        ws.onerror = null
        ws.onclose = null
        ws.close()
        ws = null
      }
    }

    timeoutId = setTimeout(() => {
      cleanup()
      resolve({ connected: false, authValid: false })
    }, WS_TIMEOUT)

    try {
      ws = new WebSocket(wsUrl)

      ws.onerror = () => {
        cleanup()
        resolve({ connected: false, authValid: false })
      }

      ws.onclose = () => {
        // If we haven't resolved yet, this is an unexpected close
        cleanup()
        resolve({ connected: false, authValid: false })
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string)

          if (message.type === 'auth_required') {
            // WebSocket is connected, now test auth
            ws?.send(JSON.stringify({ type: 'auth', access_token: token }))
          } else if (message.type === 'auth_ok') {
            // Full success
            cleanup()
            resolve({ connected: true, authValid: true })
          } else if (message.type === 'auth_invalid') {
            // WebSocket works but token is bad
            cleanup()
            resolve({ connected: true, authValid: false })
          }
        } catch {
          // Parse error - treat as connection failure
          cleanup()
          resolve({ connected: false, authValid: false })
        }
      }
    } catch {
      cleanup()
      resolve({ connected: false, authValid: false })
    }
  })
}

/**
 * Log diagnostic results to Crashlytics for debugging.
 */
async function logDiagnosticResult(result: DiagnosticResult, url: string): Promise<void> {
  // Extract hostname only for privacy
  let hostname = 'unknown'
  try {
    hostname = new URL(url).hostname
  } catch {
    // Invalid URL
  }

  await setCustomKey('connection_error_type', result.errorType)
  await setCustomKey('https_reachable', result.httpsReachable)
  await setCustomKey('websocket_reachable', result.websocketReachable)
  await setCustomKey('auth_valid', result.authValid)
  await setCustomKey('ha_hostname', hostname)

  // Log as an error for tracking
  const error = new Error(`Connection diagnostic: ${result.errorType}`)
  await logError(error, 'connection-diagnostic')
}
