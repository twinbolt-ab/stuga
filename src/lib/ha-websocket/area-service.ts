import type { AreaRegistryEntry, HALabel } from '@/types/ha'
import { isHALabel, isAreaRegistryEntry } from '@/types/ha'
import type { HAWebSocketState } from './types'
import { send, getNextMessageId } from './connection'
import { registerCallback, notifyMessageHandlers, notifyRegistryHandlers } from './message-router'
import { applyAreasToEntities } from './registry-manager'
import { ROOM_ORDER_LABEL_PREFIX, TEMPERATURE_SENSOR_LABEL_PREFIX, DEFAULT_ORDER } from '@/lib/constants'

/** Order is stored in HA labels with a special prefix (e.g., "stuga-room-order-05"). */
export function getAreaOrder(state: HAWebSocketState, areaId: string): number {
  const area = state.areaRegistry.get(areaId)
  if (!area?.labels) return DEFAULT_ORDER

  for (const labelId of area.labels) {
    const label = state.labels.get(labelId)
    if (label?.name.startsWith(ROOM_ORDER_LABEL_PREFIX)) {
      const orderStr = label.name.slice(ROOM_ORDER_LABEL_PREFIX.length)
      const order = parseInt(orderStr, 10)
      if (!isNaN(order)) return order
    }
  }
  return DEFAULT_ORDER
}

export function getAreaIcon(state: HAWebSocketState, areaId: string): string | undefined {
  return state.areaRegistry.get(areaId)?.icon
}

/** Temperature sensor is stored in HA labels (e.g., "stuga-temp-sensor.bedroom_temperature"). */
export function getAreaTemperatureSensor(state: HAWebSocketState, areaId: string): string | undefined {
  const area = state.areaRegistry.get(areaId)
  if (!area?.labels) return undefined

  for (const labelId of area.labels) {
    const label = state.labels.get(labelId)
    if (label?.name.startsWith(TEMPERATURE_SENSOR_LABEL_PREFIX)) {
      // Extract entity_id from label name (e.g., "stuga-temp-sensor.bedroom_temperature" -> "sensor.bedroom_temperature")
      return label.name.slice(TEMPERATURE_SENSOR_LABEL_PREFIX.length)
    }
  }
  return undefined
}

/** Returns existing label ID or creates a new one in HA's label registry. */
async function ensureOrderLabel(state: HAWebSocketState, prefix: string, order: number): Promise<string> {
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

export async function setAreaOrder(state: HAWebSocketState, areaId: string, order: number): Promise<void> {
  const area = state.areaRegistry.get(areaId)
  if (!area) return

  // Get existing non-order labels
  const existingLabels = (area.labels || []).filter(labelId => {
    const label = state.labels.get(labelId)
    return !label?.name.startsWith(ROOM_ORDER_LABEL_PREFIX)
  })

  // Get or create the order label
  const orderLabelId = await ensureOrderLabel(state, ROOM_ORDER_LABEL_PREFIX, order)

  // Update area with new labels
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        // Update local registry
        area.labels = [...existingLabels, orderLabelId]
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to update area labels'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/area_registry/update',
      area_id: areaId,
      labels: [...existingLabels, orderLabelId],
    })
  })
}

