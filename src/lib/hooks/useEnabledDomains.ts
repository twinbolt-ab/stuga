import { useState, useCallback } from 'react'
import {
  getEnabledDomainsSync,
  setEnabledDomains as saveEnabledDomains,
  isEntityVisible as checkEntityVisible,
} from '../config'
import { DEFAULT_ENABLED_DOMAINS, type ConfigurableDomain } from '@/types/ha'

/**
 * Hook for managing configurable entity domains and visibility settings
 * Returns the current enabled domains and utilities for checking entity visibility
 */
export function useEnabledDomains() {
  // Initialize with stored value - getEnabledDomainsSync handles SSR by returning defaults
  const [enabledDomains, setEnabledDomainsState] = useState<ConfigurableDomain[]>(() =>
    getEnabledDomainsSync()
  )

  // Save domains and update state
  const setEnabledDomains = useCallback((domains: ConfigurableDomain[]) => {
    void saveEnabledDomains(domains)
    setEnabledDomainsState(domains)
  }, [])

  // Check if an entity should be visible
  const isEntityVisible = useCallback(
    (entityId: string): boolean => {
      return checkEntityVisible(entityId, enabledDomains)
    },
    [enabledDomains]
  )

  // Toggle a domain on/off
  const toggleDomain = useCallback(
    (domain: ConfigurableDomain) => {
      const newDomains = enabledDomains.includes(domain)
        ? enabledDomains.filter((d) => d !== domain)
        : [...enabledDomains, domain]

      // Ensure at least one domain is enabled
      if (newDomains.length > 0) {
        setEnabledDomains(newDomains)
      }
    },
    [enabledDomains, setEnabledDomains]
  )

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setEnabledDomains(DEFAULT_ENABLED_DOMAINS)
  }, [setEnabledDomains])

  return {
    enabledDomains,
    setEnabledDomains,
    isEntityVisible,
    toggleDomain,
    resetToDefaults,
  }
}
