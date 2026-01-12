// Credential and configuration storage helpers
// Uses localStorage for credentials (same approach as HA frontend)

import { STORAGE_KEYS } from './constants'
import { DEFAULT_ENABLED_DOMAINS, type ConfigurableDomain } from '@/types/ha'

export interface StoredCredentials {
  url: string
  token: string
}

/**
 * Check if initial setup has been completed
 */
export function isSetupComplete(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEYS.SETUP_COMPLETE) === 'true'
}

/**
 * Get stored Home Assistant credentials
 */
export function getStoredCredentials(): StoredCredentials | null {
  if (typeof window === 'undefined') return null

  const url = localStorage.getItem(STORAGE_KEYS.HA_URL)
  const token = localStorage.getItem(STORAGE_KEYS.HA_TOKEN)

  if (!url || !token) return null
  return { url, token }
}

/**
 * Save Home Assistant credentials and mark setup as complete
 */
export function saveCredentials(url: string, token: string): void {
  if (typeof window === 'undefined') return

  // Normalize URL (remove trailing slash)
  const normalizedUrl = url.replace(/\/+$/, '')

  localStorage.setItem(STORAGE_KEYS.HA_URL, normalizedUrl)
  localStorage.setItem(STORAGE_KEYS.HA_TOKEN, token)
  localStorage.setItem(STORAGE_KEYS.SETUP_COMPLETE, 'true')
}

/**
 * Update just the HA URL
 */
export function updateUrl(url: string): void {
  if (typeof window === 'undefined') return
  const normalizedUrl = url.replace(/\/+$/, '')
  localStorage.setItem(STORAGE_KEYS.HA_URL, normalizedUrl)
}

/**
 * Update just the HA token
 */
export function updateToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.HA_TOKEN, token)
}

/**
 * Clear all credentials and setup state
 */
export function clearCredentials(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem(STORAGE_KEYS.HA_URL)
  localStorage.removeItem(STORAGE_KEYS.HA_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.SETUP_COMPLETE)
  localStorage.removeItem(STORAGE_KEYS.ENABLED_DOMAINS)
}

/**
 * Get enabled domains from localStorage
 */
export function getEnabledDomains(): ConfigurableDomain[] {
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
 * Save enabled domains to localStorage
 */
export function setEnabledDomains(domains: ConfigurableDomain[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.ENABLED_DOMAINS, JSON.stringify(domains))
}

/**
 * Check if an entity should be visible based on enabled domains
 */
export function isEntityVisible(entityId: string, enabledDomains?: ConfigurableDomain[]): boolean {
  const domains = enabledDomains ?? getEnabledDomains()
  return domains.some(domain => entityId.startsWith(`${domain}.`))
}

/**
 * Get showHiddenItems setting from localStorage
 */
export function getShowHiddenItems(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEYS.SHOW_HIDDEN_ITEMS) === 'true'
}

/**
 * Save showHiddenItems setting to localStorage
 */
export function setShowHiddenItems(show: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.SHOW_HIDDEN_ITEMS, show ? 'true' : 'false')
}
