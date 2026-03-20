/**
 * Unified Order Storage Service
 *
 * Handles both room and entity ordering with support for:
 * - Client-side storage (localStorage/Capacitor) - default
 * - Optional Home Assistant label sync for both room and entity ordering
 */

import type { RoomOrderMap, EntityOrderMap, DomainOrderMap } from '@/types/ordering'
import { getStorage } from '@/lib/storage'
import {
  STORAGE_KEYS,
  ROOM_ORDER_LABEL_PREFIX,
  DEVICE_ORDER_LABEL_PREFIX,
  DEFAULT_ORDER,
} from '@/lib/constants'
import * as ws from '@/lib/ha-websocket'
import { getState } from '@/lib/ha-websocket'

// ============================================================================
// Room Ordering - Client-side with optional HA sync
// ============================================================================

/**
 * Get room order from localStorage
 */
export async function getRoomOrder(areaId: string): Promise<number> {
  const storage = getStorage()
  const stored = await storage.getItem(STORAGE_KEYS.ROOM_ORDER)

  if (!stored) return DEFAULT_ORDER

  try {
    const orderMap = JSON.parse(stored) as RoomOrderMap
    return orderMap[areaId] ?? DEFAULT_ORDER
  } catch {
    return DEFAULT_ORDER
  }
}

/**
 * Set room order in localStorage
 */
export async function setRoomOrder(areaId: string, order: number): Promise<void> {
  const storage = getStorage()
  const stored = await storage.getItem(STORAGE_KEYS.ROOM_ORDER)

  let orderMap: RoomOrderMap = {}
  if (stored) {
    try {
      orderMap = JSON.parse(stored) as RoomOrderMap
    } catch {
      orderMap = {}
    }
  }

  orderMap[areaId] = order
  await storage.setItem(STORAGE_KEYS.ROOM_ORDER, JSON.stringify(orderMap))
}

/**
 * Get all room orders from localStorage
 */
export async function getAllRoomOrders(): Promise<RoomOrderMap> {
  const storage = getStorage()
  const stored = await storage.getItem(STORAGE_KEYS.ROOM_ORDER)

  if (!stored) return {}

  try {
    return JSON.parse(stored) as RoomOrderMap
  } catch {
    return {}
  }
}

/**
 * Set all room orders at once (useful for migration and bulk updates)
 */
export async function setAllRoomOrders(orderMap: RoomOrderMap): Promise<void> {
  const storage = getStorage()
  await storage.setItem(STORAGE_KEYS.ROOM_ORDER, JSON.stringify(orderMap))
}

/**
 * Check if room order migration from HA labels has been completed
 */
export async function isRoomOrderMigrated(): Promise<boolean> {
  const storage = getStorage()
  const migrated = await storage.getItem(STORAGE_KEYS.ROOM_ORDER_MIGRATED)
  return migrated === 'true'
}

/**
 * Mark room order migration as complete
 */
async function markRoomOrderMigrated(): Promise<void> {
  const storage = getStorage()
  await storage.setItem(STORAGE_KEYS.ROOM_ORDER_MIGRATED, 'true')
}

/**
 * One-time migration: Read room and entity order from HA labels and save to localStorage.
 * If HA labels exist, also enables HA sync so future changes sync back.
 * Returns true if HA labels were found and sync was enabled.
 */
export async function migrateRoomOrderFromHA(): Promise<boolean> {
  // Check if already migrated
  if (await isRoomOrderMigrated()) {
    return false
  }

  const state = getState()
  if (!state) {
    console.warn('Cannot migrate order: WebSocket not connected')
    return false
  }

  const orderMap: RoomOrderMap = {}

  // Read order from HA labels for each area
  for (const [areaId, area] of state.areaRegistry) {
    if (!area.labels) continue

    for (const labelId of area.labels) {
      const label = state.labels.get(labelId)
      if (label?.name.startsWith(ROOM_ORDER_LABEL_PREFIX)) {
        const orderStr = label.name.slice(ROOM_ORDER_LABEL_PREFIX.length)
        const order = parseInt(orderStr, 10)
        if (!isNaN(order)) {
          orderMap[areaId] = order
        }
      }
    }
  }

  // Also check for entity order labels
  let hasEntityOrderLabels = false
  for (const [, entity] of state.entityRegistry) {
    if (!entity.labels) continue
    for (const labelId of entity.labels) {
      const label = state.labels.get(labelId)
      if (label?.name.startsWith(DEVICE_ORDER_LABEL_PREFIX)) {
        hasEntityOrderLabels = true
        break
      }
    }
    if (hasEntityOrderLabels) break
  }

  const foundHALabels = Object.keys(orderMap).length > 0 || hasEntityOrderLabels

  // Save to localStorage
  if (foundHALabels) {
    if (Object.keys(orderMap).length > 0) {
      await setAllRoomOrders(orderMap)
    }
    // Enable HA sync since labels already exist in HA
    const storage = getStorage()
    await storage.setItem(STORAGE_KEYS.ROOM_ORDER_SYNC_TO_HA, 'true')
    console.log(
      `Migrated room order for ${Object.keys(orderMap).length} rooms from HA labels to localStorage (sync enabled)`
    )

    // Also migrate entity order if present
    if (hasEntityOrderLabels) {
      await migrateEntityOrderFromHA()
    }
  }

  // Mark migration as complete
  await markRoomOrderMigrated()
  return foundHALabels
}

