'use client'

import { useMemo } from 'react'
import { useHAConnection } from './useHAConnection'
import { useEnabledDomains } from './useEnabledDomains'
import { haWebSocket } from '../ha-websocket'
import type { HAEntity, ConfigurableDomain } from '@/types/ha'
import { ALL_CONFIGURABLE_DOMAINS } from '@/types/ha'

/**
 * Hook for getting entities that don't belong to any room/area
 * Returns entities grouped by domain for display
 */
export function useUncategorizedEntities() {
  const { entities, isConnected } = useHAConnection()
  const { enabledDomains, showHiddenItems } = useEnabledDomains()

  const uncategorizedEntities = useMemo(() => {
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
  }, [entities, enabledDomains, showHiddenItems])

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
