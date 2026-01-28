import type { HAEntity, HALabel, HAFloor, AreaRegistryEntry, EntityRegistryEntry } from '@/types/ha'
import type { HAWebSocketState, HAConfig } from './types'
import { send, getNextMessageId } from './connection'
import { notifyMessageHandlers, notifyRegistryHandlers } from './message-router'
import { clearOptimisticState } from './entity-service'
import { logger } from '@/lib/logger'

export function subscribeToStateChanges(state: HAWebSocketState): void {
  send(state, {
    id: getNextMessageId(state),
    type: 'subscribe_events',
    event_type: 'state_changed',
  })
}

/** Called after auth to load config, labels, floors, areas, devices, entities, and states. */
export function fetchAllRegistries(state: HAWebSocketState): void {
  fetchConfig(state)
  fetchLabelRegistry(state)
  fetchFloorRegistry(state)
  fetchAreaRegistry(state)
  fetchDeviceRegistry(state)
  fetchEntityRegistry(state)
  fetchAllStates(state)
}

function fetchConfig(state: HAWebSocketState): void {
  state.configMessageId = getNextMessageId(state)
  send(state, {
    id: state.configMessageId,
    type: 'get_config',
  })
}

function fetchAreaRegistry(state: HAWebSocketState): void {
  state.areaRegistryMessageId = getNextMessageId(state)
  send(state, {
    id: state.areaRegistryMessageId,
    type: 'config/area_registry/list',
  })
}

function fetchEntityRegistry(state: HAWebSocketState): void {
  state.entityRegistryMessageId = getNextMessageId(state)
  send(state, {
    id: state.entityRegistryMessageId,
    type: 'config/entity_registry/list',
  })
}

function fetchLabelRegistry(state: HAWebSocketState): void {
  state.labelRegistryMessageId = getNextMessageId(state)
  send(state, {
    id: state.labelRegistryMessageId,
    type: 'config/label_registry/list',
  })
}

function fetchFloorRegistry(state: HAWebSocketState): void {
  state.floorRegistryMessageId = getNextMessageId(state)
  send(state, {
    id: state.floorRegistryMessageId,
    type: 'config/floor_registry/list',
  })
}

function fetchDeviceRegistry(state: HAWebSocketState): void {
  state.deviceRegistryMessageId = getNextMessageId(state)
  send(state, {
    id: state.deviceRegistryMessageId,
    type: 'config/device_registry/list',
  })
}

function fetchAllStates(state: HAWebSocketState): void {
  state.statesMessageId = getNextMessageId(state)
  send(state, {
    id: state.statesMessageId,
    type: 'get_states',
  })
}

export function handleRegistryResult(
  state: HAWebSocketState,
  messageId: number,
  result: unknown
): boolean {
  // Handle config (not an array)
  if (messageId === state.configMessageId && result && typeof result === 'object') {
    state.config = result as HAConfig
    logger.debug('HA WS', 'Loaded config, temperature unit:', state.config.unit_system?.temperature)
    return true
  }

  if (!Array.isArray(result)) return false

  if (messageId === state.labelRegistryMessageId) {
    for (const label of result as HALabel[]) {
      state.labels.set(label.label_id, label)
    }
    logger.debug('HA WS', 'Loaded', state.labels.size, 'labels')
    return true
  }

  if (messageId === state.floorRegistryMessageId) {
    for (const floor of result as HAFloor[]) {
      state.floors.set(floor.floor_id, floor)
    }
    logger.debug('HA WS', 'Loaded', state.floors.size, 'floors')
    notifyRegistryHandlers(state)
    return true
  }

  if (messageId === state.areaRegistryMessageId) {
    for (const area of result as AreaRegistryEntry[]) {
      state.areas.set(area.area_id, area.name)
      state.areaRegistry.set(area.area_id, area)
    }
    logger.debug('HA WS', 'Loaded', state.areas.size, 'areas')
    notifyRegistryHandlers(state)
    return true
  }

  if (messageId === state.deviceRegistryMessageId) {
    for (const device of result as { id: string; area_id?: string }[]) {
      state.deviceRegistry.set(device.id, device)
    }
    logger.debug('HA WS', 'Loaded', state.deviceRegistry.size, 'devices')
    // Re-map entity areas in case entity registry loaded first
    remapEntityAreas(state)
    return true
  }

  if (messageId === state.entityRegistryMessageId) {
    // Entity registry response - map entity_id to area name
    for (const entry of result as EntityRegistryEntry[]) {
      state.entityRegistry.set(entry.entity_id, entry)
      // Check entity area first, then fall back to device area
      let areaId = entry.area_id
      if (!areaId && entry.device_id) {
        const device = state.deviceRegistry.get(entry.device_id)
        areaId = device?.area_id
      }
      if (areaId) {
        const areaName = state.areas.get(areaId)
        if (areaName) {
          state.entityAreas.set(entry.entity_id, areaName)
        }
      }
    }
    logger.debug('HA WS', 'Mapped', state.entityAreas.size, 'entities to areas')
    // Re-notify with updated area info
    applyAreasToEntities(state)
    notifyMessageHandlers(state)
    notifyRegistryHandlers(state)
    return true
  }

  if (messageId === state.statesMessageId) {
    // Initial state fetch
    for (const entity of result as HAEntity[]) {
      state.entities.set(entity.entity_id, entity)
    }
    applyAreasToEntities(state)
    notifyMessageHandlers(state)
    return true
  }

  return false
}

export function handleStateChange(
  state: HAWebSocketState,
  entityId: string,
  newState: HAEntity | null
): void {
  // Clear optimistic state since real state has arrived
  clearOptimisticState(state, entityId)

  if (newState) {
    // Apply area info if we have it
    const areaName = state.entityAreas.get(entityId)
    if (areaName) {
      newState.attributes.area = areaName
    }
    state.entities.set(entityId, newState)
  } else {
    state.entities.delete(entityId)
  }
  notifyMessageHandlers(state)
}

/** Copies area name from entityAreas map into entity.attributes.area for convenience. */
export function applyAreasToEntities(state: HAWebSocketState): void {
  for (const [entityId, areaName] of state.entityAreas) {
    const entity = state.entities.get(entityId)
    if (entity) {
      entity.attributes.area = areaName
    }
  }
}

/** Re-processes entity-to-area mappings when device registry loads after entity registry. */
export function remapEntityAreas(state: HAWebSocketState): void {
  for (const [entityId, entry] of state.entityRegistry) {
    if (state.entityAreas.has(entityId)) continue // Already mapped

    // Check device area
    if (entry.device_id) {
      const device = state.deviceRegistry.get(entry.device_id)
      if (device?.area_id) {
        const areaName = state.areas.get(device.area_id)
        if (areaName) {
          state.entityAreas.set(entityId, areaName)
        }
      }
    }
  }
  applyAreasToEntities(state)
  notifyMessageHandlers(state)
  notifyRegistryHandlers(state)
}