/**
 * Sync current room order from localStorage to HA labels
 * Used when user enables "Sync to Home Assistant" setting
 * Returns the number of rooms synced
 */
export async function syncRoomOrderToHA(): Promise<number> {
  const state = getState()
  if (!state) {
    throw new Error('Cannot sync to HA: WebSocket not connected')
  }

  const orderMap = await getAllRoomOrders()

  // Write each room's order to HA labels
  const promises = Object.entries(orderMap).map(([areaId, order]) => ws.setAreaOrder(areaId, order))

  await Promise.all(promises)
  console.log(`Synced room order for ${promises.length} rooms to HA labels`)
  return promises.length
}

/**
 * Check if HA sync is enabled for room ordering
 * Defaults to true - only false if explicitly disabled
 */
export async function isRoomOrderHASyncEnabled(): Promise<boolean> {
  const storage = getStorage()
  const value = await storage.getItem(STORAGE_KEYS.ROOM_ORDER_SYNC_TO_HA)
  // Default to true, only false if explicitly set to 'false'
  return value !== 'false'
}

/**
 * Enable or disable HA sync for ordering (both rooms and entities)
 * Returns { rooms, devices } counts when enabling
 */
export async function setRoomOrderHASync(
  enabled: boolean
): Promise<{ rooms: number; devices: number } | undefined> {
  const storage = getStorage()
  await storage.setItem(STORAGE_KEYS.ROOM_ORDER_SYNC_TO_HA, enabled ? 'true' : 'false')

  // If enabling, sync current localStorage order to HA (both rooms and entities)
  if (enabled) {
    const rooms = await syncRoomOrderToHA()
    const devices = await syncEntityOrderToHA()
    return { rooms, devices }
  }
}

/**
 * Set room order with optional HA sync
 * Checks if HA sync is enabled and writes to both localStorage and HA if needed
 */
export async function setRoomOrderWithSync(areaId: string, order: number): Promise<void> {
  // Always write to localStorage
  await setRoomOrder(areaId, order)

  // If HA sync is enabled, also write to HA
  if (await isRoomOrderHASyncEnabled()) {
    const state = getState()
    if (state) {
      await ws.setAreaOrder(areaId, order)
    }
  }
}

// ============================================================================
// Entity Ordering - Client-side with optional HA sync
// ============================================================================

/**
 * Get entity order for a specific room and domain
 */
export async function getEntityOrder(roomSlug: string, domain: string): Promise<DomainOrderMap> {
  const storage = getStorage()
  const key = `${STORAGE_KEYS.ENTITY_ORDER_PREFIX}${roomSlug}`
  const stored = await storage.getItem(key)

  if (!stored) return {}

  try {
    const entityOrderMap = JSON.parse(stored) as EntityOrderMap
    return entityOrderMap[domain] ?? {}
  } catch {
    return {}
  }
}

/**
 * Set entity order for a specific room, domain, and entity
 */
export async function setEntityOrder(
  roomSlug: string,
  domain: string,
  entityId: string,
  order: number
): Promise<void> {
  const storage = getStorage()
  const key = `${STORAGE_KEYS.ENTITY_ORDER_PREFIX}${roomSlug}`
  const stored = await storage.getItem(key)

  let entityOrderMap: EntityOrderMap = {}
  if (stored) {
    try {
      entityOrderMap = JSON.parse(stored) as EntityOrderMap
    } catch {
      entityOrderMap = {}
    }
  }

  if (!entityOrderMap[domain]) {
    entityOrderMap[domain] = {}
  }

  entityOrderMap[domain][entityId] = order
  await storage.setItem(key, JSON.stringify(entityOrderMap))
}

/**
 * Set all entity orders for a specific room and domain
 * Used when reordering entities within a section
 */
export async function setDomainEntityOrders(
  roomSlug: string,
  domain: string,
  domainOrderMap: DomainOrderMap
): Promise<void> {
  const storage = getStorage()
  const key = `${STORAGE_KEYS.ENTITY_ORDER_PREFIX}${roomSlug}`
  const stored = await storage.getItem(key)

  let entityOrderMap: EntityOrderMap = {}
  if (stored) {
    try {
      entityOrderMap = JSON.parse(stored) as EntityOrderMap
    } catch {
      entityOrderMap = {}
    }
  }

  entityOrderMap[domain] = domainOrderMap
  await storage.setItem(key, JSON.stringify(entityOrderMap))
}

