// Home Assistant OAuth2 Authentication
// Implements the authorization code flow per https://developers.home-assistant.io/docs/auth_api/

import { STORAGE_KEYS } from './constants'
import { getStorage, getSecureStorage } from './storage'
import { logger } from './logger'

// Custom error types to distinguish between network and auth failures
export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

// OAuth tokens from HA
export interface OAuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number // seconds until expiry
  token_type: string
}

// Stored credentials include expiry timestamp
export interface StoredOAuthCredentials {
  access_token: string
  refresh_token: string
  expires_at: number // Unix timestamp (ms)
  ha_url: string
  client_id?: string // Store the client_id used during auth for consistent refresh
}

// Check if running as a native Capacitor app
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.Capacitor?.isNativePlatform?.()
}

// Client ID for the app - must be a URL
// For native apps: We use stuga.app/oauth which has the redirect_uri link tag
// For web: We use the current origin
export function getClientId(_haUrl?: string): string {
  // On native, use the website that has <link rel="redirect_uri" href="com.twinbolt.stuga:/">
  if (isNativeApp()) {
    return 'https://stuga.app/oauth'
  }

  // For web, use current origin
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return 'https://stuga.app/oauth'
}

// Get the redirect URI for OAuth callback
export function getRedirectUri(_haUrl?: string): string {
  // For native apps, use custom URL scheme
  if (isNativeApp()) {
    return 'com.twinbolt.stuga:/'
  }

  // For web, redirect back to our app (include base path for subpath deployments like /run)
  if (typeof window !== 'undefined') {
    const basePath = import.meta.env.BASE_URL || '/'
    // Ensure basePath ends without trailing slash for clean URL
    const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
    return `${window.location.origin}${base}/auth/callback`
  }

  return 'https://stuga.app/auth/callback'
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  haUrl: string,
  code: string,
  codeVerifier?: string
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: getClientId(haUrl),
    redirect_uri: getRedirectUri(haUrl),
  })

  // Add PKCE verifier if we used it
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier)
  }

  const response = await fetch(`${haUrl}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json() as Promise<OAuthTokens>
}

// Refresh the access token using refresh token
export async function refreshAccessToken(
  haUrl: string,
  refreshToken: string,
  clientId?: string,
  isRetry?: boolean
): Promise<OAuthTokens> {
  // Use stored client_id if provided, otherwise fall back to current
  const effectiveClientId = clientId || getClientId(haUrl)
  const currentClientId = getClientId(haUrl)

  logger.debug('OAuth', 'Refreshing token for', haUrl)

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: effectiveClientId,
  })

  let response: Response
  try {
    response = await fetch(`${haUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
  } catch (error) {
    // Network error (offline, DNS failure, timeout, etc.)
    logger.warn('OAuth', 'Network error during refresh:', error)
    throw new NetworkError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  if (!response.ok) {
    const errorText = await response.text()
    logger.warn('OAuth', 'Refresh failed:', response.status, errorText)

    // 400/401/403 = auth errors (invalid token, revoked, etc.) - need to re-authenticate
    // 5xx = server errors - might be temporary
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      // If we used a stored client_id that differs from current, retry with current client_id
      if (!isRetry && clientId && clientId !== currentClientId) {
        logger.debug('OAuth', 'Retrying refresh with current client_id')
        return refreshAccessToken(haUrl, refreshToken, undefined, true)
      }
      throw new AuthError(`Token refresh failed: ${response.status} ${errorText}`)
    }

    // Server errors or other issues - treat as network/temporary
    throw new NetworkError(`Server error: ${response.status} ${errorText}`)
  }

  const tokens = (await response.json()) as OAuthTokens

  // If no new refresh token is returned, keep using the old one
  if (!tokens.refresh_token) {
    tokens.refresh_token = refreshToken
  }

  logger.debug('OAuth', 'Token refreshed successfully')
  return tokens
}

