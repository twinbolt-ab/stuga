import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Header } from '@/components/layout/Header'
import { EditModeHeader } from './EditModeHeader'
import { ConnectionBanner } from './ConnectionBanner'
import { RoomsGrid } from './RoomsGrid'
import { AllDevicesView } from './AllDevicesView'
import { FloorSwipeContainer } from './FloorSwipeContainer'
import { FloorToast } from './FloorToast'
import { RoomEditModal } from './RoomEditModal'
import { DeviceEditModal } from './DeviceEditModal'
import { FloorEditModal } from './FloorEditModal'
import { FloorCreateModal } from './FloorCreateModal'
import { BulkEditRoomsModal, BulkEditDevicesModal } from './BulkEditModal'
import { StructureHint } from './StructureHint'
import { EditModeProvider, useEditMode } from '@/lib/contexts/EditModeContext'
import { useHAConnection } from '@/lib/hooks/useHAConnection'
import { useRooms } from '@/lib/hooks/useRooms'
import { useRoomOrder } from '@/lib/hooks/useRoomOrder'
import { useEnabledDomains } from '@/lib/hooks/useEnabledDomains'
import { useDevMode } from '@/lib/hooks/useDevMode'
import { useSettings } from '@/lib/hooks/useSettings'
import { useFloorNavigation } from '@/lib/hooks/useFloorNavigation'
import { useModalState } from '@/lib/hooks/useModalState'
import { useCrossFloorDrag } from '@/lib/hooks/useCrossFloorDrag'
import { saveFloorOrderBatch, updateArea } from '@/lib/ha-websocket'
import { ORDER_GAP } from '@/lib/constants'
import { t } from '@/lib/i18n'
import type { HAEntity, HAFloor, RoomWithDevices } from '@/types/ha'

