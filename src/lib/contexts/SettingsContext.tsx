import { createContext, useContext, useEffect, useCallback, useState, ReactNode } from 'react'
import { logSettingChange } from '../analytics'
import * as orderStorage from '../services/order-storage'
import { getStorage } from '../storage'
import { STORAGE_KEYS } from '../constants'
import { DEFAULT_ENABLED_DOMAINS, type ConfigurableDomain } from '@/types/ha'
import {
  getEnabledDomainsSync,
  setEnabledDomains as saveEnabledDomains,
  isEntityVisible as checkEntityVisible,
} from '../config'

export interface SyncResult {
  rooms: number
  devices: number
}

interface SettingsContextValue {
  // Custom order feature (replaces reorderingDisabled + roomOrderSyncToHA)
  customOrderEnabled: boolean
  setCustomOrderEnabled: (value: boolean) => Promise<SyncResult | undefined>
  // Enabled domains (device types)
  enabledDomains: ConfigurableDomain[]
  setEnabledDomains: (domains: ConfigurableDomain[]) => void
  toggleDomain: (domain: ConfigurableDomain) => void
  resetDomainsToDefaults: () => void
  isEntityVisible: (entityId: string) => boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

interface SettingsProviderProps {
  children: ReactNode
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  // Custom order enabled setting (default true)
  const [customOrderEnabled, setCustomOrderEnabledState] = useState(true)

  // Enabled domains setting
  const [enabledDomains, setEnabledDomainsState] = useState<ConfigurableDomain[]>(() =>
    getEnabledDomainsSync()
  )

  // Load settings on mount
  useEffect(() => {
    let mounted = true

    async function loadSettings() {
      const storage = getStorage()

      // Load custom order enabled setting (default true)
      const customOrderValue = await storage.getItem(STORAGE_KEYS.CUSTOM_ORDER_ENABLED)
      if (mounted) {
        // Default to true, only false if explicitly set to 'false'
        setCustomOrderEnabledState(customOrderValue !== 'false')
      }
    }

    void loadSettings()

    return () => {
      mounted = false
    }
  }, [])

  const setCustomOrderEnabled = useCallback(
    async (value: boolean): Promise<SyncResult | undefined> => {
      const storage = getStorage()

      if (value) {
        // Enabling custom order: enable HA sync
        await storage.setItem(STORAGE_KEYS.CUSTOM_ORDER_ENABLED, 'true')
        const result = await orderStorage.setRoomOrderHASync(true)
        setCustomOrderEnabledState(value)
        void logSettingChange('custom_order_enabled', value)
        return result ?? { rooms: 0, devices: 0 }
      } else {
        // Disabling custom order: clean up all order labels from HA, then disable sync
        const { cleanupAllOrderLabels } = await import('../metadata/cleanup')
        await cleanupAllOrderLabels()
        await orderStorage.setRoomOrderHASync(false)
        await storage.setItem(STORAGE_KEYS.CUSTOM_ORDER_ENABLED, 'false')
        setCustomOrderEnabledState(value)
        void logSettingChange('custom_order_enabled', value)
      }
    },
    []
  )

  // Save domains and update state
  const setEnabledDomains = useCallback((domains: ConfigurableDomain[]) => {
    void saveEnabledDomains(domains)
    setEnabledDomainsState(domains)
  }, [])

  // Toggle a domain on/off
  const toggleDomain = useCallback(
    (domain: ConfigurableDomain) => {
      const isCurrentlyEnabled = enabledDomains.includes(domain)
      const newDomains = isCurrentlyEnabled
        ? enabledDomains.filter((d) => d !== domain)
        : [...enabledDomains, domain]

      // Ensure at least one domain is enabled
      if (newDomains.length > 0) {
        setEnabledDomains(newDomains)
        void logSettingChange('domain_config', `${domain}:${!isCurrentlyEnabled}`)
      }
    },
    [enabledDomains, setEnabledDomains]
  )

  // Reset to defaults
  const resetDomainsToDefaults = useCallback(() => {
    setEnabledDomains(DEFAULT_ENABLED_DOMAINS)
  }, [setEnabledDomains])

  // Check if an entity should be visible
  const isEntityVisible = useCallback(
    (entityId: string): boolean => {
      return checkEntityVisible(entityId, enabledDomains)
    },
    [enabledDomains]
  )

  return (
    <SettingsContext.Provider
      value={{
        customOrderEnabled,
        setCustomOrderEnabled,
        enabledDomains,
        setEnabledDomains,
        toggleDomain,
        resetDomainsToDefaults,
        isEntityVisible,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettingsContext(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider')
  }
  return context
}
