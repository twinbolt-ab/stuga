import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useDragControls, PanInfo } from 'framer-motion'
import { X, Check, Loader2, AlertCircle, Eye, EyeOff, LogOut, LogIn, Key } from 'lucide-react'
import { t } from '@/lib/i18n'
import { updateUrl, updateToken, clearCredentials } from '@/lib/config'
import { getStorage } from '@/lib/storage'
import { STORAGE_KEYS } from '@/lib/constants'
import { useHAConnection } from '@/lib/hooks/useHAConnection'
import { logger } from '@/lib/logger'

// Generate URL variants to try (handles missing protocol, protocol switching, and port variations)
function getUrlVariants(inputUrl: string): string[] {
  const trimmed = inputUrl.trim().replace(/\/+$/, '')

  // Check if URL has a protocol
  const hasHttp = trimmed.toLowerCase().startsWith('http://')
  const hasHttps = trimmed.toLowerCase().startsWith('https://')

  // Normalize to have a protocol for easier manipulation
  let baseUrl = trimmed
  let preferHttps = true

  if (!hasHttp && !hasHttps) {
    // No protocol - will try https first
    baseUrl = trimmed
  } else if (hasHttps) {
    baseUrl = trimmed.replace(/^https:\/\//i, '')
    preferHttps = true
  } else if (hasHttp) {
    baseUrl = trimmed.replace(/^http:\/\//i, '')
    preferHttps = false
  }

  // Check if URL has port 8123
  const hasPort8123 = /:8123(\/|$)/.test(baseUrl)
  const hasAnyPort = /:\d+(\/|$)/.test(baseUrl)

  // Generate port variants
  const portVariants: string[] = [baseUrl]
  if (hasPort8123) {
    // Has :8123 - also try without it
    portVariants.push(baseUrl.replace(/:8123/, ''))
  } else if (!hasAnyPort) {
    // No port - also try with :8123
    // Insert port before any path
    const slashIndex = baseUrl.indexOf('/')
    if (slashIndex > 0) {
      portVariants.push(baseUrl.slice(0, slashIndex) + ':8123' + baseUrl.slice(slashIndex))
    } else {
      portVariants.push(baseUrl + ':8123')
    }
  }

  // Generate protocol variants for each port variant
  const results: string[] = []
  for (const variant of portVariants) {
    if (preferHttps || (!hasHttp && !hasHttps)) {
      results.push(`https://${variant}`)
      results.push(`http://${variant}`)
    } else {
      results.push(`http://${variant}`)
      results.push(`https://${variant}`)
    }
  }

  // Remove duplicates while preserving order
  return [...new Set(results)]
}

interface ConnectionSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ConnectionSettingsModal({ isOpen, onClose }: ConnectionSettingsModalProps) {
  const { reconnect, url: connectedUrl, isOAuth } = useHAConnection()
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [workingUrls, setWorkingUrls] = useState<string[]>([])
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)

  const y = useMotionValue(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Blur any focused element to reset touch state
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    } else {
      // Reset y if not closing
      y.set(0)
    }
  }

  const startDrag = (event: React.PointerEvent) => {
    dragControls.start(event)
  }

  // Reset y motion value and blur focused element when modal opens
  useEffect(() => {
    if (isOpen) {
      y.set(0)
      // Blur the button that opened the modal to prevent stuck focus/hover state
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
  }, [isOpen, y])

  // Reset state when modal opens (ideally would use key prop but requires parent changes)
  useEffect(() => {
    if (isOpen) {
      // For token auth, load stored token
      if (!isOAuth) {
        const loadToken = async () => {
          const storage = getStorage()
          const storedToken = await storage.getItem(STORAGE_KEYS.HA_TOKEN)
          if (storedToken) setToken(storedToken)
        }
        void loadToken()
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(connectedUrl)
      setError(null)
      setSuccess(false)
      setShowLogoutConfirm(false)
      setWorkingUrls([])
      setSelectedUrl(null)
    }
  }, [isOpen, connectedUrl, isOAuth])

  // Test connection for token auth
  const testConnection = async (testUrl: string, testToken: string): Promise<boolean> => {
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
              ws.send(
                JSON.stringify({
                  type: 'auth',
                  access_token: testToken,
                })
              )
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
            logger.warn('ConnectionSettings', 'WebSocket message parse error:', e)
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

        setTimeout(() => {
          if (!resolved) {
            cleanup()
            resolve(false)
          }
        }, 10000)
      } catch (e) {
        logger.warn('ConnectionSettings', 'Connection test failed:', e)
        resolve(false)
      }
    })
  }

  const handleSave = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)
    setWorkingUrls([])
    setSelectedUrl(null)

    const trimmedToken = token.trim()
    const urlVariants = getUrlVariants(url)
    const primaryUrl = urlVariants[0]

    // First, try the user's URL (with protocol added if needed)
    const primaryWorks = await testConnection(primaryUrl, trimmedToken)

    if (primaryWorks) {
      // User's URL works - proceed directly without showing alternatives
      await updateUrl(primaryUrl)
      await updateToken(trimmedToken)
      setUrl(primaryUrl)
      setSuccess(true)
      void reconnect()

      setTimeout(() => {
        onClose()
      }, 1500)
      setIsLoading(false)
      return
    }

    // User's URL failed - try all alternative variants in parallel
    const alternativeVariants = urlVariants.slice(1)

    if (alternativeVariants.length > 0) {
      const results = await Promise.all(
        alternativeVariants.map(async (testUrl) => ({
          url: testUrl,
          works: await testConnection(testUrl, trimmedToken),
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

    // No URLs work
    setError(t.settings.connection.error)
    setIsLoading(false)
  }

  // Handle user selecting a URL and saving
  const handleSelectUrlAndSave = async () => {
    if (!selectedUrl) return

    setIsLoading(true)
    const trimmedToken = token.trim()

    await updateUrl(selectedUrl)
    await updateToken(trimmedToken)
    setUrl(selectedUrl)
    setWorkingUrls([])
    setSelectedUrl(null)
    setSuccess(true)
    void reconnect()

    // Auto close after success
    setTimeout(() => {
      onClose()
    }, 1500)

    setIsLoading(false)
  }

  // Handle user wanting to try again
  const handleTryAgain = () => {
    setWorkingUrls([])
    setSelectedUrl(null)
  }

  const handleLogout = async () => {
    await clearCredentials()
    window.location.reload()
  }

  // Format URL for display (remove ws:// prefix and /api/websocket suffix)
  const formatUrlForDisplay = (url: string) => {
    return url
      .replace(/^wss?:\/\//, '')
      .replace(/^https?:\/\//, '')
      .replace(/\/api\/websocket$/, '')
      .replace(/\/$/, '')
  }

  // Auth method icon and label
  const getAuthIcon = () => {
    if (isOAuth) {
      return <LogIn className="w-5 h-5 text-accent" />
    }
    return <Key className="w-5 h-5 text-muted" />
  }

  const getAuthLabel = () => {
    if (isOAuth) {
      return t.settings.connection.oauth?.label || 'Home Assistant Login'
    }
    return t.settings.connection.token?.label || 'Access Token'
  }

  const getAuthDescription = () => {
    if (isOAuth) {
      return (
        t.settings.connection.oauth?.description ||
        "You're signed in with your Home Assistant account."
      )
    }
    return t.settings.connection.token?.description || 'Using a long-lived access token.'
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0, pointerEvents: 'none' as const }}
            animate={{ opacity: 1, pointerEvents: 'auto' as const }}
            exit={{ opacity: 0, pointerEvents: 'none' as const }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%', pointerEvents: 'none' as const }}
            animate={{ y: 0, pointerEvents: 'auto' as const }}
            exit={{ y: '100%', pointerEvents: 'none' as const }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.8 }}
            onDragEnd={handleDragEnd}
            style={{ y }}
            className="fixed bottom-0 left-0 right-0 z-[70] bg-card rounded-t-2xl shadow-warm-lg max-h-[80vh] flex flex-col"
          >
            {/* Handle bar - drag area */}
            <div
              onPointerDown={startDrag}
              className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
            >
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Header - also draggable */}
            <div
              onPointerDown={startDrag}
              className="flex items-center justify-between px-4 pb-4 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
            >
              <h2 className="text-lg font-semibold text-foreground">
                {t.settings.connection.title}
              </h2>
              <button
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Content - scrollable */}
            <div className="px-4 pb-safe space-y-4 overflow-y-auto flex-1">
              {/* Auth Method Badge */}
              <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border">
                <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0">
                  {getAuthIcon()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{getAuthLabel()}</div>
                  <p className="text-sm text-muted">
                    {isOAuth ? formatUrlForDisplay(connectedUrl) : getAuthDescription()}
                  </p>
                </div>
              </div>

              {/* URL Field - Only for Token auth */}
              {!isOAuth && (
                <div>
                  <label
                    htmlFor="connection-url"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    {t.settings.connection.urlLabel}
                  </label>
                  <input
                    id="connection-url"
                    type="url"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value)
                      setError(null)
                      setSuccess(false)
                    }}
                    placeholder="http://homeassistant.local:8123"
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              )}

              {/* Token Field - Only for token auth */}
              {!isOAuth && (
                <div>
                  <label
                    htmlFor="connection-token"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    {t.settings.connection.tokenLabel}
                  </label>
                  <div className="relative">
                    <input
                      id="connection-token"
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => {
                        setToken(e.target.value)
                        setError(null)
                        setSuccess(false)
                      }}
                      className="w-full px-4 py-3 pr-12 bg-background border border-border rounded-xl text-foreground font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowToken(!showToken)
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground transition-colors"
                    >
                      {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* URL Selection - shown when we find working URLs */}
              <AnimatePresence>
                {workingUrls.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {workingUrls.length === 1
                              ? t.setup?.url?.foundAt || 'Found Home Assistant at:'
                              : t.setup?.url?.foundMultiple ||
                                'Found Home Assistant at multiple addresses:'}
                          </p>
                        </div>
                      </div>

                      {/* URL options */}
                      <div className="space-y-2">
                        {workingUrls.map((urlOption) => (
                          <button
                            key={urlOption}
                            onClick={() => setSelectedUrl(urlOption)}
                            className={`w-full p-3 rounded-xl text-left transition-all ${
                              selectedUrl === urlOption
                                ? 'bg-accent/20 border-2 border-accent'
                                : 'bg-card border border-border hover:border-accent/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  selectedUrl === urlOption
                                    ? 'border-accent bg-accent'
                                    : 'border-muted'
                                }`}
                              >
                                {selectedUrl === urlOption && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                )}
                              </div>
                              <span className="font-mono text-sm text-foreground break-all">
                                {urlOption}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={handleTryAgain}
                          className="flex-1 py-3 px-4 bg-border/50 text-foreground rounded-xl font-medium hover:bg-border transition-colors text-sm"
                        >
                          {t.setup?.url?.tryAgain || 'Try again'}
                        </button>
                        <button
                          onClick={handleSelectUrlAndSave}
                          disabled={!selectedUrl}
                          className="flex-1 py-3 px-4 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors text-sm disabled:opacity-50"
                        >
                          {t.setup?.url?.selectAndConnect || 'Connect'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="flex items-center gap-2 text-green-500 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{t.settings.connection.success}</span>
                </div>
              )}

              {/* Action Button - Different for each auth type */}
              {!isOAuth && (
                <button
                  onClick={handleSave}
                  disabled={!url.trim() || !token.trim() || isLoading}
                  className="w-full py-4 px-6 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t.settings.connection.testing}
                    </>
                  ) : success ? (
                    <>
                      <Check className="w-5 h-5" />
                      {t.settings.connection.saved}
                    </>
                  ) : (
                    t.settings.connection.save
                  )}
                </button>
              )}

              {/* Logout Section */}
              <div className="pt-4 border-t border-border mt-4">
                {showLogoutConfirm ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted text-center">
                      {t.settings.connection.logoutConfirm}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowLogoutConfirm(false)
                        }}
                        className="flex-1 py-3 px-4 bg-border/50 text-foreground rounded-xl font-medium hover:bg-border transition-colors"
                      >
                        {t.common.cancel}
                      </button>
                      <button
                        onClick={handleLogout}
                        className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-600 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        {t.settings.connection.logout}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowLogoutConfirm(true)
                    }}
                    className="w-full py-3 px-4 text-red-500 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {t.settings.connection.logout}
                  </button>
                )}
              </div>

              <div className="h-4" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
