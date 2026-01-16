import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { FormField } from '@/components/ui/FormField'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/providers/ToastProvider'
import { t, interpolate } from '@/lib/i18n'
import { deleteFloor, updateArea } from '@/lib/ha-websocket'
import { logger } from '@/lib/logger'
import { useIsClient } from '@/lib/hooks/useIsClient'
import type { HAFloor, RoomWithDevices } from '@/types/ha'

interface FloorDeleteDialogProps {
  floor: HAFloor | null
  floors: HAFloor[]
  rooms: RoomWithDevices[]
  onClose: () => void
  onDeleted: () => void
}

export function FloorDeleteDialog({
  floor,
  floors,
  rooms,
  onClose,
  onDeleted,
}: FloorDeleteDialogProps) {
  const isClient = useIsClient()
  const { showError } = useToast()

  // Use floor.floor_id as key to reset state when floor changes
  // This is cleaner than useEffect setState syncing
  const floorKey = floor?.floor_id ?? ''

  return (
    <FloorDeleteDialogContent
      key={floorKey}
      floor={floor}
      floors={floors}
      rooms={rooms}
      onClose={onClose}
      onDeleted={onDeleted}
      showError={showError}
      isClient={isClient}
    />
  )
}

interface FloorDeleteDialogContentProps extends Omit<FloorDeleteDialogProps, never> {
  showError: (msg: string) => void
  isClient: boolean
}

function FloorDeleteDialogContent({
  floor,
  floors,
  rooms,
  onClose,
  onDeleted,
  showError,
  isClient,
}: FloorDeleteDialogContentProps) {
  const [targetFloorId, setTargetFloorId] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onClose()
    }
    if (floor) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [floor, onClose, isDeleting])

  // Count rooms on this floor
  const roomsOnFloor = useMemo(() => {
    if (!floor) return []
    return rooms.filter((r) => r.floorId === floor.floor_id)
  }, [floor, rooms])

  const hasRooms = roomsOnFloor.length > 0

  // Get other floors for the dropdown
  const otherFloors = useMemo(() => {
    if (!floor) return []
    return floors.filter((f) => f.floor_id !== floor.floor_id)
  }, [floor, floors])

  // Floor options for select
  const floorOptions = useMemo(() => {
    const options = [
      { value: '', label: t.delete.floor.unassigned },
      ...otherFloors.map((f) => ({ value: f.floor_id, label: f.name })),
    ]
    return options
  }, [otherFloors])

  // Get destination label for confirmation message
  const destinationLabel = useMemo(() => {
    if (!targetFloorId) return t.delete.floor.unassigned.toLowerCase()
    const targetFloor = otherFloors.find((f) => f.floor_id === targetFloorId)
    return targetFloor?.name || ''
  }, [targetFloorId, otherFloors])

  const handleDelete = async () => {
    if (!floor) return

    setIsDeleting(true)
    try {
      // Move rooms to new floor if needed
      if (hasRooms) {
        const newFloorId = targetFloorId || null
        await Promise.all(
          roomsOnFloor.map((room) =>
            room.areaId ? updateArea(room.areaId, { floor_id: newFloorId }) : Promise.resolve()
          )
        )
      }

      await deleteFloor(floor.floor_id)
      onDeleted()
      onClose()
    } catch (error) {
      logger.error('FloorDelete', 'Failed to delete floor:', error)
      showError(t.errors.deleteFailed)
      setIsDeleting(false)
    }
  }

  if (!isClient) return null

  return createPortal(
    <AnimatePresence>
      {floor && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110]"
            onClick={() => !isDeleting && onClose()}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-[110] bg-card rounded-t-2xl shadow-warm-lg"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Content */}
            <div className="px-4 py-4 pb-safe">
              {/* Warning icon */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-lg font-semibold text-foreground text-center mb-2">
                {t.delete.floor.title}
              </h2>

              {/* Message/Form */}
              {hasRooms ? (
                <div className="space-y-4 mb-6">
                  <p className="text-sm text-muted text-center">
                    {interpolate(t.delete.floor.hasRooms, { count: roomsOnFloor.length })}
                  </p>

                  <FormField label={t.delete.floor.moveToFloor}>
                    <Select
                      value={targetFloorId}
                      onChange={setTargetFloorId}
                      options={floorOptions}
                    />
                  </FormField>

                  <p className="text-xs text-muted text-center">
                    {interpolate(t.delete.floor.willMove, {
                      count: roomsOnFloor.length,
                      destination: destinationLabel,
                    })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted text-center mb-6">
                  {interpolate(t.delete.floor.confirm, { name: floor.name })}
                </p>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl bg-border/50 text-foreground font-medium hover:bg-border transition-colors disabled:opacity-50"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? t.delete.floor.deleting : t.delete.floor.button}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
