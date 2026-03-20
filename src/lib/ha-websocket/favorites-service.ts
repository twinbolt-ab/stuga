/**
 * Favorites Service
 *
 * Manages favorite labels for entities and areas in Home Assistant.
 * Favorites are stored as labels with the pattern:
 *   - stuga-favorite-A-XX for scenes
 *   - stuga-favorite-B-XX for rooms (areas)
 *   - stuga-favorite-C-XX for other entities
 *
 * The numeric suffix determines display order within each section.
 */

import type { FavoriteItem, FavoriteSection } from '@/types/ha'
import { isHALabel } from '@/types/ha'
import type { HAWebSocketState } from './types'
import { send, getNextMessageId } from './connection'
import { registerCallback, notifyRegistryHandlers } from './message-router'
import {
  FAVORITE_LABEL_PREFIX,
  FAVORITE_SCENE_PREFIX,
  FAVORITE_ROOM_PREFIX,
  FAVORITE_ENTITY_PREFIX,
  ORDER_GAP,
} from '@/lib/constants'

/**
 * Parse a favorite label name and extract section and order.
 * Returns null if the label is not a favorite label.
 */
export function parseFavoriteLabel(
  labelName: string
): { section: FavoriteSection; order: number } | null {
  if (!labelName.startsWith(FAVORITE_LABEL_PREFIX)) {
    return null
  }

  if (labelName.startsWith(FAVORITE_SCENE_PREFIX)) {
    const orderStr = labelName.slice(FAVORITE_SCENE_PREFIX.length)
    const order = parseInt(orderStr, 10)
    if (!isNaN(order)) {
      return { section: 'scene', order }
    }
  } else if (labelName.startsWith(FAVORITE_ROOM_PREFIX)) {
    const orderStr = labelName.slice(FAVORITE_ROOM_PREFIX.length)
    const order = parseInt(orderStr, 10)
    if (!isNaN(order)) {
      return { section: 'room', order }
    }
  } else if (labelName.startsWith(FAVORITE_ENTITY_PREFIX)) {
    const orderStr = labelName.slice(FAVORITE_ENTITY_PREFIX.length)
    const order = parseInt(orderStr, 10)
    if (!isNaN(order)) {
      return { section: 'entity', order }
    }
  }

  return null
}

/**
 * Check if any favorites exist (entities or areas with favorite labels).
 */
export function hasFavorites(state: HAWebSocketState): boolean {
  // Check entity registry for favorite labels
  for (const entity of state.entityRegistry.values()) {
    if (!entity.labels) continue
    for (const labelId of entity.labels) {
      const label = state.labels.get(labelId)
      if (label && parseFavoriteLabel(label.name)) {
        return true
      }
    }
  }

  // Check area registry for favorite labels
  for (const area of state.areaRegistry.values()) {
    if (!area.labels) continue
    for (const labelId of area.labels) {
      const label = state.labels.get(labelId)
      if (label && parseFavoriteLabel(label.name)) {
        return true
      }
    }
  }

  return false
}

/**
 * Get favorite info for an entity.
 */
export function getEntityFavoriteInfo(
  state: HAWebSocketState,
  entityId: string
): FavoriteItem | null {
  const entity = state.entityRegistry.get(entityId)
  if (!entity?.labels) return null

  for (const labelId of entity.labels) {
    const label = state.labels.get(labelId)
    if (!label) continue
    const parsed = parseFavoriteLabel(label.name)
    if (parsed) {
      return {
        id: entityId,
        section: parsed.section,
        order: parsed.order,
        labelId,
      }
    }
  }

  return null
}

/**
 * Get favorite info for an area.
 */
export function getAreaFavoriteInfo(state: HAWebSocketState, areaId: string): FavoriteItem | null {
  const area = state.areaRegistry.get(areaId)
  if (!area?.labels) return null

  for (const labelId of area.labels) {
    const label = state.labels.get(labelId)
    if (!label) continue
    const parsed = parseFavoriteLabel(label.name)
    if (parsed) {
      return {
        id: areaId,
        section: parsed.section,
        order: parsed.order,
        labelId,
      }
    }
  }

  return null
}

/**
 * Get all favorite entity IDs grouped by section, sorted by order.
 */
export function getAllFavoriteEntityIds(state: HAWebSocketState): {
  scenes: string[]
  entities: string[]
} {
  const scenes: FavoriteItem[] = []
  const entities: FavoriteItem[] = []

  for (const entity of state.entityRegistry.values()) {
    if (!entity.labels) continue
    for (const labelId of entity.labels) {
      const label = state.labels.get(labelId)
      if (!label) continue
      const parsed = parseFavoriteLabel(label.name)
      if (parsed) {
        const item: FavoriteItem = {
          id: entity.entity_id,
          section: parsed.section,
          order: parsed.order,
          labelId,
        }
        if (parsed.section === 'scene') {
          scenes.push(item)
        } else if (parsed.section === 'entity') {
          entities.push(item)
        }
        break // Only one favorite label per entity
      }
    }
  }

  // Sort by order
  scenes.sort((a, b) => a.order - b.order)
  entities.sort((a, b) => a.order - b.order)

  return {
    scenes: scenes.map((s) => s.id),
    entities: entities.map((e) => e.id),
  }
}