export async function setAreaTemperatureSensor(
  state: HAWebSocketState,
  areaId: string,
  sensorEntityId: string | null
): Promise<void> {
  const area = state.areaRegistry.get(areaId)
  if (!area) return

  // Get existing labels, filtering out any existing temperature sensor labels
  const existingLabels = (area.labels || []).filter(labelId => {
    const label = state.labels.get(labelId)
    return !label?.name.startsWith(TEMPERATURE_SENSOR_LABEL_PREFIX)
  })

  // If clearing the sensor, just update with existing labels (minus temp label)
  if (!sensorEntityId) {
    return new Promise((resolve, reject) => {
      const msgId = getNextMessageId(state)
      registerCallback(state, msgId, (success) => {
        if (success) {
          area.labels = existingLabels
          notifyRegistryHandlers(state)
          resolve()
        } else {
          reject(new Error('Failed to update area labels'))
        }
      })
      send(state, {
        id: msgId,
        type: 'config/area_registry/update',
        area_id: areaId,
        labels: existingLabels,
      })
    })
  }

  // Create or get the sensor label
  const labelName = `${TEMPERATURE_SENSOR_LABEL_PREFIX}${sensorEntityId}`
  let sensorLabelId: string | undefined

  // Check if label already exists
  for (const [labelId, label] of state.labels) {
    if (label.name === labelName) {
      sensorLabelId = labelId
      break
    }
  }

  // Create label if it doesn't exist
  if (!sensorLabelId) {
    sensorLabelId = await new Promise<string>((resolve, reject) => {
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

  // Update area with new labels
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        area.labels = [...existingLabels, sensorLabelId!]
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to update area labels'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/area_registry/update',
      area_id: areaId,
      labels: [...existingLabels, sensorLabelId],
    })
  })
}

export async function updateArea(
  state: HAWebSocketState,
  areaId: string,
  updates: { name?: string; floor_id?: string | null; icon?: string | null }
): Promise<void> {
  const area = state.areaRegistry.get(areaId)
  if (!area) throw new Error('Area not found')

  const oldName = area.name

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success, result) => {
      if (success) {
        // Update local registry - merge our updates with existing area
        const updatedArea: AreaRegistryEntry = {
          ...area,
          ...(result as Partial<AreaRegistryEntry> || {}),
        }
        // Explicitly apply our updates in case they're not in the result
        if (updates.name !== undefined) updatedArea.name = updates.name
        if (updates.floor_id !== undefined) updatedArea.floor_id = updates.floor_id || undefined
        if (updates.icon !== undefined) updatedArea.icon = updates.icon || undefined

        state.areaRegistry.set(areaId, updatedArea)
        state.areas.set(areaId, updatedArea.name)

        // If name changed, update entityAreas to use the new name
        if (updates.name && updates.name !== oldName) {
          for (const [entityId, areaName] of state.entityAreas) {
            if (areaName === oldName) {
              state.entityAreas.set(entityId, updates.name)
            }
          }
          // Re-apply area names to entity attributes
          applyAreasToEntities(state)
          notifyMessageHandlers(state)
        }

        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to update area'))
      }
    })

    const payload: Record<string, unknown> = {
      id: msgId,
      type: 'config/area_registry/update',
      area_id: areaId,
    }

    if (updates.name !== undefined) payload.name = updates.name
    if (updates.floor_id !== undefined) payload.floor_id = updates.floor_id
    if (updates.icon !== undefined) payload.icon = updates.icon

    send(state, payload)
  })
}

export async function createArea(state: HAWebSocketState, name: string, floorId?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success, result, error) => {
      if (success && isAreaRegistryEntry(result)) {
        // Add to local registries
        state.areaRegistry.set(result.area_id, result)
        state.areas.set(result.area_id, result.name)
        notifyRegistryHandlers(state)
        resolve(result.area_id)
      } else {
        reject(new Error(error?.message || 'Failed to create area'))
      }
    })

    const payload: Record<string, unknown> = {
      id: msgId,
      type: 'config/area_registry/create',
      name,
    }
    if (floorId) payload.floor_id = floorId

    send(state, payload)
  })
}

export async function deleteArea(state: HAWebSocketState, areaId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        // Remove from local registries
        state.areaRegistry.delete(areaId)
        state.areas.delete(areaId)
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to delete area'))
      }
    })

    send(state, {
      id: msgId,
      type: 'config/area_registry/delete',
      area_id: areaId,
    })
  })
}

/**
 * Update an area's labels array directly (used for cleanup operations)
 */
export async function updateAreaLabels(
  state: HAWebSocketState,
  areaId: string,
  labels: string[]
): Promise<void> {
  const area = state.areaRegistry.get(areaId)
  if (!area) return

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        area.labels = labels
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to update area labels'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/area_registry/update',
      area_id: areaId,
      labels,
    })
  })
}
