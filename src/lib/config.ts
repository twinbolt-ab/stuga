// Credential and configuration storage helpers
// Uses storage abstraction for cross-platform support (web localStorage / Capacitor Preferences)

import { STORAGE_KEYS } from './constants'
import { getStorage } from './storage'
import { DEFAULT_ENABLED_DOMAINS, type ConfigurableDomain } from '@/types/ha'
import {
  getValidAccessToken,
  getOAuthCredentials,
  clearOAuthCredentials,
  type TokenResult,
} from './ha-oauth'

export interface StoredCredentials {
  url: string
  token: string
}

export type AuthMethod = 'oauth' | 'token' | 'addon'

// Extend Window interface for add-on mode
declare global {
  interface Window {
    __HA_ADDON__?: boolean
    __HA_URL__?: string
    __HA_TOKEN__?: string
  }
}

/**
 * Check if running as a Home Assistant add-on
 */
export function isHAAddon(): boolean {
  if (typeof window === 'undefined') return false
  return window.__HA_ADDON__ === true
}

/**
 * Get credentials from add-on environment (injected by server)
 */
export function getAddonCredentials(): StoredCredentials | null {
  if (typeof window === 'undefined') return null
  if (!window.__HA_ADDON__) return null

  const url = window.__HA_URL__
  const token = window.__HA_TOKEN__

  if (!url || !token) return null
  return { url, token }
}

/**
 * Check if initial setup has been completed
 * Returns true if in add-on mode (no setup needed)
 */
export async function isSetupComplete(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  // Add-on mode is always "setup complete"
  if (isHAAddon()) return true

  const storage = getStorage()
  return (await storage.getItem(STORAGE_KEYS.SETUP_COMPLETE)) === 'true'
}

/**
 * Synchronous version for contexts where async isn't possible
 * Only works for addon mode check - falls back to false for native storage
 */
export function isSetupCompleteSync(): boolean {
  if (typeof window === 'undefined') return false
  if (isHAAddon()) return true
  // Fallback to localStorage for web (synchronous)
  return localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETE) === 'true'
}

// Result type for getStoredCredentials - distinguishes temporary vs permanent failures
export type CredentialsResult =
  | { status: 'valid'; credentials: StoredCredentials }
  | { status: 'network-error'; haUrl: string } // Temporary - credentials exist but can't refresh
  | { status: 'no-credentials' } // No credentials stored

/**
 * Get stored Home Assistant credentials
 * Returns add-on credentials if in add-on mode, then OAuth, then manual token
 */
export async function getStoredCredentials(): Promise<CredentialsResult> {
  if (typeof window === 'undefined') return { status: 'no-credentials' }

  // Check add-on credentials first
  const addonCreds = getAddonCredentials()
  if (addonCreds) return { status: 'valid', credentials: addonCreds }

  // Check OAuth credentials
  const oauthResult = await getValidAccessToken()
  if (oauthResult.status === 'valid') {
    return { status: 'valid', credentials: { url: oauthResult.haUrl, token: oauthResult.token } }
  }
  if (oauthResult.status === 'network-error') {
    // Credentials exist but we can't refresh due to network - preserve this info
    return { status: 'network-error', haUrl: oauthResult.haUrl }
  }

  // Fall back to manual token (auth-error or no-credentials from OAuth)
  const storage = getStorage()
  const url = await storage.getItem(STORAGE_KEYS.HA_URL)
  const token = await storage.getItem(STORAGE_KEYS.HA_TOKEN)

  if (!url || !token) return { status: 'no-credentials' }
  return { status: 'valid', credentials: { url, token } }
}

/**
 * Determine which auth method is currently in use
 */
export async function getAuthMethod(): Promise<AuthMethod | null> {
  if (typeof window === 'undefined') return null

  if (isHAAddon()) return 'addon'

  const oauthCreds = await getOAuthCredentials()
  if (oauthCreds) return 'oauth'

  const storage = getStorage()
  const token = await storage.getItem(STORAGE_KEYS.HA_TOKEN)
  if (token) return 'token'

  return null
}

/**
 * Synchronous version for WebSocket initialization
 * Prefers addon credentials, falls back to localStorage
 */