/**
 * Get all favorite area IDs sorted by order.
 */
export function getAllFavoriteAreaIds(state: HAWebSocketState): string[] {
  const rooms: FavoriteItem[] = []

  for (const area of state.areaRegistry.values()) {
    if (!area.labels) continue
    for (const labelId of area.labels) {
      const label = state.labels.get(labelId)
      if (!label) continue
      const parsed = parseFavoriteLabel(label.name)
      if (parsed?.section === 'room') {
        rooms.push({
          id: area.area_id,
          section: parsed.section,
          order: parsed.order,
          labelId,
        })
        break // Only one favorite label per area
      }
    }
  }

  // Sort by order
  rooms.sort((a, b) => a.order - b.order)

  return rooms.map((r) => r.id)
}

/**
 * Get the next available order number for a section.
 */
function getNextOrder(state: HAWebSocketState, section: FavoriteSection): number {
  let maxOrder = 0

  // Check entities for scenes/entities
  if (section === 'scene' || section === 'entity') {
    for (const entity of state.entityRegistry.values()) {
      if (!entity.labels) continue
      for (const labelId of entity.labels) {
        const label = state.labels.get(labelId)
        if (!label) continue
        const parsed = parseFavoriteLabel(label.name)
        if (parsed?.section === section) {
          maxOrder = Math.max(maxOrder, parsed.order)
        }
      }
    }
  }

  // Check areas for rooms
  if (section === 'room') {
    for (const area of state.areaRegistry.values()) {
      if (!area.labels) continue
      for (const labelId of area.labels) {
        const label = state.labels.get(labelId)
        if (!label) continue
        const parsed = parseFavoriteLabel(label.name)
        if (parsed?.section === section) {
          maxOrder = Math.max(maxOrder, parsed.order)
        }
      }
    }
  }

  return maxOrder + ORDER_GAP
}

/**
 * Get or create a favorite label.
 */
async function ensureFavoriteLabel(
  state: HAWebSocketState,
  section: FavoriteSection,
  order: number
): Promise<string> {
  let prefix: string
  switch (section) {
    case 'scene':
      prefix = FAVORITE_SCENE_PREFIX
      break
    case 'room':
      prefix = FAVORITE_ROOM_PREFIX
      break
    case 'entity':
      prefix = FAVORITE_ENTITY_PREFIX
      break
  }

  const paddedOrder = order.toString().padStart(2, '0')
  const labelName = `${prefix}${paddedOrder}`

  // Check if label already exists
  for (const [labelId, label] of state.labels) {
    if (label.name === labelName) {
      return labelId
    }
  }

  // Create new label
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success, result) => {
      if (success && isHALabel(result)) {
        state.labels.set(result.label_id, result)
        resolve(result.label_id)
      } else {
        reject(new Error('Failed to create favorite label'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/label_registry/create',
      name: labelName,
    })
  })
}

/**
 * Add an entity to favorites.
 */
export async function addEntityToFavorites(
  state: HAWebSocketState,
  entityId: string,
  section: FavoriteSection
): Promise<void> {
  const entity = state.entityRegistry.get(entityId)
  if (!entity) return

  // Check if already a favorite
  const existingFavorite = getEntityFavoriteInfo(state, entityId)
  if (existingFavorite) return

  // Get next order number and create/get label
  const order = getNextOrder(state, section)
  const labelId = await ensureFavoriteLabel(state, section, order)

  // Get existing labels
  const existingLabels = entity.labels || []
  const newLabels = [...existingLabels, labelId]

  // Update entity with new labels
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        entity.labels = newLabels
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to add entity to favorites'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/entity_registry/update',
      entity_id: entityId,
      labels: newLabels,
    })
  })
}

/**
 * Add an area to favorites.
 */
export async function addAreaToFavorites(state: HAWebSocketState, areaId: string): Promise<void> {
  const area = state.areaRegistry.get(areaId)
  if (!area) return

  // Check if already a favorite
  const existingFavorite = getAreaFavoriteInfo(state, areaId)
  if (existingFavorite) return

  // Get next order number and create/get label
  const order = getNextOrder(state, 'room')
  const labelId = await ensureFavoriteLabel(state, 'room', order)

  // Get existing labels
  const existingLabels = area.labels || []
  const newLabels = [...existingLabels, labelId]

  // Update area with new labels
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        area.labels = newLabels
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to add area to favorites'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/area_registry/update',
      area_id: areaId,
      labels: newLabels,
    })
  })
}

