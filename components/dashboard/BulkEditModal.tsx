'use client'

import { useState } from 'react'
import { EditModal } from '@/components/ui/EditModal'
import { FormField } from '@/components/ui/FormField'
import { Select } from '@/components/ui/Select'
import { ComboBox } from '@/components/ui/ComboBox'
import { t, interpolate } from '@/lib/i18n'
import { haWebSocket } from '@/lib/ha-websocket'
import type { RoomWithDevices, HAFloor, HAEntity } from '@/types/ha'

interface BulkEditRoomsModalProps {
  rooms: RoomWithDevices[]
  floors: HAFloor[]
  onClose: () => void
  onComplete: () => void
}

export function BulkEditRoomsModal({ rooms, floors, onClose, onComplete }: BulkEditRoomsModalProps) {
  const [floorId, setFloorId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  const floorOptions = [
    { value: '', label: '— No change —' },
    { value: '__none__', label: t.floors.none },
    ...floors.map(f => ({ value: f.floor_id, label: f.name }))
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
          .filter(room => room.areaId)
          .map(room => haWebSocket.updateArea(room.areaId!, { floor_id: targetFloorId }))
      )
      onComplete()
      onClose()
    } catch (error) {
      console.error('Failed to update rooms:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <EditModal
      isOpen={rooms.length > 0}
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
            onCreate={(name) => haWebSocket.createFloor(name)}
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
  devices: HAEntity[]
  rooms: RoomWithDevices[]
  onClose: () => void
  onComplete: () => void
}

export function BulkEditDevicesModal({ devices, rooms, onClose, onComplete }: BulkEditDevicesModalProps) {
  const [roomId, setRoomId] = useState<string>('')
  const [hidden, setHidden] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  const roomOptions = [
    { value: '', label: '— No change —' },
    { value: '__none__', label: t.floors.none },
    ...rooms.map(r => ({ value: r.areaId || r.id, label: r.name }))
  ]

  const hiddenOptions = [
    { value: '', label: '— No change —' },
    { value: 'hide', label: t.bulkEdit.devices.hide },
    { value: 'unhide', label: t.bulkEdit.devices.unhide },
  ]

  const handleSave = async () => {
    if (!roomId && !hidden) {
      onClose()
      return
    }

    setIsSaving(true)
    try {
      await Promise.all(
        devices.map(device => {
          const updates: { area_id?: string | null; hidden_by?: string | null } = {}

          if (roomId) {
            updates.area_id = roomId === '__none__' ? null : roomId
          }
          if (hidden) {
            updates.hidden_by = hidden === 'hide' ? 'user' : null
          }

          return haWebSocket.updateEntity(device.entity_id, updates)
        })
      )
      onComplete()
      onClose()
    } catch (error) {
      console.error('Failed to update devices:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <EditModal
      isOpen={devices.length > 0}
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
            onCreate={(name) => haWebSocket.createArea(name)}
            createLabel={t.edit.createRoom}
          />
        </FormField>

        <FormField label={t.edit.device.hidden}>
          <Select
            value={hidden}
            onChange={setHidden}
            options={hiddenOptions}
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
