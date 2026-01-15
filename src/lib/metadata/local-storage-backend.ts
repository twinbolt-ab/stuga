/**
 * Local Storage Backend for Metadata
 *
 * Stores room ordering and preferences locally on the device instead
 * of in Home Assistant labels. Uses in-memory cache for sync reads
 * with async persistence to storage.
 */

import type { MetadataBackend } from './types'
import { getStorage } from '@/lib/storage'
import { DEFAULT_ORDER } from '@/lib/constants'

const STORAGE_KEYS = {
  AREA_ORDERS: 'stuga-metadata-area-orders',
  AREA_TEMP_SENSORS: 'stuga-metadata-area-temp-sensors',
  ENTITY_ORDERS: 'stuga-metadata-entity-orders',
} as const

// In-memory cache for sync reads (populated from async storage on init)
let areaOrders = new Map<string, number>()
let areaTempSensors = new Map<string, string>()
let entityOrders = new Map<string, number>()
let initialized = false

export async function initLocalStorageBackend(): Promise<void> {
  if (initialized) return

  const storage = getStorage()

  // Load cached data from storage
  const ordersJson = await storage.getItem(STORAGE_KEYS.AREA_ORDERS)
  if (ordersJson) {
    try {
      areaOrders = new Map(JSON.parse(ordersJson))
    } catch {
      areaOrders = new Map()
    }
  }

  const sensorsJson = await storage.getItem(STORAGE_KEYS.AREA_TEMP_SENSORS)
  if (sensorsJson) {
    try {
      areaTempSensors = new Map(JSON.parse(sensorsJson))
    } catch {
      areaTempSensors = new Map()
    }
  }

  const entityOrdersJson = await storage.getItem(STORAGE_KEYS.ENTITY_ORDERS)
  if (entityOrdersJson) {
    try {
      entityOrders = new Map(JSON.parse(entityOrdersJson))
    } catch {
      entityOrders = new Map()
    }
  }

  initialized = true
}

export function isLocalStorageBackendInitialized(): boolean {
  return initialized
}

export function createLocalStorageBackend(): MetadataBackend {
  return {
    getAreaOrder(areaId: string): number {
      return areaOrders.get(areaId) ?? DEFAULT_ORDER
    },

    async setAreaOrder(areaId: string, order: number): Promise<void> {
      areaOrders.set(areaId, order)
      const storage = getStorage()
      await storage.setItem(STORAGE_KEYS.AREA_ORDERS, JSON.stringify([...areaOrders]))
    },

    getAreaTemperatureSensor(areaId: string): string | undefined {
      return areaTempSensors.get(areaId)
    },

    async setAreaTemperatureSensor(areaId: string, sensorEntityId: string | null): Promise<void> {
      if (sensorEntityId) {
        areaTempSensors.set(areaId, sensorEntityId)
      } else {
        areaTempSensors.delete(areaId)
      }
      const storage = getStorage()
      await storage.setItem(STORAGE_KEYS.AREA_TEMP_SENSORS, JSON.stringify([...areaTempSensors]))
    },

    getEntityOrder(entityId: string): number {
      return entityOrders.get(entityId) ?? DEFAULT_ORDER
    },

    async setEntityOrder(entityId: string, order: number): Promise<void> {
      entityOrders.set(entityId, order)
      const storage = getStorage()
      await storage.setItem(STORAGE_KEYS.ENTITY_ORDERS, JSON.stringify([...entityOrders]))
    },
  }
}

/**
 * Export current local metadata for migration to HA labels
 */
export function exportLocalMetadata() {
  return {
    areaOrders: [...areaOrders] as [string, number][],
    areaTempSensors: [...areaTempSensors] as [string, string][],
    entityOrders: [...entityOrders] as [string, number][],
  }
}

/**
 * Import metadata (used when migrating from HA labels to local)
 */
export async function importLocalMetadata(data: {
  areaOrders: [string, number][]
  areaTempSensors: [string, string][]
  entityOrders: [string, number][]
}): Promise<void> {
  areaOrders = new Map(data.areaOrders)
  areaTempSensors = new Map(data.areaTempSensors)
  entityOrders = new Map(data.entityOrders)

  const storage = getStorage()
  await Promise.all([
    storage.setItem(STORAGE_KEYS.AREA_ORDERS, JSON.stringify([...areaOrders])),
    storage.setItem(STORAGE_KEYS.AREA_TEMP_SENSORS, JSON.stringify([...areaTempSensors])),
    storage.setItem(STORAGE_KEYS.ENTITY_ORDERS, JSON.stringify([...entityOrders])),
  ])
}

/**
 * Clear all local metadata
 */
export async function clearLocalMetadata(): Promise<void> {
  areaOrders.clear()
  areaTempSensors.clear()
  entityOrders.clear()

  const storage = getStorage()
  await Promise.all([
    storage.removeItem(STORAGE_KEYS.AREA_ORDERS),
    storage.removeItem(STORAGE_KEYS.AREA_TEMP_SENSORS),
    storage.removeItem(STORAGE_KEYS.ENTITY_ORDERS),
  ])
}
