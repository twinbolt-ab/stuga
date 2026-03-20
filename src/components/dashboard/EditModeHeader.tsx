import { motion } from 'framer-motion'
import { X, Plus, Trash2 } from 'lucide-react'
import { useEditMode } from '@/lib/contexts/EditModeContext'
import { t, interpolate } from '@/lib/i18n'

// Map domain to singular/plural labels
const DOMAIN_LABELS: Record<string, { singular: string; plural: string }> = {
  light: { singular: t.bulkEdit.editLight, plural: t.bulkEdit.editLights },
  switch: { singular: t.bulkEdit.editSwitch, plural: t.bulkEdit.editSwitches },
  scene: { singular: t.bulkEdit.editScene, plural: t.bulkEdit.editScenes },
  input_boolean: { singular: t.bulkEdit.editToggle, plural: t.bulkEdit.editToggles },
  input_number: { singular: t.bulkEdit.editSlider, plural: t.bulkEdit.editSliders },
  fan: { singular: t.bulkEdit.editFan, plural: t.bulkEdit.editFans },
  vacuum: { singular: t.bulkEdit.editVacuum, plural: t.bulkEdit.editVacuums },
  media_player: { singular: t.bulkEdit.editMedia, plural: t.bulkEdit.editMediaPlayers },
}

function getDeviceEditLabel(selectedIds: Set<string>): string {
  const domains = new Set<string>()
  for (const id of selectedIds) {
    const domain = id.split('.')[0]
    domains.add(domain)
  }

  // Multiple different types → "Edit entities"
  if (domains.size > 1) {
    return t.bulkEdit.editEntities
  }

  // Single domain type
  const domain = [...domains][0]
  const labels = DOMAIN_LABELS[domain]
  const count = selectedIds.size

  if (labels) {
    return count === 1 ? labels.singular : labels.plural
  }

  // Fallback for unknown domains
  return count === 1 ? t.bulkEdit.editEntity : t.bulkEdit.editEntities
}

interface EditModeHeaderProps {
  onEditClick: () => void
  onDone: () => void
  onAddFloor?: () => void
  onRemoveFromFavorites?: () => void
}

export function EditModeHeader({
  onEditClick,
  onDone,
  onAddFloor,
  onRemoveFromFavorites,
}: EditModeHeaderProps) {
  const {
    isDeviceEditMode,
    isAllDevicesEditMode,
    isFloorEditMode,
    isFavoritesEditMode,
    selectedCount,
    selectedIds,
  } = useEditMode()

  // Floor edit mode has its own simpler UI
  if (isFloorEditMode) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        data-edit-mode-header
      >
        {/* Floating add button above the text card */}
        <motion.button
          initial={{ y: 60, scale: 0.8 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 60, scale: 0.8 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          onClick={onAddFloor}
          className="fixed right-4 z-20 floating-bar-above flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-accent text-white text-sm font-medium shadow-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.edit.createFloor}
        </motion.button>

        {/* Text card with close button and edit button */}
        <motion.div
          initial={{ y: 60 }}
          animate={{ y: 0 }}
          exit={{ y: 60 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="fixed left-4 right-4 z-20 floating-bar rounded-2xl shadow-lg glass"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={onDone}
                className="p-1 rounded-full hover:bg-accent/20 transition-colors"
                aria-label="Exit floor edit mode"
              >
                <X className="w-4 h-4 text-accent" />
              </button>
              <span className="text-sm text-muted">{t.rooms.floorReorderHint}</span>
            </div>
            <button
              onClick={onEditClick}
              className="px-3 py-1.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              {t.edit.editFloor}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // Favorites edit mode - shows "Remove from favorites" button
  if (isFavoritesEditMode) {
    return (
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
        className="fixed left-4 right-4 z-20 floating-bar rounded-2xl shadow-lg glass"
        data-edit-mode-header
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onDone}
              className="p-1 rounded-full hover:bg-accent/20 transition-colors"
              aria-label="Exit favorites edit mode"
            >
              <X className="w-4 h-4 text-accent" />
            </button>
            {selectedCount > 0 && (
              <span className="text-sm font-semibold text-accent">
                {interpolate(t.bulkEdit.selected, { count: selectedCount })}
              </span>
            )}
          </div>

          {selectedCount > 0 && (
            <button
              onClick={onRemoveFromFavorites}
              className="px-3 py-1.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.favorites.removeFromFavorites}
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  const isDeviceMode = isDeviceEditMode || isAllDevicesEditMode
  const editButtonLabel = isDeviceMode
    ? getDeviceEditLabel(selectedIds)
    : selectedCount === 1
      ? t.bulkEdit.editRoom
      : t.bulkEdit.editRooms

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      className="fixed left-4 right-4 z-20 floating-bar rounded-2xl shadow-lg glass"
      data-edit-mode-header
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onDone}
            className="p-1 rounded-full hover:bg-accent/20 transition-colors"
            aria-label="Exit edit mode"
          >
            <X className="w-4 h-4 text-accent" />
          </button>
          {selectedCount > 0 && (
            <span className="text-sm font-semibold text-accent">
              {interpolate(t.bulkEdit.selected, { count: selectedCount })}
            </span>
          )}
        </div>

        {selectedCount > 0 && (
          <button
            onClick={onEditClick}
            className="px-3 py-1.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            {editButtonLabel}
          </button>
        )}
      </div>
    </motion.div>
  )
}
