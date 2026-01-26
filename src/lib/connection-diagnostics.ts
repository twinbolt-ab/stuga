import { logError, setCustomKey, log } from '@/lib/crashlytics'

export type ConnectionErrorType =
  | 'network'
  | 'ssl-error'
  | 'ssl-hostname-mismatch'
  | 'dns-resolution'
  | 'websocket-blocked'
  | 'auth'
  | 'server-down'
  | 'unknown'

export interface DiagnosticResult {
  httpsReachable: boolean
  websocketReachable: boolean
  authValid: boolean
  errorType: ConnectionErrorType
  /** Raw error message from the failed connection attempt */
  errorDetails?: string
  /** Specific error code if available (e.g., SSL error codes) */
  errorCode?: string
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
  const httpsResult = await testHttpsConnectivity(url)
  result.httpsReachable = httpsResult.reachable

  if (!result.httpsReachable) {
    // Can't reach the server - use the specific error type from the test
    result.errorType = httpsResult.errorType || 'network'
    result.errorDetails = httpsResult.errorDetails
    result.errorCode = httpsResult.errorCode
    await logDiagnosticResult(result, url)
    return result
  }

  // HTTPS works, now test WebSocket
  const wsResult = await testWebSocketConnectivity(url, token)
  result.websocketReachable = wsResult.connected
  result.authValid = wsResult.authValid

