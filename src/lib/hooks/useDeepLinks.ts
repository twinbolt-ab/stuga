import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from '@capacitor/app'
import { getValidAccessToken, isUsingOAuth } from '../ha-oauth'
import { isConnected, configure, connect, updateToken } from '../ha-websocket'
import { logger } from '../logger'

/**
 * Hook to handle app lifecycle events on native platforms
 * - Refreshes OAuth tokens when app resumes from background
 */
export function useDeepLinks() {
  const navigate = useNavigate()

  useEffect(() => {
    // Only set up listener on native platforms
    const isNative = window.Capacitor?.isNativePlatform?.()
    if (!isNative) return

    // Handle app resume - proactively refresh OAuth token
    const handleAppResume = async () => {
      logger.debug('App', 'Resumed from background')

      // Only handle OAuth - long-lived tokens don't expire
      const usingOAuth = await isUsingOAuth()
      if (!usingOAuth) return

      // Check if token needs refresh (this handles refresh automatically)
      const result = await getValidAccessToken()
      logger.debug('App', 'Token check on resume:', result.status)

      if (result.status === 'valid') {
        // Token is valid (either still fresh or successfully refreshed)
        // Always update token for next reconnect, even if currently connected
        updateToken(result.token)

        // If WebSocket is disconnected, reconnect with the valid token
        if (!isConnected()) {
          logger.debug('App', 'Reconnecting WebSocket with refreshed token')
          configure(result.haUrl, result.token, true)
          connect()
        }
      } else if (result.status === 'auth-error') {
        // Token refresh failed permanently - redirect to setup
        logger.debug('App', 'Auth error on resume, redirecting to setup')
        void navigate('/setup', { replace: true })
      }
      // For network-error, we keep credentials and let normal reconnect handle it
    }

    // Add listener for app state changes (resume from background)
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void handleAppResume()
      }
    })

    return () => {
      void App.removeAllListeners()
    }
  }, [navigate])
}
