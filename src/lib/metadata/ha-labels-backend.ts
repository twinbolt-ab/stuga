/**
 * Home Assistant Labels Backend for Metadata
 *
 * Wraps existing WebSocket service functions to provide the MetadataBackend interface.
 * This is the default backend that stores metadata in HA labels.
 */

import type { MetadataBackend } from './types'
import * as ws from '@/lib/ha-websocket'

export function createHALabelsBackend(): MetadataBackend {
  return {
    getAreaOrder(areaId: string): number {
      return ws.getAreaOrder(areaId)
    },

    async setAreaOrder(areaId: string, order: number): Promise<void> {
      return ws.setAreaOrder(areaId, order)
    },

    getAreaTemperatureSensor(areaId: string): string | undefined {
      return ws.getAreaTemperatureSensor(areaId)
    },

    async setAreaTemperatureSensor(areaId: string, sensorEntityId: string | null): Promise<void> {
      return ws.setAreaTemperatureSensor(areaId, sensorEntityId)
    },

    getEntityOrder(entityId: string): number {
      return ws.getEntityOrder(entityId)
    },

    async setEntityOrder(entityId: string, order: number): Promise<void> {
      return ws.setEntityOrder(entityId, order)
    },
  }
}