/**
 * Get all entity orders for a specific room (all domains)
 */
export async function getAllEntityOrders(roomSlug: string): Promise<EntityOrderMap> {
  const storage = getStorage()
  const key = `${STORAGE_KEYS.ENTITY_ORDER_PREFIX}${roomSlug}`
  const stored = await storage.getItem(key)

  if (!stored) return {}

  try {
    return JSON.parse(stored) as EntityOrderMap
  } catch {
    return {}
  }
}

/**
 * Clear entity ordering for a specific room
 * Useful when a room is deleted or user wants to reset
 */
export async function clearEntityOrders(roomSlug: string): Promise<void> {
  const storage = getStorage()
  const key = `${STORAGE_KEYS.ENTITY_ORDER_PREFIX}${roomSlug}`
  await storage.removeItem(key)
}

/**
 * Set entity order for a domain with optional HA sync
 * Checks if HA sync is enabled and writes to both localStorage and HA if needed
 */
export async function setDomainEntityOrdersWithSync(
  roomSlug: string,
  domain: string,
  domainOrderMap: DomainOrderMap
): Promise<void> {
  // Always write to localStorage
  await setDomainEntityOrders(roomSlug, domain, domainOrderMap)

  // If HA sync is enabled, also write to HA
  if (await isRoomOrderHASyncEnabled()) {
    const state = getState()
    if (state) {
      // Write each entity's order to HA labels
      const promises = Object.entries(domainOrderMap).map(([entityId, order]) =>
        ws.setEntityOrder(entityId, order)
      )
      await Promise.all(promises)
    }
  }
}

/**
 * One-time migration: Read entity order from HA labels and save to localStorage.
 * Called during app initialization if HA sync is enabled.
 */
export async function migrateEntityOrderFromHA(): Promise<void> {
  const state = getState()
  if (!state) {
    console.warn('Cannot migrate entity order: WebSocket not connected')
    return
  }

  // Group entities by area (room) and domain
  const ordersByRoom: Record<string, EntityOrderMap> = {}

  for (const [entityId, entity] of state.entityRegistry) {
    if (!entity.labels || !entity.area_id) continue

    // Check for device order label
    for (const labelId of entity.labels) {
      const label = state.labels.get(labelId)
      if (label?.name.startsWith(DEVICE_ORDER_LABEL_PREFIX)) {
        const orderStr = label.name.slice(DEVICE_ORDER_LABEL_PREFIX.length)
        const order = parseInt(orderStr, 10)
        if (!isNaN(order)) {
          const domain = entityId.split('.')[0]
          const roomId = entity.area_id

          if (!ordersByRoom[roomId]) {
            ordersByRoom[roomId] = {}
          }
          if (!ordersByRoom[roomId][domain]) {
            ordersByRoom[roomId][domain] = {}
          }
          ordersByRoom[roomId][domain][entityId] = order
        }
      }
    }
  }

  // Save to localStorage
  const storage = getStorage()
  for (const [roomId, entityOrderMap] of Object.entries(ordersByRoom)) {
    const key = `${STORAGE_KEYS.ENTITY_ORDER_PREFIX}${roomId}`
    await storage.setItem(key, JSON.stringify(entityOrderMap))
  }

  if (Object.keys(ordersByRoom).length > 0) {
    console.log(
      `Migrated entity order for ${Object.keys(ordersByRoom).length} rooms from HA labels`
    )
  }
}

/**
 * Sync all entity orders from localStorage to HA labels
 * Used when user enables "Sync to Home Assistant" setting
 * Returns the number of entities synced
 */
export async function syncEntityOrderToHA(): Promise<number> {
  const state = getState()
  if (!state) {
    throw new Error('Cannot sync to HA: WebSocket not connected')
  }

  const storage = getStorage()
  let totalSynced = 0

  // Find all entity order keys in storage
  // We need to iterate through all areas to find their entity orders
  for (const [areaId] of state.areaRegistry) {
    const key = `${STORAGE_KEYS.ENTITY_ORDER_PREFIX}${areaId}`
    const stored = await storage.getItem(key)

    if (!stored) continue

    try {
      const entityOrderMap = JSON.parse(stored) as EntityOrderMap

      // Sync each domain's entities
      for (const domainOrder of Object.values(entityOrderMap)) {
        for (const [entityId, order] of Object.entries(domainOrder)) {
          await ws.setEntityOrder(entityId, order)
          totalSynced++
        }
      }
    } catch {
      // Skip invalid entries
    }
  }

  if (totalSynced > 0) {
    console.log(`Synced entity order for ${totalSynced} entities to HA labels`)
  }
  return totalSynced
}
