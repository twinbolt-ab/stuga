import type { HAFloor } from '@/types/ha'
import { isHAFloor, isHALabel } from '@/types/ha'
import type { HAWebSocketState } from './types'
import { send, getNextMessageId } from './connection'
import { registerCallback, notifyRegistryHandlers } from './message-router'
import { DEFAULT_ORDER, ORDER_GAP, FLOOR_COLUMNS_LABEL_PREFIX } from '@/lib/constants'
import { logger } from '@/lib/logger'
import type { GridColumnsOption } from '@/lib/hooks/useSettings'

export function getFloors(state: HAWebSocketState): Map<string, HAFloor> {
  return state.floors
}

export function getFloor(state: HAWebSocketState, floorId: string): HAFloor | undefined {
  return state.floors.get(floorId)
}

/** Returns the floor's level field, used for sorting floors in the UI. */
export function getFloorOrder(state: HAWebSocketState, floorId: string): number {
  const floor = state.floors.get(floorId)
  return floor?.level ?? DEFAULT_ORDER
}

export async function updateFloor(
  state: HAWebSocketState,
  floorId: string,
  updates: { name?: string; icon?: string | null }
): Promise<void> {
  const floor = state.floors.get(floorId)
  if (!floor) throw new Error('Floor not found')

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success, result) => {
      if (success) {
        // Update local registry - merge our updates with existing floor
        const updatedFloor: HAFloor = {
          ...floor,
          ...((result as Partial<HAFloor>) || {}),
        }
        // Explicitly apply our updates in case they're not in the result
        if (updates.name !== undefined) updatedFloor.name = updates.name
        if (updates.icon !== undefined) updatedFloor.icon = updates.icon || undefined

        state.floors.set(floorId, updatedFloor)
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to update floor'))
      }
    })

    const payload: Record<string, unknown> = {
      id: msgId,
      type: 'config/floor_registry/update',
      floor_id: floorId,
    }

    if (updates.name !== undefined) payload.name = updates.name
    if (updates.icon !== undefined) payload.icon = updates.icon

    send(state, payload)
  })
}

/** Updates HA's built-in level field to persist floor ordering. */
export async function setFloorOrder(
  state: HAWebSocketState,
  floorId: string,
  order: number
): Promise<void> {
  const floor = state.floors.get(floorId)
  if (!floor) return

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success, _result, error) => {
      if (success) {
        // Update local registry
        floor.level = order
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error(`Failed to update floor level: ${error?.message || 'Unknown error'}`))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/floor_registry/update',
      floor_id: floorId,
      level: order,
    })
  })
}

export async function createFloor(state: HAWebSocketState, name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success, result) => {
      if (success && isHAFloor(result)) {
        // Add to local registry
        state.floors.set(result.floor_id, result)
        notifyRegistryHandlers(state)
        resolve(result.floor_id)
      } else {
        reject(new Error('Failed to create floor'))
      }
    })

    send(state, {
      id: msgId,
      type: 'config/floor_registry/create',
      name,
    })
  })
}

export async function deleteFloor(state: HAWebSocketState, floorId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success, _result, error) => {
      if (success) {
        // Remove from local registry
        state.floors.delete(floorId)
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error(`Failed to delete floor: ${error?.message || 'Unknown error'}`))
      }
    })

    send(state, {
      id: msgId,
      type: 'config/floor_registry/delete',
      floor_id: floorId,
    })
  })
}

/**
 * Sets floor level without triggering registry notification.
 * Used by saveFloorOrderBatch to batch multiple updates.
 */
async function setFloorOrderSilent(
  state: HAWebSocketState,
  floorId: string,
  order: number
): Promise<void> {
  const floor = state.floors.get(floorId)
  if (!floor) return

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success, _result, error) => {
      if (success) {
        // Update local registry but DON'T notify handlers yet
        floor.level = order
        resolve()
      } else {
        reject(new Error(`Failed to update floor level: ${error?.message || 'Unknown error'}`))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/floor_registry/update',
      floor_id: floorId,
      level: order,
    })
  })
}

