import { useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { saveCredentials } from '@/lib/config'
import { useKeyboardHeight } from '@/lib/hooks/useKeyboardHeight'
import { t } from '@/lib/i18n'
import { type ConnectionErrorType, type DiagnosticResult } from '@/lib/connection-diagnostics'
import { logError, setCustomKey, log } from '@/lib/crashlytics'
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
import { type Step, type AuthMethod, type UrlSuggestion, type LiveDiagnosticState } from './types'
import { COMMON_URLS, getUrlVariants, isOAuthAvailable } from './url-utils'
import { WelcomeStep } from './WelcomeStep'
import { ConnectStep } from './ConnectStep'
import { CompleteStep } from './CompleteStep'

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
  const [workingUrls, setWorkingUrls] = useState<string[]>([])
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const keyboardOffset = useKeyboardHeight()
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
      status: 'checking' as const,
    }))
    setSuggestions(initialSuggestions)

    // Probe all URLs in parallel with shorter timeout
    const results = await Promise.all(
      COMMON_URLS.map(async ({ url, label }) => {
        const success = await testConnection(url, undefined, 3000)
        const status: 'success' | 'failed' = success ? 'success' : 'failed'
        return { url, label, status }
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

  // Run live diagnostics with progress updates
  const runLiveDiagnostics = useCallback(
    async (testUrl: string): Promise<DiagnosticResult> => {
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
    },
    [testConnection]
  )

  const handleOAuthLogin = async (urlToUse?: string) => {
    const haUrl = urlToUse || url
    try {
      if (isNativeApp()) {
        // On native, use in-app browser for OAuth (works for both HTTP and HTTPS)
        const result = await authenticateWithInAppBrowser(haUrl)

        if (!result.success) {
          throw new Error(result.error || 'Authentication failed')
        }

        if (!result.tokens) {
          throw new Error('No tokens received')
        }

        logger.debug('OAuth', 'Storing credentials for URL:', haUrl)
        await storeOAuthCredentials(haUrl, {
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
        await storePendingOAuth(state, verifier, haUrl)

        // Build and redirect to authorization URL
        const params = new URLSearchParams({
          client_id: getClientId(haUrl),
          redirect_uri: getRedirectUri(haUrl),
          state,
          response_type: 'code',
          code_challenge: challenge,
          code_challenge_method: 'S256',
        })

        window.location.href = `${haUrl}/auth/authorize?${params.toString()}`
      }
    } catch (err) {
      logger.error('OAuth', 'Failed:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage || t.setup.oauth?.startError || 'Failed to start authentication')
      setIsLoading(false)
    }
  }

  const handleTokenSubmit = async (urlToUse?: string) => {
    const haUrl = urlToUse || url
    const success = await testConnection(haUrl, token.trim())

    setIsLoading(false)

    if (success) {
      await saveCredentials(haUrl, token.trim())
      setStep('complete')
    } else {
      setError(t.setup.token.error)
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
    setWorkingUrls([])
    setSelectedUrl(null)
    setLiveDiagnostic({ show: false, httpsStatus: 'idle', websocketStatus: 'idle' })

    // Generate URL variants to try (handles missing protocol, protocol switching, and port variations)
    const urlVariants = getUrlVariants(url)

    // First verify URL if not already verified
    if (!urlVerified) {
      const primaryUrl = urlVariants[0]

      // First, try the user's URL (with protocol added if needed)
      const primaryWorks = await testConnection(primaryUrl, undefined, 5000)

      if (primaryWorks) {
        // User's URL works - proceed directly without showing alternatives
        setUrl(primaryUrl)
        setUrlVerified(true)

        if (authMethod === 'oauth') {
          await handleOAuthLogin(primaryUrl)
        } else {
          await handleTokenSubmit(primaryUrl)
        }
        return
      }

      // User's URL failed - try all alternative variants in parallel
      const alternativeVariants = urlVariants.slice(1)

      if (alternativeVariants.length > 0) {
        const results = await Promise.all(
          alternativeVariants.map(async (testUrl) => ({
            url: testUrl,
            works: await testConnection(testUrl, undefined, 5000),
          }))
        )

        const foundUrls = results.filter((r) => r.works).map((r) => r.url)

        if (foundUrls.length > 0) {
          // Found working alternatives - show selection
          setWorkingUrls(foundUrls)
          setSelectedUrl(foundUrls[0])
          setIsLoading(false)
          return
        }
      }

      // No URLs work - run diagnostics on the primary URL
      await runLiveDiagnostics(primaryUrl)
      setIsLoading(false)
      return
    }

    // URL already verified, authenticate with current url state
    if (authMethod === 'oauth') {
      await handleOAuthLogin()
    } else {
      await handleTokenSubmit()
    }
  }

  // Handle user selecting a URL and connecting
  const handleSelectUrlAndConnect = async () => {
    if (!selectedUrl) return

    setUrl(selectedUrl)
    setUrlVerified(true)
    setWorkingUrls([])
    setIsLoading(true)

    // Authenticate with the selected URL (pass directly since state update is async)
    if (authMethod === 'oauth') {
      await handleOAuthLogin(selectedUrl)
    } else {
      await handleTokenSubmit(selectedUrl)
    }
  }

  // Handle user wanting to try again with different input
  const handleTryAgain = () => {
    setWorkingUrls([])
    setSelectedUrl(null)
    setUrlVerified(false)
  }

  // Retry connection after diagnostic
  const handleRetryConnection = useCallback(() => {
    setLiveDiagnostic({ show: false, httpsStatus: 'idle', websocketStatus: 'idle' })
    setError(null)
    setUrlVerified(false)
  }, [])

  const handleUrlChange = (newUrl: string) => {
    userHasTyped.current = true
    setUrl(newUrl)
    setUrlVerified(false)
    setError(null)
  }

  const handleTokenChange = (newToken: string) => {
    setToken(newToken)
    setError(null)
  }

  const handleUrlVerified = (selectedUrl: string, verified: boolean) => {
    setUrl(selectedUrl)
    if (verified) {
      setUrlVerified(true)
    }
    setError(null)
  }

  const handleComplete = () => {
    void navigate('/')
  }

  return (
    <div className="flex-1 bg-background flex flex-col items-center justify-start p-6 overflow-y-auto relative">
      {/* Subtle glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
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

      {/* Spacer to help center content vertically when there's room */}
      <div className="flex-1 min-h-8" />

      <div className="w-full max-w-md relative z-10">
        <AnimatePresence mode="wait">
          {step === 'welcome' && <WelcomeStep onNext={() => setStep('connect')} />}

          {step === 'connect' && (
            <ConnectStep
              url={url}
              token={token}
              authMethod={authMethod}
              isLoading={isLoading}
              error={error}
              suggestions={suggestions}
              isProbing={isProbing}
              liveDiagnostic={liveDiagnostic}
              workingUrls={workingUrls}
              selectedUrl={selectedUrl}
              keyboardOffset={keyboardOffset}
              onUrlChange={handleUrlChange}
              onTokenChange={handleTokenChange}
              onAuthMethodChange={setAuthMethod}
              onConnect={handleConnect}
              onBack={() => setStep('welcome')}
              onRetryConnection={handleRetryConnection}
              onSelectWorkingUrl={setSelectedUrl}
              onSelectAndConnect={handleSelectUrlAndConnect}
              onTryAgain={handleTryAgain}
              onVerifyUrl={verifyUrl}
              onUrlVerified={handleUrlVerified}
            />
          )}

          {step === 'complete' && <CompleteStep onComplete={handleComplete} />}
        </AnimatePresence>
      </div>

      {/* Spacer to help center content vertically when there's room.
          When the keyboard is up, expand it so the form can scroll above the keyboard. */}
      <div
        className="flex-1 min-h-8 flex-shrink-0"
        style={keyboardOffset > 0 ? { minHeight: keyboardOffset + 32 } : undefined}
      />
    </div>
  )
}
