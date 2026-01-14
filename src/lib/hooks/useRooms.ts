import { useMemo, useState, useEffect } from 'react'
import { useHAConnection } from './useHAConnection'
import { useDevMode } from './useDevMode'
import { haWebSocket } from '../ha-websocket'
import { getShowHiddenItemsSync } from '../config'
import { generateMockData } from '../mock-data'
import type { HAEntity, RoomWithDevices } from '@/types/ha'
import { DEFAULT_ORDER, STORAGE_KEYS } from '../constants'

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
  const { entities, isConnected } = useHAConnection()
  const { activeMockScenario } = useDevMode()
  const [registryVersion, setRegistryVersion] = useState(0)
  const [showHiddenItems, setShowHiddenItems] = useState(false)

  // Load showHiddenItems on mount and listen for changes
  useEffect(() => {
    setShowHiddenItems(getShowHiddenItemsSync())

    // Listen for localStorage changes (from other components)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.SHOW_HIDDEN_ITEMS) {
        setShowHiddenItems(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', handleStorage)

    // Also poll for changes from same tab (storage event doesn't fire for same tab)
    const interval = setInterval(() => {
      setShowHiddenItems(getShowHiddenItemsSync())
    }, 500)

    return () => {
      window.removeEventListener('storage', handleStorage)
      clearInterval(interval)
    }
  }, [])

  // Subscribe to registry updates for order changes
  useEffect(() => {
    const unsubscribe = haWebSocket.onRegistryUpdate(() => {
      setRegistryVersion(v => v + 1)
    })
    return () => { unsubscribe() }
  }, [])

  const { rooms, floors } = useMemo(() => {
    // If mock scenario is active, return mock data
    if (activeMockScenario !== 'none') {
      const mockData = generateMockData(activeMockScenario)
      if (mockData) {
        return mockData
      }
    }

    const roomMap = new Map<string, { entities: HAEntity[]; areaId: string | null }>()
    const areaRegistry = haWebSocket.getAreaRegistry()
    const floorRegistry = haWebSocket.getFloors()
    const hiddenEntities = haWebSocket.getHiddenEntities()

    // Group entities by area (we'll extract area from friendly_name or entity_id patterns)
    for (const entity of entities.values()) {
      // Skip hidden entities (unless showHiddenItems is enabled)
      if (!showHiddenItems && hiddenEntities.has(entity.entity_id)) continue

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
      const lights = devices.filter((d) => d.entity_id.startsWith('light.'))
      const lightsOn = lights.filter((l) => l.state === 'on').length

      // Find temperature sensors and average valid values
      const tempSensors = devices.filter(
        (d) =>
          d.entity_id.startsWith('sensor.') &&
          d.attributes.device_class === 'temperature'
      )
      const validTemps = tempSensors
        .map((s) => parseFloat(s.state))
        .filter((v) => !isNaN(v))
      const temperature = validTemps.length > 0
        ? validTemps.reduce((a, b) => a + b, 0) / validTemps.length
        : undefined

      // Find humidity sensors and average valid values
      const humiditySensors = devices.filter(
        (d) =>
          d.entity_id.startsWith('sensor.') &&
          d.attributes.device_class === 'humidity'
      )
      const validHumidities = humiditySensors
        .map((s) => parseFloat(s.state))
        .filter((v) => !isNaN(v))
      const humidity = validHumidities.length > 0
        ? Math.round(validHumidities.reduce((a, b) => a + b, 0) / validHumidities.length)
        : undefined

      // Get order, icon, and floor from HA
      const order = areaId ? haWebSocket.getAreaOrder(areaId) : DEFAULT_ORDER
      const icon = areaId ? haWebSocket.getAreaIcon(areaId) : undefined
      const areaEntry = areaId ? areaRegistry.get(areaId) : undefined
      const floorId = areaEntry?.floor_id

      result.push({
        id: slugify(name),
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

    // Get floors sorted by level
    const floorsArray = Array.from(floorRegistry.values()).sort((a, b) => {
      const levelA = a.level ?? 0
      const levelB = b.level ?? 0
      return levelA - levelB
    })

    return { rooms: result, floors: floorsArray }
  }, [entities, registryVersion, showHiddenItems, activeMockScenario])

  // When mock mode is active, always report as connected
  const effectiveIsConnected = activeMockScenario !== 'none' ? true : isConnected

  return { rooms, floors, isConnected: effectiveIsConnected }
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
