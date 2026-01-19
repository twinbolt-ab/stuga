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
  LogIn,
  Key,
} from 'lucide-react'
import { saveCredentials } from '@/lib/config'
import { t } from '@/lib/i18n'
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

// Common HA URL patterns to try
const COMMON_URLS = [
  { url: 'http://homeassistant.local:8123', label: 'homeassistant.local' },
  { url: 'http://homeassistant:8123', label: 'homeassistant' },
  { url: 'http://192.168.1.1:8123', label: '192.168.1.1' },
  { url: 'http://localhost:8123', label: 'localhost' },
]

export function SetupWizard() {
  const navigate = useNavigate()
  const { enableDevMode, setMockScenario } = useDevMode()
  const [step, setStep] = useState<Step>('welcome')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [authMethod, setAuthMethod] = useState<AuthMethod>('oauth')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  // Probe common URLs when entering URL step
  const probeUrls = useCallback(async () => {
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

  // Start probing when entering connect step
  useEffect(() => {
    if (step === 'connect') {
      void probeUrls()
    }
  }, [step, probeUrls])

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

  // Handle connect button click
  const handleConnect = async () => {
    // Check for demo mode
    if (url.toLowerCase().trim() === 'demo') {
      startDemo()
      return
    }

    setIsLoading(true)
    setError(null)

    // First verify URL if not already verified
    if (!urlVerified) {
      const urlValid = await verifyUrl(url)
      if (!urlValid) {
        setError(t.setup.url.error)
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
      void saveCredentials(url, token.trim())
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
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary warm glow - center */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-accent/[0.07] dark:bg-accent/[0.05] blur-[100px]" />
        {/* Secondary subtle glow - bottom right */}
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-amber/[0.04] dark:bg-amber/[0.03] blur-[80px] translate-x-1/4 translate-y-1/4" />
        {/* Tertiary subtle glow - top left */}
        <div className="absolute top-0 left-0 w-[250px] h-[250px] rounded-full bg-accent/[0.04] dark:bg-accent/[0.03] blur-[60px] -translate-x-1/4 -translate-y-1/4" />
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
                      placeholder={t.setup.url.placeholder}
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                      autoComplete="url"
                    />
                  </div>

                  {/* URL Suggestions */}
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
                </div>

                {/* Auth Method Selection */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">
                    {t.setup.authMethod?.title || 'Login method'}
                  </p>

                  {/* OAuth Option */}
                  <button
                    onClick={() => oauthAvailable && setAuthMethod('oauth')}
                    disabled={isLoading || !oauthAvailable}
                    className={`w-full p-4 bg-card rounded-xl flex items-start gap-4 transition-colors touch-feedback disabled:opacity-50 ${
                      authMethod === 'oauth'
                        ? 'border-2 border-accent'
                        : 'border border-border hover:bg-border/30'
                    } ${!oauthAvailable ? 'cursor-not-allowed' : ''}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        authMethod === 'oauth' ? 'bg-accent/15' : 'bg-border/50'
                      }`}
                    >
                      <LogIn
                        className={`w-5 h-5 ${authMethod === 'oauth' ? 'text-accent' : 'text-muted'}`}
                      />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-medium text-foreground flex items-center gap-2">
                        {t.setup.authMethod?.oauth || 'Login with Home Assistant'}
                        {oauthAvailable && (
                          <span className="text-xs text-accent font-medium">
                            {t.setup.authMethod?.recommended || 'Recommended'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted mt-1">
                        {!oauthAvailable
                          ? t.setup.authMethod?.oauthHttpDisabled || 'Requires HTTPS connection'
                          : t.setup.authMethod?.oauthHint ||
                            'Use your existing Home Assistant account'}
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        authMethod === 'oauth' ? 'border-accent bg-accent' : 'border-border'
                      }`}
                    >
                      {authMethod === 'oauth' && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>

                  {/* Token Option */}
                  <button
                    onClick={() => setAuthMethod('token')}
                    disabled={isLoading}
                    className={`w-full p-4 bg-card rounded-xl flex items-start gap-4 transition-colors touch-feedback disabled:opacity-50 ${
                      authMethod === 'token'
                        ? 'border-2 border-accent'
                        : 'border border-border hover:bg-border/30'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        authMethod === 'token' ? 'bg-accent/15' : 'bg-border/50'
                      }`}
                    >
                      <Key
                        className={`w-5 h-5 ${authMethod === 'token' ? 'text-accent' : 'text-muted'}`}
                      />
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-medium text-foreground">
                        {t.setup.authMethod?.token || 'Use access token'}
                      </div>
                      <p className="text-sm text-muted mt-1">
                        {t.setup.authMethod?.tokenHint ||
                          'Enter a long-lived access token manually'}
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        authMethod === 'token' ? 'border-accent bg-accent' : 'border-border'
                      }`}
                    >
                      {authMethod === 'token' && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>

                  {/* Token Input - shown when token auth is selected */}
                  {authMethod === 'token' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2 space-y-3">
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
                </div>

                {error && (
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
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {authMethod === 'oauth'
                          ? t.setup.url.testing
                          : t.setup.token.authenticating}
                      </>
                    ) : (
                      <>
                        {t.setup.token.authenticate}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
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