// Inner component that uses the context
function DashboardContent() {
  const { rooms, floors, isConnected, hasReceivedData } = useRooms()
  const { entities } = useHAConnection()
  const { isEntityVisible } = useEnabledDomains()
  const { setAreaOrder } = useRoomOrder()
  const { activeMockScenario } = useDevMode()
  const { roomOrderingEnabled } = useSettings()

  // Edit mode from context
  const {
    isEditMode,
    isRoomEditMode,
    isDeviceEditMode,
    isAllDevicesEditMode,
    isFloorEditMode,
    selectedCount,
    selectedIds,
    orderedRooms: rawOrderedRooms,
    orderedFloors,
    selectedFloorId: editModeSelectedFloorId,
    enterRoomEdit,
    enterDeviceEdit,
    enterAllDevicesEdit,
    exitEditMode,
    reorderRooms,
    switchFloorRooms,
  } = useEditMode()

  // State for floor edit modal
  const [editingFloor, setEditingFloor] = useState<HAFloor | null>(null)

  // State for floor create modal
  const [showCreateFloor, setShowCreateFloor] = useState(false)

  // Expanded room state (kept separate as it's used for toggling)
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null)
  const closeExpandedRoom = useCallback(() => {
    setExpandedRoomId(null)
  }, [])

  // Floor navigation (extracted to hook)
  const {
    selectedFloorId,
    filteredRooms,
    hasUnassignedRooms,
    getRoomsForFloor,
    handleSelectFloor,
    handleViewAllDevices,
  } = useFloorNavigation({
    rooms,
    floors,
    hasReceivedData,
    activeMockScenario,
    isEntityVisible,
    onFloorChange: closeExpandedRoom,
  })

  // Floor toast state (shown when swiping between floors)
  const [toastFloorName, setToastFloorName] = useState<string | null>(null)
  const [showFloorToast, setShowFloorToast] = useState(false)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialMountRef = useRef(true)

  // Show toast when floor changes (but not on initial mount)
  useEffect(() => {
    // Skip the initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      return
    }

    // Don't show toast for all devices view or when no floor selected
    if (selectedFloorId === '__all_devices__') return

    // Get floor name
    const floor = floors.find((f) => f.floor_id === selectedFloorId)
    const floorName = floor?.name || (selectedFloorId === null ? t.floors.other : null)

    if (floorName) {
      // Clear existing timeout
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }

      setToastFloorName(floorName)
      setShowFloorToast(true)

      // Hide after 1.5 seconds
      toastTimeoutRef.current = setTimeout(() => {
        setShowFloorToast(false)
      }, 1500)
    }

    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [selectedFloorId, floors])

  // Handler to open the create floor modal
  const handleAddFloor = useCallback(() => {
    setShowCreateFloor(true)
  }, [])

  // Handler when a new floor is created
  const handleFloorCreated = useCallback(
    (newFloorId: string) => {
      setShowCreateFloor(false)
      // Exit floor edit mode and navigate to the new floor
      exitEditMode()
      handleSelectFloor(newFloorId)
    },
    [exitEditMode, handleSelectFloor]
  )

  // Modal state (extracted to hook)
  const {
    editingRoom,
    editingDevice,
    showBulkEditRooms,
    showBulkEditDevices,
    openRoomEdit,
    openDeviceEdit,
    openBulkRooms,
    openBulkDevices,
    closeRoomEdit,
    closeDeviceEdit,
    closeBulkRooms,
    closeBulkDevices,
  } = useModalState()

  // Handler to move a room to a different floor
  // Note: Only updates the floor assignment, NOT the order.
  // Order is set when edit mode exits based on final drag position.
  const handleMoveRoomToFloor = useCallback(
    async (room: RoomWithDevices, targetFloorId: string | null) => {
      if (!room.areaId) return

      // Update room's floor in Home Assistant (order will be set on edit mode exit)
      await updateArea(room.areaId, { floor_id: targetFloorId })
    },
    []
  )

  // Get selected rooms for multi-drag support
  const getSelectedRooms = useCallback(() => {
    if (selectedIds.size === 0) return []
    return rawOrderedRooms.filter((room) => selectedIds.has(room.id))
  }, [selectedIds, rawOrderedRooms])

  // Cross-floor drag state and handlers
  const {
    draggedRoom,
    dragPosition,
    hoveredFloorId,
    isTransitioning,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleFloorTabEnter,
    handleFloorTabLeave,
    handleEdgeHover,
  } = useCrossFloorDrag({
    floors,
    selectedFloorId,
    hasUnassignedRooms,
    onSelectFloor: handleSelectFloor,
    onMoveRoomToFloor: handleMoveRoomToFloor,
    onSwitchFloorRooms: switchFloorRooms,
    getRoomsForFloor,
    getSelectedRooms,
  })

  // Sync room data changes (name/icon updates) while preserving order - replaces useEffect
  // During cross-floor drag, rawOrderedRooms may contain rooms not yet in filteredRooms
  // (because HA hasn't updated yet), so we use 'rooms' (all rooms) for freshening
  const orderedRooms = useMemo(() => {
    if (!isRoomEditMode || rawOrderedRooms.length === 0) return rawOrderedRooms

    // Use all rooms for freshening data, not just filtered rooms
    // This ensures rooms being dragged cross-floor are still found
    const freshRoomsByAreaId = new Map(rooms.map((r) => [r.areaId, r]))

    // Update data for existing ones, keep rooms even if not in fresh data
    // (they might be mid-cross-floor-drag before HA updates)
    return rawOrderedRooms.map((ordered) => freshRoomsByAreaId.get(ordered.areaId) || ordered)
  }, [isRoomEditMode, rawOrderedRooms, rooms])

  // Display rooms
  const displayRooms = isRoomEditMode ? orderedRooms : filteredRooms

  const handleToggleExpand = useCallback(
    (roomId: string) => {
      if (isRoomEditMode) return
      setExpandedRoomId((current) => (current === roomId ? null : roomId))
    },
    [isRoomEditMode]
  )

  const handleEnterEditMode = useCallback(() => {
    if (selectedFloorId === '__all_devices__') {
      enterAllDevicesEdit()
    } else if (expandedRoomId) {
      enterDeviceEdit(expandedRoomId)
    } else {
      enterRoomEdit(filteredRooms)
    }
  }, [
    selectedFloorId,
    expandedRoomId,
    filteredRooms,
    enterRoomEdit,
    enterDeviceEdit,
    enterAllDevicesEdit,
  ])

  // Save room/floor order to HA before exiting edit mode
  const handleExitEditMode = useCallback(async () => {
    if (isRoomEditMode && orderedRooms.length > 0) {
      const updates = orderedRooms
        .map((room, idx) => ({ areaId: room.areaId, order: (idx + 1) * ORDER_GAP }))
        .filter((item) => item.areaId)

      await Promise.all(updates.map(({ areaId, order }) => setAreaOrder(areaId!, order)))
    }

    if (isFloorEditMode && orderedFloors.length > 0) {
      await saveFloorOrderBatch(orderedFloors, floors)
    }

    exitEditMode()
  }, [
    isRoomEditMode,
    isFloorEditMode,
    orderedRooms,
    orderedFloors,
    floors,
    exitEditMode,
    setAreaOrder,
  ])

  // Callback for RoomCard long-press to enter edit mode with room selected
  // Uses getRoomsForFloor to get the correct floor's rooms (not filteredRooms which may be stale
  // when FloorSwipeContainer preloads adjacent floors)
  const handleEnterEditModeWithSelection = useCallback(
    (roomId: string) => {
      // Find the room to determine its floor
      const room = rooms.find((r) => r.id === roomId)
      const roomsForFloor = room ? getRoomsForFloor(room.floorId ?? null) : filteredRooms
      enterRoomEdit(roomsForFloor, roomId)
    },
    [rooms, getRoomsForFloor, filteredRooms, enterRoomEdit]
  )

  // Handle clicks on empty area (gaps between cards)
  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      const isInsideCard = target.closest('.card')

      if (!isInsideCard) {
        // Don't exit floor edit mode from background click - it's handled in Header
        // Don't exit all-devices edit mode from background click - there are no .card elements
        if (isEditMode && !isFloorEditMode && !isAllDevicesEditMode) {
          void handleExitEditMode()
          return
        }
        if (expandedRoomId) {
          setExpandedRoomId(null)
        }
      }
    },
    [expandedRoomId, isEditMode, isFloorEditMode, isAllDevicesEditMode, handleExitEditMode]
  )

  // Get selected rooms for bulk edit modal
  const selectedRoomsForEdit = useMemo(() => {
    const roomsToSearch = isRoomEditMode ? orderedRooms : filteredRooms
    return roomsToSearch.filter((r) => selectedIds.has(r.id))
  }, [isRoomEditMode, orderedRooms, filteredRooms, selectedIds])

  // Get selected devices for bulk edit modal
  const selectedDevicesForEdit = useMemo(() => {
    if (isAllDevicesEditMode) {
      // Find actual entity objects - first try rooms, then fall back to entities map
      const allDevices = rooms.flatMap((r) => r.devices)
      return Array.from(selectedIds)
        .map((id) => allDevices.find((d) => d.entity_id === id) || entities.get(id))
        .filter((d): d is HAEntity => d !== undefined)
    }
    if (!isDeviceEditMode || !expandedRoomId) return []
    const expandedRoom = rooms.find((r) => r.id === expandedRoomId)
    if (!expandedRoom) return []
    return expandedRoom.devices.filter((d) => selectedIds.has(d.entity_id))
  }, [isDeviceEditMode, isAllDevicesEditMode, expandedRoomId, rooms, entities, selectedIds])

  // Handle edit button click
  const handleEditButtonClick = useCallback(() => {
    // Floor edit mode - open the selected floor's edit modal
    if (isFloorEditMode && editModeSelectedFloorId) {
      const floor = floors.find((f) => f.floor_id === editModeSelectedFloorId)
      if (floor) {
        setEditingFloor(floor)
      }
      return
    }

    const isDeviceOrAllDevices = isDeviceEditMode || isAllDevicesEditMode

    if (selectedCount === 1) {
      if (isDeviceOrAllDevices) {
        const selectedDevice = selectedDevicesForEdit[0]
        if (selectedDevice) {
          openDeviceEdit(selectedDevice)
        }
      } else {
        const selectedRoom = selectedRoomsForEdit[0]
        if (selectedRoom) {
          openRoomEdit(selectedRoom)
        }
      }
    } else {
      if (isDeviceOrAllDevices) {
        openBulkDevices()
      } else {
        openBulkRooms()
      }
    }
  }, [
    selectedCount,
    isDeviceEditMode,
    isAllDevicesEditMode,
    isFloorEditMode,
    editModeSelectedFloorId,
    floors,
    selectedDevicesForEdit,
    selectedRoomsForEdit,
    openDeviceEdit,
    openRoomEdit,
    openBulkDevices,
    openBulkRooms,
  ])

  return (
    <div className="flex-1 flex flex-col bg-background pt-safe overflow-hidden relative">
      {/* Connection status banner */}
      <ConnectionBanner isConnected={isConnected} hasReceivedData={hasReceivedData} />

      {/* Floor name toast (shown when swiping between floors) */}
      <FloorToast floorName={toastFloorName} show={showFloorToast} />

      {/* Edit mode header bar - hidden while dragging a room */}
      <AnimatePresence>
        {isEditMode && !draggedRoom && (
          <EditModeHeader
            onEditClick={handleEditButtonClick}
            onDone={handleExitEditMode}
            onAddFloor={handleAddFloor}
          />
        )}
      </AnimatePresence>

      <div onClick={handleBackgroundClick} className="flex-1 flex flex-col overflow-hidden pb-nav">
        <section className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
          {selectedFloorId === '__all_devices__' ? (
            // All devices view (not part of swipe navigation)
            <div className="px-4 pt-4 overflow-x-hidden">
              <AllDevicesView />
            </div>
          ) : isRoomEditMode ? (
            // Edit mode: show only current floor in ReorderableGrid
            <motion.div
              className="px-4 py-4"
              initial={false}
              animate={{ opacity: isTransitioning ? 0.3 : 1 }}
              transition={{ duration: 0.15 }}
            >
              <RoomsGrid
                displayRooms={displayRooms}
                isConnected={isConnected}
                isRoomEditMode
                orderedRooms={orderedRooms}
                onReorder={reorderRooms}
                onClickOutside={handleExitEditMode}
                reorderingDisabled={!roomOrderingEnabled}
                selectedIds={selectedIds}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragPosition={handleDragMove}
                onEdgeHover={handleEdgeHover}
                activeDragRoomId={draggedRoom?.id}
                activeDragPosition={dragPosition}
              />
            </motion.div>
          ) : (
            // Normal mode: swipeable floor container
            <div className="pt-8 flex-1 flex flex-col">
              <FloorSwipeContainer
                floors={floors}
                hasUncategorized={hasUnassignedRooms}
                selectedFloorId={selectedFloorId}
                onSelectFloor={handleSelectFloor}
              >
                {(floorId) => {
                  const floorRooms = getRoomsForFloor(floorId)

                  return (
                    <div className="px-4">
                      <RoomsGrid
                        displayRooms={floorRooms}
                        isConnected={isConnected}
                        selectedFloorId={floorId}
                        allRooms={rooms}
                        expandedRoomId={expandedRoomId}
                        onToggleExpand={handleToggleExpand}
                        onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
                      />
                    </div>
                  )
                }}
              </FloorSwipeContainer>
            </div>
          )}
        </section>

        {/* Hints for empty structure */}
        {hasReceivedData && rooms.length === 0 && floors.length === 0 ? (
          <StructureHint type="structure" show />
        ) : hasReceivedData && rooms.length > 0 && floors.length === 0 ? (
          <StructureHint type="floors" show />
        ) : null}
      </div>

      <Header
        onEnterEditMode={handleEnterEditMode}
        floors={floors}
        selectedFloorId={selectedFloorId}
        onSelectFloor={handleSelectFloor}
        hasUnassignedRooms={hasUnassignedRooms}
        isEditMode={isRoomEditMode}
        onViewAllDevices={handleViewAllDevices}
        onEditFloor={setEditingFloor}
        editingFloorId={editingFloor?.floor_id}
        dragPosition={dragPosition}
        hoveredFloorId={hoveredFloorId}
        onDragEnterFloor={handleFloorTabEnter}
        onDragLeaveFloor={handleFloorTabLeave}
      />

      <RoomEditModal
        room={editingRoom}
        allRooms={rooms}
        floors={floors}
        onClose={closeRoomEdit}
        onFloorCreated={handleSelectFloor}
      />

      <DeviceEditModal device={editingDevice} rooms={rooms} onClose={closeDeviceEdit} />

      <BulkEditRoomsModal
        isOpen={showBulkEditRooms}
        rooms={selectedRoomsForEdit}
        floors={floors}
        onClose={closeBulkRooms}
        onComplete={() => {}} // Keep selection after save
        onFloorCreated={handleSelectFloor}
      />

      <BulkEditDevicesModal
        isOpen={showBulkEditDevices}
        devices={selectedDevicesForEdit}
        rooms={rooms}
        onClose={closeBulkDevices}
        onComplete={() => {}} // Keep selection after save
      />

      <FloorEditModal
        floor={editingFloor}
        floors={floors}
        rooms={rooms}
        onClose={() => {
          setEditingFloor(null)
        }}
        onDeleted={() => {
          // Exit floor edit mode and navigate to first floor
          exitEditMode()
          const firstFloorId = floors[0]?.floor_id || null
          if (firstFloorId !== selectedFloorId) {
            handleSelectFloor(firstFloorId)
          }
        }}
      />

      <FloorCreateModal
        isOpen={showCreateFloor}
        floors={floors}
        onClose={() => {
          setShowCreateFloor(false)
        }}
        onCreate={handleFloorCreated}
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
