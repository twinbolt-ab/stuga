// In-app browser OAuth handler for native apps
// Uses @capgo/inappbrowser to handle OAuth flow without relying on AppAuth library

import { App } from '@capacitor/app'
import { InAppBrowser, ToolBarType } from '@capgo/inappbrowser'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  exchangeCodeForTokens,
  getClientId,
  getRedirectUri,
} from './ha-oauth'
import { logger } from './logger'

interface OAuthResult {
  success: boolean
  tokens?: {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  error?: string
}

/**
 * Authenticate with Home Assistant using an in-app WebView
 * Works for both HTTP and HTTPS Home Assistant instances
 */
export async function authenticateWithInAppBrowser(haUrl: string): Promise<OAuthResult> {
  const clientId = getClientId(haUrl)
  const redirectUri = getRedirectUri(haUrl)

  logger.debug('OAuth', 'Starting in-app browser auth', { haUrl, clientId, redirectUri })

  // Generate PKCE values
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = generateState()

  // Build authorization URL
  const authUrl = new URL(`${haUrl}/auth/authorize`)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  logger.debug('OAuth', 'Opening auth URL', authUrl.toString())

  return new Promise((resolve) => {
    let resolved = false
    let processingRedirect = false
    let urlChangeListener: { remove: () => Promise<void> } | null = null
    let closeListener: { remove: () => Promise<void> } | null = null
    let appUrlListener: { remove: () => Promise<void> } | null = null

    const cleanup = async () => {
      if (urlChangeListener) {
        await urlChangeListener.remove()
        urlChangeListener = null
      }
      if (closeListener) {
        await closeListener.remove()
        closeListener = null
      }
      if (appUrlListener) {
        await appUrlListener.remove()
        appUrlListener = null
      }
    }

    const handleResult = async (result: OAuthResult) => {
      if (resolved) return
      resolved = true
      await cleanup()
      resolve(result)
    }

    // Helper to process the OAuth callback URL
    const processCallback = async (url: string) => {
      processingRedirect = true
      logger.debug('OAuth', 'Processing callback URL:', url)

      try {
        // Close the browser first
        await InAppBrowser.close()
      } catch {
        // Ignore close errors
      }

      // Parse the callback URL - try to extract params manually since custom schemes may fail URL parsing
      const queryStart = url.indexOf('?')
      if (queryStart === -1) {
        await handleResult({ success: false, error: 'Invalid callback URL - no query params' })
        return
      }
      const queryString = url.substring(queryStart + 1)
      const params = new URLSearchParams(queryString)

      const error = params.get('error')
      if (error) {
        await handleResult({ success: false, error })
        return
      }

      const code = params.get('code')
      const returnedState = params.get('state')

      if (returnedState !== state) {
        logger.error('OAuth', 'State mismatch', { expected: state, got: returnedState })
        await handleResult({ success: false, error: 'State mismatch - possible CSRF attack' })
        return
      }

      if (!code) {
        await handleResult({ success: false, error: 'No authorization code received' })
        return
      }

      // Exchange code for tokens
      try {
        logger.debug('OAuth', 'Exchanging code for tokens...')
        const tokens = await exchangeCodeForTokens(haUrl, code, codeVerifier)
        logger.debug('OAuth', 'Token exchange successful')
        await handleResult({
          success: true,
          tokens: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
          },
        })
      } catch (err) {
        logger.error('OAuth', 'Token exchange failed:', err)
        await handleResult({
          success: false,
          error: err instanceof Error ? err.message : 'Token exchange failed',
        })
      }
    }

    // Set up listeners BEFORE opening the browser to avoid race conditions
    const setupAndOpen = async () => {
      // Listen for deep links (app URL open) - this catches the custom scheme redirect
      // when the OS intercepts com.twinbolt.stuga:/ and opens the app
      appUrlListener = await App.addListener('appUrlOpen', (event) => {
        if (resolved) return

        const url = event.url
        logger.debug('OAuth', 'App URL opened:', url)

        // Check if this is our OAuth redirect
        if (url.startsWith('com.twinbolt.stuga:')) {
          void processCallback(url)
        }
      })

      // Listen for URL changes in WebView (backup, may not fire for custom schemes)
      urlChangeListener = await InAppBrowser.addListener('urlChangeEvent', (event) => {
        if (resolved) return

        const url = event.url
        logger.debug('OAuth', 'URL changed:', url)

        // Check if this is our redirect
        if (url.startsWith(redirectUri) || url.startsWith('com.twinbolt.stuga:')) {
          void processCallback(url)
        }
      })

      // Listen for browser close (user cancelled)
      closeListener = await InAppBrowser.addListener('closeEvent', () => {
        // Ignore close if we're already processing a redirect
        if (!resolved && !processingRedirect) {
          logger.debug('OAuth', 'User closed browser without completing auth')
          void handleResult({ success: false, error: 'User cancelled' })
        }
      })

      // Now open the in-app browser
      // preventDeeplink: false allows deep links to be handled by the OS
      try {
        await InAppBrowser.openWebView({
          url: authUrl.toString(),
          title: '',
          toolbarType: ToolBarType.BLANK, // No toolbar - full screen WebView
          preventDeeplink: false,
        })
      } catch (err) {
        logger.error('OAuth', 'Failed to open browser:', err)
        await handleResult({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to open browser',
        })
      }
    }

    setupAndOpen().catch((err: unknown) => {
      logger.error('OAuth', 'Setup failed:', err)
      void handleResult({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to setup OAuth',
      })
    })
  })
}
