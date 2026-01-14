import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, type URLOpenListenerEvent } from '@capacitor/app'
import { getValidAccessToken, isUsingOAuth } from '../ha-oauth'
import { haWebSocket } from '../ha-websocket'

/**
 * Hook to handle deep links on native platforms
 * Listens for giraff://auth/callback URLs and navigates to the auth callback route
 */
export function useDeepLinks() {
  const navigate = useNavigate()

  useEffect(() => {
    // Only set up listener on native platforms
    const isNative = (window as any).Capacitor?.isNativePlatform?.()
    if (!isNative) return

    const handleDeepLink = (event: URLOpenListenerEvent) => {
      // Parse the deep link URL
      // Format: giraff://auth/callback?code=xxx&state=xxx
      const url = new URL(event.url)

      if (url.host === 'auth' && url.pathname === '/callback') {
        // Navigate to auth callback with the query params
        navigate(`/auth/callback${url.search}`, { replace: true })
      }
    }

    // Handle app resume - proactively refresh OAuth token
    const handleAppResume = async () => {
      console.log('[App] Resumed from background')

      // Only handle OAuth - long-lived tokens don't expire
      const usingOAuth = await isUsingOAuth()
      if (!usingOAuth) return

      // Check if token needs refresh (this handles refresh automatically)
      const result = await getValidAccessToken()
      console.log('[App] Token check on resume:', result.status)

      if (result.status === 'valid') {
        // Token is valid (either still fresh or successfully refreshed)
        // If WebSocket is disconnected, reconnect with the valid token
        if (!haWebSocket.isConnected()) {
          console.log('[App] Reconnecting WebSocket with refreshed token')
          haWebSocket.configure(result.haUrl, result.token, true)
          haWebSocket.connect()
        }
      } else if (result.status === 'auth-error') {
        // Token refresh failed permanently - redirect to setup
        console.log('[App] Auth error on resume, redirecting to setup')
        navigate('/setup', { replace: true })
      }
      // For network-error, we keep credentials and let normal reconnect handle it
    }

    // Add listener for app URL open events
    App.addListener('appUrlOpen', handleDeepLink)

    // Add listener for app state changes (resume from background)
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        handleAppResume()
      }
    })

    return () => {
      App.removeAllListeners()
    }
  }, [navigate])
}
