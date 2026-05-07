import { useRef } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { t } from '@/lib/i18n'
import { openExternalUrl } from '@/lib/browser'
import { scrollIntoVisualViewport } from '@/lib/utils/scroll-into-visual-viewport'

interface Props {
  token: string
  url: string
  keyboardOffset: number
  onTokenChange: (token: string) => void
  onSwitchToOAuth: () => void
}

export function TokenInput({ token, url, keyboardOffset, onTokenChange, onSwitchToOAuth }: Props) {
  const tokenInputRef = useRef<HTMLTextAreaElement>(null)

  return (
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
          <button onClick={onSwitchToOAuth} className="text-xs text-accent hover:underline">
            {t.setup.authMethod?.useOAuthInstead || 'Use login instead'}
          </button>
        </div>
        <p className="text-sm text-muted">
          <button
            type="button"
            onClick={() => url && void openExternalUrl(`${url}/profile/security`)}
            className="text-accent hover:underline inline-flex items-center gap-1"
          >
            {t.setup.token.goToProfile}
            <ExternalLink className="w-3.5 h-3.5" />
          </button>{' '}
          {t.setup.token.hint}
        </p>
        <textarea
          ref={tokenInputRef}
          id="ha-token"
          value={token}
          onChange={(e) => onTokenChange(e.target.value)}
          onFocus={() => {
            // Scroll input into the visible area once the keyboard has opened.
            setTimeout(() => {
              scrollIntoVisualViewport(tokenInputRef.current, keyboardOffset)
            }, 300)
          }}
          placeholder={t.setup.token.placeholder}
          rows={3}
          className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors resize-none font-mono text-sm"
        />
      </div>
    </motion.div>
  )
}
