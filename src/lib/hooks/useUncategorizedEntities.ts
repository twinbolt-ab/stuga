import { useMemo } from 'react'
import { useHAConnection } from './useHAConnection'
import { useEnabledDomains } from './useEnabledDomains'
import { useDevMode } from './useDevMode'
import { haWebSocket } from '../ha-websocket'
import { generateMockData } from '../mock-data'
import type { HAEntity, ConfigurableDomain } from '@/types/ha'
import { ALL_CONFIGURABLE_DOMAINS } from '@/types/ha'

/**
 * Hook for getting entities that don't belong to any room/area
 * Returns entities grouped by domain for display
 */
export function useUncategorizedEntities() {
  const { entities, isConnected } = useHAConnection()
  const { enabledDomains, showHiddenItems } = useEnabledDomains()
  const { activeMockScenario } = useDevMode()

  const uncategorizedEntities = useMemo(() => {
    // Check for mock data first
    if (activeMockScenario !== 'none') {
      const mockData = generateMockData(activeMockScenario)
      if (mockData?.uncategorizedEntities) {
        // Filter mock entities by enabled domains
        return mockData.uncategorizedEntities.filter(entity => {
          const domain = entity.entity_id.split('.')[0] as ConfigurableDomain
          if (!ALL_CONFIGURABLE_DOMAINS.includes(domain)) return false
          if (!enabledDomains.includes(domain)) return false
          return true
        })
      }
      // Mock scenario with no uncategorized entities
      return []
    }

    const result: HAEntity[] = []

    for (const entity of entities.values()) {
      // Skip if entity has an area
      if (entity.attributes.area) continue

      // Get domain from entity_id
      const domain = entity.entity_id.split('.')[0] as ConfigurableDomain

      // Skip if not a configurable domain
      if (!ALL_CONFIGURABLE_DOMAINS.includes(domain)) continue

      // Skip if domain is not enabled
      if (!enabledDomains.includes(domain)) continue

      // Skip if entity is hidden (unless showHiddenItems is enabled)
      if (!showHiddenItems && haWebSocket.isEntityHidden(entity.entity_id)) continue

      result.push(entity)
    }

    return result
  }, [entities, enabledDomains, showHiddenItems, activeMockScenario])

  // Group by domain
  const uncategorizedByDomain = useMemo(() => {
    const byDomain = new Map<ConfigurableDomain, HAEntity[]>()

    for (const entity of uncategorizedEntities) {
      const domain = entity.entity_id.split('.')[0] as ConfigurableDomain
      const existing = byDomain.get(domain) || []
      existing.push(entity)
      byDomain.set(domain, existing)
    }

    return byDomain
  }, [uncategorizedEntities])

  return {
    uncategorizedEntities,
    uncategorizedByDomain,
    totalCount: uncategorizedEntities.length,
    isConnected,
  }
}
