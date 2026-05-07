import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Loader2, AlertCircle, Key } from 'lucide-react'
import { t } from '@/lib/i18n'
import { isNativeApp } from '@/lib/ha-oauth'
import { scrollIntoVisualViewport } from '@/lib/utils/scroll-into-visual-viewport'
import { type AuthMethod, type UrlSuggestion, type LiveDiagnosticState } from './types'
import { DiagnosticDetails } from './DiagnosticDetails'
import { WebCorsConfig } from './WebCorsConfig'
import { UrlSuggestions } from './UrlSuggestions'
import { UrlSelectionPanel } from './UrlSelectionPanel'
import { TokenInput } from './TokenInput'

interface Props {
  url: string
  token: string
  authMethod: AuthMethod
  isLoading: boolean
  error: string | null
  suggestions: UrlSuggestion[]
  isProbing: boolean
  liveDiagnostic: LiveDiagnosticState
  workingUrls: string[]
  selectedUrl: string | null
  onUrlChange: (url: string) => void
  onTokenChange: (token: string) => void
  onAuthMethodChange: (method: AuthMethod) => void
  onConnect: () => void
  onBack: () => void
  onRetryConnection: () => void
  onSelectWorkingUrl: (url: string) => void
  onSelectAndConnect: () => void
  onTryAgain: () => void
  onVerifyUrl: (url: string) => void
  onUrlVerified: (url: string, verified: boolean) => void
}

const slideVariants = {
  enter: { x: 50, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -50, opacity: 0 },
}

export function ConnectStep({
  url,
  token,
  authMethod,
  isLoading,
  error,
  suggestions,
  isProbing,
  liveDiagnostic,
  workingUrls,
  selectedUrl,
  onUrlChange,
  onTokenChange,
  onAuthMethodChange,
  onConnect,
  onBack,
  onRetryConnection,
  onSelectWorkingUrl,
  onSelectAndConnect,
  onTryAgain,
  onVerifyUrl,
  onUrlVerified,
}: Props) {
  const urlInputRef = useRef<HTMLInputElement>(null)

  return (
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
            <label htmlFor="ha-url" className="block text-sm font-medium text-foreground mb-2">
              {t.setup.url.label}
            </label>
            <input
              ref={urlInputRef}
              id="ha-url"
              type="url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              onFocus={() => {
                // Scroll input into the visual viewport once the keyboard has opened.
                setTimeout(() => {
                  scrollIntoVisualViewport(urlInputRef.current)
                }, 300)
              }}
              onBlur={() => {
                if (url.trim()) {
                  onVerifyUrl(url)
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
                  <p className="text-sm text-foreground/90 font-medium">{t.setup.url.webNote}</p>
                  <p className="text-sm text-muted">{t.setup.url.webNoteApps}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Web setup instructions - always shown on web */}
          {!isNativeApp() && <WebCorsConfig />}

          {/* URL Suggestions - only shown on native apps (local URLs don't work on web) */}
          {isNativeApp() && (
            <UrlSuggestions
              suggestions={suggestions}
              selectedUrl={url}
              isProbing={isProbing}
              onSelectUrl={(selectedUrl, verified) => {
                onUrlVerified(selectedUrl, verified)
              }}
            />
          )}
        </div>

        {/* Token Input - shown when token auth is selected */}
        <AnimatePresence>
          {authMethod === 'token' && (
            <TokenInput
              token={token}
              url={url}
              onTokenChange={onTokenChange}
              onSwitchToOAuth={() => {
                onAuthMethodChange('oauth')
                onTokenChange('')
              }}
            />
          )}
        </AnimatePresence>

        {/* Live Connection Diagnostic Details */}
        <AnimatePresence>
          {liveDiagnostic.show && (
            <DiagnosticDetails state={liveDiagnostic} onRetry={onRetryConnection} />
          )}
        </AnimatePresence>

        {/* URL Selection - shown when we find working URLs */}
        <AnimatePresence>
          {workingUrls.length > 0 && (
            <UrlSelectionPanel
              workingUrls={workingUrls}
              selectedUrl={selectedUrl}
              onSelectUrl={onSelectWorkingUrl}
              onTryAgain={onTryAgain}
              onConnect={onSelectAndConnect}
            />
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
            onClick={onBack}
            disabled={isLoading}
            aria-label={t.common.back}
            className="py-4 px-4 bg-card border border-border text-foreground rounded-xl font-medium flex items-center justify-center hover:bg-border/30 transition-colors touch-feedback disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onConnect}
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
                onClick={() => onAuthMethodChange('token')}
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
  )
}
