import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  ExternalLink,
  AlertCircle,
  X,
  Wifi,
  Key,
  Copy,
  ShieldOff,
  ServerOff,
  RefreshCw,
} from 'lucide-react'
import { saveCredentials } from '@/lib/config'
import { t } from '@/lib/i18n'
import { type ConnectionErrorType, type DiagnosticResult } from '@/lib/connection-diagnostics'
import { logError, setCustomKey, log } from '@/lib/crashlytics'
import { EditModal } from '@/components/ui/EditModal'
import { useDevMode } from '@/lib/hooks/useDevMode'
import {
  storePendingOAuth,
  storeOAuthCredentials,
  isNativeApp,
  getClientId,
  getRedirectUri,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from '@/lib/ha-oauth'
import { authenticateWithInAppBrowser } from '@/lib/oauth-browser'
import { logger } from '@/lib/logger'

type Step = 'welcome' | 'connect' | 'complete'

type AuthMethod = 'oauth' | 'token'

// OAuth is always available - we handle HTTP via manual token exchange
function isOAuthAvailable(_urlToCheck: string): boolean {
  return true
}

type UrlStatus = 'idle' | 'checking' | 'success' | 'failed'

interface UrlSuggestion {
  url: string
  label: string
  status: UrlStatus
}

// Map error types to user-friendly messages
function getErrorMessage(errorType: ConnectionErrorType): string {
  const messages: Record<ConnectionErrorType, string> = {
    network: t.connectionError?.errorNetwork || 'Unable to reach Home Assistant',
    'websocket-blocked': t.connectionError?.errorWebsocket || 'WebSocket connection blocked',
    auth: t.connectionError?.errorAuth || 'Authentication failed',
    'server-down': t.connectionError?.errorServerDown || 'Home Assistant is not responding',
    unknown: t.setup.url.error,
  }
  return messages[errorType]
}

function getTroubleshootingTip(errorType: ConnectionErrorType): string {
  const tips: Record<ConnectionErrorType, string> = {
    network:
      t.connectionError?.troubleshootNetwork ||
      'Check your network connection and verify the Home Assistant URL is correct.',
    'websocket-blocked':
      t.connectionError?.troubleshootWebsocket ||
      'WebSocket connections may be blocked by your network or proxy. Try connecting from a different network.',
    auth:
      t.connectionError?.troubleshootAuth ||
      'Your access token may have expired or is invalid. Try reconnecting with a new token.',
    'server-down':
      t.connectionError?.troubleshootServerDown ||
      'Home Assistant may be restarting or offline. Check that it is running and try again.',
    unknown:
      t.connectionError?.troubleshootUnknown ||
      'An unexpected error occurred. Check your connection settings and try again.',
  }
  return tips[errorType]
}

// Detailed troubleshooting steps for each error type
function getTroubleshootingSteps(errorType: ConnectionErrorType): string[] {
  const steps: Record<ConnectionErrorType, string[]> = {
    network: [
      'Check that your device is connected to the internet or local network',
      'Verify the Home Assistant URL is correct (e.g., http://homeassistant.local:8123)',
      'Make sure Home Assistant is running and accessible',
      'If using a local address, ensure you\'re on the same network as Home Assistant',
      'Try accessing the URL directly in a web browser to verify it works',
    ],
    'websocket-blocked': [
      'WebSocket connections are being blocked by your network or a proxy',
      'If you\'re on a corporate or public WiFi, try using mobile data instead',
      'Check if you have a VPN running that might block WebSocket connections',
      'If using a reverse proxy (like nginx), ensure WebSocket upgrade is enabled',
      'Add these lines to your nginx config:\n  proxy_http_version 1.1;\n  proxy_set_header Upgrade $http_upgrade;\n  proxy_set_header Connection "upgrade";',
      'If using Cloudflare, ensure WebSockets are enabled in your dashboard',
    ],
    auth: [
      'Your access token may have expired or is invalid',
      'Go to Home Assistant → Profile → Security → Long-Lived Access Tokens',
      'Create a new token and try connecting again',
      'Make sure you copied the entire token without any extra spaces',
    ],
    'server-down': [
      'Home Assistant appears to be offline or not responding',
      'Check if Home Assistant is running on your server',
      'Try restarting Home Assistant from the command line or web interface',
      'Check the Home Assistant logs for any errors',
      'Verify the port number is correct (default is 8123)',
    ],
    unknown: [
      'An unexpected error occurred during connection',
      'Try the connection again - it may be a temporary issue',
      'Check the Home Assistant logs for more details',
      'Restart Home Assistant and try again',
      'If the problem persists, check the Home Assistant community forums',
    ],
  }
  return steps[errorType]
}

// Troubleshooting help content (rendered inside EditModal)
function TroubleshootingHelpContent({ errorType }: { errorType: ConnectionErrorType }) {
  const steps = getTroubleshootingSteps(errorType)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{getTroubleshootingTip(errorType)}</p>

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Things to try:</p>
        <ul className="space-y-3">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-sm">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-xs font-medium flex items-center justify-center">
                {index + 1}
              </span>
              <span className="text-foreground/90 whitespace-pre-wrap">{step}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

type DiagnosticStatus = 'idle' | 'checking' | 'success' | 'failed'

interface LiveDiagnosticState {
  show: boolean
  httpsStatus: DiagnosticStatus
  websocketStatus: DiagnosticStatus
  errorType?: ConnectionErrorType
}

// Component for showing live connection diagnostic details
function DiagnosticDetails({
  state,
  onRetry,
}: {
  state: LiveDiagnosticState
  onRetry: () => void
}) {
  const [showHelp, setShowHelp] = useState(false)
  const { httpsStatus, websocketStatus, errorType } = state
  const isComplete = httpsStatus !== 'checking' && websocketStatus !== 'checking'
  const hasFailed = httpsStatus === 'failed' || websocketStatus === 'failed'

  const getIcon = () => {
    if (!isComplete) return <Loader2 className="w-6 h-6 animate-spin" />
    if (!hasFailed) return <Check className="w-6 h-6" />
    switch (errorType) {
      case 'network':
      case 'server-down':
        return <ServerOff className="w-6 h-6" />
      case 'websocket-blocked':
      case 'auth':
        return <ShieldOff className="w-6 h-6" />
      default:
        return <AlertCircle className="w-6 h-6" />
    }
  }

  const getStatusDisplay = (status: DiagnosticStatus) => {
    switch (status) {
      case 'checking':
        return (
          <span className="flex items-center gap-1.5 text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking...
          </span>
        )
      case 'success':
        return (
          <span className="flex items-center gap-1.5 text-green-500">
            <Check className="w-4 h-4" />
            {t.connectionError?.statusOk || 'OK'}
          </span>
        )
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 text-red-500">
            <X className="w-4 h-4" />
            {t.connectionError?.statusFailed || 'Failed'}
          </span>
        )
      default:
        return <span className="text-muted">—</span>
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Error Header - only show when complete and failed */}
        {isComplete && hasFailed && errorType && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
          >
            <div className="text-red-500 flex-shrink-0">{getIcon()}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{getErrorMessage(errorType)}</p>
              <p className="text-sm text-muted mt-1">{getTroubleshootingTip(errorType)}</p>
              {/* Troubleshooting button */}
              <button
                onClick={() => setShowHelp(true)}
                className="text-xs text-muted hover:text-foreground underline underline-offset-2 transition-colors mt-2"
              >
                Troubleshooting
              </button>
            </div>
          </motion.div>
        )}

        {/* Diagnostic Details - show during checking and after */}
        <div className="p-4 bg-card border border-border rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            {!isComplete && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
            <p className="text-xs font-medium text-muted uppercase tracking-wide">
              {isComplete
                ? t.connectionError?.diagnosticDetails || 'Diagnostic Details'
                : 'Checking connection...'}
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted">
                {t.connectionError?.httpsStatus || 'Server reachable'}
              </span>
              {getStatusDisplay(httpsStatus)}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">
                {t.connectionError?.websocketStatus || 'WebSocket'}
              </span>
              {getStatusDisplay(websocketStatus)}
            </div>
          </div>
        </div>

        {/* Retry Button - only show when complete and failed */}
        {isComplete && hasFailed && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onRetry}
            className="w-full py-3 px-4 bg-accent/10 text-accent hover:bg-accent/20 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t.connectionError?.retry || 'Retry'}
          </motion.button>
        )}
      </motion.div>

      {/* Troubleshooting Help Modal */}
      {errorType && (
        <EditModal
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          title="Troubleshooting Help"
        >
          <TroubleshootingHelpContent errorType={errorType} />
        </EditModal>
      )}
    </>
  )
}

