import { useState, useCallback, useRef, useMemo } from 'react'
import { haptic } from '@/lib/haptics'
import type { RoomWithDevices, HAFloor } from '@/types/ha'

const HOLD_DURATION = 500 // ms before auto-swiping to floor

interface UseCrossFloorDragOptions {
  floors: HAFloor[]
  selectedFloorId: string | null
  hasUnassignedRooms: boolean
  onSelectFloor: (floorId: string | null) => void
  onMoveRoomToFloor: (room: RoomWithDevices, targetFloorId: string | null) => Promise<void>
  /** Called when switching floors mid-drag, with the new floor's rooms */
  onSwitchFloorRooms?: (rooms: RoomWithDevices[]) => void
  /** Get rooms for a specific floor */
  getRoomsForFloor?: (floorId: string | null) => RoomWithDevices[]
}

interface UseCrossFloorDragReturn {
  /** The room currently being dragged, if any */
  draggedRoom: RoomWithDevices | null
  /** Current pointer position during drag (for hit testing) */
  dragPosition: { x: number; y: number } | null
  /** Floor ID that's being hovered over (for visual feedback) */
  hoveredFloorId: string | null | undefined
  /** Whether we're mid-cross-floor transition (prevents double triggers) */
  isTransitioning: boolean
  /** Call when drag starts */
  handleDragStart: (room: RoomWithDevices) => void
  /** Call continuously during drag with pointer position */
  handleDragMove: (clientX: number, clientY: number) => void
  /** Call when drag ends - returns true if room was moved to different floor */
  handleDragEnd: (room: RoomWithDevices) => Promise<boolean>
  /** Call when drag is cancelled */
  handleDragCancel: () => void
  /** Call when pointer enters a floor tab */
  handleFloorTabEnter: (floorId: string | null) => void
  /** Call when pointer leaves floor tabs */
  handleFloorTabLeave: () => void
  /** Handle edge hover from ReorderableGrid */
  handleEdgeHover: (edge: 'left' | 'right' | null) => void
}

