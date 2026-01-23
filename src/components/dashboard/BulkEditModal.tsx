import { useState, useEffect } from 'react'
import { EditModal } from '@/components/ui/EditModal'
import { FormField } from '@/components/ui/FormField'
import { ComboBox } from '@/components/ui/ComboBox'
import { IconPickerField } from '@/components/ui/IconPickerField'
import { useToast } from '@/providers/ToastProvider'
import { t, interpolate } from '@/lib/i18n'
import {
  updateArea,
  createFloor,
  updateEntity,
  createArea,
  setEntityHidden,
} from '@/lib/ha-websocket'
import { logger } from '@/lib/logger'
import type { RoomWithDevices, HAFloor, HAEntity } from '@/types/ha'

interface BulkEditRoomsModalProps {
  isOpen: boolean
  rooms: RoomWithDevices[]
  floors: HAFloor[]
  onClose: () => void
  onComplete: () => void
  onFloorCreated?: (floorId: string) => void
}

export function BulkEditRoomsModal({
  isOpen,
  rooms,
  floors,
  onClose,
  onComplete,
  onFloorCreated,
}: BulkEditRoomsModalProps) {
  const [floorId, setFloorId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const { showError } = useToast()

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFloorId('')
      setIsSaving(false)
    }
  }, [isOpen])

  const floorOptions = [
    { value: '', label: '— No change —' },
    { value: '__none__', label: t.floors.none },
    ...floors.map((f) => ({ value: f.floor_id, label: f.name })),
  ]

  const handleSave = async () => {
    if (!floorId) {
      onClose()
      return
    }

    setIsSaving(true)
    try {
      const targetFloorId = floorId === '__none__' ? null : floorId
      await Promise.all(
        rooms
          .filter((room) => room.areaId)
          .map((room) => updateArea(room.areaId!, { floor_id: targetFloorId }))
      )
      onComplete()
      onClose()
    } catch (error) {
      logger.error('BulkEdit', 'Failed to update rooms:', error)
      showError(t.errors.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <EditModal
      isOpen={isOpen}
      onClose={onClose}
      title={interpolate(t.bulkEdit.rooms.title, { count: rooms.length })}
    >
      <div className="space-y-4">
        <FormField label={t.bulkEdit.rooms.moveToFloor}>
          <ComboBox
            value={floorId}
            onChange={setFloorId}
            options={floorOptions}
            placeholder="— No change —"
            onCreate={async (name) => {
              const floorId = await createFloor(name)
              onFloorCreated?.(floorId)
              return floorId
            }}
            createLabel={t.edit.createFloor}
          />
        </FormField>

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
      </div>
    </EditModal>
  )
}

interface BulkEditDevicesModalProps {
  isOpen: boolean
  devices: HAEntity[]
  rooms: RoomWithDevices[]
  onClose: () => void
  onComplete: () => void
}

export function BulkEditDevicesModal({
  isOpen,
  devices,
  rooms,
  onClose,
  onComplete,
}: BulkEditDevicesModalProps) {
  const [roomId, setRoomId] = useState<string>('')
  const [icon, setIcon] = useState<string>('')
  const [hidden, setHidden] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const { showError } = useToast()

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRoomId('')
      setIcon('')
      setHidden('')
      setIsSaving(false)
    }
  }, [isOpen])

  const roomOptions = [
    { value: '', label: '— No change —' },
    { value: '__none__', label: t.floors.none },
    ...rooms.map((r) => ({ value: r.areaId || r.id, label: r.name })),
  ]

  const hiddenOptions = [
    { value: '', label: t.bulkEdit.noChange },
    { value: 'hide', label: t.bulkEdit.devices.hide },
    { value: 'unhide', label: t.bulkEdit.devices.unhide },
  ]

  const handleSave = async () => {
    if (!roomId && !icon && !hidden) {
      onClose()
      return
    }

    setIsSaving(true)
    try {
      // Handle entity updates (room, icon)
      const entityUpdates = devices
        .filter(() => roomId || icon)
        .map((device) => {
          const updates: { area_id?: string | null; icon?: string | null } = {}

          if (roomId) {
            updates.area_id = roomId === '__none__' ? null : roomId
          }
          if (icon) {
            updates.icon = icon
          }

          return updateEntity(device.entity_id, updates)
        })

      // Handle hidden state separately using the correct API
      const hiddenUpdates = hidden
        ? devices.map((device) => setEntityHidden(device.entity_id, hidden === 'hide'))
        : []

      await Promise.all([...entityUpdates, ...hiddenUpdates])
      onComplete()
      onClose()
    } catch (error) {
      logger.error('BulkEdit', 'Failed to update devices:', error)
      showError(t.errors.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <EditModal
      isOpen={isOpen}
      onClose={onClose}
      title={interpolate(t.bulkEdit.devices.title, { count: devices.length })}
    >
      <div className="space-y-4">
        <FormField label={t.bulkEdit.devices.moveToRoom}>
          <ComboBox
            value={roomId}
            onChange={setRoomId}
            options={roomOptions}
            placeholder="— No change —"
            onCreate={(name) => createArea(name)}
            createLabel={t.edit.createRoom}
          />
        </FormField>

        <FormField label={t.bulkEdit.devices.setIcon}>
          <IconPickerField value={icon} onChange={setIcon} />
        </FormField>

        <FormField label={t.edit.device.hidden}>
          <div className="flex gap-2">
            {hiddenOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setHidden(option.value)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                  hidden === option.value
                    ? 'bg-accent text-white'
                    : 'bg-border/50 text-foreground hover:bg-border'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FormField>

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
      </div>
    </EditModal>
  )
}
