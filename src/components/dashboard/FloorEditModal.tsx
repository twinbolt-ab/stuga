import { useState, useEffect } from 'react'
import { Trash2, LayoutGrid } from 'lucide-react'
import { clsx } from 'clsx'
import { EditModal } from '@/components/ui/EditModal'
import { FormField } from '@/components/ui/FormField'
import { TextInput } from '@/components/ui/TextInput'
import { IconPickerField } from '@/components/ui/IconPickerField'
import { FloorDeleteDialog } from '@/components/dashboard/FloorDeleteDialog'
import { useToast } from '@/providers/ToastProvider'
import { t } from '@/lib/i18n'
import { updateFloor, getFloorColumns, setFloorColumns } from '@/lib/ha-websocket'
import { logger } from '@/lib/logger'
import type { GridColumnsOption } from '@/lib/hooks/useSettings'
import type { HAFloor, RoomWithDevices } from '@/types/ha'

interface FloorEditModalProps {
  floor: HAFloor | null
  floors?: HAFloor[]
  rooms?: RoomWithDevices[]
  onClose: () => void
  onDeleted?: () => void
}

export function FloorEditModal({
  floor,
  floors = [],
  rooms = [],
  onClose,
  onDeleted,
}: FloorEditModalProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [columns, setColumns] = useState<GridColumnsOption | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const { showError } = useToast()

  // Reset form only when a different floor is selected
  const floorId = floor?.floor_id
  useEffect(() => {
    if (floor && floorId) {
      setName(floor.name)
      setIcon(floor.icon || '')
      setColumns(getFloorColumns(floorId))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorId])

  const handleSave = async () => {
    if (!floor) return

    setIsSaving(true)
    try {
      await updateFloor(floor.floor_id, {
        name: name.trim() || floor.name,
        icon: icon.trim() || null,
      })
      // Save columns setting separately (via labels)
      const currentColumns = getFloorColumns(floor.floor_id)
      if (columns !== currentColumns) {
        await setFloorColumns(floor.floor_id, columns)
      }
      onClose()
    } catch (error) {
      logger.error('FloorEdit', 'Failed to update floor:', error)
      showError(t.errors.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <EditModal isOpen={!!floor} onClose={onClose} title={t.edit.floor.title}>
      <div className="space-y-4">
        <FormField label={t.edit.floor.name}>
          <TextInput value={name} onChange={setName} placeholder={floor?.name} />
        </FormField>

        <FormField label={t.edit.floor.icon}>
          <IconPickerField value={icon} onChange={setIcon} />
        </FormField>

        <FormField label={t.edit.floor.columns}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-border/50">
              <LayoutGrid className="w-4 h-4 text-foreground" />
            </div>
            <div className="flex rounded-lg overflow-hidden border border-border">
              {([undefined, 'auto', 1, 2, 3] as const).map((col) => (
                <button
                  key={col ?? 'default'}
                  type="button"
                  onClick={() => setColumns(col)}
                  className={clsx(
                    'h-8 text-sm font-medium transition-colors',
                    col === undefined || col === 'auto' ? 'px-2' : 'w-8',
                    columns === col
                      ? 'bg-accent text-white'
                      : 'bg-transparent text-foreground hover:bg-border/50'
                  )}
                >
                  {col === undefined
                    ? t.edit.floor.columnsDefault
                    : col === 'auto'
                      ? t.settings.display.columnsAuto
                      : col}
                </button>
              ))}
            </div>
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

        {/* Delete button */}
        <button
          onClick={() => {
            setShowDeleteDialog(true)
          }}
          className="w-full mt-4 py-3 px-4 rounded-xl border border-red-500/30 text-red-500 font-medium hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          {t.delete.floor.button}
        </button>
      </div>

      <FloorDeleteDialog
        floor={showDeleteDialog ? floor : null}
        floors={floors}
        rooms={rooms}
        onClose={() => {
          setShowDeleteDialog(false)
        }}
        onDeleted={() => {
          onClose()
          onDeleted?.()
        }}
      />
    </EditModal>
  )
}
