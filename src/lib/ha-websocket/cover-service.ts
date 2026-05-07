import { isHALabel } from '@/types/ha'
import type { HAWebSocketState } from './types'
import { send, getNextMessageId } from './connection'
import { registerCallback, notifyRegistryHandlers } from './message-router'
import { COVER_INVERTED_LABEL, COVER_CLOSED_PRC_PREFIX } from '@/lib/constants'
import { DEFAULT_COVER_SETTINGS, type CoverSettings } from '@/lib/utils/cover'

/** Read per-cover Stuga overrides from the entity's labels. */
export function getCoverSettings(state: HAWebSocketState, entityId: string): CoverSettings {
  const entry = state.entityRegistry.get(entityId)
  if (!entry?.labels) return DEFAULT_COVER_SETTINGS

  let inverted = false
  let closedPrc = 0
  for (const labelId of entry.labels) {
    const label = state.labels.get(labelId)
    if (!label) continue
    if (label.name === COVER_INVERTED_LABEL) {
      inverted = true
    } else if (label.name.startsWith(COVER_CLOSED_PRC_PREFIX)) {
      const parsed = parseInt(label.name.slice(COVER_CLOSED_PRC_PREFIX.length), 10)
      if (!isNaN(parsed)) {
        closedPrc = Math.max(0, Math.min(100, parsed))
      }
    }
  }
  return { inverted, closedPrc }
}

/** Get or create a label by name, returns its id. */
async function ensureLabel(state: HAWebSocketState, name: string): Promise<string> {
  for (const [labelId, label] of state.labels) {
    if (label.name === name) return labelId
  }
  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success, result) => {
      if (success && isHALabel(result)) {
        state.labels.set(result.label_id, result)
        resolve(result.label_id)
      } else {
        reject(new Error(`Failed to create label ${name}`))
      }
    })
    send(state, { id: msgId, type: 'config/label_registry/create', name })
  })
}

async function writeEntityLabels(
  state: HAWebSocketState,
  entityId: string,
  labels: string[]
): Promise<void> {
  const entry = state.entityRegistry.get(entityId)
  if (!entry) return
  const previous = entry.labels
  entry.labels = labels
  notifyRegistryHandlers(state)

  return new Promise((resolve, reject) => {
    const msgId = getNextMessageId(state)
    registerCallback(state, msgId, (success) => {
      if (success) {
        resolve()
      } else {
        entry.labels = previous
        notifyRegistryHandlers(state)
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

export async function setCoverInverted(
  state: HAWebSocketState,
  entityId: string,
  inverted: boolean
): Promise<void> {
  const entry = state.entityRegistry.get(entityId)
  if (!entry) return

  const current = entry.labels || []
  const withoutInverted = current.filter(
    (id) => state.labels.get(id)?.name !== COVER_INVERTED_LABEL
  )

  if (!inverted) {
    if (withoutInverted.length === current.length) return
    await writeEntityLabels(state, entityId, withoutInverted)
    return
  }

  const labelId = await ensureLabel(state, COVER_INVERTED_LABEL)
  if (current.includes(labelId)) return
  await writeEntityLabels(state, entityId, [...withoutInverted, labelId])
}

/** Pass null to clear (default behavior, no remap). */
export async function setCoverClosedPrc(
  state: HAWebSocketState,
  entityId: string,
  prc: number | null
): Promise<void> {
  const entry = state.entityRegistry.get(entityId)
  if (!entry) return

  const current = entry.labels || []
  const withoutClosedPrc = current.filter(
    (id) => !state.labels.get(id)?.name.startsWith(COVER_CLOSED_PRC_PREFIX)
  )

  if (prc === null || prc <= 0) {
    if (withoutClosedPrc.length === current.length) return
    await writeEntityLabels(state, entityId, withoutClosedPrc)
    return
  }

  const clamped = Math.max(0, Math.min(100, Math.round(prc)))
  const labelName = `${COVER_CLOSED_PRC_PREFIX}${clamped}`
  const labelId = await ensureLabel(state, labelName)
  if (current.includes(labelId)) return
  await writeEntityLabels(state, entityId, [...withoutClosedPrc, labelId])
}
