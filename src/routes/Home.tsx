import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, AlertCircle, WifiOff, RefreshCw } from 'lucide-react'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { isSetupComplete, getStoredCredentials, clearCredentials } from '@/lib/config'
import { t } from '@/lib/i18n'
import { logger } from '@/lib/logger'

type HomeState = 'loading' | 'ready' | 'session-expired' | 'connection-lost' | 'needs-setup'

// Async setup check function - defined outside component to avoid lint issues
async function checkSetupStatus(
  navigate: ReturnType<typeof useNavigate>,
  setState: (state: HomeState) => void
) {
  const setupComplete = await isSetupComplete()
  if (!setupComplete) {
    void navigate('/setup', { replace: true })
    return
  }

  // Check if we actually have valid credentials
  // (setup might be marked complete but credentials could have been cleared)
  const result = await getStoredCredentials()

  if (result.status === 'valid') {
    setState('ready')
  } else if (result.status === 'network-error') {
    // Credentials exist but network is down - show reconnect UI, not setup
    logger.debug('Home', 'Network error - showing connection lost UI')
    setState('connection-lost')
  } else {
    // No credentials at all
    logger.debug('Home', 'No credentials - session expired')
    setState('session-expired')
  }
}

export default function Home() {
  const navigate = useNavigate()
  const [state, setState] = useState<HomeState>('loading')
  const [retrying, setRetrying] = useState(false)

  // Run setup check on mount
  useEffect(() => {
    void checkSetupStatus(navigate, setState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignIn = async () => {
    // Clear credentials and redirect to setup
    await clearCredentials()
    void navigate('/setup', { replace: true })
  }

  const handleRetry = async () => {
    setRetrying(true)
    setState('loading')
    await checkSetupStatus(navigate, setState)
    setRetrying(false)
  }

  // Loading state - minimal blank screen
  if (state === 'loading') {
    return <div className="min-h-screen bg-background" />
  }

  // Session expired - friendly message with sign in button
  if (state === 'session-expired') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm text-center"
        >
          {/* Icon */}
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-amber-500" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground mb-3">
            {t.sessionExpired?.title || 'Session Expired'}
          </h1>

          {/* Message */}
          <p className="text-muted mb-8 leading-relaxed">
            {t.sessionExpired?.message ||
              'Your Home Assistant session has expired. Please sign in again to continue.'}
          </p>

          {/* Sign in button */}
          <button
            onClick={handleSignIn}
            className="w-full py-4 px-6 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors touch-feedback"
          >
            <LogIn className="w-5 h-5" />
            {t.sessionExpired?.signIn || 'Sign In'}
          </button>
        </motion.div>
      </div>
    )
  }

  // Connection lost - temporary network issue, just need to reconnect WiFi
  if (state === 'connection-lost') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm text-center"
        >
          {/* Icon */}
          <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <WifiOff className="w-10 h-10 text-blue-500" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground mb-3">
            {t.connectionLost?.title || 'Connection Lost'}
          </h1>

          {/* Message */}
          <p className="text-muted mb-8 leading-relaxed">
            {t.connectionLost?.message ||
              'Unable to connect to Home Assistant. Check your WiFi connection and try again.'}
          </p>

          {/* Retry button */}
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full py-4 px-6 bg-accent text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors touch-feedback disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Retrying...' : t.connectionLost?.retry || 'Retry Connection'}
          </button>
        </motion.div>
      </div>
    )
  }

  return <Dashboard />
}
