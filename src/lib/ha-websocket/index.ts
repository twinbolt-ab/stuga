/**
 * Home Assistant WebSocket Module
 *
 * Provides a WebSocket connection to Home Assistant for real-time
 * entity state updates and registry management.
 *
 * Usage:
 *   import { configure, connect, getEntities, callService } from '@/lib/ha-websocket'
 */

import type { HAEntity, WebSocketMessage, HALabel, HAFloor, AreaRegistryEntry, EntityRegistryEntry } from '@/types/ha'
import { createInitialState } from './types'
import type { MessageHandler, ConnectionHandler, RegistryHandler } from './types'
import * as conn from './connection'
import * as router from './message-router'
import * as registry from './registry-manager'
import * as areaSvc from './area-service'
import * as floorSvc from './floor-service'
import * as entitySvc from './entity-service'
import * as labelSvc from './label-service'
import { logger } from '@/lib/logger'

// Module-private singleton state
const state = createInitialState()

// Internal message handler
function handleMessage(message: WebSocketMessage): void {
  switch (message.type) {
    case 'auth_required':
      conn.authenticate(state)
      break

    case 'auth_ok':
      logger.debug('HA WS', 'Authenticated')
      state.isAuthenticated = true
      router.notifyConnectionHandlers(state, true)
      registry.subscribeToStateChanges(state)
      registry.fetchAllRegistries(state)
      break

    case 'auth_invalid':
      logger.error('HA WS', 'Authentication failed')
      conn.disconnect(state)
      break

    case 'result':
      if (message.id) {
        if (!message.success && message.error) {
          logger.error('HA WS', 'Command failed:', message.error.code, message.error.message)
        }
        router.handlePendingCallback(state, message.id, message.success ?? false, message.result, message.error)
      }
      if (message.success && message.id) {
        registry.handleRegistryResult(state, message.id, message.result)
      }
      break

    case 'event':
      if (message.event?.event_type === 'state_changed') {
        const { entity_id, new_state } = message.event.data
        registry.handleStateChange(state, entity_id, new_state)
      }
      break
  }
}

// Connection
export const configure = (url: string, token: string, useOAuth = false) =>
  conn.configure(state, url, token, useOAuth)
export const connect = () => conn.connect(state, handleMessage)
export const disconnect = () => conn.disconnect(state)
export const isConnected = () => conn.isConnected(state)

// Subscriptions
export const onMessage = (handler: MessageHandler) => router.addMessageHandler(state, handler)
export const onConnection = (handler: ConnectionHandler) => router.addConnectionHandler(state, handler)
export const onRegistryUpdate = (handler: RegistryHandler) => router.addRegistryHandler(state, handler)

// Entities
export const getEntities = () => entitySvc.getEntities(state)
export const getEntity = (entityId: string) => entitySvc.getEntity(state, entityId)
export const getEntityRegistry = () => entitySvc.getEntityRegistry(state)
export const getLabels = () => entitySvc.getLabels(state)
export const getEntityIcon = (entityId: string) => entitySvc.getEntityIcon(state, entityId)
export const getEntityOrder = (entityId: string) => entitySvc.getEntityOrder(state, entityId)
export const setEntityOrder = (entityId: string, order: number) =>
  entitySvc.setEntityOrder(state, entityId, order)
export const updateEntity = (
  entityId: string,
  updates: { name?: string | null; area_id?: string | null; icon?: string | null }
) => entitySvc.updateEntity(state, entityId, updates)
export const isEntityHidden = (entityId: string) => entitySvc.isEntityHidden(state, entityId)
export const getHiddenEntities = () => entitySvc.getHiddenEntities(state)
export const setEntityHidden = (entityId: string, hidden: boolean) =>
  entitySvc.setEntityHidden(state, entityId, hidden)
export const deleteScene = (entityId: string) => entitySvc.deleteScene(state, entityId)
export const callService = (domain: string, service: string, data?: Record<string, unknown>) =>
  entitySvc.callService(state, domain, service, data)

// Areas
export const getAreaRegistry = () => state.areaRegistry
export const getAreaIcon = (areaId: string) => areaSvc.getAreaIcon(state, areaId)
export const getAreaOrder = (areaId: string) => areaSvc.getAreaOrder(state, areaId)
export const setAreaOrder = (areaId: string, order: number) => areaSvc.setAreaOrder(state, areaId, order)
export const getAreaTemperatureSensor = (areaId: string) => areaSvc.getAreaTemperatureSensor(state, areaId)
export const setAreaTemperatureSensor = (areaId: string, sensorEntityId: string | null) =>
  areaSvc.setAreaTemperatureSensor(state, areaId, sensorEntityId)
export const updateArea = (
  areaId: string,
  updates: { name?: string; floor_id?: string | null; icon?: string | null }
) => areaSvc.updateArea(state, areaId, updates)
export const createArea = (name: string, floorId?: string) => areaSvc.createArea(state, name, floorId)
export const deleteArea = (areaId: string) => areaSvc.deleteArea(state, areaId)

// Floors
export const getFloors = () => floorSvc.getFloors(state)
export const getFloor = (floorId: string) => floorSvc.getFloor(state, floorId)
export const getFloorOrder = (floorId: string) => floorSvc.getFloorOrder(state, floorId)
export const updateFloor = (floorId: string, updates: { name?: string; icon?: string | null }) =>
  floorSvc.updateFloor(state, floorId, updates)
export const setFloorOrder = (floorId: string, order: number) =>
  floorSvc.setFloorOrder(state, floorId, order)
export const saveFloorOrderBatch = (orderedFloors: HAFloor[], originalFloors: HAFloor[]) =>
  floorSvc.saveFloorOrderBatch(state, orderedFloors, originalFloors)
export const createFloor = (name: string) => floorSvc.createFloor(state, name)
export const deleteFloor = (floorId: string) => floorSvc.deleteFloor(state, floorId)

// Labels (for cleanup operations)
export const deleteLabel = (labelId: string) => labelSvc.deleteLabel(state, labelId)
export const updateAreaLabels = (areaId: string, labels: string[]) =>
  areaSvc.updateAreaLabels(state, areaId, labels)
export const updateEntityLabels = (entityId: string, labels: string[]) =>
  entitySvc.updateEntityLabels(state, entityId, labels)

// State access (for metadata service)
export const getState = () => state

// Re-export types
export type { HAWebSocketState, MessageHandler, ConnectionHandler, RegistryHandler } from './types'
export type { HAEntity, HALabel, HAFloor, AreaRegistryEntry, EntityRegistryEntry }
