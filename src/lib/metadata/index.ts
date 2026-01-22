/**
 * Metadata Service
 *
 * Provides a unified API for storing room ordering, temperature sensor selection,
 * and device ordering via Home Assistant labels.
 */

import type { MetadataBackend } from './types'
import { createHALabelsBackend } from './ha-labels-backend'

let backend: MetadataBackend | null = null
let initialized = false

/**
 * Initialize the metadata service.
 */
export function initMetadataService(): void {
  if (initialized) return
  backend = createHALabelsBackend()
  initialized = true
}

/**
 * Check if the metadata service has been initialized
 */
export function isMetadataServiceInitialized(): boolean {
  return initialized
}

function getBackend(): MetadataBackend {
  if (!backend) {
    throw new Error('MetadataService not initialized. Call initMetadataService() first.')
  }
  return backend
}

// Public API - delegates to current backend

export function getAreaOrder(areaId: string): number {
  return getBackend().getAreaOrder(areaId)
}

export function setAreaOrder(areaId: string, order: number): Promise<void> {
  return getBackend().setAreaOrder(areaId, order)
}

export function getAreaTemperatureSensor(areaId: string): string | undefined {
  return getBackend().getAreaTemperatureSensor(areaId)
}

export function setAreaTemperatureSensor(
  areaId: string,
  sensorEntityId: string | null
): Promise<void> {
  return getBackend().setAreaTemperatureSensor(areaId, sensorEntityId)
}

export function getEntityOrder(entityId: string): number {
  return getBackend().getEntityOrder(entityId)
}

export function setEntityOrder(entityId: string, order: number): Promise<void> {
  return getBackend().setEntityOrder(entityId, order)
}
