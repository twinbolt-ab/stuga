import { useState, useCallback, useMemo } from 'react'
import type { RoomWithDevices, HAFloor } from '@/types/ha'
import { FAVORITES_FLOOR_ID } from '@/lib/constants'

interface UseFloorNavigationOptions {
  rooms: RoomWithDevices[]
  floors: HAFloor[]
  hasReceivedData: boolean
  activeMockScenario: string | null
  isEntityVisible: (entityId: string) => boolean
  /** Whether favorites exist (for showing favorites tab) */
  hasFavorites?: boolean
  /** Called when floor selection changes (for closing expanded rooms, etc.) */
  onFloorChange?: (newFloorId: string | null) => void
}

interface UseFloorNavigationReturn {
  /** The currently selected floor ID (null = unassigned rooms, '__all_devices__' = all devices view, '__favorites__' = favorites) */
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
  hasFavorites = false,
  onFloorChange,
}: UseFloorNavigationOptions): UseFloorNavigationReturn {
  const [userSelectedFloorId, setUserSelectedFloorId] = useState<string | null | undefined>(
    undefined
  )

  // Track previous mock scenario for change detection
  const [prevActiveMockScenario, setPrevActiveMockScenario] = useState(activeMockScenario)

  // Reset user selection when mock scenario changes (render-time state update)
  if (prevActiveMockScenario !== activeMockScenario) {
    setPrevActiveMockScenario(activeMockScenario)
    setUserSelectedFloorId(undefined)
  }

  // Set of valid floor IDs for quick lookup
  const validFloorIds = useMemo(() => new Set(floors.map((f) => f.floor_id)), [floors])

  // Helper to check if a room has a valid floor assignment
  // Returns true if room has no floor OR has a floor that doesn't exist (orphaned)
  const isRoomUnassigned = useCallback(
    (room: RoomWithDevices) => !room.floorId || !validFloorIds.has(room.floorId),
    [validFloorIds]
  )

  // Check if there are rooms without a valid floor that have controllable devices.
  // Only meaningful when floors exist — without floors, all rooms are shown by default.
  const hasUnassignedRooms = useMemo(() => {
    if (floors.length === 0) return false

    return rooms.some((room) => {
      if (!isRoomUnassigned(room)) return false
      const hasControllableDevices = room.devices.some((d) => isEntityVisible(d.entity_id))
      return hasControllableDevices
    })
  }, [rooms, floors.length, isEntityVisible, isRoomUnassigned])

  // Derive selected floor from data - user selection takes precedence, otherwise auto-select
  const selectedFloorId = useMemo(() => {
    // If user has made an explicit selection, use it (unless it's stale)
    if (userSelectedFloorId !== undefined) {
      // Validate the selection still exists
      if (userSelectedFloorId === '__all_devices__') return '__all_devices__'
      if (userSelectedFloorId === FAVORITES_FLOOR_ID) {
        // Only allow favorites if they exist
        return hasFavorites ? FAVORITES_FLOOR_ID : null
      }
      if (userSelectedFloorId === null) return null // "Other" tab
      if (floors.some((f) => f.floor_id === userSelectedFloorId)) return userSelectedFloorId
      // Selection is stale, fall through to auto-select
    }

    // Auto-select based on data - favorites first if they exist
    if (hasFavorites) {
      return FAVORITES_FLOOR_ID
    }
    if (floors.length > 0) {
      return floors[0].floor_id
    }
    if (hasReceivedData && rooms.length === 0) {
      return '__all_devices__'
    }
    return null
  }, [userSelectedFloorId, floors, hasReceivedData, rooms.length, hasFavorites])

  // Filter rooms by selected floor
  const filteredRooms = useMemo(() => {
    // Favorites tab handles its own data
    if (selectedFloorId === FAVORITES_FLOOR_ID) {
      return []
    }
    if (selectedFloorId === null) {
      // Show rooms with no floor OR with a non-existent floor (orphaned)
      return rooms.filter((room) => {
        if (!isRoomUnassigned(room)) return false
        return room.devices.some((d) => isEntityVisible(d.entity_id))
      })
    }
    return rooms.filter((room) => room.floorId === selectedFloorId)
  }, [rooms, selectedFloorId, isEntityVisible, isRoomUnassigned])

  // Get rooms for a specific floor (used by FloorSwipeContainer)
  const getRoomsForFloor = useCallback(
    (floorId: string | null): RoomWithDevices[] => {
      if (floorId === null) {
        // Uncategorized rooms (no floor OR non-existent floor)
        return rooms.filter((room) => {
          if (!isRoomUnassigned(room)) return false
          return room.devices.some((d) => isEntityVisible(d.entity_id))
        })
      }
      return rooms.filter((room) => room.floorId === floorId)
    },
    [rooms, isEntityVisible, isRoomUnassigned]
  )

  // Handle floor selection (from swipe or tab click)
  const handleSelectFloor = useCallback(
    (floorId: string | null) => {
      if (floorId !== selectedFloorId) {
        onFloorChange?.(floorId) // Notify parent (e.g., to close expanded rooms)
      }
      setUserSelectedFloorId(floorId)
    },
    [selectedFloorId, onFloorChange]
  )

  const handleViewAllDevices = useCallback(() => {
    onFloorChange?.('__all_devices__') // Notify parent (e.g., to close expanded rooms)
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
