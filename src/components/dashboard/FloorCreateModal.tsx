import { useState } from 'react'
import { EditModal } from '@/components/ui/EditModal'
import { FormField } from '@/components/ui/FormField'
import { TextInput } from '@/components/ui/TextInput'
import { IconPickerField } from '@/components/ui/IconPickerField'
import { useToast } from '@/providers/ToastProvider'
import { t } from '@/lib/i18n'
import { createFloor, updateFloor, setFloorOrder } from '@/lib/ha-websocket'
import { ORDER_GAP } from '@/lib/constants'
import { logger } from '@/lib/logger'
import type { HAFloor } from '@/types/ha'

interface FloorCreateModalProps {
  isOpen: boolean
  floors: HAFloor[]
  onClose: () => void
  onCreate: (floorId: string) => void
}

export function FloorCreateModal({ isOpen, floors, onClose, onCreate }: FloorCreateModalProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const { showError } = useToast()

  const handleClose = () => {
    // Reset form state
    setName('')
    setIcon('')
    onClose()
  }

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      // Calculate the order for the new floor (after all existing floors)
      const maxLevel = floors.reduce((max, f) => Math.max(max, f.level ?? 0), 0)
      const newLevel = (maxLevel + 1) * ORDER_GAP

      // Create the floor with the name (or default to "New Floor")
      const floorName = name.trim() || 'New Floor'
      const newFloorId = await createFloor(floorName)

      // Set the floor's level to be last
      await setFloorOrder(newFloorId, newLevel)

      // If icon was set, update the floor with the icon
      if (icon.trim()) {
        await updateFloor(newFloorId, { icon: icon.trim() })
      }

      // Reset form state
      setName('')
      setIcon('')

      // Notify parent
      onCreate(newFloorId)
    } catch (error) {
      logger.error('FloorCreate', 'Failed to create floor:', error)
      showError(t.errors.saveFailed)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <EditModal isOpen={isOpen} onClose={handleClose} title={t.edit.createFloor}>
      <div className="space-y-4">
        <FormField label={t.edit.floor.name}>
          <TextInput value={name} onChange={setName} placeholder="New Floor" />
        </FormField>

        <FormField label={t.edit.floor.icon}>
          <IconPickerField value={icon} onChange={setIcon} />
        </FormField>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleClose}
            className="flex-1 py-3 px-4 rounded-xl border border-border text-foreground font-medium hover:bg-border/30 transition-colors"
          >
            {t.edit.cancel}
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex-1 py-3 px-4 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {isCreating ? t.edit.saving : t.edit.createFloor}
          </button>
        </div>
      </div>
    </EditModal>
  )
}