  if (!result.websocketReachable) {
    // HTTPS works but WebSocket doesn't
    // Use the specific error from WebSocket test if available
    result.errorType = wsResult.errorType || 'websocket-blocked'
    result.errorDetails = wsResult.errorDetails
    result.errorCode = wsResult.errorCode
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

interface HttpsTestResult {
  reachable: boolean
  errorType?: ConnectionErrorType
  errorDetails?: string
  errorCode?: string
}

/**
 * Analyze an error to determine if it's SSL-related.
 * Browser/WebView errors for SSL issues contain specific patterns.
 */
function analyzeConnectionError(error: unknown): { errorType: ConnectionErrorType; errorDetails: string; errorCode?: string } {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorName = error instanceof Error ? error.name : 'Error'
  const lowerMessage = errorMessage.toLowerCase()

  // SSL/TLS error patterns
  // These patterns appear in various browsers/WebViews when SSL fails
  const sslPatterns = [
    'ssl',
    'certificate',
    'cert_',
    'tls',
    'https',
    'secure connection',
    'security error',
    'net::err_cert',
    'net::err_ssl',
    'pkix',
    'handshake',
    'self-signed',
    'expired',
    'untrusted',
  ]

  // Hostname/certificate mismatch patterns
  const hostnameMismatchPatterns = [
    'hostname',
    'host name',
    'common name',
    'subject alternative name',
    'san',
    'name mismatch',
    'err_cert_common_name_invalid',
    'err_cert_authority_invalid',
  ]

  // DNS resolution error patterns
  const dnsPatterns = [
    'dns',
    'getaddrinfo',
    'enotfound',
    'err_name_not_resolved',
    'nodename nor servname',
    'name or service not known',
    'no address associated',
    'could not resolve',
  ]

  // Check for hostname mismatch (more specific than general SSL)
  if (hostnameMismatchPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return {
      errorType: 'ssl-hostname-mismatch',
      errorDetails: errorMessage,
      errorCode: errorName,
    }
  }

  // Check for SSL/TLS errors
  if (sslPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return {
      errorType: 'ssl-error',
      errorDetails: errorMessage,
      errorCode: errorName,
    }
  }

  // Check for DNS resolution errors
  if (dnsPatterns.some(pattern => lowerMessage.includes(pattern))) {
    return {
      errorType: 'dns-resolution',
      errorDetails: errorMessage,
      errorCode: errorName,
    }
  }

  // Check for timeout (AbortError)
  if (errorName === 'AbortError' || lowerMessage.includes('timeout') || lowerMessage.includes('abort')) {
    return {
      errorType: 'network',
      errorDetails: 'Connection timed out',
      errorCode: 'TIMEOUT',
    }
  }

  // Generic network error
  return {
    errorType: 'network',
    errorDetails: errorMessage || 'Unknown network error',
    errorCode: errorName,
  }
}

/**
 * Test if the Home Assistant server is reachable via HTTPS/HTTP.
 * Returns detailed error information for better diagnostics.
 */
async function testHttpsConnectivity(url: string): Promise<HttpsTestResult> {
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
    if (response.status === 401 || response.status === 200 || response.status === 403) {
      return { reachable: true }
    }

    // Server responded but with an unexpected status
    return {
      reachable: false,
      errorType: 'server-down',
      errorDetails: `Server returned status ${response.status}`,
      errorCode: `HTTP_${response.status}`,
    }
  } catch (error) {
    // Analyze the error to determine the specific type
    const analysis = analyzeConnectionError(error)
    return {
      reachable: false,
      ...analysis,
    }
  }
}

interface WebSocketTestResult {
  connected: boolean
  authValid: boolean
  errorType?: ConnectionErrorType
  errorDetails?: string
  errorCode?: string
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
    let lastError: Event | null = null

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
      resolve({
        connected: false,
        authValid: false,
        errorType: 'websocket-blocked',
        errorDetails: 'WebSocket connection timed out',
        errorCode: 'TIMEOUT',
      })
    }, WS_TIMEOUT)

    try {
      ws = new WebSocket(wsUrl)

      ws.onerror = (event) => {
        lastError = event
        // Don't resolve yet - wait for onclose which has more info
      }

      ws.onclose = (event) => {
        // If we haven't resolved yet, this is an unexpected close
        cleanup()

        // Try to extract useful info from the close event
        let errorDetails = 'WebSocket connection closed'
        let errorCode: string | undefined

        if (event.code) {
          errorCode = `WS_${event.code}`
          errorDetails = `WebSocket closed with code ${event.code}`
          if (event.reason) {
            errorDetails += `: ${event.reason}`
          }
        }

        // Analyze any error that occurred before close
        if (lastError) {
          // WebSocket errors are often opaque for security reasons,
          // but we can still detect SSL issues from the close pattern
          const analysis = analyzeConnectionError(new Error(errorDetails))
          resolve({
            connected: false,
            authValid: false,
            errorType: analysis.errorType === 'network' ? 'websocket-blocked' : analysis.errorType,
            errorDetails: analysis.errorDetails,
            errorCode: errorCode || analysis.errorCode,
          })
        } else {
          resolve({
            connected: false,
            authValid: false,
            errorType: 'websocket-blocked',
            errorDetails,
            errorCode,
          })
        }
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
          resolve({
            connected: false,
            authValid: false,
            errorType: 'websocket-blocked',
            errorDetails: 'Invalid response from WebSocket',
            errorCode: 'PARSE_ERROR',
          })
        }
      }
    } catch (error) {
      cleanup()
      const analysis = analyzeConnectionError(error)
      resolve({
        connected: false,
        authValid: false,
        errorType: analysis.errorType === 'network' ? 'websocket-blocked' : analysis.errorType,
        errorDetails: analysis.errorDetails,
        errorCode: analysis.errorCode,
      })
    }
  })
}

/**
 * Log diagnostic results to Crashlytics for debugging.
 */
async function logDiagnosticResult(result: DiagnosticResult, url: string): Promise<void> {
  // Extract hostname only for privacy
  let hostname = 'unknown'
  let protocol = 'unknown'
  try {
    const urlObj = new URL(url)
    hostname = urlObj.hostname
    protocol = urlObj.protocol.replace(':', '')
  } catch {
    // Invalid URL
  }

  await setCustomKey('connection_error_type', result.errorType)
  await setCustomKey('https_reachable', result.httpsReachable)
  await setCustomKey('websocket_reachable', result.websocketReachable)
  await setCustomKey('auth_valid', result.authValid)
  await setCustomKey('ha_hostname', hostname)
  await setCustomKey('ha_protocol', protocol)

  // Log error details if available
  if (result.errorDetails) {
    await setCustomKey('error_details', result.errorDetails.slice(0, 200)) // Truncate for safety
  }
  if (result.errorCode) {
    await setCustomKey('error_code', result.errorCode)
  }

  // Log as an error for tracking
  const errorMsg = result.errorDetails
    ? `Connection diagnostic: ${result.errorType} - ${result.errorDetails}`
    : `Connection diagnostic: ${result.errorType}`
  const error = new Error(errorMsg)
  await logError(error, 'connection-diagnostic')
}