/**
 * Remove an entity from favorites.
 */
export async function removeEntityFromFavorites(
  state: HAWebSocketState,
  entityId: string
): Promise<void> {
  const entity = state.entityRegistry.get(entityId)
  if (!entity) return

  const favoriteInfo = getEntityFavoriteInfo(state, entityId)
  if (!favoriteInfo) return

  // Remove the favorite label
  const newLabels = (entity.labels || []).filter((id) => id !== favoriteInfo.labelId)

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        entity.labels = newLabels
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to remove entity from favorites'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/entity_registry/update',
      entity_id: entityId,
      labels: newLabels,
    })
  })
}

/**
 * Remove an area from favorites.
 */
export async function removeAreaFromFavorites(
  state: HAWebSocketState,
  areaId: string
): Promise<void> {
  const area = state.areaRegistry.get(areaId)
  if (!area) return

  const favoriteInfo = getAreaFavoriteInfo(state, areaId)
  if (!favoriteInfo) return

  // Remove the favorite label
  const newLabels = (area.labels || []).filter((id) => id !== favoriteInfo.labelId)

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        area.labels = newLabels
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to remove area from favorites'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/area_registry/update',
      area_id: areaId,
      labels: newLabels,
    })
  })
}

/**
 * Update the order of a favorited entity (internal, optionally skip notification).
 */
async function updateEntityFavoriteOrderInternal(
  state: HAWebSocketState,
  entityId: string,
  newOrder: number,
  skipNotify: boolean
): Promise<void> {
  const entity = state.entityRegistry.get(entityId)
  if (!entity) return

  const favoriteInfo = getEntityFavoriteInfo(state, entityId)
  if (!favoriteInfo) return

  // Remove old favorite label and add new one with updated order
  const newLabelId = await ensureFavoriteLabel(state, favoriteInfo.section, newOrder)

  // Replace the label
  const newLabels = (entity.labels || [])
    .filter((id) => id !== favoriteInfo.labelId)
    .concat(newLabelId)

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        entity.labels = newLabels
        if (!skipNotify) {
          notifyRegistryHandlers(state)
        }
        resolve()
      } else {
        reject(new Error('Failed to update entity favorite order'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/entity_registry/update',
      entity_id: entityId,
      labels: newLabels,
    })
  })
}

/**
 * Update the order of a favorited entity.
 */
export async function updateEntityFavoriteOrder(
  state: HAWebSocketState,
  entityId: string,
  newOrder: number
): Promise<void> {
  return updateEntityFavoriteOrderInternal(state, entityId, newOrder, false)
}

/**
 * Batch update favorite entity orders. Only notifies once after all updates complete.
 */
export async function updateEntityFavoriteOrderBatch(
  state: HAWebSocketState,
  updates: { entityId: string; order: number }[]
): Promise<void> {
  await Promise.all(
    updates.map(({ entityId, order }) =>
      updateEntityFavoriteOrderInternal(state, entityId, order, true)
    )
  )
  notifyRegistryHandlers(state)
}

/**
 * Update the order of a favorited area (internal, optionally skip notification).
 */
async function updateAreaFavoriteOrderInternal(
  state: HAWebSocketState,
  areaId: string,
  newOrder: number,
  skipNotify: boolean
): Promise<void> {
  const area = state.areaRegistry.get(areaId)
  if (!area) return

  const favoriteInfo = getAreaFavoriteInfo(state, areaId)
  if (!favoriteInfo) return

  // Remove old favorite label and add new one with updated order
  const newLabelId = await ensureFavoriteLabel(state, 'room', newOrder)

  // Replace the label
  const newLabels = (area.labels || [])
    .filter((id) => id !== favoriteInfo.labelId)
    .concat(newLabelId)

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        area.labels = newLabels
        if (!skipNotify) {
          notifyRegistryHandlers(state)
        }
        resolve()
      } else {
        reject(new Error('Failed to update area favorite order'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/area_registry/update',
      area_id: areaId,
      labels: newLabels,
    })
  })
}

/**
 * Update the order of a favorited area.
 */
export async function updateAreaFavoriteOrder(
  state: HAWebSocketState,
  areaId: string,
  newOrder: number
): Promise<void> {
  return updateAreaFavoriteOrderInternal(state, areaId, newOrder, false)
}

/**
 * Batch update favorite area orders. Only notifies once after all updates complete.
 */
export async function updateAreaFavoriteOrderBatch(
  state: HAWebSocketState,
  updates: { areaId: string; order: number }[]
): Promise<void> {
  await Promise.all(
    updates.map(({ areaId, order }) => updateAreaFavoriteOrderInternal(state, areaId, order, true))
  )
  notifyRegistryHandlers(state)
}