// Common HA URL patterns to try
const COMMON_URLS = [
  { url: 'http://homeassistant.local:8123', label: 'homeassistant.local' },
  { url: 'http://homeassistant:8123', label: 'homeassistant' },
  { url: 'http://192.168.1.1:8123', label: '192.168.1.1' },
  { url: 'http://localhost:8123', label: 'localhost' },
]

// Component for showing CORS config on web
function WebCorsConfig() {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://stuga.app'

  const configCode = `http:
  cors_allowed_origins:
    - ${origin}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(configCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers that don't support navigator.clipboard
      const textarea = document.createElement('textarea')
      textarea.value = configCode
      document.body.appendChild(textarea)
      textarea.select()
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="p-4 bg-card border border-border rounded-xl space-y-3">
      <p className="text-sm font-medium text-foreground">{t.setup.url.webSetupTitle}</p>
      <p className="text-sm text-muted">{t.setup.url.webSetupNote}</p>
      <div className="relative">
        <pre className="text-xs bg-background p-3 pr-10 rounded-lg overflow-x-auto font-mono text-foreground/80">
          {configCode}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-border/50 transition-colors text-muted hover:text-foreground"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export function SetupWizard() {
  const navigate = useNavigate()
  const { enableDevMode, setMockScenario } = useDevMode()
  const [step, setStep] = useState<Step>('welcome')
  const [url, setUrl] = useState(isNativeApp() ? '' : 'https://')
  const [token, setToken] = useState('')
  const [authMethod, setAuthMethod] = useState<AuthMethod>('oauth')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [liveDiagnostic, setLiveDiagnostic] = useState<LiveDiagnosticState>({
    show: false,
    httpsStatus: 'idle',
    websocketStatus: 'idle',
  })
  const [suggestions, setSuggestions] = useState<UrlSuggestion[]>([])
  const [isProbing, setIsProbing] = useState(false)
  const [urlVerified, setUrlVerified] = useState(false)
  const hasProbed = useRef(false)
  const userHasTyped = useRef(false)

  // Check if OAuth is available for current URL
  const oauthAvailable = isOAuthAvailable(url)

  // Auto-switch to token auth when OAuth becomes unavailable
  useEffect(() => {
    if (!oauthAvailable && authMethod === 'oauth') {
      setAuthMethod('token')
    }
  }, [oauthAvailable, authMethod])

  // Start demo mode with sample data
  const startDemo = useCallback(() => {
    enableDevMode()
    setMockScenario('apartment')
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate returns void but type includes Promise path
    navigate('/')
  }, [enableDevMode, setMockScenario, navigate])

  // Test WebSocket connection to HA (with shorter timeout for probing)
  const testConnection = useCallback(
    async (testUrl: string, testToken?: string, timeout = 10000): Promise<boolean> => {
      return new Promise((resolve) => {
        try {
          const wsUrl = testUrl.replace('http', 'ws') + '/api/websocket'
          const ws = new WebSocket(wsUrl)
          let resolved = false

          const cleanup = () => {
            if (!resolved) {
              resolved = true
              ws.close()
            }
          }

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data as string) as { type: string }

              if (data.type === 'auth_required') {
                if (testToken) {
                  // Authenticate
                  ws.send(
                    JSON.stringify({
                      type: 'auth',
                      access_token: testToken,
                    })
                  )
                } else {
                  // Just testing URL, connection works
                  resolved = true
                  ws.close()
                  resolve(true)
                }
              } else if (data.type === 'auth_ok') {
                resolved = true
                ws.close()
                resolve(true)
              } else if (data.type === 'auth_invalid') {
                resolved = true
                ws.close()
                resolve(false)
              }
            } catch (e) {
              logger.warn('SetupWizard', 'WebSocket message parse error:', e)
            }
          }

          ws.onerror = () => {
            cleanup()
            resolve(false)
          }

          ws.onclose = () => {
            if (!resolved) {
              resolve(false)
            }
          }

          // Timeout
          setTimeout(() => {
            if (!resolved) {
              cleanup()
              resolve(false)
            }
          }, timeout)
        } catch (e) {
          logger.warn('SetupWizard', 'Connection test failed:', e)
          resolve(false)
        }
      })
    },
    []
  )

  // Probe common URLs when entering URL step (only on native apps - local URLs don't work on web)
  const probeUrls = useCallback(async () => {
    // Skip probing on web - local addresses won't work due to mixed content/CORS
    if (!isNativeApp()) return

    if (hasProbed.current) return
    hasProbed.current = true
    setIsProbing(true)

    // Initialize suggestions with checking status
    const initialSuggestions = COMMON_URLS.map((u) => ({
      ...u,
      status: 'checking' as UrlStatus,
    }))
    setSuggestions(initialSuggestions)

    // Probe all URLs in parallel with shorter timeout
    const results = await Promise.all(
      COMMON_URLS.map(async ({ url, label }) => {
        const success = await testConnection(url, undefined, 3000)
        return { url, label, status: success ? 'success' : 'failed' } as UrlSuggestion
      })
    )

    setSuggestions(results)
    setIsProbing(false)

    // Auto-fill the first successful URL only if user hasn't started typing
    const firstSuccess = results.find((r) => r.status === 'success')
    if (firstSuccess && !userHasTyped.current) {
      setUrl(firstSuccess.url)
    }
  }, [testConnection])

  // Start probing immediately on welcome screen (native only)
  // This gives us a head start so results are ready when user clicks "Get Started"
  useEffect(() => {
    if (isNativeApp() && step === 'welcome') {
      void probeUrls()
    }
  }, [probeUrls, step])

  // Verify the URL is reachable (called on blur or when user clicks connect)
  const verifyUrl = useCallback(
    async (urlToVerify: string): Promise<boolean> => {
      // Normalize URL
      let normalizedUrl = urlToVerify.trim()
      if (!normalizedUrl.startsWith('http')) {
        normalizedUrl = 'http://' + normalizedUrl
      }
      normalizedUrl = normalizedUrl.replace(/\/+$/, '')

      const success = await testConnection(normalizedUrl)

      if (success) {
        setUrl(normalizedUrl)
        setUrlVerified(true)
        setError(null)
        return true
      } else {
        setUrlVerified(false)
        return false
      }
    },
    [testConnection]
  )

  // Run live diagnostics with progress updates
  const runLiveDiagnostics = useCallback(async (testUrl: string): Promise<DiagnosticResult> => {
    void log('Setup: Running connection diagnostics')

    // Show diagnostic panel
    setLiveDiagnostic({
      show: true,
      httpsStatus: 'checking',
      websocketStatus: 'idle',
    })

    // Test HTTPS first
    const httpsOk = await testHttpsReachable(testUrl)
    setLiveDiagnostic((prev) => ({
      ...prev,
      httpsStatus: httpsOk ? 'success' : 'failed',
      websocketStatus: httpsOk ? 'checking' : 'idle',
    }))

    if (!httpsOk) {
      const result: DiagnosticResult = {
        httpsReachable: false,
        websocketReachable: false,
        authValid: false,
        errorType: 'network',
        timestamp: Date.now(),
      }
      setLiveDiagnostic((prev) => ({ ...prev, errorType: 'network' }))
      // Log to Crashlytics
      void logSetupDiagnostic(result, testUrl)
      return result
    }

    // Test WebSocket
    const wsOk = await testConnection(testUrl, undefined, 8000)
    const errorType: ConnectionErrorType = wsOk ? 'unknown' : 'websocket-blocked'
    setLiveDiagnostic((prev) => ({
      ...prev,
      websocketStatus: wsOk ? 'success' : 'failed',
      errorType: wsOk ? undefined : errorType,
    }))

    const result: DiagnosticResult = {
      httpsReachable: true,
      websocketReachable: wsOk,
      authValid: false, // Not tested yet
      errorType,
      timestamp: Date.now(),
    }

    // Log to Crashlytics if failed
    if (!wsOk) {
      void logSetupDiagnostic(result, testUrl)
    }

    return result
  }, [testConnection])

  // Log diagnostic result to Crashlytics
  const logSetupDiagnostic = async (result: DiagnosticResult, testUrl: string) => {
    let hostname = 'unknown'
    try {
      hostname = new URL(testUrl).hostname
    } catch {
      // Invalid URL
    }

    await setCustomKey('setup_error_type', result.errorType)
    await setCustomKey('setup_https_reachable', result.httpsReachable)
    await setCustomKey('setup_websocket_reachable', result.websocketReachable)
    await setCustomKey('setup_ha_hostname', hostname)

    const error = new Error(`Setup connection failed: ${result.errorType}`)
    await logError(error, 'setup-diagnostic')
  }

  // Simple HTTPS reachability test
  const testHttpsReachable = async (testUrl: string): Promise<boolean> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)
      const response = await fetch(`${testUrl}/api/`, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      // 401/403 means server is reachable but needs auth
      return response.status === 401 || response.status === 200 || response.status === 403
    } catch {
      return false
    }
  }

  // Handle connect button click
  const handleConnect = async () => {
    // Check for demo mode
    if (url.toLowerCase().trim() === 'demo') {
      startDemo()
      return
    }

    setIsLoading(true)
    setError(null)
    setLiveDiagnostic({ show: false, httpsStatus: 'idle', websocketStatus: 'idle' })

    // Normalize URL
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'http://' + normalizedUrl
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, '')

    // First verify URL if not already verified
    if (!urlVerified) {
      // Start a timer - show diagnostics after 500ms if still connecting
      let showDiagnosticsTimer: ReturnType<typeof setTimeout> | null = null
      let diagnosticPromise: Promise<DiagnosticResult> | null = null

      // Run connection test
      const connectionPromise = testConnection(normalizedUrl, undefined, 10000)

      // After 500ms, start showing live diagnostics
      showDiagnosticsTimer = setTimeout(() => {
        diagnosticPromise = runLiveDiagnostics(normalizedUrl)
      }, 500)

      const connected = await connectionPromise

      // Clear the timer if connection completed quickly
      if (showDiagnosticsTimer) {
        clearTimeout(showDiagnosticsTimer)
      }

      if (connected) {
        // Success! Hide diagnostics and proceed
        setLiveDiagnostic({ show: false, httpsStatus: 'idle', websocketStatus: 'idle' })
        setUrl(normalizedUrl)
        setUrlVerified(true)
      } else {
        // Connection failed - if diagnostics already started, wait for them
        if (diagnosticPromise) {
          await diagnosticPromise
        } else {
          // Diagnostics didn't start (failed within 500ms), run them now
          await runLiveDiagnostics(normalizedUrl)
        }
        setIsLoading(false)
        return
      }
    }

    // Now authenticate based on selected method
    if (authMethod === 'oauth') {
      await handleOAuthLogin()
    } else {
      await handleTokenSubmit()
    }
  }

  // Retry connection after diagnostic
  const handleRetryConnection = useCallback(() => {
    setLiveDiagnostic({ show: false, httpsStatus: 'idle', websocketStatus: 'idle' })
    setError(null)
    setUrlVerified(false)
  }, [])

  const handleOAuthLogin = async () => {
    try {
      if (isNativeApp()) {
        // On native, use in-app browser for OAuth (works for both HTTP and HTTPS)
        const result = await authenticateWithInAppBrowser(url)

        if (!result.success) {
          throw new Error(result.error || 'Authentication failed')
        }

        if (!result.tokens) {
          throw new Error('No tokens received')
        }

        logger.debug('OAuth', 'Storing credentials for URL:', url)
        await storeOAuthCredentials(url, {
          access_token: result.tokens.access_token,
          refresh_token: result.tokens.refresh_token,
          expires_in: result.tokens.expires_in,
          token_type: 'Bearer',
        })
        logger.debug('OAuth', 'Credentials stored successfully')

        // Navigate to home
        void navigate('/', { replace: true })
      } else {
        // On web, use redirect-based OAuth flow
        const verifier = generateCodeVerifier()
        const challenge = await generateCodeChallenge(verifier)
        const state = generateState()

        // Store pending OAuth data for validation after redirect
        await storePendingOAuth(state, verifier, url)

        // Build and redirect to authorization URL
        const params = new URLSearchParams({
          client_id: getClientId(url),
          redirect_uri: getRedirectUri(url),
          state,
          response_type: 'code',
          code_challenge: challenge,
          code_challenge_method: 'S256',
        })

        window.location.href = `${url}/auth/authorize?${params.toString()}`
      }
    } catch (err) {
      logger.error('OAuth', 'Failed:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage || t.setup.oauth?.startError || 'Failed to start authentication')
      setIsLoading(false)
    }
  }

  const handleTokenSubmit = async () => {
    const success = await testConnection(url, token.trim())

    setIsLoading(false)

    if (success) {
      await saveCredentials(url, token.trim())
      setStep('complete')
    } else {
      setError(t.setup.token.error)
    }
  }

  const handleComplete = () => {
    void navigate('/')
  }

  const slideVariants = {
    enter: { x: 50, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -50, opacity: 0 },
  }

  return (
    <div className="flex-1 bg-background flex items-center justify-center p-6 overflow-hidden relative">
      {/* Subtle glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Primary warm glow - center */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'rgba(196, 167, 125, 0.12)',
            filter: 'blur(100px)',
          }}
        />
        {/* Secondary subtle glow - bottom right */}
        <div
          className="absolute bottom-0 right-0 w-[350px] h-[350px] rounded-full translate-x-1/4 translate-y-1/4"
          style={{
            background: 'rgba(212, 165, 116, 0.08)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        <AnimatePresence mode="wait">
          {/* Welcome Step */}
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="text-center"
            >
              <div className="mb-10">
                {/* Logo with subtle glow */}
                <div className="relative inline-block mb-8">
                  <div className="absolute inset-0 blur-2xl bg-accent/20 scale-150" />
                  <img
                    src="/icon.png"
                    alt="Stuga"
                    width={120}
                    height={180}
                    className="relative mx-auto drop-shadow-lg"
                  />
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-3">{t.setup.welcome.title}</h1>
                <p className="text-muted text-lg">{t.setup.welcome.subtitle}</p>
              </div>

              <button
                onClick={() => {
                  setStep('connect')
                }}
                className="w-full py-4 px-6 bg-accent text-warm-brown rounded-xl text-lg font-semibold flex items-center justify-center gap-2 hover:bg-brass-hover transition-colors touch-feedback btn-accent-glow"
              >
                {t.setup.welcome.getStarted}
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* Connect Step - Combined URL + Auth Method */}
          {step === 'connect' && (
            <motion.div
              key="connect"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">{t.setup.url.title}</h2>
              <p className="text-muted mb-6">{t.setup.url.hint}</p>

              <div className="space-y-6">
                {/* URL Input */}
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="ha-url"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      {t.setup.url.label}
                    </label>
                    <input
                      id="ha-url"
                      type="url"
                      value={url}
                      onChange={(e) => {
                        userHasTyped.current = true
                        setUrl(e.target.value)
                        setUrlVerified(false)
                        setError(null)
                      }}
                      onBlur={() => {
                        if (url.trim()) {
                          void verifyUrl(url)
                        }
                      }}
                      placeholder={
                        isNativeApp()
                          ? t.setup.url.placeholder
                          : t.setup.url.placeholderWeb || t.setup.url.placeholder
                      }
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                      autoComplete="url"
                    />
                    <p className="mt-2 text-xs text-muted">
                      {isNativeApp() ? t.setup.url.hint : t.setup.url.hintWeb || t.setup.url.hint}
                    </p>
                  </div>

                  {/* Web-only warning when user enters non-HTTPS URL */}
                  <AnimatePresence>
                    {!isNativeApp() && url && !url.trim().toLowerCase().startsWith('https://') && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
                          <p className="text-sm text-foreground/90 font-medium">
                            {t.setup.url.webNote}
                          </p>
                          <p className="text-sm text-muted">{t.setup.url.webNoteApps}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Web setup instructions - always shown on web */}
                  {!isNativeApp() && <WebCorsConfig />}

                  {/* URL Suggestions - only shown on native apps (local URLs don't work on web) */}
                  {isNativeApp() && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted uppercase tracking-wide">
                        {isProbing ? t.setup.url.scanning : t.setup.url.commonUrls}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {suggestions.map((suggestion) => (
                          <button
                            key={suggestion.url}
                            onClick={() => {
                              setUrl(suggestion.url)
                              if (suggestion.status === 'success') {
                                setUrlVerified(true)
                              }
                              setError(null)
                            }}
                            disabled={suggestion.status === 'checking'}
                            className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all
                            ${
                              url === suggestion.url
                                ? 'bg-accent/20 ring-2 ring-accent'
                                : suggestion.status === 'success'
                                  ? 'bg-green-500/10 hover:bg-green-500/20 ring-1 ring-green-500/30'
                                  : suggestion.status === 'failed'
                                    ? 'bg-border/30 text-muted'
                                    : 'bg-border/50'
                            }
                          `}
                          >
                            {/* Status indicator */}
                            <div className="flex-shrink-0">
                              {suggestion.status === 'checking' ? (
                                <Loader2 className="w-4 h-4 animate-spin text-muted" />
                              ) : suggestion.status === 'success' ? (
                                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 text-white" />
                                </div>
                              ) : suggestion.status === 'failed' ? (
                                <div className="w-4 h-4 rounded-full bg-border flex items-center justify-center">
                                  <X className="w-2.5 h-2.5 text-muted" />
                                </div>
                              ) : (
                                <Wifi className="w-4 h-4 text-muted" />
                              )}
                            </div>
                            <span
                              className={`truncate ${suggestion.status === 'success' ? 'text-foreground font-medium' : ''}`}
                            >
                              {suggestion.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Token Input - shown when token auth is selected */}
                <AnimatePresence>
                  {authMethod === 'token' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted uppercase tracking-wide">
                            {t.setup.authMethod?.token || 'Access Token'}
                          </p>
                          <button
                            onClick={() => {
                              setAuthMethod('oauth')
                              setToken('')
                            }}
                            className="text-xs text-accent hover:underline"
                          >
                            {t.setup.authMethod?.useOAuthInstead || 'Use login instead'}
                          </button>
                        </div>
                        <p className="text-sm text-muted">
                          <a
                            href={url ? `${url}/profile/security` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline inline-flex items-center gap-1"
                          >
                            {t.setup.token.goToProfile}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>{' '}
                          {t.setup.token.hint}
                        </p>
                        <textarea
                          id="ha-token"
                          value={token}
                          onChange={(e) => {
                            setToken(e.target.value)
                            setError(null)
                          }}
                          placeholder={t.setup.token.placeholder}
                          rows={3}
                          className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors resize-none font-mono text-sm"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Live Connection Diagnostic Details */}
                <AnimatePresence>
                  {liveDiagnostic.show && (
                    <DiagnosticDetails state={liveDiagnostic} onRetry={handleRetryConnection} />
                  )}
                </AnimatePresence>

                {/* Simple error message (for non-diagnostic errors like OAuth failures) */}
                {error && !liveDiagnostic.show && (
                  <div className="flex items-center gap-2 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setStep('welcome')
                    }}
                    disabled={isLoading}
                    aria-label={t.common.back}
                    className="py-4 px-4 bg-card border border-border text-foreground rounded-xl font-medium flex items-center justify-center hover:bg-border/30 transition-colors touch-feedback disabled:opacity-50"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleConnect}
                    disabled={!url.trim() || (authMethod === 'token' && !token.trim()) || isLoading}
                    className="flex-1 py-4 px-6 bg-accent text-warm-brown rounded-xl text-lg font-semibold flex items-center justify-center gap-2 hover:bg-brass-hover transition-colors touch-feedback btn-accent-glow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {t.setup.token.authenticate}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Advanced section - shown when OAuth is selected */}
                <AnimatePresence>
                  {authMethod === 'oauth' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, delay: 0.1 }}
                      className="pt-4 border-t border-border/50"
                    >
                      <button
                        onClick={() => setAuthMethod('token')}
                        disabled={isLoading}
                        className="w-full py-3 px-4 text-sm text-muted hover:text-foreground hover:bg-card/50 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Key className="w-4 h-4" />
                        {t.setup.authMethod?.advancedToken || 'Connect with access token'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <motion.div
              key="complete"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="text-center"
            >
              <div className="mb-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {t.setup.complete.title}
                </h2>
                <p className="text-muted">{t.setup.complete.subtitle}</p>
              </div>

              <button
                onClick={handleComplete}
                className="w-full py-4 px-6 bg-accent text-warm-brown rounded-xl text-lg font-semibold flex items-center justify-center gap-2 hover:bg-brass-hover transition-colors touch-feedback btn-accent-glow"
              >
                {t.setup.complete.goToDashboard}
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
