import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEditMode } from '@/lib/contexts/EditModeContext'
import { t, interpolate } from '@/lib/i18n'

interface EditModeHeaderProps {
  onEditClick: () => void
  onDone: () => void
}

export function EditModeHeader({ onEditClick, onDone }: EditModeHeaderProps) {
  const {
    isDeviceEditMode,
    isAllDevicesEditMode,
    isFloorEditMode,
    selectedCount,
    clearSelection,
  } = useEditMode()

  // Floor edit mode has its own simpler UI
  if (isFloorEditMode) {
    return (
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
        className="fixed left-4 right-4 z-20 floating-bar rounded-2xl shadow-lg glass"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted">
            {t.rooms.floorReorderHint}
          </span>

          <button
            onClick={onDone}
            className="px-3 py-1.5 rounded-full btn-glass text-foreground text-sm font-medium transition-colors"
          >
            {t.editMode.done}
          </button>
        </div>
      </motion.div>
    )
  }

  const editButtonLabel = selectedCount === 1
    ? (isDeviceEditMode || isAllDevicesEditMode)
      ? t.bulkEdit.editDevice
      : t.bulkEdit.editRoom
    : t.bulkEdit.editSelected

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      className="fixed left-4 right-4 z-20 floating-bar rounded-2xl shadow-lg glass"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <>
              <button
                onClick={clearSelection}
                className="p-1 rounded-full hover:bg-accent/20 transition-colors"
                aria-label="Clear selection"
              >
                <X className="w-4 h-4 text-accent" />
              </button>
              <span className="text-sm font-semibold text-accent">
                {interpolate(t.bulkEdit.selected, { count: selectedCount })}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <button
              onClick={onEditClick}
              className="px-3 py-1.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              {editButtonLabel}
            </button>
          )}
          <button
            onClick={onDone}
            className="px-3 py-1.5 rounded-full btn-glass text-foreground text-sm font-medium transition-colors"
          >
            {t.editMode.done}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
