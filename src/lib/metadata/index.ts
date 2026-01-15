/**
 * Metadata Service
 *
 * Provides a unified API for storing room ordering, temperature sensor selection,
 * and device ordering. Supports two backends:
 * - 'ha-labels': Store in Home Assistant labels (syncs across devices)
 * - 'local-storage': Store locally on device (keeps HA clean)
 */

import type { MetadataBackend, MetadataStorageMode } from './types'
import { createHALabelsBackend } from './ha-labels-backend'
import { createLocalStorageBackend, initLocalStorageBackend } from './local-storage-backend'
import { getStorage } from '@/lib/storage'

const STORAGE_KEY = 'stuga-metadata-storage-mode'

let currentMode: MetadataStorageMode = 'local-storage'
let backend: MetadataBackend | null = null
let initialized = false

/**
 * Initialize the metadata service. Must be called after initStorage().
 * Defaults to local-storage mode unless user has explicitly opted into ha-labels.
 */
export async function initMetadataService(): Promise<void> {
  if (initialized) return

  const storage = getStorage()
  const storedMode = await storage.getItem(STORAGE_KEY)
  // Default to local-storage, only use ha-labels if explicitly set
  currentMode = storedMode === 'ha-labels' ? 'ha-labels' : 'local-storage'

  if (currentMode === 'local-storage') {
    await initLocalStorageBackend()
    backend = createLocalStorageBackend()
  } else {
    backend = createHALabelsBackend()
  }

  initialized = true
}

/**
 * Check if the metadata service has been initialized
 */
export function isMetadataServiceInitialized(): boolean {
  return initialized
}

/**
 * Get the current storage mode
 */
export function getMetadataStorageMode(): MetadataStorageMode {
  return currentMode
}

/**
 * Set the storage mode. This does NOT handle migration - use the cleanup module for that.
 */
export async function setMetadataStorageMode(mode: MetadataStorageMode): Promise<void> {
  if (mode === currentMode && initialized) return

  const storage = getStorage()
  await storage.setItem(STORAGE_KEY, mode)
  currentMode = mode

  if (mode === 'local-storage') {
    await initLocalStorageBackend()
    backend = createLocalStorageBackend()
  } else {
    backend = createHALabelsBackend()
  }

  initialized = true
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

export function setAreaTemperatureSensor(areaId: string, sensorEntityId: string | null): Promise<void> {
  return getBackend().setAreaTemperatureSensor(areaId, sensorEntityId)
}

export function getEntityOrder(entityId: string): number {
  return getBackend().getEntityOrder(entityId)
}

export function setEntityOrder(entityId: string, order: number): Promise<void> {
  return getBackend().setEntityOrder(entityId, order)
}

// Re-export types and utilities
export type { MetadataStorageMode } from './types'
export { exportLocalMetadata, importLocalMetadata, clearLocalMetadata } from './local-storage-backend'
