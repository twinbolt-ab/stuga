/**
 * Layout Cache Service
 *
 * Caches the dashboard layout (floors, rooms, favorites) for optimistic loading.
 * This allows the app to show the previous layout immediately while waiting
 * for fresh data from Home Assistant.
 */

import { getStorage } from '@/lib/storage'
import { STORAGE_KEYS } from '@/lib/constants'
import type { HAEntity, HAFloor, RoomWithDevices } from '@/types/ha'

/**
 * Cached room data - structural info plus last-known light counts
 */
interface CachedRoom {
  id: string
  name: string
  areaId?: string
  floorId?: string
  icon?: string
  order?: number
  // Cached display state (may be stale)
  lightsOn?: number
  totalLights?: number
  temperature?: number
  humidity?: number
}

/**
 * Cached favorites - includes full entity data for scenes and entities
 */
export interface CachedFavorites {
  scenes: HAEntity[]
  rooms: CachedRoom[] // Room structural data (resolved from roomAreaIds)
  entities: HAEntity[]
}

/**
 * Full layout cache structure
 */
interface LayoutCache {
  version: number
  timestamp: number
  floors: HAFloor[]
  rooms: CachedRoom[]
  favorites: CachedFavorites
}

// Cache version - increment when structure changes
const CACHE_VERSION = 3

// Max age before cache is considered stale (24 hours)
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000

/**
 * Save current layout to cache
 */
export async function saveLayoutCache(
  floors: HAFloor[],
  rooms: RoomWithDevices[],
  favorites: {
    scenes: HAEntity[]
    favoriteRooms: RoomWithDevices[]
    entities: HAEntity[]
  }
): Promise<void> {
  const cache: LayoutCache = {
    version: CACHE_VERSION,
    timestamp: Date.now(),
    floors,
    rooms: rooms.map((room) => ({
      id: room.id,
      name: room.name,
      areaId: room.areaId,
      floorId: room.floorId,
      icon: room.icon,
      order: room.order,
      lightsOn: room.lightsOn,
      totalLights: room.totalLights,
      temperature: room.temperature,
      humidity: room.humidity,
    })),
    favorites: {
      scenes: favorites.scenes,
      rooms: favorites.favoriteRooms.map((room) => ({
        id: room.id,
        name: room.name,
        areaId: room.areaId,
        floorId: room.floorId,
        icon: room.icon,
        order: room.order,
        lightsOn: room.lightsOn,
        totalLights: room.totalLights,
        temperature: room.temperature,
        humidity: room.humidity,
      })),
      entities: favorites.entities,
    },
  }

  const storage = getStorage()
  await storage.setItem(STORAGE_KEYS.LAYOUT_CACHE, JSON.stringify(cache))
}

/**
 * Load cached layout
 * Returns null if no cache exists or cache is invalid/stale
 */
export async function loadLayoutCache(): Promise<{
  floors: HAFloor[]
  rooms: CachedRoom[]
  favorites: CachedFavorites
} | null> {
  const storage = getStorage()
  const stored = await storage.getItem(STORAGE_KEYS.LAYOUT_CACHE)

  if (!stored) return null

  try {
    const cache = JSON.parse(stored) as LayoutCache

    // Check version
    if (cache.version !== CACHE_VERSION) {
      await clearLayoutCache()
      return null
    }

    // Check staleness
    if (Date.now() - cache.timestamp > MAX_CACHE_AGE_MS) {
      await clearLayoutCache()
      return null
    }

    return {
      floors: cache.floors,
      rooms: cache.rooms,
      favorites: cache.favorites,
    }
  } catch {
    await clearLayoutCache()
    return null
  }
}

/**
 * Clear the layout cache
 */
export async function clearLayoutCache(): Promise<void> {
  const storage = getStorage()
  await storage.removeItem(STORAGE_KEYS.LAYOUT_CACHE)
}

/**
 * Convert cached rooms to RoomWithDevices with empty device arrays
 * Used for optimistic rendering before live data arrives
 */
export function cachedRoomsToOptimistic(cachedRooms: CachedRoom[]): RoomWithDevices[] {
  return cachedRooms.map((room) => ({
    id: room.id,
    name: room.name,
    areaId: room.areaId,
    floorId: room.floorId,
    icon: room.icon,
    order: room.order,
    devices: [],
    lightsOn: room.lightsOn ?? 0,
    totalLights: room.totalLights ?? 0,
    temperature: room.temperature,
    humidity: room.humidity,
  }))
}
