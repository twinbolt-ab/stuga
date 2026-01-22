/**
 * Metadata Cleanup
 *
 * Handles cleanup of Home Assistant labels when room ordering is disabled.
 */

import * as ws from '@/lib/ha-websocket'
import { logger } from '@/lib/logger'
import { ROOM_ORDER_LABEL_PREFIX } from '@/lib/constants'

/**
 * Clean up all room order labels from Home Assistant.
 * Called when user disables room ordering.
 */
export async function cleanupRoomOrderLabels(): Promise<{ deletedCount: number }> {
  const labels = ws.getLabels()
  const roomOrderLabels = Array.from(labels.values()).filter((label) =>
    label.name.startsWith(ROOM_ORDER_LABEL_PREFIX)
  )

  if (roomOrderLabels.length === 0) {
    return { deletedCount: 0 }
  }

  const roomOrderLabelIds = new Set(roomOrderLabels.map((l) => l.label_id))

  // Remove room order labels from areas
  const areaRegistry = ws.getAreaRegistry()
  for (const [areaId, area] of areaRegistry) {
    const areaLabels = area.labels || []
    if (areaLabels.some((labelId) => roomOrderLabelIds.has(labelId))) {
      const filteredLabels = areaLabels.filter((id) => !roomOrderLabelIds.has(id))
      try {
        await ws.updateAreaLabels(areaId, filteredLabels)
      } catch (error) {
        logger.error('Metadata', `Failed to update area ${areaId} labels:`, error)
      }
    }
  }

  // Delete the labels themselves
  for (const label of roomOrderLabels) {
    try {
      await ws.deleteLabel(label.label_id)
    } catch (error) {
      logger.error('Metadata', `Failed to delete label ${label.name}:`, error)
    }
  }

  logger.debug(
    'Metadata',
    `Cleaned up ${roomOrderLabels.length} room order labels from Home Assistant`
  )
  return { deletedCount: roomOrderLabels.length }
}
