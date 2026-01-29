import type { HAEntity, HALabel, EntityRegistryEntry } from '@/types/ha'
import { isHALabel } from '@/types/ha'
import type { HAWebSocketState, OptimisticOverride } from './types'
import { send, getNextMessageId } from './connection'
import { registerCallback, notifyMessageHandlers, notifyRegistryHandlers } from './message-router'
import {
  DEVICE_ORDER_LABEL_PREFIX,
  DEFAULT_ORDER,
  OPTIMISTIC_DURATION,
  STUGA_HIDDEN_LABEL,
} from '@/lib/constants'
import { getDevModeSync } from '@/lib/hooks/useDevMode'

// Timer references for optimistic state cleanup
const optimisticTimers = new Map<string, NodeJS.Timeout>()

/** Set optimistic state for immediate UI feedback */
export function setOptimisticState(
  state: HAWebSocketState,
  entityId: string,
  newState: string,
  brightness?: number
): void {
  // Clear any existing timer
  const existingTimer = optimisticTimers.get(entityId)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  // In demo mode, use a much longer duration (5 minutes) since no real state will arrive
  const { isDevMode } = getDevModeSync()
  const duration = isDevMode ? 300000 : OPTIMISTIC_DURATION

  // Set the override
  const override: OptimisticOverride = {
    state: newState,
    brightness,
    expiresAt: Date.now() + duration,
  }
  state.optimisticOverrides.set(entityId, override)

  // Schedule cleanup
  const timer = setTimeout(() => {
    state.optimisticOverrides.delete(entityId)
    optimisticTimers.delete(entityId)
    notifyMessageHandlers(state)
  }, duration)
  optimisticTimers.set(entityId, timer)

  // Notify immediately so UI updates
  notifyMessageHandlers(state)
}

