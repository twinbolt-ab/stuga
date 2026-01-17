import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, PanInfo } from 'framer-motion'
import {
  X,
  Check,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  LogOut,
  LogIn,
  Key,
  Server,
} from 'lucide-react'
import { t } from '@/lib/i18n'
import {
  updateUrl,
  updateToken,
  clearCredentials,
  getAuthMethod,
  type AuthMethod,
} from '@/lib/config'
import {
  getOAuthCredentials,
  storePendingOAuth,
  isNativeApp,
  getClientId,
  getRedirectUri,
  storeOAuthCredentials,
} from '@/lib/ha-oauth'
import { getStorage } from '@/lib/storage'
import { STORAGE_KEYS } from '@/lib/constants'
import { useHAConnection } from '@/lib/hooks/useHAConnection'
import { OAuth2Client } from '@byteowls/capacitor-oauth2'
import { logger } from '@/lib/logger'
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

interface ConnectionSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ConnectionSettingsModal({ isOpen, onClose }: ConnectionSettingsModalProps) {
  const { reconnect } = useHAConnection()
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null)
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true)
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const y = useMotionValue(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Release any pointer capture to prevent blocking subsequent touches
    if (sheetRef.current && 'pointerId' in event) {
      try {
        sheetRef.current.releasePointerCapture(event.pointerId)
      } catch {
        // Expected when pointer capture wasn't held - not an error
      }
    }

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

  // Load current credentials and detect auth method when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoadingCredentials(true)
      const loadCredentials = async () => {
        try {
          const method = await getAuthMethod()
          logger.debug('ConnectionSettings', 'Detected auth method:', method)
          setAuthMethod(method)

          let loadedUrl = ''
          let loadedToken = ''

          // Try OAuth credentials first (works on native with secure storage)
          const oauthCreds = await getOAuthCredentials()
          if (oauthCreds) {
            logger.debug('ConnectionSettings', 'Found OAuth credentials, URL:', oauthCreds.ha_url)
            loadedUrl = oauthCreds.ha_url
          }

          // Try async storage (Capacitor Preferences on native, localStorage on web)
          const storage = getStorage()
          const storedUrl = await storage.getItem(STORAGE_KEYS.HA_URL)
          const storedToken = await storage.getItem(STORAGE_KEYS.HA_TOKEN)

          if (storedUrl) {
            logger.debug('ConnectionSettings', 'Found URL in storage:', storedUrl)
            if (!loadedUrl) loadedUrl = storedUrl
          }
          if (storedToken) {
            logger.debug('ConnectionSettings', 'Found token in storage')
            loadedToken = storedToken
          }

          setUrl(loadedUrl)
          setToken(loadedToken)
          logger.debug(
            'ConnectionSettings',
            'Final state - URL:',
            loadedUrl,
            'Has token:',
            !!loadedToken
          )
        } catch (err) {
          logger.error('ConnectionSettings', 'Failed to load credentials:', err)
        }
        setIsLoadingCredentials(false)
      }
      void loadCredentials()
      setError(null)
      setSuccess(false)
      setShowLogoutConfirm(false)
    }
  }, [isOpen])

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

    const normalizedUrl = url.trim().replace(/\/+$/, '')
    const trimmedToken = token.trim()

    const isValid = await testConnection(normalizedUrl, trimmedToken)

    if (isValid) {
      await updateUrl(normalizedUrl)
      await updateToken(trimmedToken)
      setSuccess(true)
      void reconnect()

      // Auto close after success
      setTimeout(() => {
        onClose()
      }, 1500)
    } else {
      setError(t.settings.connection.error)
    }

    setIsLoading(false)
  }

  const handleOAuthReauth = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (isNativeApp()) {
        // On native, use OAuth2Client plugin which handles the browser + deep link
        const clientId = 'https://stuga.app/oauth'
        const isHttps = url.startsWith('https://')

        if (isHttps) {
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

          if (response.access_token) {
            await storeOAuthCredentials(url, {
              access_token: response.access_token,
              refresh_token: response.refresh_token ?? '',
              expires_in: response.expires_in ?? 1800,
              token_type: 'Bearer',
            })
            void reconnect()
            setSuccess(true)
            setTimeout(() => {
              onClose()
            }, 1500)
          } else {
            throw new Error('No access token received')
          }
        } else {
          // For HTTP (local HA), handle token exchange manually
          const response = (await OAuth2Client.authenticate({
            authorizationBaseUrl: `${url}/auth/authorize`,
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

          const authCode = response.authorization_response?.code
          const codeVerifier = response.authorization_response?.code_verifier

          if (!authCode) {
            throw new Error('No authorization code received')
          }

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
          await storeOAuthCredentials(url, {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in ?? 1800,
            token_type: 'Bearer',
          })
          void reconnect()
          setSuccess(true)
          setTimeout(() => {
            onClose()
          }, 1500)
        }
      } else {
        // On web, use manual redirect flow
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

        await storePendingOAuth(state, verifier, url)

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
      logger.error('OAuth', 'Re-auth failed:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage || 'Failed to re-authenticate')
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    await clearCredentials()
    window.location.reload()
  }

  // Auth method icon and label
  const getAuthIcon = () => {
    switch (authMethod) {
      case 'oauth':
        return <LogIn className="w-5 h-5 text-accent" />
      case 'addon':
        return <Server className="w-5 h-5 text-green-500" />
      case 'token':
      default:
        return <Key className="w-5 h-5 text-muted" />
    }
  }

  const getAuthLabel = () => {
    switch (authMethod) {
      case 'oauth':
        return t.settings.connection.oauth?.label || 'Home Assistant Login'
      case 'addon':
        return t.settings.connection.addon?.label || 'Home Assistant Add-on'
      case 'token':
      default:
        return t.settings.connection.token?.label || 'Access Token'
    }
  }

  const getAuthDescription = () => {
    switch (authMethod) {
      case 'oauth':
        return (
          t.settings.connection.oauth?.description ||
          "You're signed in with your Home Assistant account."
        )
      case 'addon':
        return t.settings.connection.addon?.description || 'Running as a Home Assistant add-on.'
      case 'token':
      default:
        return t.settings.connection.token?.description || 'Using a long-lived access token.'
    }
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
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            style={{ y }}
            className="fixed bottom-0 left-0 right-0 z-[70] bg-card rounded-t-2xl shadow-warm-lg max-h-[80vh] overflow-y-auto"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {t.settings.connection.title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="px-4 pb-safe space-y-4">
              {isLoadingCredentials ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted" />
                </div>
              ) : (
                <>
                  {/* Auth Method Badge */}
                  <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border">
                    <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0">
                      {getAuthIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">{getAuthLabel()}</div>
                      <p className="text-sm text-muted">{getAuthDescription()}</p>
                    </div>
                  </div>

                  {/* URL Field - Read-only for OAuth/Addon, Editable for Token */}
                  <div>
                    <label
                      htmlFor="connection-url"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      {t.settings.connection.urlLabel}
                    </label>
                    {authMethod === 'token' ? (
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
                    ) : (
                      <div className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground font-mono text-sm">
                        {url || '—'}
                      </div>
                    )}
                  </div>

                  {/* Token Field - Only for token auth */}
                  {authMethod === 'token' && (
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
                  {authMethod === 'token' && (
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

                  {authMethod === 'oauth' && (
                    <button
                      onClick={handleOAuthReauth}
                      disabled={isLoading}
                      className="w-full py-4 px-6 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {t.settings.connection.oauth?.reauthenticating ||
                            'Opening Home Assistant...'}
                        </>
                      ) : success ? (
                        <>
                          <Check className="w-5 h-5" />
                          {t.settings.connection.saved}
                        </>
                      ) : (
                        <>
                          <LogIn className="w-5 h-5" />
                          {t.settings.connection.oauth?.reauthenticate || 'Sign In Again'}
                        </>
                      )}
                    </button>
                  )}

                  {/* Logout Section - Not shown for addon */}
                  {authMethod !== 'addon' && (
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
                  )}

                  <div className="h-4" />
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
