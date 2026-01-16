import { useState, useCallback, useEffect, useMemo } from 'react'
import type { RoomWithDevices, HAFloor } from '@/types/ha'

interface UseFloorNavigationOptions {
  rooms: RoomWithDevices[]
  floors: HAFloor[]
  hasReceivedData: boolean
  activeMockScenario: string | null
  isEntityVisible: (entityId: string) => boolean
  /** Called when floor selection changes (for closing expanded rooms, etc.) */
  onFloorChange?: () => void
}

interface UseFloorNavigationReturn {
  /** The currently selected floor ID (null = unassigned rooms, '__all_devices__' = all devices view) */
  selectedFloorId: string | null
  /** Rooms filtered by selected floor */
  filteredRooms: RoomWithDevices[]
  /** Whether there are rooms without floor assignment that have controllable devices */
  hasUnassignedRooms: boolean
  /** Get rooms for a specific floor */
  getRoomsForFloor: (floorId: string | null) => RoomWithDevices[]
  /** Handle floor selection (from swipe or tab click) */
  handleSelectFloor: (floorId: string | null) => void
  /** Switch to all devices view */
  handleViewAllDevices: () => void
}

export function useFloorNavigation({
  rooms,
  floors,
  hasReceivedData,
  activeMockScenario,
  isEntityVisible,
  onFloorChange,
}: UseFloorNavigationOptions): UseFloorNavigationReturn {
  const [userSelectedFloorId, setUserSelectedFloorId] = useState<string | null | undefined>(
    undefined
  )

  // Check if there are rooms without a floor that have controllable devices
  const hasUnassignedRooms = useMemo(() => {
    return rooms.some((room) => {
      if (room.floorId) return false
      const hasControllableDevices = room.devices.some((d) => isEntityVisible(d.entity_id))
      return hasControllableDevices
    })
  }, [rooms, isEntityVisible])

  // Derive selected floor from data - user selection takes precedence, otherwise auto-select
  const selectedFloorId = useMemo(() => {
    // If user has made an explicit selection, use it (unless it's stale)
    if (userSelectedFloorId !== undefined) {
      // Validate the selection still exists
      if (userSelectedFloorId === '__all_devices__') return '__all_devices__'
      if (userSelectedFloorId === null) return null // "Other" tab
      if (floors.some((f) => f.floor_id === userSelectedFloorId)) return userSelectedFloorId
      // Selection is stale, fall through to auto-select
    }

    // Auto-select based on data
    if (floors.length > 0) {
      return floors[0].floor_id
    }
    if (hasReceivedData && rooms.length === 0) {
      return '__all_devices__'
    }
    return null
  }, [userSelectedFloorId, floors, hasReceivedData, rooms.length])

  // Reset user selection when mock scenario changes
  useEffect(() => {
    setUserSelectedFloorId(undefined)
  }, [activeMockScenario])

  // Filter rooms by selected floor
  const filteredRooms = useMemo(() => {
    if (selectedFloorId === null) {
      return rooms.filter((room) => {
        if (room.floorId) return false
        return room.devices.some((d) => isEntityVisible(d.entity_id))
      })
    }
    return rooms.filter((room) => room.floorId === selectedFloorId)
  }, [rooms, selectedFloorId, isEntityVisible])

  // Get rooms for a specific floor (used by FloorSwipeContainer)
  const getRoomsForFloor = useCallback(
    (floorId: string | null): RoomWithDevices[] => {
      if (floorId === null) {
        // Uncategorized rooms
        return rooms.filter((room) => {
          if (room.floorId) return false
          return room.devices.some((d) => isEntityVisible(d.entity_id))
        })
      }
      return rooms.filter((room) => room.floorId === floorId)
    },
    [rooms, isEntityVisible]
  )

  // Handle floor selection (from swipe or tab click)
  const handleSelectFloor = useCallback(
    (floorId: string | null) => {
      if (floorId !== selectedFloorId) {
        onFloorChange?.() // Notify parent (e.g., to close expanded rooms)
      }
      setUserSelectedFloorId(floorId)
    },
    [selectedFloorId, onFloorChange]
  )

  const handleViewAllDevices = useCallback(() => {
    onFloorChange?.() // Notify parent (e.g., to close expanded rooms)
    setUserSelectedFloorId('__all_devices__') // Special ID for all devices view
  }, [onFloorChange])

  return {
    selectedFloorId,
    filteredRooms,
    hasUnassignedRooms,
    getRoomsForFloor,
    handleSelectFloor,
    handleViewAllDevices,
  }
}
