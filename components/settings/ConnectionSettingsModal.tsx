'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, PanInfo } from 'framer-motion'
import { X, Check, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { t } from '@/lib/i18n'
import { getStoredCredentials, updateUrl, updateToken } from '@/lib/config'
import { useHAConnection } from '@/lib/hooks/useHAConnection'

interface ConnectionSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ConnectionSettingsModal({ isOpen, onClose }: ConnectionSettingsModalProps) {
  const { reconnect } = useHAConnection()
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const y = useMotionValue(0)

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    }
  }

  // Load current credentials when modal opens
  useEffect(() => {
    if (isOpen) {
      const credentials = getStoredCredentials()
      if (credentials) {
        setUrl(credentials.url)
        setToken(credentials.token)
      }
      setError(null)
      setSuccess(false)
    }
  }, [isOpen])

  // Test connection
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
            const data = JSON.parse(event.data)
            if (data.type === 'auth_required') {
              ws.send(JSON.stringify({
                type: 'auth',
                access_token: testToken,
              }))
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

        setTimeout(() => {
          if (!resolved) {
            cleanup()
            resolve(false)
          }
        }, 10000)
      } catch {
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
      updateUrl(normalizedUrl)
      updateToken(trimmedToken)
      setSuccess(true)
      reconnect()

      // Auto close after success
      setTimeout(() => {
        onClose()
      }, 1500)
    } else {
      setError(t.settings.connection.error)
    }

    setIsLoading(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
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
              <h2 className="text-lg font-semibold text-foreground">{t.settings.connection.title}</h2>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="px-4 pb-safe space-y-4">
              {/* URL Field */}
              <div>
                <label htmlFor="connection-url" className="block text-sm font-medium text-foreground mb-2">
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

              {/* Token Field */}
              <div>
                <label htmlFor="connection-token" className="block text-sm font-medium text-foreground mb-2">
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
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground transition-colors"
                  >
                    {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

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

              {/* Save Button */}
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

              <div className="h-4" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
