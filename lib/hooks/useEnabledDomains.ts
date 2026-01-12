'use client'

import { useState, useEffect, useCallback } from 'react'
import { getEnabledDomains, setEnabledDomains as saveEnabledDomains, isEntityVisible as checkEntityVisible, getShowHiddenItems, setShowHiddenItems as saveShowHiddenItems } from '../config'
import { DEFAULT_ENABLED_DOMAINS, type ConfigurableDomain } from '@/types/ha'

/**
 * Hook for managing configurable entity domains and visibility settings
 * Returns the current enabled domains and utilities for checking entity visibility
 */
export function useEnabledDomains() {
  const [enabledDomains, setEnabledDomainsState] = useState<ConfigurableDomain[]>(DEFAULT_ENABLED_DOMAINS)
  const [showHiddenItems, setShowHiddenItemsState] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setEnabledDomainsState(getEnabledDomains())
    setShowHiddenItemsState(getShowHiddenItems())
  }, [])

  // Save domains and update state
  const setEnabledDomains = useCallback((domains: ConfigurableDomain[]) => {
    saveEnabledDomains(domains)
    setEnabledDomainsState(domains)
  }, [])

  // Check if an entity should be visible
  const isEntityVisible = useCallback((entityId: string): boolean => {
    return checkEntityVisible(entityId, enabledDomains)
  }, [enabledDomains])

  // Toggle a domain on/off
  const toggleDomain = useCallback((domain: ConfigurableDomain) => {
    const newDomains = enabledDomains.includes(domain)
      ? enabledDomains.filter(d => d !== domain)
      : [...enabledDomains, domain]

    // Ensure at least one domain is enabled
    if (newDomains.length > 0) {
      setEnabledDomains(newDomains)
    }
  }, [enabledDomains, setEnabledDomains])

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setEnabledDomains(DEFAULT_ENABLED_DOMAINS)
  }, [setEnabledDomains])

  // Toggle showHiddenItems
  const setShowHiddenItems = useCallback((show: boolean) => {
    saveShowHiddenItems(show)
    setShowHiddenItemsState(show)
  }, [])

  return {
    enabledDomains,
    setEnabledDomains,
    isEntityVisible,
    toggleDomain,
    resetToDefaults,
    showHiddenItems,
    setShowHiddenItems,
  }
}
