import { motion } from 'framer-motion'
import { X, Info } from 'lucide-react'
import { useEditMode } from '@/lib/contexts/EditModeContext'
import { t, interpolate } from '@/lib/i18n'

interface EditModeHeaderProps {
  onEditClick: () => void
  onDone: () => void
}

export function EditModeHeader({ onEditClick, onDone }: EditModeHeaderProps) {
  const {
    isDeviceEditMode,
    isUncategorizedEditMode,
    selectedCount,
    clearSelection,
  } = useEditMode()

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      className="sticky top-0 z-20 bg-accent/10 backdrop-blur-md border-b border-accent/20"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Edit mode badge */}
          <span className="px-2 py-0.5 rounded-md bg-accent/20 text-accent text-xs font-semibold uppercase tracking-wide">
            {t.editMode.badge}
          </span>

          {/* Selection count or instructions */}
          {selectedCount > 0 ? (
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
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <span title={t.editMode.instructionsTooltip} className="flex-shrink-0 cursor-help">
                <Info className="w-4 h-4 text-accent/70" />
              </span>
              {t.editMode.instructions}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <button
              onClick={onEditClick}
              className="px-3 py-1.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              {selectedCount === 1
                ? (isDeviceEditMode || isUncategorizedEditMode)
                  ? t.bulkEdit.editDevice
                  : t.bulkEdit.editRoom
                : t.bulkEdit.editSelected}
            </button>
          )}
          <button
            onClick={onDone}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-border/50 text-foreground text-sm font-medium hover:bg-border transition-colors"
          >
            {t.editMode.done}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
