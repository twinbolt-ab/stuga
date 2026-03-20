import { useMemo, useState, useEffect, useCallback } from 'react'
import { useHAConnection } from './useHAConnection'
import { useDevMode } from './useDevMode'
import * as ws from '../ha-websocket'
import * as metadata from '../metadata'
import * as orderStorage from '../services/order-storage'
import * as layoutCache from '../services/layout-cache'
import { generateMockData } from '../mock-data'
import type { HAEntity, HAFloor, RoomWithDevices } from '@/types/ha'
import type { EntityOrderMap, DomainOrderMap } from '@/types/ordering'
import { DEFAULT_ORDER } from '../constants'
import { isEntityAuxiliary } from '../ha-websocket'

// Map of room slug -> EntityOrderMap
type AllEntityOrders = Map<string, EntityOrderMap>

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function useRooms() {
  const { entities, isConnected, hasReceivedData } = useHAConnection()
  const { activeMockScenario } = useDevMode()
  const [registryVersion, setRegistryVersion] = useState(0)
  const [entityOrders, setEntityOrders] = useState<AllEntityOrders>(new Map())

  // Cached layout for optimistic rendering
  const [cachedLayout, setCachedLayout] = useState<{
    floors: HAFloor[]
    rooms: RoomWithDevices[]
  } | null>(null)

  // Load cached layout on mount for optimistic rendering
  useEffect(() => {
    void layoutCache.loadLayoutCache().then((cached) => {
      if (cached) {
        setCachedLayout({
          floors: cached.floors,
          rooms: layoutCache.cachedRoomsToOptimistic(cached.rooms),
        })
      }
    })
  }, [])

  // Subscribe to registry updates for order changes
  useEffect(() => {
    const unsubscribe = ws.onRegistryUpdate(() => {
      setRegistryVersion((v) => v + 1)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  // Load entity orders for sensor domains when room slugs are known
  const loadEntityOrders = useCallback(async (roomSlugs: string[]) => {
    const newOrders: AllEntityOrders = new Map()
    for (const slug of roomSlugs) {
      const orders = await orderStorage.getAllEntityOrders(slug)
      if (Object.keys(orders).length > 0) {
        newOrders.set(slug, orders)
      }
    }
    setEntityOrders(newOrders)
  }, [])

  // Helper to get sensor order from loaded entity orders
  const getSensorOrder = useCallback(
    (roomSlug: string, entityId: string): number => {
      const roomOrders = entityOrders.get(roomSlug)
      if (!roomOrders) return DEFAULT_ORDER
      // Sensors are stored under the 'sensor' domain
      const sensorOrders = roomOrders.sensor as DomainOrderMap | undefined
      if (!sensorOrders) return DEFAULT_ORDER
      return sensorOrders[entityId] ?? DEFAULT_ORDER
    },
    [entityOrders]
  )

  const { rooms, floors, roomSlugs } = useMemo(() => {
    // If mock scenario is active, return mock data
    if (activeMockScenario !== 'none') {
      const mockData = generateMockData(activeMockScenario)
      if (mockData) {
        return { ...mockData, roomSlugs: mockData.rooms.map((r) => r.id) }
      }
    }

    const roomMap = new Map<string, { entities: HAEntity[]; areaId: string | null }>()
    const areaRegistry = ws.getAreaRegistry()
    const floorRegistry = ws.getFloors()
    const hiddenEntities = ws.getHiddenEntities()
    const stugaHiddenEntities = ws.getStugaHiddenEntities()

    // Group entities by area (we'll extract area from friendly_name or entity_id patterns)
    for (const entity of entities.values()) {
      // Skip hidden entities in normal room view (they're visible in All Devices)
      if (hiddenEntities.has(entity.entity_id)) continue
      if (stugaHiddenEntities.has(entity.entity_id)) continue
      // Skip auxiliary entities (config/diagnostic) like UniFi PoE ports
      if (isEntityAuxiliary(entity.entity_id)) continue

      const areaName = extractAreaFromEntity(entity)
      if (areaName) {
        const existing = roomMap.get(areaName) || { entities: [], areaId: null }
        existing.entities.push(entity)

        // Try to find the area_id for this room name
        if (!existing.areaId) {
          for (const [areaId, area] of areaRegistry) {
            if (area.name === areaName) {
              existing.areaId = areaId
              break
            }
          }
        }

        roomMap.set(areaName, existing)
      }
    }

    // Convert to RoomWithDevices array
    const result: RoomWithDevices[] = []

    for (const [name, { entities: devices, areaId }] of roomMap) {
      const roomSlug = slugify(name)
      const lights = devices.filter((d) => d.entity_id.startsWith('light.'))
      const lightsOn = lights.filter((l) => l.state === 'on').length

      // Find temperature sensors, sorted by entity order (first in order shows on card)
      const tempSensors = devices
        .filter(
          (d) => d.entity_id.startsWith('sensor.') && d.attributes.device_class === 'temperature'
        )
        .filter((s) => !isNaN(parseFloat(s.state)))
        .sort((a, b) => {
          const orderA = getSensorOrder(roomSlug, a.entity_id)
          const orderB = getSensorOrder(roomSlug, b.entity_id)
          if (orderA !== orderB) return orderA - orderB
          return a.entity_id.localeCompare(b.entity_id)
        })

      // Get temperature from selected sensor, or first one by entity order
      let temperature: number | undefined
      if (tempSensors.length > 0) {
        const selectedSensorId = areaId ? metadata.getAreaTemperatureSensor(areaId) : undefined
        const selectedSensor = selectedSensorId
          ? tempSensors.find((s) => s.entity_id === selectedSensorId)
          : undefined
        // Use selected sensor if valid, otherwise fall back to first sensor by order
        const sensorToUse = selectedSensor || tempSensors[0]
        temperature = parseFloat(sensorToUse.state)
      }

      // Find humidity sensors, sorted by entity order (first in order shows on card)
      const humiditySensors = devices
        .filter(
          (d) => d.entity_id.startsWith('sensor.') && d.attributes.device_class === 'humidity'
        )
        .filter((s) => !isNaN(parseFloat(s.state)))
        .sort((a, b) => {
          const orderA = getSensorOrder(roomSlug, a.entity_id)
          const orderB = getSensorOrder(roomSlug, b.entity_id)
          if (orderA !== orderB) return orderA - orderB
          return a.entity_id.localeCompare(b.entity_id)
        })

      // Get humidity from first sensor by entity order
      const humidity =
        humiditySensors.length > 0 ? Math.round(parseFloat(humiditySensors[0].state)) : undefined

      // Get order, icon, and floor from HA
      const order = areaId ? metadata.getAreaOrder(areaId) : DEFAULT_ORDER
      const icon = areaId ? ws.getAreaIcon(areaId) : undefined
      const areaEntry = areaId ? areaRegistry.get(areaId) : undefined
      const floorId = areaEntry?.floor_id

      result.push({
        id: roomSlug,
        name,
        areaId: areaId || undefined,
        floorId,
        icon,
        devices,
        lightsOn,
        totalLights: lights.length,
        temperature,
        humidity,
        order,
      })
    }

    // Sort by order from HA labels (lower = first), then alphabetically
    result.sort((a, b) => {
      const orderA = a.order ?? DEFAULT_ORDER
      const orderB = b.order ?? DEFAULT_ORDER
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })

    // Get floors sorted by level (stable sort using floor_id as tiebreaker)
    const floorsArray = Array.from(floorRegistry.values()).sort((a, b) => {
      const levelA = a.level ?? 0
      const levelB = b.level ?? 0
      if (levelA !== levelB) return levelA - levelB
      // Stable sort: use floor_id as tiebreaker when levels are equal
      return a.floor_id.localeCompare(b.floor_id)
    })

    return { rooms: result, floors: floorsArray, roomSlugs: result.map((r) => r.id) }
  }, [entities, registryVersion, activeMockScenario, getSensorOrder])

  // Load entity orders for all rooms when room slugs are known
  // This triggers a re-render once orders are loaded, updating sensor display
  const roomSlugsKey = roomSlugs.join(',')
  useEffect(() => {
    if (roomSlugs.length > 0) {
      void loadEntityOrders(roomSlugs)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomSlugsKey, loadEntityOrders])

  // Listen for entity order changes (dispatched when sensors are reordered)
  useEffect(() => {
    const handleEntityOrderChange = () => {
      if (roomSlugs.length > 0) {
        void loadEntityOrders(roomSlugs)
      }
    }

    window.addEventListener('stuga:entity-order-changed', handleEntityOrderChange)
    return () => {
      window.removeEventListener('stuga:entity-order-changed', handleEntityOrderChange)
    }
  }, [roomSlugs, loadEntityOrders])

  // Provide a way to refresh entity orders (called after reordering sensors)
  const refreshEntityOrders = useCallback(() => {
    if (roomSlugs.length > 0) {
      void loadEntityOrders(roomSlugs)
    }
  }, [roomSlugs, loadEntityOrders])

  // When mock mode is active, always report as connected and data received
  const effectiveIsConnected = activeMockScenario !== 'none' ? true : isConnected
  const effectiveHasReceivedData = activeMockScenario !== 'none' ? true : hasReceivedData

  // Use cached layout before live data arrives
  const effectiveRooms = effectiveHasReceivedData ? rooms : (cachedLayout?.rooms ?? rooms)
  const effectiveFloors = effectiveHasReceivedData ? floors : (cachedLayout?.floors ?? floors)

  // Show as "data ready" if we have cached data, even before live data arrives
  const hasDataToShow = effectiveHasReceivedData || cachedLayout !== null

  // Track if we're showing cached (stale) data vs live data
  const isShowingCachedData = !effectiveHasReceivedData && cachedLayout !== null

  return {
    rooms: effectiveRooms,
    floors: effectiveFloors,
    isConnected: effectiveIsConnected,
    hasReceivedData: hasDataToShow,
    isShowingCachedData,
    hasLiveData: effectiveHasReceivedData,
    refreshEntityOrders,
  }
}

// Helper to extract area from entity attributes (populated by ha-websocket.ts from HA registry)
function extractAreaFromEntity(entity: HAEntity): string | null {
  const area = entity.attributes.area
  if (typeof area === 'string' && area.length > 0) {
    return area
  }
  return null
}

export function useRoom(roomId: string) {
  const { rooms, floors, isConnected } = useRooms()
  const room = rooms.find((r) => r.id === roomId)
  return { room, floors, isConnected }
}
