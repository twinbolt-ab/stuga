// In-app browser OAuth handler for native apps
// Uses @capgo/inappbrowser to handle OAuth flow without relying on AppAuth library

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
    let urlChangeListener: { remove: () => Promise<void> } | null = null
    let closeListener: { remove: () => Promise<void> } | null = null

    const cleanup = async () => {
      if (urlChangeListener) {
        await urlChangeListener.remove()
        urlChangeListener = null
      }
      if (closeListener) {
        await closeListener.remove()
        closeListener = null
      }
    }

    const handleResult = async (result: OAuthResult) => {
      if (resolved) return
      resolved = true
      await cleanup()
      resolve(result)
    }

    // Listen for URL changes to detect redirect
    InAppBrowser.addListener('urlChangeEvent', async (event) => {
      if (resolved) return

      const url = event.url
      logger.debug('OAuth', 'URL changed:', url)

      // Check if this is our redirect
      if (url.startsWith(redirectUri) || url.startsWith('com.twinbolt.stuga:')) {
        logger.debug('OAuth', 'Detected redirect, processing...')

        try {
          // Close the browser first
          await InAppBrowser.close()
        } catch {
          // Ignore close errors
        }

        // Parse the callback URL
        let callbackUrl: URL
        try {
          // Handle both formats: com.twinbolt.stuga:/?code=xxx and com.twinbolt.stuga:/auth/callback?code=xxx
          callbackUrl = new URL(url)
        } catch {
          // URL parsing might fail for custom schemes, try to extract params manually
          const queryStart = url.indexOf('?')
          if (queryStart === -1) {
            await handleResult({ success: false, error: 'Invalid callback URL' })
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
          return
        }

        // If URL parsing succeeded
        const error = callbackUrl.searchParams.get('error')
        if (error) {
          await handleResult({ success: false, error })
          return
        }

        const returnedState = callbackUrl.searchParams.get('state')
        if (returnedState !== state) {
          logger.error('OAuth', 'State mismatch', { expected: state, got: returnedState })
          await handleResult({ success: false, error: 'State mismatch - possible CSRF attack' })
          return
        }

        const code = callbackUrl.searchParams.get('code')
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
    }).then((listener) => {
      urlChangeListener = listener
    })

    // Listen for browser close (user cancelled)
    InAppBrowser.addListener('closeEvent', async () => {
      if (!resolved) {
        logger.debug('OAuth', 'User closed browser')
        await handleResult({ success: false, error: 'User cancelled' })
      }
    }).then((listener) => {
      closeListener = listener
    })

    // Open the in-app browser
    InAppBrowser.openWebView({
      url: authUrl.toString(),
      title: 'Login to Home Assistant',
      toolbarType: ToolBarType.NAVIGATION,
    }).catch(async (err) => {
      logger.error('OAuth', 'Failed to open browser:', err)
      await handleResult({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to open browser',
      })
    })
  })
}
