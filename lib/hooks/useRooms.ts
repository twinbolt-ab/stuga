'use client'

import { useMemo, useState, useEffect } from 'react'
import { useHAConnection } from './useHAConnection'
import { haWebSocket } from '../ha-websocket'
import type { HAEntity, RoomWithDevices } from '@/types/ha'
import { DEFAULT_ORDER } from '../constants'

// Room icons (order is now dynamic from HA labels)
const ROOM_ICONS: Record<string, string> = {
  'Hall': 'door-open',
  'Kök': 'utensils',
  'Matbord och vardagsrum': 'sofa',
  'Sovrum vuxna': 'bed',
  'Cleos rum': 'star',
  'Noras rum': 'star',
  'Stora badrummet': 'bath',
  'Lilla badrummet': 'droplet',
  'Korridor uppe': 'arrow-right',
  'Kontor': 'briefcase',
  'Garage ': 'car',
  'Förråd trappa': 'archive',
  'Källare': 'layers',
  'Pool': 'waves',
  'Trädgård': 'trees',
  'Groventré': 'door-closed',
  'Trappa': 'stairs',
}

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
  const [registryVersion, setRegistryVersion] = useState(0)

  // Subscribe to registry updates for order changes
  useEffect(() => {
    const unsubscribe = haWebSocket.onRegistryUpdate(() => {
      setRegistryVersion(v => v + 1)
    })
    return () => { unsubscribe() }
  }, [])

  const rooms = useMemo(() => {
    const roomMap = new Map<string, { entities: HAEntity[]; areaId: string | null }>()
    const areaRegistry = haWebSocket.getAreaRegistry()

    // Group entities by area (we'll extract area from friendly_name or entity_id patterns)
    for (const entity of entities.values()) {
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

      // Find temperature sensor
      const tempSensor = devices.find(
        (d) =>
          d.entity_id.startsWith('sensor.') &&
          d.attributes.device_class === 'temperature'
      )

      // Find humidity sensor
      const humiditySensor = devices.find(
        (d) =>
          d.entity_id.startsWith('sensor.') &&
          d.attributes.device_class === 'humidity'
      )

      // Get order from HA labels (or default)
      const order = areaId ? haWebSocket.getAreaOrder(areaId) : DEFAULT_ORDER

      result.push({
        id: slugify(name),
        name,
        areaId: areaId || undefined,
        devices,
        lightsOn,
        totalLights: lights.length,
        temperature: tempSensor ? parseFloat(tempSensor.state) : undefined,
        humidity: humiditySensor ? parseFloat(humiditySensor.state) : undefined,
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

    return result
  }, [entities, registryVersion])

  return { rooms, isConnected }
}

// Aliases for matching device names to rooms
const ROOM_ALIASES: Record<string, string[]> = {
  'Sovrum vuxna': ['sovrum vuxna', 'sovrum spot', 'sovrum tak'],
  'Cleos rum': ['cleos rum', 'cleo tak', 'cleo spot', 'cleos spot', 'cleos tak'],
  'Noras rum': ['noras rum', 'nora tak', 'nora spot', 'noras tak', 'noras spot', 'nora taklampa'],
  'Stora badrummet': ['stora badrummet', 'stora toaletten', 'badrumssk'],
  'Lilla badrummet': ['lilla badrummet', 'lilla toaletten'],
  'Matbord och vardagsrum': ['matbord', 'vardagsrum', 'soffbord', 'över soffbordet'],
  'Kök': ['kök', 'köks', 'grovkök'],
  'Kontor': ['kontor', 'skrivbord', 'elgato'],
  'Pool': ['pool', 'bastu'],
  'Trädgård': ['trädgård', 'lily outdoor', 'spa temp', 'spa ', 'ute'],
  'Garage ': ['garage'],
  'Förråd trappa': ['förråd'],
  'Källare': ['källare'],
  'Groventré': ['grovent', 'grovkök'],
  'Hall': ['hall', 'entre', 'långben'],
  'Korridor uppe': ['korridor uppe'],
  'Trappa': ['trappa'],
}

// Helper to extract area from entity attributes or name patterns
function extractAreaFromEntity(entity: HAEntity): string | null {
  // First check if there's an explicit area attribute
  const area = entity.attributes.area
  if (typeof area === 'string' && area.length > 0) {
    return area
  }

  const friendlyName = (entity.attributes.friendly_name || '').toLowerCase()

  // Try to match using aliases first (more specific)
  for (const [roomName, aliases] of Object.entries(ROOM_ALIASES)) {
    for (const alias of aliases) {
      if (friendlyName.includes(alias)) {
        return roomName
      }
    }
  }

  // Fallback: Try to match known room names in the friendly_name
  for (const roomName of Object.keys(ROOM_ICONS)) {
    if (friendlyName.includes(roomName.toLowerCase())) {
      return roomName
    }
  }

  return null
}

export function useRoom(roomId: string) {
  const { rooms, isConnected } = useRooms()
  const room = rooms.find((r) => r.id === roomId)
  return { room, isConnected }
}