// Revoke a refresh token (for logout)
export async function revokeToken(haUrl: string, token: string): Promise<void> {
  const body = new URLSearchParams({
    token,
    action: 'revoke',
  })

  await fetch(`${haUrl}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  // Response is always 200 regardless of success
}

// Storage keys for OAuth
const OAUTH_STORAGE_KEYS = {
  CREDENTIALS: 'stuga-oauth-credentials',
  PENDING_STATE: 'stuga-oauth-state',
  PENDING_VERIFIER: 'stuga-oauth-verifier',
  PENDING_URL: 'stuga-oauth-pending-url',
} as const

// In-memory cache for OAuth credentials to avoid repeated secure storage reads
let credentialsCache: StoredOAuthCredentials | null | undefined = undefined // undefined = not loaded yet
let credentialsCachePromise: Promise<StoredOAuthCredentials | null> | null = null

// Store OAuth credentials
export async function storeOAuthCredentials(
  haUrl: string,
  tokens: OAuthTokens,
  clientId?: string
): Promise<void> {
  logger.debug('OAuth', 'Storing credentials for', haUrl)
  const storage = getStorage()
  const secureStorage = getSecureStorage()
  // Use provided clientId or get current one - store it for consistent refresh
  const storedClientId = clientId || getClientId(haUrl)
  const credentials: StoredOAuthCredentials = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    ha_url: haUrl,
    client_id: storedClientId,
  }
  // Store credentials in secure storage (iOS Keychain / Android KeyStore on native)
  await secureStorage.setItem(OAUTH_STORAGE_KEYS.CREDENTIALS, JSON.stringify(credentials))
  // Update in-memory cache
  credentialsCache = credentials
  credentialsCachePromise = null
  // Mark setup as complete (non-sensitive, use regular storage)
  await storage.setItem(STORAGE_KEYS.SETUP_COMPLETE, 'true')
  // Also store URL in standard location for compatibility (non-sensitive)
  await storage.setItem(STORAGE_KEYS.HA_URL, haUrl)
  logger.debug('OAuth', 'Credentials stored successfully')
}

// Get stored OAuth credentials (with in-memory caching to avoid repeated secure storage reads)
export async function getOAuthCredentials(): Promise<StoredOAuthCredentials | null> {
  // Return cached value if we've already loaded
  if (credentialsCache !== undefined) {
    return credentialsCache
  }

  // If a load is already in progress, wait for it (prevents parallel reads)
  if (credentialsCachePromise) {
    return credentialsCachePromise
  }

  // Load from secure storage and cache the result
  credentialsCachePromise = (async () => {
    const secureStorage = getSecureStorage()
    const stored = await secureStorage.getItem(OAUTH_STORAGE_KEYS.CREDENTIALS)
    if (!stored) {
      credentialsCache = null
      return null
    }
    try {
      credentialsCache = JSON.parse(stored) as StoredOAuthCredentials
      return credentialsCache
    } catch {
      credentialsCache = null
      return null
    }
  })()

  const result = await credentialsCachePromise
  credentialsCachePromise = null
  return result
}

// Check if OAuth credentials exist
export async function hasOAuthCredentials(): Promise<boolean> {
  const creds = await getOAuthCredentials()
  return creds !== null
}

// Clear OAuth credentials
export async function clearOAuthCredentials(): Promise<void> {
  const secureStorage = getSecureStorage()
  await secureStorage.removeItem(OAUTH_STORAGE_KEYS.CREDENTIALS)
  // Clear the in-memory cache
  credentialsCache = null
  credentialsCachePromise = null
}

// Store pending OAuth state (for validation after redirect)
export async function storePendingOAuth(
  state: string,
  verifier: string | undefined,
  haUrl: string
): Promise<void> {
  const storage = getStorage()
  await storage.setItem(OAUTH_STORAGE_KEYS.PENDING_STATE, state)
  if (verifier) {
    await storage.setItem(OAUTH_STORAGE_KEYS.PENDING_VERIFIER, verifier)
  }
  await storage.setItem(OAUTH_STORAGE_KEYS.PENDING_URL, haUrl)
}

// Get and clear pending OAuth state
export async function getPendingOAuth(): Promise<{
  state: string | null
  verifier: string | null
  haUrl: string | null
}> {
  const storage = getStorage()
  const state = await storage.getItem(OAUTH_STORAGE_KEYS.PENDING_STATE)
  const verifier = await storage.getItem(OAUTH_STORAGE_KEYS.PENDING_VERIFIER)
  const haUrl = await storage.getItem(OAUTH_STORAGE_KEYS.PENDING_URL)
  return { state, verifier, haUrl }
}

// Clear pending OAuth state
export async function clearPendingOAuth(): Promise<void> {
  const storage = getStorage()
  await storage.removeItem(OAUTH_STORAGE_KEYS.PENDING_STATE)
  await storage.removeItem(OAUTH_STORAGE_KEYS.PENDING_VERIFIER)
  await storage.removeItem(OAUTH_STORAGE_KEYS.PENDING_URL)
}

// Result type for getValidAccessToken
export type TokenResult =
  | { status: 'valid'; token: string; haUrl: string }
  | { status: 'network-error'; haUrl: string } // Temporary - keep credentials, can retry
  | { status: 'auth-error' } // Permanent - credentials cleared, need re-auth
  | { status: 'no-credentials' } // Never had credentials

// Get a valid access token, refreshing if needed
export async function getValidAccessToken(): Promise<TokenResult> {
  const creds = await getOAuthCredentials()
  if (!creds) {
    return { status: 'no-credentials' }
  }

  // Check if token is expired (with 60s buffer)
  const isExpired = Date.now() >= creds.expires_at - 60000

  if (!isExpired) {
    return { status: 'valid', token: creds.access_token, haUrl: creds.ha_url }
  }

  // Token is expired, try to refresh
  logger.debug('OAuth', 'Token expired, refreshing...')
  try {
    // Use stored client_id to ensure refresh works even if accessed from different URL
    const newTokens = await refreshAccessToken(creds.ha_url, creds.refresh_token, creds.client_id)
    await storeOAuthCredentials(creds.ha_url, newTokens, creds.client_id)
    return { status: 'valid', token: newTokens.access_token, haUrl: creds.ha_url }
  } catch (error) {
    logger.warn('OAuth', 'Token refresh failed:', error)

    if (error instanceof AuthError) {
      // Permanent auth failure - credentials are invalid, need to re-authenticate
      logger.debug('OAuth', 'Auth error - clearing credentials')
      const storage = getStorage()
      await clearOAuthCredentials()
      await storage.removeItem(STORAGE_KEYS.SETUP_COMPLETE)
      return { status: 'auth-error' }
    }

    // Network error - keep credentials, user might just need to reconnect WiFi
    logger.debug('OAuth', 'Network error - keeping credentials for retry')
    return { status: 'network-error', haUrl: creds.ha_url }
  }
}

// Check if using OAuth or long-lived token auth
export async function isUsingOAuth(): Promise<boolean> {
  return await hasOAuthCredentials()
}

// PKCE Utilities for OAuth flow

/**
 * Generate a cryptographically random code verifier for PKCE
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a code challenge from the verifier using SHA-256
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hashed = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hashed)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/**
 * Generate a random state value for CSRF protection
 */
export function generateState(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
