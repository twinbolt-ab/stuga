import { useState, useEffect, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { EditModal } from '@/components/ui/EditModal'
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
  isEntityHidden,
  updateEntity,
  setEntityHidden,
  deleteScene,
  createArea,
} from '@/lib/ha-websocket'
import { logger } from '@/lib/logger'
import type { HAEntity, RoomWithDevices } from '@/types/ha'

interface DeviceEditModalProps {
  device: HAEntity | null
  rooms: RoomWithDevices[]
  onClose: () => void
}

export function DeviceEditModal({ device, rooms, onClose }: DeviceEditModalProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [roomId, setRoomId] = useState('')
  const [hidden, setHidden] = useState(false)
  const [actsAsLight, setActsAsLight] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showError } = useToast()

  // Determine if this is a scene
  const isScene = useMemo(() => {
    return device?.entity_id.startsWith('scene.') ?? false
  }, [device])

  // Determine if this is a switch (only switches show "Show as" option)
  const isSwitch = useMemo(() => {
    return device?.entity_id.startsWith('switch.') ?? false
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

      // Get hidden state
      setHidden(isEntityHidden(deviceId))

      // Get "acts as light" state (for switches: device_class === 'light')
      setActsAsLight(device.attributes.device_class === 'light')
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

      // Update hidden state
      await setEntityHidden(device.entity_id, hidden)

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

          <FormField label={labels.hidden} hint={labels.hiddenHint}>
            <Toggle checked={hidden} onChange={setHidden} />
          </FormField>

          {isSwitch && (
            <FormField label={t.edit.device.actAsLight} hint={t.edit.device.actAsLightHint}>
              <Toggle checked={actsAsLight} onChange={setActsAsLight} />
            </FormField>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-border text-foreground font-medium hover:bg-border/30 transition-colors"
            >
              {t.edit.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? t.edit.saving : t.edit.save}
            </button>
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
