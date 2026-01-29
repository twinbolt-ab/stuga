import { useMemo, useState, useCallback } from 'react'
import { useHAConnection } from './useHAConnection'
import { useEnabledDomains } from './useEnabledDomains'
import { useDevMode } from './useDevMode'
import { isEntityHidden, isEntityHiddenInStuga, isEntityAuxiliary } from '../ha-websocket'
import { generateMockData } from '../mock-data'
import type { HAEntity, ConfigurableDomain } from '@/types/ha'
import { ALL_CONFIGURABLE_DOMAINS } from '@/types/ha'

export interface EntityMeta {
  isHiddenInStuga: boolean
  isHiddenInHA: boolean
  hasRoom: boolean
  roomName?: string
}

export type FilterType = 'all' | 'hidden-stuga' | 'hidden-ha' | 'no-room'

/**
 * Hook for getting all entities with metadata about their status.
 * Shows all entities regardless of room assignment or hidden status.
 * Supports search filtering and status filters.
 */
export function useAllEntities() {
  const { entities, isConnected } = useHAConnection()
  const { enabledDomains } = useEnabledDomains()
  const { activeMockScenario } = useDevMode()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  // First pass: get all entities without status filters (needed for counts)
  const baseEntities = useMemo(() => {
    // Check for mock data first
    if (activeMockScenario !== 'none') {
      const mockData = generateMockData(activeMockScenario)
      if (mockData?.uncategorizedEntities) {
        // Filter mock entities by enabled domains and search
        return mockData.uncategorizedEntities.filter((entity) => {
          const domain = entity.entity_id.split('.')[0] as ConfigurableDomain
          if (!ALL_CONFIGURABLE_DOMAINS.includes(domain)) return false
          if (!enabledDomains.includes(domain)) return false

          if (searchQuery) {
            const name = (entity.attributes.friendly_name || entity.entity_id).toLowerCase()
            const id = entity.entity_id.toLowerCase()
            const query = searchQuery.toLowerCase()
            if (!name.includes(query) && !id.includes(query)) return false
          }

          return true
        })
      }
      return []
    }

    const result: HAEntity[] = []

    for (const entity of entities.values()) {
      // Get domain from entity_id
      const domain = entity.entity_id.split('.')[0] as ConfigurableDomain

      // Skip if not a configurable domain
      if (!ALL_CONFIGURABLE_DOMAINS.includes(domain)) continue

      // Skip if domain is not enabled
      if (!enabledDomains.includes(domain)) continue

      // Skip auxiliary entities (config/diagnostic) like UniFi PoE ports
      if (isEntityAuxiliary(entity.entity_id)) continue

      // Apply search filter
      if (searchQuery) {
        const name = (entity.attributes.friendly_name || entity.entity_id).toLowerCase()
        const id = entity.entity_id.toLowerCase()
        const query = searchQuery.toLowerCase()
        if (!name.includes(query) && !id.includes(query)) continue
      }

      result.push(entity)
    }

    return result
  }, [entities, enabledDomains, searchQuery, activeMockScenario])

  // Apply status filter to get displayed entities
  const allEntities = useMemo(() => {
    return baseEntities.filter((entity) => {
      const hiddenInStuga = isEntityHiddenInStuga(entity.entity_id)
      const hiddenInHA = isEntityHidden(entity.entity_id)
      const hasRoom = !!entity.attributes.area

      // 'all' filter excludes hidden items (they appear only in their specific filters)
      if (activeFilter === 'all') return !hiddenInStuga
      if (activeFilter === 'hidden-stuga') return hiddenInStuga
      if (activeFilter === 'hidden-ha') return hiddenInHA
      if (activeFilter === 'no-room') return !hasRoom && !hiddenInStuga

      return true
    })
  }, [baseEntities, activeFilter])

  // Build metadata map for all entities
  const entityMeta = useMemo(() => {
    const meta = new Map<string, EntityMeta>()

    for (const entity of allEntities) {
      const area = entity.attributes.area
      meta.set(entity.entity_id, {
        isHiddenInStuga: isEntityHiddenInStuga(entity.entity_id),
        isHiddenInHA: isEntityHidden(entity.entity_id),
        hasRoom: !!area,
        roomName: typeof area === 'string' ? area : undefined,
      })
    }

    return meta
  }, [allEntities])

  // Group by domain
  const entitiesByDomain = useMemo(() => {
    const byDomain = new Map<ConfigurableDomain, HAEntity[]>()

    for (const entity of allEntities) {
      const domain = entity.entity_id.split('.')[0] as ConfigurableDomain
      const existing = byDomain.get(domain) || []
      existing.push(entity)
      byDomain.set(domain, existing)
    }

    return byDomain
  }, [allEntities])

  // Calculate counts from base entities (unfiltered by status)
  const { hiddenInStugaCount, hiddenInHACount, noRoomCount } = useMemo(() => {
    let hiddenInStuga = 0
    let hiddenInHA = 0
    let noRoom = 0

    for (const entity of baseEntities) {
      if (isEntityHiddenInStuga(entity.entity_id)) hiddenInStuga++
      if (isEntityHidden(entity.entity_id)) hiddenInHA++
      if (!entity.attributes.area) noRoom++
    }

    return { hiddenInStugaCount: hiddenInStuga, hiddenInHACount: hiddenInHA, noRoomCount: noRoom }
  }, [baseEntities])

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleFilterChange = useCallback((filter: FilterType) => {
    setActiveFilter(filter)
  }, [])

  return {
    allEntities,
    entitiesByDomain,
    entityMeta,
    totalCount: baseEntities.length,
    filteredCount: allEntities.length,
    hiddenInStugaCount,
    hiddenInHACount,
    noRoomCount,
    isConnected,
    searchQuery,
    setSearchQuery: handleSearchChange,
    activeFilter,
    setActiveFilter: handleFilterChange,
  }
}
