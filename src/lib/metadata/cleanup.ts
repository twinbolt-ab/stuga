/**
 * Metadata Cleanup & Migration
 *
 * Handles cleanup of Home Assistant labels and migration between storage modes.
 */

import * as ws from '@/lib/ha-websocket'
import { STUGA_PREFIX } from '@/lib/constants'
import { logger } from '@/lib/logger'
import { importLocalMetadata } from './local-storage-backend'
import {
  ROOM_ORDER_LABEL_PREFIX,
  TEMPERATURE_SENSOR_LABEL_PREFIX,
  DEVICE_ORDER_LABEL_PREFIX,
} from '@/lib/constants'

/**
 * Extract metadata from HA labels and return it for migration
 */
export function extractHAMetadata(): {
  areaOrders: [string, number][]
  areaTempSensors: [string, string][]
  entityOrders: [string, number][]
} {
  const areaOrders: [string, number][] = []
  const areaTempSensors: [string, string][] = []
  const entityOrders: [string, number][] = []

  const labels = ws.getLabels()
  const areaRegistry = ws.getAreaRegistry()
  const entityRegistry = ws.getEntityRegistry()

  // Extract area metadata
  for (const [areaId, area] of areaRegistry) {
    for (const labelId of area.labels || []) {
      const label = labels.get(labelId)
      if (!label) continue

      if (label.name.startsWith(ROOM_ORDER_LABEL_PREFIX)) {
        const orderStr = label.name.slice(ROOM_ORDER_LABEL_PREFIX.length)
        const order = parseInt(orderStr, 10)
        if (!isNaN(order)) {
          areaOrders.push([areaId, order])
        }
      } else if (label.name.startsWith(TEMPERATURE_SENSOR_LABEL_PREFIX)) {
        const sensorId = label.name.slice(TEMPERATURE_SENSOR_LABEL_PREFIX.length)
        areaTempSensors.push([areaId, sensorId])
      }
    }
  }

  // Extract entity metadata
  for (const [entityId, entity] of entityRegistry) {
    for (const labelId of entity.labels || []) {
      const label = labels.get(labelId)
      if (!label) continue

      if (label.name.startsWith(DEVICE_ORDER_LABEL_PREFIX)) {
        const orderStr = label.name.slice(DEVICE_ORDER_LABEL_PREFIX.length)
        const order = parseInt(orderStr, 10)
        if (!isNaN(order)) {
          entityOrders.push([entityId, order])
        }
      }
    }
  }

  return { areaOrders, areaTempSensors, entityOrders }
}

/**
 * Migrate metadata from HA labels to local storage
 */
export async function migrateHAToLocal(): Promise<void> {
  const metadata = extractHAMetadata()
  await importLocalMetadata(metadata)
  logger.debug(
    'Metadata',
    `Migrated ${metadata.areaOrders.length} area orders, ${metadata.areaTempSensors.length} temp sensors, ${metadata.entityOrders.length} entity orders to local storage`
  )
}

/**
 * Clean up all Stuga labels from Home Assistant
 */
export async function cleanupHALabels(): Promise<{ deletedCount: number }> {
  const labels = ws.getLabels()
  const stugaLabels = Array.from(labels.values()).filter((label) =>
    label.name.startsWith(STUGA_PREFIX)
  )

  if (stugaLabels.length === 0) {
    return { deletedCount: 0 }
  }

  const stugaLabelIds = new Set(stugaLabels.map((l) => l.label_id))

  // Remove stuga labels from areas
  const areaRegistry = ws.getAreaRegistry()
  for (const [areaId, area] of areaRegistry) {
    const areaLabels = area.labels || []
    if (areaLabels.some((labelId) => stugaLabelIds.has(labelId))) {
      const filteredLabels = areaLabels.filter((id) => !stugaLabelIds.has(id))
      try {
        await ws.updateAreaLabels(areaId, filteredLabels)
      } catch (error) {
        logger.error('Metadata', `Failed to update area ${areaId} labels:`, error)
      }
    }
  }

  // Remove stuga labels from entities
  const entityRegistry = ws.getEntityRegistry()
  for (const [entityId, entity] of entityRegistry) {
    const entityLabels = entity.labels || []
    if (entityLabels.some((labelId) => stugaLabelIds.has(labelId))) {
      const filteredLabels = entityLabels.filter((id) => !stugaLabelIds.has(id))
      try {
        await ws.updateEntityLabels(entityId, filteredLabels)
      } catch (error) {
        logger.error('Metadata', `Failed to update entity ${entityId} labels:`, error)
      }
    }
  }

  // Delete the labels themselves
  for (const label of stugaLabels) {
    try {
      await ws.deleteLabel(label.label_id)
    } catch (error) {
      logger.error('Metadata', `Failed to delete label ${label.name}:`, error)
    }
  }

  logger.debug('Metadata', `Cleaned up ${stugaLabels.length} Stuga labels from Home Assistant`)
  return { deletedCount: stugaLabels.length }
}

/**
 * Full migration: copy HA data to local, then clean up HA labels
 */
export async function switchToLocalStorage(): Promise<void> {
  await migrateHAToLocal()
  await cleanupHALabels()
}
