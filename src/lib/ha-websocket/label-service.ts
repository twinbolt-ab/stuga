/**
 * Label Service
 *
 * Provides label management functions for the Home Assistant label registry.
 */

import type { HAWebSocketState } from './types'
import { send, getNextMessageId } from './connection'
import { registerCallback, notifyRegistryHandlers } from './message-router'

/**
 * Delete a label from the Home Assistant label registry
 */
export async function deleteLabel(state: HAWebSocketState, labelId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        state.labels.delete(labelId)
        notifyRegistryHandlers(state)
        resolve()
      } else {
        reject(new Error('Failed to delete label'))
      }
    })
    send(state, {
      id: msgId,
      type: 'config/label_registry/delete',
      label_id: labelId,
    })
  })
}
