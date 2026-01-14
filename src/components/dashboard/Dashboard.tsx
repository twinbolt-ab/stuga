import { useState, useCallback, useEffect, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Header } from '@/components/layout/Header'
import { EditModeHeader } from './EditModeHeader'
import { RoomsGrid } from './RoomsGrid'
import { FloorSwipeContainer } from './FloorSwipeContainer'
import { RoomEditModal } from './RoomEditModal'
import { DeviceEditModal } from './DeviceEditModal'
import { BulkEditRoomsModal, BulkEditDevicesModal } from './BulkEditModal'
import { EditModeProvider, useEditMode } from '@/lib/contexts/EditModeContext'
import { useRooms } from '@/lib/hooks/useRooms'
import { useRoomOrder } from '@/lib/hooks/useRoomOrder'
import { useEnabledDomains } from '@/lib/hooks/useEnabledDomains'
import { useSettings } from '@/lib/hooks/useSettings'
import { ORDER_GAP } from '@/lib/constants'
import type { RoomWithDevices, HAEntity } from '@/types/ha'

// Auto threshold for showing scenes
const AUTO_SCENES_ROOM_THRESHOLD = 16

// Inner component that uses the context
function DashboardContent() {
  const { rooms, floors, isConnected } = useRooms()
  const { isEntityVisible } = useEnabledDomains()
  const { showScenes } = useSettings()
  const { setAreaOrder } = useRoomOrder()

  // Edit mode from context
  const {
    isEditMode,
    isRoomEditMode,
    isDeviceEditMode,
    isUncategorizedEditMode,
    selectedCount,
    selectedIds,
    orderedRooms: rawOrderedRooms,
    enterRoomEdit,
    enterDeviceEdit,
    enterUncategorizedEdit,
    exitEditMode,
    clearSelection,
    toggleSelection,
    reorderRooms,
  } = useEditMode()

  // Local UI state
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null)
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null)
  const [hasInitializedFloor, setHasInitializedFloor] = useState(false)
  const [editingRoom, setEditingRoom] = useState<RoomWithDevices | null>(null)
  const [editingDevice, setEditingDevice] = useState<HAEntity | null>(null)
  const [showBulkEditRooms, setShowBulkEditRooms] = useState(false)
  const [showBulkEditDevices, setShowBulkEditDevices] = useState(false)

  // Check if there are rooms without a floor that have controllable devices
  const hasUnassignedRooms = useMemo(() => {
    return rooms.some((room) => {
      if (room.floorId) return false
      const hasControllableDevices = room.devices.some((d) => isEntityVisible(d.entity_id))
      return hasControllableDevices
    })
  }, [rooms, isEntityVisible])

  // Auto-select first floor when floors load (only on initial load)
  useEffect(() => {
    if (floors.length > 0 && !hasInitializedFloor) {
      setSelectedFloorId(floors[0].floor_id)
      setHasInitializedFloor(true)
    }
  }, [floors, hasInitializedFloor])

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
  const getRoomsForFloor = useCallback((floorId: string | null): RoomWithDevices[] => {
    if (floorId === null) {
      // Uncategorized rooms
      return rooms.filter((room) => {
        if (room.floorId) return false
        return room.devices.some((d) => isEntityVisible(d.entity_id))
      })
    }
    return rooms.filter((room) => room.floorId === floorId)
  }, [rooms, isEntityVisible])

  // Sync room data changes (name/icon updates) while preserving order - replaces useEffect
  const orderedRooms = useMemo(() => {
    if (!isRoomEditMode || rawOrderedRooms.length === 0) return rawOrderedRooms

    const freshRoomsByAreaId = new Map(filteredRooms.map(r => [r.areaId, r]))

    // Filter out deleted rooms and update data for existing ones
    return rawOrderedRooms
      .filter(r => freshRoomsByAreaId.has(r.areaId))
      .map(ordered => freshRoomsByAreaId.get(ordered.areaId) || ordered)
  }, [isRoomEditMode, rawOrderedRooms, filteredRooms])

  // Display rooms
  const displayRooms = isRoomEditMode ? orderedRooms : filteredRooms

  // Handle reorder during drag
  const handleReorder = useCallback((newOrder: RoomWithDevices[]) => {
    reorderRooms(newOrder)
  }, [reorderRooms])

  // Compute shouldShowScenes based on setting, room count, and whether any room has scenes
  const shouldShowScenes = useMemo(() => {
    if (showScenes === 'off') return false
    // Check if any room on this floor has scenes
    const floorHasScenes = displayRooms.some(room =>
      room.devices.some(d => d.entity_id.startsWith('scene.'))
    )
    if (!floorHasScenes) return false
    if (showScenes === 'on') return true
    // Auto: show if fewer than threshold rooms
    return displayRooms.length < AUTO_SCENES_ROOM_THRESHOLD
  }, [showScenes, displayRooms])

  const handleToggleExpand = useCallback((roomId: string) => {
    if (isRoomEditMode) return
    setExpandedRoomId((current) => (current === roomId ? null : roomId))
  }, [isRoomEditMode])

  const handleEnterEditMode = useCallback(() => {
    if (selectedFloorId === '__uncategorized__') {
      enterUncategorizedEdit()
    } else if (expandedRoomId) {
      enterDeviceEdit(expandedRoomId)
    } else {
      enterRoomEdit(filteredRooms)
    }
  }, [selectedFloorId, expandedRoomId, filteredRooms, enterRoomEdit, enterDeviceEdit, enterUncategorizedEdit])

  // Save room order to HA before exiting edit mode - replaces useEffect
  const handleExitEditMode = useCallback(() => {
    if (isRoomEditMode && orderedRooms.length > 0) {
      const updates = orderedRooms
        .map((room, idx) => ({ areaId: room.areaId, order: (idx + 1) * ORDER_GAP }))
        .filter(item => item.areaId)

      Promise.all(updates.map(({ areaId, order }) => setAreaOrder(areaId!, order)))
    }
    exitEditMode()
  }, [isRoomEditMode, orderedRooms, exitEditMode, setAreaOrder])

  // Callback for RoomCard long-press to enter edit mode with room selected
  const handleEnterEditModeWithSelection = useCallback((roomId: string) => {
    enterRoomEdit(filteredRooms)
    toggleSelection(roomId)
  }, [filteredRooms, enterRoomEdit, toggleSelection])

  // Handle clicks on empty area (gaps between cards)
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const isInsideCard = target.closest('.card')

    if (!isInsideCard) {
      if (isEditMode) {
        handleExitEditMode()
        return
      }
      if (expandedRoomId) {
        setExpandedRoomId(null)
      }
    }
  }, [expandedRoomId, isEditMode, handleExitEditMode])

  const handleViewUncategorized = useCallback(() => {
    setExpandedRoomId(null) // Close any expanded room
    setSelectedFloorId('__uncategorized__') // Special ID for uncategorized devices view
  }, [])

  // Handle floor selection (from swipe or tab click) - auto-close expanded rooms
  const handleSelectFloor = useCallback((floorId: string | null) => {
    if (floorId !== selectedFloorId) {
      setExpandedRoomId(null) // Close any expanded room when changing floors
    }
    setSelectedFloorId(floorId)
  }, [selectedFloorId])

  // Get selected rooms for bulk edit modal
  const selectedRoomsForEdit = useMemo(() => {
    const roomsToSearch = isRoomEditMode ? orderedRooms : filteredRooms
    return roomsToSearch.filter(r => selectedIds.has(r.id))
  }, [isRoomEditMode, orderedRooms, filteredRooms, selectedIds])

  // Get selected devices for bulk edit modal
  const selectedDevicesForEdit = useMemo(() => {
    if (isUncategorizedEditMode) {
      return Array.from(selectedIds).map(id => ({ entity_id: id } as HAEntity))
    }
    if (!isDeviceEditMode || !expandedRoomId) return []
    const expandedRoom = rooms.find(r => r.id === expandedRoomId)
    if (!expandedRoom) return []
    return expandedRoom.devices.filter(d => selectedIds.has(d.entity_id))
  }, [isDeviceEditMode, isUncategorizedEditMode, expandedRoomId, rooms, selectedIds])

  // Handle edit button click
  const handleEditButtonClick = useCallback(() => {
    const isDeviceOrUncategorized = isDeviceEditMode || isUncategorizedEditMode

    if (selectedCount === 1) {
      if (isDeviceOrUncategorized) {
        const selectedDevice = selectedDevicesForEdit[0]
        if (selectedDevice) {
          setEditingDevice(selectedDevice)
        }
      } else {
        const selectedRoom = selectedRoomsForEdit[0]
        if (selectedRoom) {
          setEditingRoom(selectedRoom)
        }
      }
    } else {
      if (isDeviceOrUncategorized) {
        setShowBulkEditDevices(true)
      } else {
        setShowBulkEditRooms(true)
      }
    }
  }, [selectedCount, isDeviceEditMode, isUncategorizedEditMode, selectedDevicesForEdit, selectedRoomsForEdit])

  return (
    <div className="min-h-screen bg-background pt-safe pb-nav">
      {/* Edit mode header bar */}
      <AnimatePresence>
        {isEditMode && (
          <EditModeHeader
            onEditClick={handleEditButtonClick}
            onDone={handleExitEditMode}
          />
        )}
      </AnimatePresence>

      <div onClick={handleBackgroundClick}>
        <section>
          {selectedFloorId === '__uncategorized__' ? (
            // Uncategorized devices view (not part of swipe navigation)
            <div className="px-4 py-4">
              <RoomsGrid
                selectedFloorId={selectedFloorId}
                displayRooms={[]}
                orderedRooms={[]}
                allRooms={rooms}
                expandedRoomId={expandedRoomId}
                isConnected={isConnected}
                isRoomEditMode={false}
                shouldShowScenes={false}
                onReorder={() => {}}
                onToggleExpand={handleToggleExpand}
                onClickOutside={handleExitEditMode}
                onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
              />
            </div>
          ) : isRoomEditMode ? (
            // Edit mode: show only current floor in ReorderableGrid
            <div className="px-4 py-4">
              <RoomsGrid
                selectedFloorId={selectedFloorId}
                displayRooms={displayRooms}
                orderedRooms={orderedRooms}
                allRooms={rooms}
                expandedRoomId={expandedRoomId}
                isConnected={isConnected}
                isRoomEditMode={isRoomEditMode}
                shouldShowScenes={shouldShowScenes}
                onReorder={handleReorder}
                onToggleExpand={handleToggleExpand}
                onClickOutside={handleExitEditMode}
                onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
              />
            </div>
          ) : (
            // Normal mode: swipeable floor container
            <div className="py-4">
              <FloorSwipeContainer
                floors={floors}
                hasUncategorized={hasUnassignedRooms}
                selectedFloorId={selectedFloorId}
                onSelectFloor={handleSelectFloor}
              >
                {(floorId) => {
                  const floorRooms = getRoomsForFloor(floorId)
                  const floorShowScenes = showScenes === 'on' ||
                    (showScenes === 'auto' && floorRooms.length < AUTO_SCENES_ROOM_THRESHOLD &&
                     floorRooms.some(room => room.devices.some(d => d.entity_id.startsWith('scene.'))))

                  return (
                    <div className="px-4">
                      <RoomsGrid
                        selectedFloorId={floorId}
                        displayRooms={floorRooms}
                        orderedRooms={[]}
                        allRooms={rooms}
                        expandedRoomId={expandedRoomId}
                        isConnected={isConnected}
                        isRoomEditMode={false}
                        shouldShowScenes={floorShowScenes}
                        onReorder={() => {}}
                        onToggleExpand={handleToggleExpand}
                        onClickOutside={handleExitEditMode}
                        onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
                      />
                    </div>
                  )
                }}
              </FloorSwipeContainer>
            </div>
          )}
        </section>
      </div>

      <Header
        onEnterEditMode={handleEnterEditMode}
        floors={floors}
        selectedFloorId={selectedFloorId}
        onSelectFloor={handleSelectFloor}
        hasUnassignedRooms={hasUnassignedRooms}
        isEditMode={isRoomEditMode}
        onViewUncategorized={handleViewUncategorized}
      />

      <RoomEditModal
        room={editingRoom}
        allRooms={rooms}
        floors={floors}
        onClose={() => setEditingRoom(null)}
      />

      <DeviceEditModal
        device={editingDevice}
        rooms={rooms}
        onClose={() => setEditingDevice(null)}
      />

      <BulkEditRoomsModal
        rooms={showBulkEditRooms ? selectedRoomsForEdit : []}
        floors={floors}
        onClose={() => setShowBulkEditRooms(false)}
        onComplete={clearSelection}
      />

      <BulkEditDevicesModal
        devices={showBulkEditDevices ? selectedDevicesForEdit : []}
        rooms={rooms}
        onClose={() => setShowBulkEditDevices(false)}
        onComplete={clearSelection}
      />
    </div>
  )
}

// Outer component that provides the context
export function Dashboard() {
  return (
    <EditModeProvider>
      <DashboardContent />
    </EditModeProvider>
  )
}
