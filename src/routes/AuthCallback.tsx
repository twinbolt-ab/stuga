import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle, Check } from 'lucide-react'
import {
  getPendingOAuth,
  clearPendingOAuth,
  exchangeCodeForTokens,
  storeOAuthCredentials,
} from '@/lib/ha-oauth'
import { t } from '@/lib/i18n'
import { logger } from '@/lib/logger'

type Status = 'processing' | 'success' | 'error'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<Status>('processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const errorParam = searchParams.get('error')

      // Check for OAuth error response
      if (errorParam) {
        setStatus('error')
        setError(searchParams.get('error_description') || 'Authorization was denied')
        return
      }

      // Validate we have required params
      if (!code || !state) {
        setStatus('error')
        setError('Missing authorization code or state')
        return
      }

      // Get pending OAuth data
      const pending = await getPendingOAuth()

      // Validate state matches
      if (pending.state !== state) {
        setStatus('error')
        setError('Invalid state parameter - possible CSRF attack')
        await clearPendingOAuth()
        return
      }

      if (!pending.haUrl) {
        setStatus('error')
        setError('Missing Home Assistant URL')
        await clearPendingOAuth()
        return
      }

      try {
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(
          pending.haUrl,
          code,
          pending.verifier || undefined
        )

        // Store credentials
        await storeOAuthCredentials(pending.haUrl, tokens)

        // Clear pending state
        await clearPendingOAuth()

        setStatus('success')

        // Navigate to home after short delay
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 1500)
      } catch (err) {
        logger.error('OAuth', 'Token exchange failed:', err)
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to complete authentication')
        await clearPendingOAuth()
      }
    }

    handleCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        {status === 'processing' && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-accent animate-spin" />
            <h2 className="text-xl font-semibold text-foreground">
              {t.setup.oauth?.completing || 'Completing authentication...'}
            </h2>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">{t.setup.complete.title}</h2>
            <p className="text-muted">
              {t.setup.oauth?.redirecting || 'Redirecting to dashboard...'}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {t.setup.oauth?.failed || 'Authentication failed'}
            </h2>
            <p className="text-muted">{error}</p>
            <button
              onClick={() => navigate('/setup', { replace: true })}
              className="px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-accent/90 transition-colors"
            >
              {t.setup.oauth?.tryAgain || 'Try again'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
