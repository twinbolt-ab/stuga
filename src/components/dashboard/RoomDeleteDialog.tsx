import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { FormField } from '@/components/ui/FormField'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/providers/ToastProvider'
import { t, interpolate } from '@/lib/i18n'
import { updateEntity, deleteArea } from '@/lib/ha-websocket'
import { logger } from '@/lib/logger'
import type { RoomWithDevices, HAFloor } from '@/types/ha'

interface RoomDeleteDialogProps {
  room: RoomWithDevices | null
  allRooms: RoomWithDevices[]
  floors: HAFloor[]
  onClose: () => void
  onDeleted: () => void
}

export function RoomDeleteDialog({
  room,
  allRooms,
  floors,
  onClose,
  onDeleted,
}: RoomDeleteDialogProps) {
  const [mounted, setMounted] = useState(false)
  const [targetRoomId, setTargetRoomId] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const { showError } = useToast()

  // Only render portal on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset state when dialog opens
  useEffect(() => {
    if (room) {
      setTargetRoomId('')
      setIsDeleting(false)
    }
  }, [room])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onClose()
    }
    if (room) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [room, onClose, isDeleting])

  // Get other rooms for the dropdown
  const otherRooms = useMemo(() => {
    if (!room) return []
    return allRooms.filter((r) => r.areaId !== room.areaId && r.areaId)
  }, [room, allRooms])

  // Room options for select
  const roomOptions = useMemo(() => {
    const options = [
      { value: '', label: t.delete.room.uncategorized },
      ...otherRooms.map((r) => ({ value: r.areaId!, label: r.name })),
    ]
    return options
  }, [otherRooms])

  // Get controllable devices count
  const controllableDevices = useMemo(() => {
    if (!room) return []
    return room.devices.filter(
      (d) =>
        d.entity_id.startsWith('light.') ||
        d.entity_id.startsWith('switch.') ||
        d.entity_id.startsWith('scene.') ||
        d.entity_id.startsWith('input_boolean.') ||
        d.entity_id.startsWith('input_number.')
    )
  }, [room])

  const hasDevices = controllableDevices.length > 0

  // Get destination label for confirmation message
  const destinationLabel = useMemo(() => {
    if (!targetRoomId) return t.delete.room.uncategorized.toLowerCase()
    const targetRoom = otherRooms.find((r) => r.areaId === targetRoomId)
    return targetRoom?.name || ''
  }, [targetRoomId, otherRooms])

  const handleDelete = async () => {
    if (!room?.areaId) return

    setIsDeleting(true)
    try {
      // Move devices to new area if needed
      if (hasDevices) {
        const newAreaId = targetRoomId || null
        await Promise.all(
          controllableDevices.map((device) =>
            updateEntity(device.entity_id, { area_id: newAreaId })
          )
        )
      }

      // Delete the room
      await deleteArea(room.areaId)

      onDeleted()
      onClose()
    } catch (error) {
      logger.error('RoomDelete', 'Failed to delete room:', error)
      showError(t.errors.deleteFailed)
      setIsDeleting(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {room && (
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
                {t.delete.room.title}
              </h2>

              {/* Message/Form */}
              {hasDevices ? (
                <div className="space-y-4 mb-6">
                  <p className="text-sm text-muted text-center">
                    {interpolate(t.delete.room.hasDevices, { count: controllableDevices.length })}
                  </p>

                  <FormField label={t.delete.room.moveToRoom}>
                    <Select value={targetRoomId} onChange={setTargetRoomId} options={roomOptions} />
                  </FormField>

                  <p className="text-xs text-muted text-center">
                    {interpolate(t.delete.room.willMove, {
                      count: controllableDevices.length,
                      destination: destinationLabel,
                    })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted text-center mb-6">
                  {interpolate(t.delete.room.confirm, { name: room.name })}
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
                  {isDeleting ? t.delete.room.deleting : t.delete.room.button}
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
