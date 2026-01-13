import { useState, useEffect, useRef, useCallback } from 'react'
import { useRoomOrder } from './useRoomOrder'
import { ORDER_GAP } from '@/lib/constants'
import type { RoomWithDevices } from '@/types/ha'

interface UseRoomOrderSyncOptions {
  filteredRooms: RoomWithDevices[]
  isRoomEditMode: boolean
  modeType: string
}

interface UseRoomOrderSyncReturn {
  orderedRooms: RoomWithDevices[]
  setOrderedRooms: React.Dispatch<React.SetStateAction<RoomWithDevices[]>>
  handleReorder: (newOrder: RoomWithDevices[]) => void
}

/**
 * Hook to manage room ordering during edit mode.
 * Handles:
 * - Initializing order when entering edit mode
 * - Syncing room data changes (name, icon) while preserving order
 * - Saving order to Home Assistant when exiting edit mode
 */
export function useRoomOrderSync({
  filteredRooms,
  isRoomEditMode,
  modeType,
}: UseRoomOrderSyncOptions): UseRoomOrderSyncReturn {
  const { setAreaOrder } = useRoomOrder()
  const [orderedRooms, setOrderedRooms] = useState<RoomWithDevices[]>([])
  const prevModeTypeRef = useRef(modeType)

  // Save room order when exiting room edit mode
  useEffect(() => {
    const wasRoomEdit = prevModeTypeRef.current === 'edit-rooms'
    const isNowNormal = modeType === 'normal'

    if (wasRoomEdit && isNowNormal && orderedRooms.length > 0) {
      // Save room order
      const updates = orderedRooms
        .map((room, idx) => ({ areaId: room.areaId, order: (idx + 1) * ORDER_GAP }))
        .filter(item => item.areaId)

      Promise.all(updates.map(({ areaId, order }) => setAreaOrder(areaId!, order)))

      // Clear orderedRooms so it gets re-initialized next time
      setOrderedRooms([])
    }

    prevModeTypeRef.current = modeType
  }, [modeType, orderedRooms, setAreaOrder])

  // Sync orderedRooms with filteredRooms data while preserving order
  // This ensures edits (name, icon changes) and deletions are reflected immediately
  useEffect(() => {
    if (!isRoomEditMode || orderedRooms.length === 0) return

    // Use areaId for matching since room.id is derived from name and changes when renamed
    const roomDataByAreaId = new Map(filteredRooms.map(r => [r.areaId, r]))

    // Check if any rooms were deleted
    const hasDeletedRooms = orderedRooms.some(ordered => !roomDataByAreaId.has(ordered.areaId))

    // Check if any rooms need data updates
    const needsDataUpdate = orderedRooms.some(ordered => {
      const fresh = roomDataByAreaId.get(ordered.areaId)
      return fresh && (fresh.name !== ordered.name || fresh.icon !== ordered.icon || fresh.id !== ordered.id)
    })

    if (hasDeletedRooms || needsDataUpdate) {
      setOrderedRooms(prev => prev
        .filter(r => roomDataByAreaId.has(r.areaId))
        .map(ordered => {
          const fresh = roomDataByAreaId.get(ordered.areaId)
          return fresh || ordered
        })
      )
    }
  }, [isRoomEditMode, filteredRooms, orderedRooms])

  // Initialize orderedRooms when entering room edit mode
  useEffect(() => {
    if (isRoomEditMode && orderedRooms.length === 0 && filteredRooms.length > 0) {
      setOrderedRooms([...filteredRooms])
    }
  }, [isRoomEditMode, orderedRooms.length, filteredRooms])

  const handleReorder = useCallback((newOrder: RoomWithDevices[]) => {
    setOrderedRooms(newOrder)
  }, [])

  return {
    orderedRooms,
    setOrderedRooms,
    handleReorder,
  }
}