/** Clear optimistic state (called when real state arrives) */
export function clearOptimisticState(state: HAWebSocketState, entityId: string): void {
  const existingTimer = optimisticTimers.get(entityId)
  if (existingTimer) {
    clearTimeout(existingTimer)
    optimisticTimers.delete(entityId)
  }
  state.optimisticOverrides.delete(entityId)
}

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
async function ensureOrderLabel(
  state: HAWebSocketState,
  prefix: string,
  order: number
): Promise<string> {
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
  const existingLabels = (entity.labels || []).filter((labelId) => {
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
  updates: {
    name?: string | null
    area_id?: string | null
    icon?: string | null
    device_class?: string | null
  }
): Promise<void> {
  const entity = state.entityRegistry.get(entityId)
  // Entity might not be in registry (e.g., YAML-defined scenes), but we can still try to update it

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success, result) => {
      if (success) {
        // Update local registry - merge our updates with existing entity
        const baseEntity = entity || ({ entity_id: entityId } as EntityRegistryEntry)
        const updatedEntity: EntityRegistryEntry = {
          ...baseEntity,
          ...((result as Partial<EntityRegistryEntry>) || {}),
        }
        // Explicitly apply our updates in case they're not in the result
        if (updates.name !== undefined) updatedEntity.name = updates.name || undefined
        if (updates.area_id !== undefined) updatedEntity.area_id = updates.area_id || undefined
        if (updates.icon !== undefined) updatedEntity.icon = updates.icon || undefined
        if (updates.device_class !== undefined)
          updatedEntity.device_class = updates.device_class || undefined

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

        // Update device_class in entity attributes if changed
        if (updates.device_class !== undefined) {
          const stateEntity = state.entities.get(entityId)
          if (stateEntity) {
            if (updates.device_class) {
              stateEntity.attributes.device_class = updates.device_class
            } else {
              delete stateEntity.attributes.device_class
            }
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
    if (updates.device_class !== undefined) payload.device_class = updates.device_class

    send(state, payload)
  })
}

/** Uses HA's native hidden_by registry field. */
export function isEntityHidden(state: HAWebSocketState, entityId: string): boolean {
  const entity = state.entityRegistry.get(entityId)
  return !!entity?.hidden_by
}

/**
 * Checks if an entity has entity_category 'config' or 'diagnostic'.
 * These are auxiliary entities (e.g., UniFi PoE ports, diagnostic sensors)
 * that shouldn't be shown in the main device view.
 */
export function isEntityAuxiliary(state: HAWebSocketState, entityId: string): boolean {
  const entity = state.entityRegistry.get(entityId)
  return entity?.entity_category === 'config' || entity?.entity_category === 'diagnostic'
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

/** Get or create the stuga-hidden label ID */
async function ensureStugaHiddenLabel(state: HAWebSocketState): Promise<string> {
  // Check if label already exists
  for (const [labelId, label] of state.labels) {
    if (label.name === STUGA_HIDDEN_LABEL) {
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
        reject(new Error('Failed to create stuga-hidden label'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/label_registry/create',
      name: STUGA_HIDDEN_LABEL,
    })
  })
}

/** Check if entity has the stuga-hidden label (hidden in Stuga only) */
export function isEntityHiddenInStuga(state: HAWebSocketState, entityId: string): boolean {
  const entity = state.entityRegistry.get(entityId)
  if (!entity?.labels) return false

  for (const labelId of entity.labels) {
    const label = state.labels.get(labelId)
    if (label?.name === STUGA_HIDDEN_LABEL) {
      return true
    }
  }
  return false
}

/** Get all entities with the stuga-hidden label */
export function getStugaHiddenEntities(state: HAWebSocketState): Set<string> {
  const hidden = new Set<string>()
  for (const [entityId, entity] of state.entityRegistry) {
    if (!entity.labels) continue
    for (const labelId of entity.labels) {
      const label = state.labels.get(labelId)
      if (label?.name === STUGA_HIDDEN_LABEL) {
        hidden.add(entityId)
        break
      }
    }
  }
  return hidden
}

/** Hide/show entity in Stuga only (via label), optionally also in HA */
export async function setEntityHiddenInStuga(
  state: HAWebSocketState,
  entityId: string,
  hidden: boolean,
  alsoHideInHA: boolean = false
): Promise<void> {
  const entity = state.entityRegistry.get(entityId)
  if (!entity) {
    return
  }

  const currentLabels = entity.labels || []
  const isCurrentlyHiddenInStuga = isEntityHiddenInStuga(state, entityId)

  // If already in desired Stuga state, only update HA if needed
  if (isCurrentlyHiddenInStuga === hidden) {
    if (alsoHideInHA) {
      await setEntityHidden(state, entityId, hidden)
    }
    return
  }

  if (hidden) {
    // Add stuga-hidden label
    const hiddenLabelId = await ensureStugaHiddenLabel(state)
    const newLabels = [...currentLabels, hiddenLabelId]

    // Optimistically update local state immediately
    entity.labels = newLabels
    notifyRegistryHandlers(state)

    // Send to HA (don't await - fire and forget for optimistic UI)
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (!success) {
        // Rollback on failure
        entity.labels = currentLabels
        notifyRegistryHandlers(state)
      }
    })
    send(state, {
      id: msgId,
      type: 'config/entity_registry/update',
      entity_id: entityId,
      labels: newLabels,
    })

    // Also hide in HA if requested
    if (alsoHideInHA) {
      await setEntityHidden(state, entityId, true)
    }
  } else {
    // Remove stuga-hidden label
    let hiddenLabelId: string | undefined
    for (const labelId of currentLabels) {
      const label = state.labels.get(labelId)
      if (label?.name === STUGA_HIDDEN_LABEL) {
        hiddenLabelId = labelId
        break
      }
    }

    if (hiddenLabelId) {
      const newLabels = currentLabels.filter((id) => id !== hiddenLabelId)

      // Optimistically update local state immediately
      entity.labels = newLabels
      notifyRegistryHandlers(state)

      // Send to HA (don't await - fire and forget for optimistic UI)
      const msgId = getNextMessageId(state)
      registerCallback(state, msgId, (success) => {
        if (!success) {
          // Rollback on failure
          entity.labels = currentLabels
          notifyRegistryHandlers(state)
        }
      })
      send(state, {
        id: msgId,
        type: 'config/entity_registry/update',
        entity_id: entityId,
        labels: newLabels,
      })
    }

    // Also unhide in HA if the setting is enabled
    if (alsoHideInHA) {
      await setEntityHidden(state, entityId, false)
    }
  }
}

/** Sync all Stuga-hidden entities to/from HA hidden state */
export async function syncStugaHiddenToHA(
  state: HAWebSocketState,
  hideInHA: boolean
): Promise<void> {
  const stugaHidden = getStugaHiddenEntities(state)

  for (const entityId of stugaHidden) {
    await setEntityHidden(state, entityId, hideInHA)
  }
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
