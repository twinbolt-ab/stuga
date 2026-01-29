import { useMemo, useState, useEffect } from 'react'
import { useHAConnection } from './useHAConnection'
import { useDevMode } from './useDevMode'
import * as ws from '../ha-websocket'
import * as metadata from '../metadata'
import { generateMockData } from '../mock-data'
import type { HAEntity, RoomWithDevices } from '@/types/ha'
import { DEFAULT_ORDER } from '../constants'
import { isEntityAuxiliary } from '../ha-websocket'

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

  // Subscribe to registry updates for order changes
  useEffect(() => {
    const unsubscribe = ws.onRegistryUpdate(() => {
      setRegistryVersion((v) => v + 1)
    })
    return () => {
      unsubscribe()
    }
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
      const lights = devices.filter((d) => d.entity_id.startsWith('light.'))
      const lightsOn = lights.filter((l) => l.state === 'on').length

      // Find temperature sensors
      const tempSensors = devices
        .filter(
          (d) => d.entity_id.startsWith('sensor.') && d.attributes.device_class === 'temperature'
        )
        .filter((s) => !isNaN(parseFloat(s.state)))
        .sort((a, b) => a.entity_id.localeCompare(b.entity_id))

      // Get temperature from selected sensor, or first one alphabetically
      let temperature: number | undefined
      if (tempSensors.length > 0) {
        const selectedSensorId = areaId ? metadata.getAreaTemperatureSensor(areaId) : undefined
        const selectedSensor = selectedSensorId
          ? tempSensors.find((s) => s.entity_id === selectedSensorId)
          : undefined
        // Use selected sensor if valid, otherwise fall back to first sensor
        const sensorToUse = selectedSensor || tempSensors[0]
        temperature = parseFloat(sensorToUse.state)
      }

      // Find humidity sensors and average valid values
      const humiditySensors = devices.filter(
        (d) => d.entity_id.startsWith('sensor.') && d.attributes.device_class === 'humidity'
      )
      const validHumidities = humiditySensors
        .map((s) => parseFloat(s.state))
        .filter((v) => !isNaN(v))
      const humidity =
        validHumidities.length > 0
          ? Math.round(validHumidities.reduce((a, b) => a + b, 0) / validHumidities.length)
          : undefined

      // Get order, icon, and floor from HA
      const order = areaId ? metadata.getAreaOrder(areaId) : DEFAULT_ORDER
      const icon = areaId ? ws.getAreaIcon(areaId) : undefined
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

    // Get floors sorted by level (stable sort using floor_id as tiebreaker)
    const floorsArray = Array.from(floorRegistry.values()).sort((a, b) => {
      const levelA = a.level ?? 0
      const levelB = b.level ?? 0
      if (levelA !== levelB) return levelA - levelB
      // Stable sort: use floor_id as tiebreaker when levels are equal
      return a.floor_id.localeCompare(b.floor_id)
    })

    return { rooms: result, floors: floorsArray }
  }, [entities, registryVersion, activeMockScenario])

  // When mock mode is active, always report as connected and data received
  const effectiveIsConnected = activeMockScenario !== 'none' ? true : isConnected
  const effectiveHasReceivedData = activeMockScenario !== 'none' ? true : hasReceivedData

  return {
    rooms,
    floors,
    isConnected: effectiveIsConnected,
    hasReceivedData: effectiveHasReceivedData,
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
