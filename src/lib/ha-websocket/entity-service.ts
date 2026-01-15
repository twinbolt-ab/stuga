import type { HAEntity, HALabel, EntityRegistryEntry } from '@/types/ha'
import { isHALabel } from '@/types/ha'
import type { HAWebSocketState } from './types'
import { send, getNextMessageId } from './connection'
import { registerCallback, notifyMessageHandlers, notifyRegistryHandlers } from './message-router'
import { DEVICE_ORDER_LABEL_PREFIX, DEFAULT_ORDER } from '@/lib/constants'

export function getEntities(state: HAWebSocketState): Map<string, HAEntity> {
  return state.entities
}

export function getEntity(state: HAWebSocketState, entityId: string): HAEntity | undefined {
  return state.entities.get(entityId)
}

export function getEntityRegistry(state: HAWebSocketState): Map<string, EntityRegistryEntry> {
  return state.entityRegistry
}

export function getLabels(state: HAWebSocketState): Map<string, HALabel> {
  return state.labels
}

/** Returns icon from entity registry first, falling back to state attributes. */
export function getEntityIcon(state: HAWebSocketState, entityId: string): string | undefined {
  const registryEntry = state.entityRegistry.get(entityId)
  if (registryEntry?.icon) return registryEntry.icon

  const entity = state.entities.get(entityId)
  if (entity?.attributes.icon && typeof entity.attributes.icon === 'string') {
    return entity.attributes.icon
  }

  return undefined
}

/** Order is stored in HA labels with a special prefix (e.g., "stuga-device-order-05"). */
export function getEntityOrder(state: HAWebSocketState, entityId: string): number {
  const entity = state.entityRegistry.get(entityId)
  if (!entity?.labels) return DEFAULT_ORDER

  for (const labelId of entity.labels) {
    const label = state.labels.get(labelId)
    if (label?.name.startsWith(DEVICE_ORDER_LABEL_PREFIX)) {
      const orderStr = label.name.slice(DEVICE_ORDER_LABEL_PREFIX.length)
      const order = parseInt(orderStr, 10)
      if (!isNaN(order)) return order
    }
  }
  return DEFAULT_ORDER
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

export async function setEntityOrder(
  state: HAWebSocketState,
  entityId: string,
  order: number
): Promise<void> {
  const entity = state.entityRegistry.get(entityId)
  if (!entity) return

  // Get existing non-order labels
  const existingLabels = (entity.labels || []).filter(labelId => {
    const label = state.labels.get(labelId)
    return !label?.name.startsWith(DEVICE_ORDER_LABEL_PREFIX)
  })

  // Get or create the order label
  const orderLabelId = await ensureOrderLabel(state, DEVICE_ORDER_LABEL_PREFIX, order)

  // Update entity with new labels
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        // Update local registry
        entity.labels = [...existingLabels, orderLabelId]
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to update entity labels'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/entity_registry/update',
      entity_id: entityId,
      labels: [...existingLabels, orderLabelId],
    })
  })
}

export async function updateEntity(
  state: HAWebSocketState,
  entityId: string,
  updates: { name?: string | null; area_id?: string | null; icon?: string | null }
): Promise<void> {
  const entity = state.entityRegistry.get(entityId)
  // Entity might not be in registry (e.g., YAML-defined scenes), but we can still try to update it

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success, result) => {
      if (success) {
        // Update local registry - merge our updates with existing entity
        const baseEntity = entity || { entity_id: entityId } as EntityRegistryEntry
        const updatedEntity: EntityRegistryEntry = {
          ...baseEntity,
          ...(result as Partial<EntityRegistryEntry> || {}),
        }
        // Explicitly apply our updates in case they're not in the result
        if (updates.name !== undefined) updatedEntity.name = updates.name || undefined
        if (updates.area_id !== undefined) updatedEntity.area_id = updates.area_id || undefined
        if (updates.icon !== undefined) updatedEntity.icon = updates.icon || undefined

        state.entityRegistry.set(entityId, updatedEntity)

        // Update entity-to-area mapping
        if (updatedEntity.area_id) {
          const areaName = state.areas.get(updatedEntity.area_id)
          if (areaName) {
            state.entityAreas.set(entityId, areaName)
            // Update entity attributes
            const stateEntity = state.entities.get(entityId)
            if (stateEntity) {
              stateEntity.attributes.area = areaName
            }
          }
        } else {
          state.entityAreas.delete(entityId)
          // Clear area from entity attributes
          const stateEntity = state.entities.get(entityId)
          if (stateEntity) {
            delete stateEntity.attributes.area
          }
        }

        notifyMessageHandlers(state)
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to update entity'))
      }
    })

    const payload: Record<string, unknown> = {
      id: msgId,
      type: 'config/entity_registry/update',
      entity_id: entityId,
    }

    if (updates.name !== undefined) payload.name = updates.name
    if (updates.area_id !== undefined) payload.area_id = updates.area_id
    if (updates.icon !== undefined) payload.icon = updates.icon

    send(state, payload)
  })
}

/** Uses HA's native hidden_by registry field. */
export function isEntityHidden(state: HAWebSocketState, entityId: string): boolean {
  const entity = state.entityRegistry.get(entityId)
  return !!entity?.hidden_by
}

export function getHiddenEntities(state: HAWebSocketState): Set<string> {
  const hidden = new Set<string>()
  for (const [entityId, entity] of state.entityRegistry) {
    if (entity.hidden_by) {
      hidden.add(entityId)
    }
  }
  return hidden
}

/** Sets HA's native hidden_by field to 'user' or null. */
export async function setEntityHidden(
  state: HAWebSocketState,
  entityId: string,
  hidden: boolean
): Promise<void> {
  const entity = state.entityRegistry.get(entityId)

  // Check if already in desired state
  const isCurrentlyHidden = !!entity?.hidden_by
  if (isCurrentlyHidden === hidden) return

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        // Update local cache
        if (entity) {
          entity.hidden_by = hidden ? 'user' : undefined
        }
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to update entity hidden state'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/entity_registry/update',
      entity_id: entityId,
      hidden_by: hidden ? 'user' : null,
    })
  })
}

export async function deleteScene(state: HAWebSocketState, entityId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        // Remove from local registries
        state.entities.delete(entityId)
        state.entityRegistry.delete(entityId)
        state.entityAreas.delete(entityId)
        notifyMessageHandlers(state)
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to delete scene'))
      }
    })

    send(state, {
      id: msgId,
      type: 'call_service',
      domain: 'scene',
      service: 'delete',
      service_data: {
        entity_id: entityId,
      },
    })
  })
}

export function callService(
  state: HAWebSocketState,
  domain: string,
  service: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  return new Promise((resolve) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success, _result, error) => {
      resolve({ success, error })
    })
    send(state, {
      id: msgId,
      type: 'call_service',
      domain,
      service,
      service_data: data,
    })
  })
}

/**
 * Update an entity's labels array directly (used for cleanup operations)
 */
export async function updateEntityLabels(
  state: HAWebSocketState,
  entityId: string,
  labels: string[]
): Promise<void> {
  const entity = state.entityRegistry.get(entityId)
  if (!entity) return

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        entity.labels = labels
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to update entity labels'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/entity_registry/update',
      entity_id: entityId,
      labels,
    })
  })
}