/**
 * Saves floor order to Home Assistant for floors that have changed position.
 * Compares orderedFloors against originalFloors and only updates floors whose index changed.
 * Batches registry notification to fire only once after all updates complete.
 */
export async function saveFloorOrderBatch(
  state: HAWebSocketState,
  orderedFloors: HAFloor[],
  originalFloors: HAFloor[]
): Promise<void> {
  let hasChanges = false

  for (let i = 0; i < orderedFloors.length; i++) {
    const floor = orderedFloors[i]
    const originalIndex = originalFloors.findIndex((f) => f.floor_id === floor.floor_id)
    if (originalIndex !== i) {
      try {
        await setFloorOrderSilent(state, floor.floor_id, i * ORDER_GAP)
        hasChanges = true
      } catch (error) {
        logger.error('FloorService', 'Failed to save floor order:', error)
      }
    }
  }

  // Notify once after all updates complete
  if (hasChanges) {
    notifyRegistryHandlers(state)
  }
}

/** Grid columns override is stored in HA labels (e.g., "stuga-floor-columns-2"). */
export function getFloorColumns(
  state: HAWebSocketState,
  floorId: string
): GridColumnsOption | undefined {
  const floor = state.floors.get(floorId)
  if (!floor?.labels) return undefined

  for (const labelId of floor.labels) {
    const label = state.labels.get(labelId)
    if (label?.name.startsWith(FLOOR_COLUMNS_LABEL_PREFIX)) {
      const value = label.name.slice(FLOOR_COLUMNS_LABEL_PREFIX.length)
      if (value === 'auto') return 'auto'
      const num = parseInt(value, 10)
      if (num === 1 || num === 2 || num === 3) return num
    }
  }
  return undefined
}

/** Sets the grid columns override for a floor. Pass undefined to clear (use global setting). */
export async function setFloorColumns(
  state: HAWebSocketState,
  floorId: string,
  columns: GridColumnsOption | undefined
): Promise<void> {
  const floor = state.floors.get(floorId)
  if (!floor) return

  // Get existing labels, filtering out any existing columns labels
  const existingLabels = (floor.labels || []).filter((labelId) => {
    const label = state.labels.get(labelId)
    return !label?.name.startsWith(FLOOR_COLUMNS_LABEL_PREFIX)
  })

  // If clearing the setting, just update with existing labels (minus columns label)
  if (columns === undefined) {
    return new Promise((resolve, reject) => {
      const msgId = getNextMessageId(state)
      registerCallback(state, msgId, (success) => {
        if (success) {
          floor.labels = existingLabels
          notifyRegistryHandlers(state)
          resolve()
        } else {
          reject(new Error('Failed to update floor labels'))
        }
      })
      send(state, {
        id: msgId,
        type: 'config/floor_registry/update',
        floor_id: floorId,
        labels: existingLabels,
      })
    })
  }

  // Create or get the columns label
  const labelName = `${FLOOR_COLUMNS_LABEL_PREFIX}${columns}`
  let columnsLabelId: string | undefined

  // Check if label already exists
  for (const [labelId, label] of state.labels) {
    if (label.name === labelName) {
      columnsLabelId = labelId
      break
    }
  }

  // Create label if it doesn't exist
  if (!columnsLabelId) {
    columnsLabelId = await new Promise<string>((resolve, reject) => {
      const msgId = getNextMessageId(state)
      registerCallback(state, msgId, (success, result) => {
        if (success && isHALabel(result)) {
          state.labels.set(result.label_id, result)
          resolve(result.label_id)
        } else {
          reject(new Error('Failed to create label'))
        }
      })
      send(state, {
        id: msgId,
        type: 'config/label_registry/create',
        name: labelName,
      })
    })
  }

  // Update floor with new labels
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        floor.labels = [...existingLabels, columnsLabelId]
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to update floor labels'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/floor_registry/update',
      floor_id: floorId,
      labels: [...existingLabels, columnsLabelId],
    })
  })
}
