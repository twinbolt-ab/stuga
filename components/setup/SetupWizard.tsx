'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowRight, Check, Loader2, ExternalLink, AlertCircle, X, Wifi } from 'lucide-react'
import { saveCredentials } from '@/lib/config'
import { t } from '@/lib/i18n'

type Step = 'welcome' | 'url' | 'token' | 'complete'

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
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<UrlSuggestion[]>([])
  const [isProbing, setIsProbing] = useState(false)
  const hasProbed = useRef(false)

  // Test WebSocket connection to HA (with shorter timeout for probing)
  const testConnection = useCallback(async (testUrl: string, testToken?: string, timeout = 10000): Promise<boolean> => {
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
            const data = JSON.parse(event.data)

            if (data.type === 'auth_required') {
              if (testToken) {
                // Authenticate
                ws.send(JSON.stringify({
                  type: 'auth',
                  access_token: testToken,
                }))
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
          } catch {
            // Invalid JSON, ignore
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
      } catch {
        resolve(false)
      }
    })
  }, [])

  // Probe common URLs when entering URL step
  const probeUrls = useCallback(async () => {
    if (hasProbed.current) return
    hasProbed.current = true
    setIsProbing(true)

    // Initialize suggestions with checking status
    const initialSuggestions = COMMON_URLS.map(u => ({
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
    const firstSuccess = results.find(r => r.status === 'success')
    if (firstSuccess && !url) {
      setUrl(firstSuccess.url)
    }
  }, [testConnection, url])

  // Start probing when entering URL step
  useEffect(() => {
    if (step === 'url') {
      probeUrls()
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
      setStep('token')
    } else {
      setError(t.setup.url.error)
    }
  }

  const handleTokenSubmit = async () => {
    setIsLoading(true)
    setError(null)

    const success = await testConnection(url, token.trim())

    setIsLoading(false)

    if (success) {
      saveCredentials(url, token.trim())
      setStep('complete')
    } else {
      setError(t.setup.token.error)
    }
  }

  const handleComplete = () => {
    router.push('/')
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
                <Image
                  src="/giraff.png"
                  alt="Giraff"
                  width={120}
                  height={180}
                  className="mx-auto mb-6"
                  priority
                />
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {t.setup.welcome.title}
                </h1>
                <p className="text-muted">
                  {t.setup.welcome.subtitle}
                </p>
              </div>

              <button
                onClick={() => setStep('url')}
                className="w-full py-4 px-6 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors touch-feedback"
              >
                {t.setup.welcome.getStarted}
                <ArrowRight className="w-5 h-5" />
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
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t.setup.url.title}
              </h2>
              <p className="text-muted mb-6">
                {t.setup.url.hint}
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="ha-url" className="block text-sm font-medium text-foreground mb-2">
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
                          ${url === suggestion.url
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
                        <span className={`truncate ${suggestion.status === 'success' ? 'text-foreground font-medium' : ''}`}>
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

                <button
                  onClick={handleUrlSubmit}
                  disabled={!url.trim() || isLoading}
                  className="w-full py-4 px-6 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors touch-feedback disabled:opacity-50 disabled:cursor-not-allowed"
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
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t.setup.token.title}
              </h2>
              <p className="text-muted mb-6">
                <a
                  href={`${url}/profile/security`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1"
                >
                  {t.setup.token.goToProfile}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {' '}{t.setup.token.hint}
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="ha-token" className="block text-sm font-medium text-foreground mb-2">
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

                <button
                  onClick={handleTokenSubmit}
                  disabled={!token.trim() || isLoading}
                  className="w-full py-4 px-6 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors touch-feedback disabled:opacity-50 disabled:cursor-not-allowed"
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
                <p className="text-muted">
                  {t.setup.complete.subtitle}
                </p>
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