export function getStoredCredentialsSync(): StoredCredentials | null {
  if (typeof window === 'undefined') return null

  // Check add-on credentials first
  const addonCreds = getAddonCredentials()
  if (addonCreds) return addonCreds

  // Fallback to localStorage (works on web, native apps init storage first)
  const url = localStorage.getItem(STORAGE_KEYS.HA_URL)
  const token = localStorage.getItem(STORAGE_KEYS.HA_TOKEN)

  if (!url || !token) return null
  return { url, token }
}

/**
 * Save Home Assistant credentials and mark setup as complete
 */
export async function saveCredentials(url: string, token: string): Promise<void> {
  if (typeof window === 'undefined') return

  const storage = getStorage()
  // Normalize URL (remove trailing slash)
  const normalizedUrl = url.replace(/\/+$/, '')

  await storage.setItem(STORAGE_KEYS.HA_URL, normalizedUrl)
  await storage.setItem(STORAGE_KEYS.HA_TOKEN, token)
  await storage.setItem(STORAGE_KEYS.SETUP_COMPLETE, 'true')
}

/**
 * Update just the HA URL
 */
export async function updateUrl(url: string): Promise<void> {
  if (typeof window === 'undefined') return
  const storage = getStorage()
  const normalizedUrl = url.replace(/\/+$/, '')
  await storage.setItem(STORAGE_KEYS.HA_URL, normalizedUrl)
}

/**
 * Update just the HA token
 */
export async function updateToken(token: string): Promise<void> {
  if (typeof window === 'undefined') return
  const storage = getStorage()
  await storage.setItem(STORAGE_KEYS.HA_TOKEN, token)
}

/**
 * Clear all credentials and setup state
 */
export async function clearCredentials(): Promise<void> {
  if (typeof window === 'undefined') return

  const storage = getStorage()
  await storage.removeItem(STORAGE_KEYS.HA_URL)
  await storage.removeItem(STORAGE_KEYS.HA_TOKEN)
  await storage.removeItem(STORAGE_KEYS.SETUP_COMPLETE)
  await storage.removeItem(STORAGE_KEYS.ENABLED_DOMAINS)
  // Also clear OAuth credentials
  await clearOAuthCredentials()
}

/**
 * Get enabled domains from storage
 */
export async function getEnabledDomains(): Promise<ConfigurableDomain[]> {
  if (typeof window === 'undefined') return DEFAULT_ENABLED_DOMAINS

  const storage = getStorage()
  const stored = await storage.getItem(STORAGE_KEYS.ENABLED_DOMAINS)
  if (!stored) return DEFAULT_ENABLED_DOMAINS

  try {
    const domains = JSON.parse(stored) as ConfigurableDomain[]
    return domains.length > 0 ? domains : DEFAULT_ENABLED_DOMAINS
  } catch {
    return DEFAULT_ENABLED_DOMAINS
  }
}

/**
 * Synchronous version for immediate rendering
 */
export function getEnabledDomainsSync(): ConfigurableDomain[] {
  if (typeof window === 'undefined') return DEFAULT_ENABLED_DOMAINS

  const stored = localStorage.getItem(STORAGE_KEYS.ENABLED_DOMAINS)
  if (!stored) return DEFAULT_ENABLED_DOMAINS

  try {
    const domains = JSON.parse(stored) as ConfigurableDomain[]
    return domains.length > 0 ? domains : DEFAULT_ENABLED_DOMAINS
  } catch {
    return DEFAULT_ENABLED_DOMAINS
  }
}

/**
 * Save enabled domains to storage
 */
export async function setEnabledDomains(domains: ConfigurableDomain[]): Promise<void> {
  if (typeof window === 'undefined') return
  const storage = getStorage()
  await storage.setItem(STORAGE_KEYS.ENABLED_DOMAINS, JSON.stringify(domains))
}

/**
 * Check if an entity should be visible based on enabled domains
 */
export function isEntityVisible(entityId: string, enabledDomains?: ConfigurableDomain[]): boolean {
  const domains = enabledDomains ?? getEnabledDomainsSync()
  return domains.some((domain) => entityId.startsWith(`${domain}.`))
}
