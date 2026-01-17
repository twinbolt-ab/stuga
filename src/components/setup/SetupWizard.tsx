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
} from '@/lib/ha-oauth'
import { OAuth2Client } from '@byteowls/capacitor-oauth2'
import type { OAuthTokens } from '@/lib/ha-oauth'

// Type for OAuth2Client response with access token
interface OAuth2Response {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  authorization_response?: {
    code?: string
    code_verifier?: string
  }
}
import { logger } from '@/lib/logger'

type Step = 'welcome' | 'url' | 'auth-method' | 'token' | 'complete'

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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<UrlSuggestion[]>([])
  const [isProbing, setIsProbing] = useState(false)
  const hasProbed = useRef(false)

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

    // Auto-fill the first successful URL
    const firstSuccess = results.find((r) => r.status === 'success')
    if (firstSuccess && !url) {
      setUrl(firstSuccess.url)
    }
  }, [testConnection, url])

  // Start probing when entering URL step
  useEffect(() => {
    if (step === 'url') {
      void probeUrls()
    }
  }, [step, probeUrls])

  const handleUrlSubmit = async () => {
    setIsLoading(true)
    setError(null)

    // Normalize URL
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'http://' + normalizedUrl
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, '')

    const success = await testConnection(normalizedUrl)

    setIsLoading(false)

    if (success) {
      setUrl(normalizedUrl)
      setStep('auth-method')
    } else {
      setError(t.setup.url.error)
    }
  }

  const handleOAuthLogin = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (isNativeApp()) {
        // On native, use OAuth2Client plugin which handles the browser + deep link
        // client_id must be the website with <link rel="redirect_uri"> tag
        const clientId = 'https://stuga.app/oauth'

        // Check if using HTTPS - AppAuth library requires HTTPS for token endpoint
        const isHttps = url.startsWith('https://')

        if (isHttps) {
          // Use OAuth2Client plugin for HTTPS (handles everything automatically)
          const response = (await OAuth2Client.authenticate({
            authorizationBaseUrl: `${url}/auth/authorize`,
            accessTokenEndpoint: `${url}/auth/token`,
            scope: '',
            pkceEnabled: true,
            logsEnabled: true,
            web: {
              appId: clientId,
              responseType: 'code',
              redirectUrl: `${window.location.origin}/auth/callback`,
            },
            android: {
              appId: clientId,
              responseType: 'code',
              redirectUrl: 'com.twinbolt.stuga:/',
              handleResultOnNewIntent: true,
              handleResultOnActivityResult: true,
            },
            ios: {
              appId: clientId,
              responseType: 'code',
              redirectUrl: 'com.twinbolt.stuga:/',
            },
          })) as OAuth2Response

          // Store the tokens
          logger.debug(
            'OAuth',
            'HTTPS response received, has access_token:',
            !!response.access_token
          )
          if (response.access_token) {
            logger.debug('OAuth', 'Storing credentials for URL:', url)
            await storeOAuthCredentials(url, {
              access_token: response.access_token,
              refresh_token: response.refresh_token ?? '',
              expires_in: response.expires_in ?? 1800,
              token_type: 'Bearer',
            })
            logger.debug('OAuth', 'Credentials stored successfully')

            // Navigate to home
            void navigate('/', { replace: true })
          } else {
            throw new Error('No access token received')
          }
        } else {
          // For HTTP (local HA), use OAuth2Client for auth only, then manual token exchange
          // AppAuth doesn't support HTTP token endpoints, so we handle that ourselves
          const response = (await OAuth2Client.authenticate({
            authorizationBaseUrl: `${url}/auth/authorize`,
            // Don't set accessTokenEndpoint - we'll do the token exchange manually
            scope: '',
            pkceEnabled: true,
            logsEnabled: true,
            web: {
              appId: clientId,
              responseType: 'code',
              redirectUrl: `${window.location.origin}/auth/callback`,
            },
            android: {
              appId: clientId,
              responseType: 'code',
              redirectUrl: 'com.twinbolt.stuga:/',
              handleResultOnNewIntent: true,
              handleResultOnActivityResult: true,
            },
            ios: {
              appId: clientId,
              responseType: 'code',
              redirectUrl: 'com.twinbolt.stuga:/',
            },
          })) as OAuth2Response

          // We should get back the authorization code
          const authCode = response.authorization_response?.code
          const codeVerifier = response.authorization_response?.code_verifier

          if (!authCode) {
            throw new Error('No authorization code received')
          }

          // Manually exchange the code for tokens via fetch (works with HTTP)
          const tokenBody = new URLSearchParams({
            grant_type: 'authorization_code',
            code: authCode,
            client_id: clientId,
          })
          if (codeVerifier) {
            tokenBody.set('code_verifier', codeVerifier)
          }

          const tokenResponse = await fetch(`${url}/auth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: tokenBody.toString(),
          })

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text()
            throw new Error(`Token exchange failed: ${errorText}`)
          }

          const tokens = (await tokenResponse.json()) as OAuthTokens

          logger.debug('OAuth', 'HTTP tokens received, expires_in:', tokens.expires_in)
          logger.debug('OAuth', 'Storing credentials for URL:', url)
          await storeOAuthCredentials(url, {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in ?? 1800,
            token_type: 'Bearer',
          })
          logger.debug('OAuth', 'Credentials stored successfully')

          // Navigate to home
          void navigate('/', { replace: true })
        }
      } else {
        // On web, use manual redirect flow
        // Generate PKCE values manually for web
        const array = new Uint8Array(32)
        crypto.getRandomValues(array)
        const verifier = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
        const encoder = new TextEncoder()
        const data = encoder.encode(verifier)
        const hashed = await crypto.subtle.digest('SHA-256', data)
        const bytes = new Uint8Array(hashed)
        let binary = ''
        for (const byte of bytes) {
          binary += String.fromCharCode(byte)
        }
        const challenge = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

        const stateArray = new Uint8Array(16)
        crypto.getRandomValues(stateArray)
        const state = Array.from(stateArray, (byte) => byte.toString(16).padStart(2, '0')).join('')

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
    setIsLoading(true)
    setError(null)

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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
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
              <div className="mb-8">
                <img
                  src="/icon.png"
                  alt="Stuga"
                  width={120}
                  height={180}
                  className="mx-auto mb-6"
                />
                <h1 className="text-3xl font-bold text-foreground mb-2">{t.setup.welcome.title}</h1>
                <p className="text-muted">{t.setup.welcome.subtitle}</p>
              </div>

              <button
                onClick={() => {
                  setStep('url')
                }}
                className="w-full py-4 px-6 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors touch-feedback"
              >
                {t.setup.welcome.getStarted}
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={startDemo}
                className="mt-6 text-sm text-muted hover:text-accent transition-colors underline underline-offset-2"
              >
                {t.setup.welcome.tryDemo}
              </button>
            </motion.div>
          )}

          {/* URL Step */}
          {step === 'url' && (
            <motion.div
              key="url"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">{t.setup.url.title}</h2>
              <p className="text-muted mb-6">{t.setup.url.hint}</p>

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
                      setUrl(e.target.value)
                      setError(null)
                    }}
                    placeholder={t.setup.url.placeholder}
                    className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                    autoFocus
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

                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

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
                    onClick={handleUrlSubmit}
                    disabled={!url.trim() || isLoading}
                    className="flex-1 py-4 px-6 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors touch-feedback disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t.setup.url.testing}
                      </>
                    ) : (
                      <>
                        {t.setup.url.testConnection}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Auth Method Step */}
          {step === 'auth-method' && (
            <motion.div
              key="auth-method"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t.setup.authMethod?.title || 'Choose login method'}
              </h2>
              <p className="text-muted mb-6">
                {t.setup.authMethod?.subtitle || 'How would you like to authenticate?'}
              </p>

              <div className="space-y-3">
                {/* OAuth Login - Recommended */}
                <button
                  onClick={handleOAuthLogin}
                  disabled={isLoading}
                  className="w-full p-4 bg-card border-2 border-accent rounded-xl flex items-start gap-4 hover:bg-accent/5 transition-colors touch-feedback disabled:opacity-50"
                >
                  <div className="w-10 h-10 bg-accent/15 rounded-lg flex items-center justify-center flex-shrink-0">
                    <LogIn className="w-5 h-5 text-accent" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-medium text-foreground">
                      {t.setup.authMethod?.oauth || 'Login with Home Assistant'}
                    </div>
                    <p className="text-sm text-muted mt-1">
                      {t.setup.authMethod?.oauthHint || 'Use your existing Home Assistant account'}
                    </p>
                    <span className="inline-block text-xs text-accent font-medium mt-2">
                      {t.setup.authMethod?.recommended || 'Recommended'}
                    </span>
                  </div>
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-accent flex-shrink-0" />
                  ) : (
                    <ArrowRight className="w-5 h-5 text-accent flex-shrink-0" />
                  )}
                </button>

                {/* Manual Token - Alternative */}
                <button
                  onClick={() => {
                    setStep('token')
                  }}
                  disabled={isLoading}
                  className="w-full p-4 bg-card border border-border rounded-xl flex items-start gap-4 hover:bg-border/30 transition-colors touch-feedback disabled:opacity-50"
                >
                  <div className="w-10 h-10 bg-border/50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Key className="w-5 h-5 text-muted" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-medium text-foreground">
                      {t.setup.authMethod?.token || 'Use access token'}
                    </div>
                    <p className="text-sm text-muted mt-1">
                      {t.setup.authMethod?.tokenHint || 'Enter a long-lived access token manually'}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted flex-shrink-0" />
                </button>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-sm mt-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  onClick={() => {
                    setStep('url')
                  }}
                  disabled={isLoading}
                  className="mt-4 text-sm text-muted hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" />
                    {t.common.back}
                  </span>
                </button>
              </div>
            </motion.div>
          )}

          {/* Token Step */}
          {step === 'token' && (
            <motion.div
              key="token"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">{t.setup.token.title}</h2>
              <p className="text-muted mb-4">
                <a
                  href={`${url}/profile/security`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1"
                >
                  {t.setup.token.goToProfile}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>{' '}
                {t.setup.token.hint}
              </p>
              <p className="text-sm text-muted bg-card border border-border rounded-lg px-3 py-2 mb-6">
                {t.setup.token.instructions}
              </p>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="ha-token"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    {t.setup.token.label}
                  </label>
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
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setStep('auth-method')
                    }}
                    disabled={isLoading}
                    aria-label={t.common.back}
                    className="py-4 px-4 bg-card border border-border text-foreground rounded-xl font-medium flex items-center justify-center hover:bg-border/30 transition-colors touch-feedback disabled:opacity-50"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleTokenSubmit}
                    disabled={!token.trim() || isLoading}
                    className="flex-1 py-4 px-6 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors touch-feedback disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t.setup.token.authenticating}
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
                className="w-full py-4 px-6 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors touch-feedback"
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
