import { useState, useEffect, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { EditModal } from '@/components/ui/EditModal'
import { ModalActions } from '@/components/ui/ModalActions'
import { FormField } from '@/components/ui/FormField'
import { TextInput } from '@/components/ui/TextInput'
import { ComboBox } from '@/components/ui/ComboBox'
import { Toggle } from '@/components/ui/Toggle'
import { IconPickerField } from '@/components/ui/IconPickerField'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/providers/ToastProvider'
import { t, interpolate } from '@/lib/i18n'
import {
  getEntityRegistry,
  isEntityHiddenInStuga,
  updateEntity,
  setEntityHiddenInStuga,
  deleteScene,
  createArea,
  getCoverSettings,
  setCoverInverted,
  setCoverClosedPrc,
} from '@/lib/ha-websocket'
import { useSettings } from '@/lib/hooks/useSettings'
import { isEntityFavorite, toggleEntityFavorite } from '@/lib/hooks/useFavorites'
import { logger } from '@/lib/logger'
import { logDeviceEdit } from '@/lib/analytics'
import type { HAEntity, RoomWithDevices } from '@/types/ha'

interface DeviceEditModalProps {
  device: HAEntity | null
  rooms: RoomWithDevices[]
  onClose: () => void
  onDeviceHidden?: (entityId: string) => void
}

export function DeviceEditModal({ device, rooms, onClose, onDeviceHidden }: DeviceEditModalProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [roomId, setRoomId] = useState('')
  const [hidden, setHidden] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const [actsAsLight, setActsAsLight] = useState(false)
  const [coverInverted, setCoverInvertedState] = useState(false)
  const [coverClosedPrc, setCoverClosedPrcState] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showError } = useToast()
  const { alsoHideInHA } = useSettings()

  // Determine if this is a scene
  const isScene = useMemo(() => {
    return device?.entity_id.startsWith('scene.') ?? false
  }, [device])

  // Determine if this is a switch (only switches show "Show as" option)
  const isSwitch = useMemo(() => {
    return device?.entity_id.startsWith('switch.') ?? false
  }, [device])

  // Determine if this is a cover (covers show inverted + closed-at)
  const isCover = useMemo(() => {
    return device?.entity_id.startsWith('cover.') ?? false
  }, [device])

  // Get the appropriate translations
  const labels = isScene ? t.edit.scene : t.edit.device
  const deleteLabels = t.delete.scene

  // Reset form only when a different device is selected
  const deviceId = device?.entity_id
  useEffect(() => {
    if (device && deviceId) {
      // Get current name and icon from entity registry
      const registry = getEntityRegistry()
      const entry = registry.get(deviceId)
      setName(entry?.name || '')
      setIcon(entry?.icon || '')

      // Get current area
      const currentArea = device.attributes.area as string | undefined
      const currentRoom = rooms.find((r) => r.name === currentArea)
      setRoomId(currentRoom?.areaId || '')

      // Get hidden state (use Stuga-hidden state)
      setHidden(isEntityHiddenInStuga(deviceId))

      // Get favorite status
      setFavorite(isEntityFavorite(deviceId))

      // Get "acts as light" state (for switches: device_class === 'light')
      setActsAsLight(device.attributes.device_class === 'light')

      // Cover-specific settings
      if (deviceId.startsWith('cover.')) {
        const coverSettings = getCoverSettings(deviceId)
        setCoverInvertedState(coverSettings.inverted)
        setCoverClosedPrcState(coverSettings.closedPrc)
      } else {
        setCoverInvertedState(false)
        setCoverClosedPrcState(0)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId])

  const roomOptions = [
    { value: '', label: t.floors.none },
    ...rooms
      .map((r) => ({
        value: r.areaId || '',
        label: r.name,
      }))
      .filter((r) => r.value),
  ]

  const handleSave = async () => {
    if (!device) return

    setIsSaving(true)
    try {
      // Update name, icon, area, and device_class (for switches)
      await updateEntity(device.entity_id, {
        name: name.trim() || null,
        icon: icon.trim() || null,
        area_id: roomId || null,
        device_class: isSwitch ? (actsAsLight ? 'light' : null) : undefined,
      })

      // Update hidden state (in Stuga, and optionally in HA based on setting)
      await setEntityHiddenInStuga(device.entity_id, hidden, alsoHideInHA)

      // Update favorite status if changed
      const currentFavorite = isEntityFavorite(device.entity_id)
      if (favorite !== currentFavorite) {
        await toggleEntityFavorite(device.entity_id, isScene)
      }

      // Cover-specific persistence
      if (isCover) {
        const previous = getCoverSettings(device.entity_id)
        if (previous.inverted !== coverInverted) {
          await setCoverInverted(device.entity_id, coverInverted)
        }
        if (previous.closedPrc !== coverClosedPrc) {
          await setCoverClosedPrc(device.entity_id, coverClosedPrc > 0 ? coverClosedPrc : null)
        }
      }

      // Notify parent if device was hidden (so it can be deselected)
      if (hidden) {
        onDeviceHidden?.(device.entity_id)
      }

      void logDeviceEdit()
      onClose()
    } catch (error) {
      logger.error('DeviceEdit', 'Failed to update device:', error)
      showError(t.errors.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  const deviceName = device?.attributes.friendly_name || device?.entity_id || ''

  const handleDelete = async () => {
    if (!device || !isScene) return

    setIsDeleting(true)
    try {
      await deleteScene(device.entity_id)
      setShowDeleteConfirm(false)
      onClose()
    } catch (error) {
      logger.error('DeviceEdit', 'Failed to delete scene:', error)
      showError(t.errors.deleteFailed)
      setIsDeleting(false)
    }
  }

  return (
    <>
      <EditModal isOpen={!!device} onClose={onClose} title={labels.title}>
        <div className="space-y-4">
          <FormField label={labels.name}>
            <TextInput value={name} onChange={setName} placeholder={deviceName} />
          </FormField>

          <FormField label={labels.icon}>
            <IconPickerField value={icon} onChange={setIcon} />
          </FormField>

          <FormField label={labels.room}>
            <ComboBox
              value={roomId}
              onChange={setRoomId}
              options={roomOptions}
              placeholder="Select room..."
              onCreate={(name) => createArea(name)}
              createLabel={t.edit.createRoom}
            />
          </FormField>

          <FormField
            label={labels.hidden}
            hint={alsoHideInHA ? labels.hiddenHintAlsoHA : labels.hiddenHintStugaOnly}
          >
            <Toggle checked={hidden} onChange={setHidden} />
          </FormField>

          <FormField label={labels.favorite}>
            <Toggle checked={favorite} onChange={setFavorite} />
          </FormField>

          {isSwitch && (
            <FormField label={t.edit.device.actAsLight} hint={t.edit.device.actAsLightHint}>
              <Toggle checked={actsAsLight} onChange={setActsAsLight} />
            </FormField>
          )}

          {isCover && (
            <>
              <FormField label={t.edit.cover.inverted} hint={t.edit.cover.invertedHint}>
                <Toggle checked={coverInverted} onChange={setCoverInvertedState} />
              </FormField>

              <FormField label={t.edit.cover.closedAt} hint={t.edit.cover.closedAtHint}>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={coverClosedPrc}
                    onChange={(e) => {
                      setCoverClosedPrcState(parseInt(e.target.value, 10))
                    }}
                    className="flex-1 h-1.5 bg-border rounded-full appearance-none cursor-pointer accent-accent"
                  />
                  <span className="text-sm text-muted tabular-nums w-12 text-right">
                    {coverClosedPrc === 0 ? t.edit.cover.closedAtOff : `${coverClosedPrc}%`}
                  </span>
                </div>
              </FormField>
            </>
          )}

          <div className="pt-4">
            <ModalActions
              onCancel={onClose}
              onConfirm={handleSave}
              cancelLabel={t.edit.cancel}
              confirmLabel={isSaving ? t.edit.saving : t.edit.save}
              isLoading={isSaving}
            />
          </div>

          {/* Delete button for scenes */}
          {isScene && (
            <button
              onClick={() => {
                setShowDeleteConfirm(true)
              }}
              className="w-full mt-4 py-3 px-4 rounded-xl border border-red-500/30 text-red-500 font-medium hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {deleteLabels.button}
            </button>
          )}
        </div>
      </EditModal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
        }}
        onConfirm={handleDelete}
        title={deleteLabels.title}
        message={interpolate(deleteLabels.confirm, { name: deviceName })}
        confirmLabel={deleteLabels.button}
        variant="destructive"
        isLoading={isDeleting}
      />
    </>
  )
}