export function useCrossFloorDrag({
  floors,
  selectedFloorId,
  hasUnassignedRooms,
  onSelectFloor,
  onMoveRoomToFloor,
  onSwitchFloorRooms,
  getRoomsForFloor,
}: UseCrossFloorDragOptions): UseCrossFloorDragReturn {
  const [draggedRoom, setDraggedRoom] = useState<RoomWithDevices | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoveredFloorId, setHoveredFloorId] = useState<string | null | undefined>(undefined)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sourceFloorIdRef = useRef<string | null | undefined>(undefined)

  // Build ordered list of floor IDs (including uncategorized if applicable)
  const floorIds = useMemo((): (string | null)[] => {
    const ids: (string | null)[] = floors.map((f) => f.floor_id)
    if (hasUnassignedRooms) {
      ids.push(null) // null represents uncategorized
    }
    return ids
  }, [floors, hasUnassignedRooms])

  // Clear hold timer
  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }, [])

  // Get adjacent floor ID for edge navigation
  const getAdjacentFloorId = useCallback(
    (direction: 'left' | 'right'): string | null | undefined => {
      const currentIndex = floorIds.indexOf(selectedFloorId)
      if (currentIndex === -1) return undefined

      const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= floorIds.length) {
        return undefined // No adjacent floor in this direction
      }
      return floorIds[targetIndex]
    },
    [floorIds, selectedFloorId]
  )

  // Start hold timer for auto-swipe
  const startHoldTimer = useCallback(
    (targetFloorId: string | null) => {
      clearHoldTimer()

      // Don't start timer if targeting current floor
      if (targetFloorId === selectedFloorId) return

      holdTimerRef.current = setTimeout(() => {
        // Move room to target floor and navigate there
        setIsTransitioning(true)

        // Get target floor's rooms BEFORE the HA update
        const targetFloorRooms = getRoomsForFloor ? getRoomsForFloor(targetFloorId) : []

        // Create combined list with dragged room added at the end
        // (it won't be in the registry yet since HA hasn't updated)
        const combinedRooms = [...targetFloorRooms]
        if (draggedRoom && !combinedRooms.some((r) => r.id === draggedRoom.id)) {
          combinedRooms.push(draggedRoom)
        }

        // Switch floor rooms immediately (before HA updates) so UI shows all rooms
        if (onSwitchFloorRooms) {
          onSwitchFloorRooms(combinedRooms)
        }

        // Move room in HA (background, don't block UI)
        if (draggedRoom) {
          void onMoveRoomToFloor(draggedRoom, targetFloorId)
        }

        // Navigate to target floor
        onSelectFloor(targetFloorId)

        // Clear transitioning state after animation
        setTimeout(() => {
          setHoveredFloorId(undefined)
          setIsTransitioning(false)
          // Note: We do NOT reset draggedRoom, dragPosition, or sourceFloorIdRef
          // The drag continues on the new floor
        }, 300) // Match floor swipe animation duration
      }, HOLD_DURATION)
    },
    [
      clearHoldTimer,
      selectedFloorId,
      draggedRoom,
      onMoveRoomToFloor,
      onSelectFloor,
      onSwitchFloorRooms,
      getRoomsForFloor,
    ]
  )

  // Handle drag start
  const handleDragStart = useCallback((room: RoomWithDevices) => {
    setDraggedRoom(room)
    sourceFloorIdRef.current = room.floorId
  }, [])

  // Handle drag move (update position)
  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    setDragPosition({ x: clientX, y: clientY })
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback(
    async (room: RoomWithDevices): Promise<boolean> => {
      clearHoldTimer()

      // Check if we should move room to a different floor
      const targetFloorId = hoveredFloorId
      const shouldMove =
        targetFloorId !== undefined &&
        targetFloorId !== selectedFloorId &&
        !isTransitioning

      if (shouldMove) {
        // Move room to target floor (at end position)
        await onMoveRoomToFloor(room, targetFloorId)
      }

      // Reset state
      setDraggedRoom(null)
      setDragPosition(null)
      setHoveredFloorId(undefined)
      sourceFloorIdRef.current = undefined

      return shouldMove
    },
    [hoveredFloorId, selectedFloorId, isTransitioning, clearHoldTimer, onMoveRoomToFloor]
  )

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    clearHoldTimer()
    setDraggedRoom(null)
    setDragPosition(null)
    setHoveredFloorId(undefined)
    sourceFloorIdRef.current = undefined
  }, [clearHoldTimer])

  // Handle floor tab enter (when dragging over a floor tab)
  const handleFloorTabEnter = useCallback(
    (floorId: string | null) => {
      if (!draggedRoom || isTransitioning) return

      // Haptic feedback when entering a floor tab
      haptic.light()

      setHoveredFloorId(floorId)

      if (floorId !== selectedFloorId) {
        startHoldTimer(floorId)
      } else {
        clearHoldTimer()
      }
    },
    [draggedRoom, isTransitioning, selectedFloorId, startHoldTimer, clearHoldTimer]
  )

  // Handle floor tab leave
  const handleFloorTabLeave = useCallback(() => {
    if (isTransitioning) return

    clearHoldTimer()
    setHoveredFloorId(undefined)
  }, [isTransitioning, clearHoldTimer])

  // Handle edge hover from ReorderableGrid
  const handleEdgeHover = useCallback(
    (edge: 'left' | 'right' | null) => {
      if (!draggedRoom || isTransitioning) return

      if (edge === null) {
        // Left edge zone
        clearHoldTimer()
        setHoveredFloorId(undefined)
        return
      }

      const adjacentFloorId = getAdjacentFloorId(edge)
      if (adjacentFloorId === undefined) {
        // No floor in this direction
        clearHoldTimer()
        setHoveredFloorId(undefined)
        return
      }

      setHoveredFloorId(adjacentFloorId)
      startHoldTimer(adjacentFloorId)
    },
    [draggedRoom, isTransitioning, getAdjacentFloorId, startHoldTimer, clearHoldTimer]
  )

  return {
    draggedRoom,
    dragPosition,
    hoveredFloorId,
    isTransitioning,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
    handleFloorTabEnter,
    handleFloorTabLeave,
    handleEdgeHover,
  }
}
