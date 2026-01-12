'use client'

import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { EditModal } from '@/components/ui/EditModal'
import { FormField } from '@/components/ui/FormField'
import { TextInput } from '@/components/ui/TextInput'
import { ComboBox } from '@/components/ui/ComboBox'
import { IconPickerField } from '@/components/ui/IconPickerField'
import { RoomDeleteDialog } from '@/components/dashboard/RoomDeleteDialog'
import { t } from '@/lib/i18n'
import { haWebSocket } from '@/lib/ha-websocket'
import type { RoomWithDevices, HAFloor } from '@/types/ha'

interface RoomEditModalProps {
  room: RoomWithDevices | null
  allRooms?: RoomWithDevices[]
  floors: HAFloor[]
  onClose: () => void
}

export function RoomEditModal({ room, allRooms = [], floors, onClose }: RoomEditModalProps) {
  const [name, setName] = useState('')
  const [floorId, setFloorId] = useState('')
  const [icon, setIcon] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Reset form only when a different room is selected
  const roomId = room?.areaId
  useEffect(() => {
    if (room && roomId) {
      setName(room.name)
      setFloorId(room.floorId || '')
      setIcon(room.icon || '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const floorOptions = [
    { value: '', label: t.floors.none },
    ...floors.map(f => ({ value: f.floor_id, label: f.name }))
  ]

  const handleSave = async () => {
    if (!room?.areaId) return

    setIsSaving(true)
    try {
      await haWebSocket.updateArea(room.areaId, {
        name: name.trim() || room.name,
        floor_id: floorId || null,
        icon: icon.trim() || null,
      })
      onClose()
    } catch (error) {
      console.error('Failed to update room:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <EditModal
      isOpen={!!room}
      onClose={onClose}
      title={t.edit.room.title}
    >
      <div className="space-y-4">
        <FormField label={t.edit.room.name}>
          <TextInput
            value={name}
            onChange={setName}
            placeholder={room?.name}
          />
        </FormField>

        <FormField label={t.edit.room.floor}>
          <ComboBox
            value={floorId}
            onChange={setFloorId}
            options={floorOptions}
            placeholder={t.floors.none}
            onCreate={(name) => haWebSocket.createFloor(name)}
            createLabel={t.edit.createFloor}
          />
        </FormField>

        <FormField label={t.edit.room.icon}>
          <IconPickerField
            value={icon}
            onChange={setIcon}
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

        {/* Delete button */}
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="w-full mt-4 py-3 px-4 rounded-xl border border-red-500/30 text-red-500 font-medium hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          {t.delete.room.button}
        </button>
      </div>

      <RoomDeleteDialog
        room={showDeleteDialog ? room : null}
        allRooms={allRooms}
        floors={floors}
        onClose={() => setShowDeleteDialog(false)}
        onDeleted={onClose}
      />
    </EditModal>
  )
}
