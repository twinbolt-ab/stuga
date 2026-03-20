import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Header } from '@/components/layout/Header'
import { EditModeHeader } from './EditModeHeader'
import { ConnectionBanner } from './ConnectionBanner'
import { ConnectionErrorModal } from './ConnectionErrorModal'
import { RoomsGrid } from './RoomsGrid'
import { AllDevicesView } from './AllDevicesView'
import { FavoritesView } from './FavoritesView'
import { FloorSwipeContainer } from './FloorSwipeContainer'
import { FloorToast } from './FloorToast'
import { RoomEditModal } from './RoomEditModal'
import { DeviceEditModal } from './DeviceEditModal'
import { FloorEditModal } from './FloorEditModal'
import { FloorCreateModal } from './FloorCreateModal'
import { BulkEditRoomsModal, BulkEditDevicesModal } from './BulkEditModal'
import { StructureHint } from './StructureHint'
import { ConnectionSettingsModal } from '@/components/settings/ConnectionSettingsModal'
import { Loader } from '@/components/ui/Loader'
import * as layoutCache from '@/lib/services/layout-cache'
import { EditModeProvider, useEditMode } from '@/lib/contexts/EditModeContext'
import { useHAConnection } from '@/lib/hooks/useHAConnection'
import { useRooms } from '@/lib/hooks/useRooms'
import { useRoomOrder } from '@/lib/hooks/useRoomOrder'
import { useEnabledDomains } from '@/lib/hooks/useEnabledDomains'
import { useDevMode } from '@/lib/hooks/useDevMode'
import { useFloorNavigation } from '@/lib/hooks/useFloorNavigation'
import { useModalState } from '@/lib/hooks/useModalState'
import { useCrossFloorDrag } from '@/lib/hooks/useCrossFloorDrag'
import { useSettings } from '@/lib/hooks/useSettings'
import { useFavorites } from '@/lib/hooks/useFavorites'
import {
  saveFloorOrderBatch,
  updateArea,
  removeEntityFromFavorites,
  removeAreaFromFavorites,
  updateEntityFavoriteOrderBatch,
  updateAreaFavoriteOrderBatch,
} from '@/lib/ha-websocket'
import { ORDER_GAP, FAVORITES_FLOOR_ID } from '@/lib/constants'
import { t } from '@/lib/i18n'
import type { HAEntity, HAFloor, RoomWithDevices } from '@/types/ha'
import * as orderStorage from '@/lib/services/order-storage'

// Inner component that uses the context
function DashboardContent() {
  const { rooms, floors, isConnected, hasReceivedData, isShowingCachedData, hasLiveData } =
    useRooms()
  const { entities, connectionError, retryConnection, clearConnectionError } = useHAConnection()
  const { isEntityVisible } = useEnabledDomains()
  const { setAreaOrder } = useRoomOrder()
  const { activeMockScenario } = useDevMode()
  const { customOrderEnabled } = useSettings()

  // Data is ready when we've received data (live or cached) or in demo mode
  const _isDataReady = hasReceivedData || activeMockScenario !== 'none'

  // Get favorites
  const { hasFavorites, favoriteScenes, favoriteRooms, favoriteEntities } = useFavorites(
    rooms,
    entities
  )

  // Save layout cache when we receive live data (only once per session)
  const hasSavedCache = useRef(false)
  useEffect(() => {
    if (hasLiveData && rooms.length > 0 && !hasSavedCache.current) {
      hasSavedCache.current = true
      void layoutCache.saveLayoutCache(floors, rooms, {
        scenes: favoriteScenes,
        favoriteRooms,
        entities: favoriteEntities,
      })
    }
  }, [hasLiveData, rooms, floors, favoriteScenes, favoriteRooms, favoriteEntities])

  // Edit mode from context
  const {
    isEditMode,
    isRoomEditMode,
    isDeviceEditMode,
    isAllDevicesEditMode,
    isFloorEditMode,
    isFavoritesEditMode,
    selectedFavoriteItemType,
    selectedCount,
    selectedIds,
    orderedRooms: rawOrderedRooms,
    orderedFloors,
    selectedFloorId: editModeSelectedFloorId,
    enterRoomEdit,
    enterDeviceEdit,
    enterAllDevicesEdit,
    exitEditMode,
    deselect,
    reorderRooms,
    switchFloorRooms,
  } = useEditMode()

  // State for floor edit modal
  const [editingFloor, setEditingFloor] = useState<HAFloor | null>(null)

  // State for floor create modal
  const [showCreateFloor, setShowCreateFloor] = useState(false)

  // State for connection error modal and settings
  const [connectionErrorDismissed, setConnectionErrorDismissed] = useState(false)
  const showConnectionError = !!connectionError && !hasReceivedData && !connectionErrorDismissed
  const [showConnectionSettings, setShowConnectionSettings] = useState(false)

  // Migrate room order from HA labels to localStorage on first connection
  useEffect(() => {
    if (isConnected && hasReceivedData) {
      void orderStorage.migrateRoomOrderFromHA()
    }
  }, [isConnected, hasReceivedData])

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
    hasFavorites,
    onFloorChange: (newFloorId) => {
      closeExpandedRoom()
      showFloorToastForId(newFloorId)
    },
  })

  // Floor toast state (shown when swiping between floors)
  const [toastFloorName, setToastFloorName] = useState<string | null>(null)
  const [showFloorToast, setShowFloorToast] = useState(false)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showFloorToastForId = useCallback(
    (floorId: string | null) => {
      // Don't show toast for all devices view
      if (floorId === '__all_devices__') return

      // Get floor name - handle favorites tab specially
      let floorName: string | null = null
      if (floorId === FAVORITES_FLOOR_ID) {
        floorName = t.favorites.title
      } else {
        const floor = floors.find((f) => f.floor_id === floorId)
        floorName = floor?.name || (floorId === null ? t.floors.other : null)
      }

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
    },
    [floors]
  )

  // Handler to open the create floor modal
  const handleAddFloor = useCallback(() => {
    setShowCreateFloor(true)
  }, [])

  // Handlers for connection error modal
  const handleCloseConnectionError = useCallback(() => {
    setConnectionErrorDismissed(true)
    clearConnectionError()
  }, [clearConnectionError])

  const handleRetryConnection = useCallback(() => {
    setConnectionErrorDismissed(true)
    retryConnection()
  }, [retryConnection])

  const handleOpenConnectionSettings = useCallback(() => {
    setConnectionErrorDismissed(true)
    setShowConnectionSettings(true)
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
    bulkEditRooms,
    bulkEditDevices,
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

  // Bottom nav is only shown when floors exist
  const hasBottomNav = floors.length > 0

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

  // Handler for removing selected items from favorites
  const handleRemoveFromFavorites = useCallback(async () => {
    if (!isFavoritesEditMode || selectedIds.size === 0) return

    const idsToRemove = Array.from(selectedIds)

    // Remove based on item type
    if (selectedFavoriteItemType === 'room') {
      await Promise.all(idsToRemove.map((areaId) => removeAreaFromFavorites(areaId)))
    } else {
      // scenes and entities are both stored in entity registry
      await Promise.all(idsToRemove.map((entityId) => removeEntityFromFavorites(entityId)))
    }

    exitEditMode()
  }, [isFavoritesEditMode, selectedIds, selectedFavoriteItemType, exitEditMode])

  // Handler for reordering favorite scenes
  const handleReorderFavoriteScenes = useCallback(async (scenes: HAEntity[]) => {
    const updates = scenes.map((scene, idx) => ({
      entityId: scene.entity_id,
      order: (idx + 1) * ORDER_GAP,
    }))
    await updateEntityFavoriteOrderBatch(updates)
  }, [])

  // Handler for reordering favorite rooms
  const handleReorderFavoriteRooms = useCallback(async (rooms: RoomWithDevices[]) => {
    const updates = rooms
      .filter((room) => room.areaId)
      .map((room, idx) => ({ areaId: room.areaId!, order: (idx + 1) * ORDER_GAP }))
    await updateAreaFavoriteOrderBatch(updates)
  }, [])

  // Handler for reordering favorite entities
  // When a domain group (e.g., lights) is reordered, we need to merge the new order
  // back into the full entity list to avoid order collisions with other domains
  const handleReorderFavoriteEntities = useCallback(
    async (reorderedDomainEntities: HAEntity[]) => {
      if (reorderedDomainEntities.length === 0) return

      // Get the domain prefix from the first entity (e.g., "light." from "light.kitchen")
      const domainPrefix = reorderedDomainEntities[0].entity_id.split('.')[0] + '.'

      // Build a Set of entity IDs that were reordered for fast lookup
      const reorderedIds = new Set(reorderedDomainEntities.map((e) => e.entity_id))

      // Create new list: keep non-reordered entities in place, replace reordered domain with new order
      // Strategy: iterate through current favoriteEntities, when we hit the first entity of the
      // reordered domain, insert all reordered entities there, skip other entities from that domain
      const newEntityOrder: HAEntity[] = []
      let insertedReordered = false

      for (const entity of favoriteEntities) {
        if (reorderedIds.has(entity.entity_id)) {
          // This entity is part of the reordered group
          if (!insertedReordered) {
            // Insert all reordered entities at the position of the first one
            newEntityOrder.push(...reorderedDomainEntities)
            insertedReordered = true
          }
          // Skip this entity (it's already included in reorderedDomainEntities)
        } else if (entity.entity_id.startsWith(domainPrefix)) {
          // Same domain but not in reordered list - this shouldn't happen normally,
          // but skip it to avoid duplicates
        } else {
          // Different domain - keep in place
          newEntityOrder.push(entity)
        }
      }

      // If we never inserted (edge case), append them
      if (!insertedReordered) {
        newEntityOrder.push(...reorderedDomainEntities)
      }

      // Now assign sequential orders to the full list
      const updates = newEntityOrder.map((entity, idx) => ({
        entityId: entity.entity_id,
        order: (idx + 1) * ORDER_GAP,
      }))

      await updateEntityFavoriteOrderBatch(updates)
    },
    [favoriteEntities]
  )

  // Handle clicks on empty area (gaps between cards)
  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      const isInsideCard = target.closest('.card')

      if (!isInsideCard) {
        // Don't exit floor edit mode from background click - it's handled in Header
        // Don't exit all-devices edit mode from background click - there are no .card elements
        // Don't exit favorites edit mode from background click - it's handled in FavoritesView
        if (isEditMode && !isFloorEditMode && !isAllDevicesEditMode && !isFavoritesEditMode) {
          void handleExitEditMode()
          return
        }
        if (expandedRoomId) {
          setExpandedRoomId(null)
        }
      }
    },
    [
      expandedRoomId,
      isEditMode,
      isFloorEditMode,
      isAllDevicesEditMode,
      isFavoritesEditMode,
      handleExitEditMode,
    ]
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
        openBulkDevices(selectedDevicesForEdit)
      } else {
        openBulkRooms(selectedRoomsForEdit)
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
      {/* Loading overlay - solid when no data, blurred when showing cached data */}
      <AnimatePresence>
        {!hasLiveData && activeMockScenario === 'none' && (
          <motion.div
            className={`absolute inset-0 flex items-center justify-center z-50 ${
              isShowingCachedData ? 'bg-background/60 backdrop-blur-sm' : 'bg-background'
            }`}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Loader />
          </motion.div>
        )}
      </AnimatePresence>

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
            onRemoveFromFavorites={handleRemoveFromFavorites}
          />
        )}
      </AnimatePresence>

      <div
        onClick={handleBackgroundClick}
        className={`flex-1 flex flex-col overflow-hidden ${hasBottomNav ? 'pb-nav' : 'pb-safe'}`}
      >
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
                reorderingDisabled={!customOrderEnabled}
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
            <div className="pt-10 flex-1 flex flex-col">
              <FloorSwipeContainer
                floors={floors}
                hasUncategorized={hasUnassignedRooms}
                hasFavorites={hasFavorites}
                selectedFloorId={selectedFloorId}
                onSelectFloor={handleSelectFloor}
              >
                {(floorId) => {
                  // Render FavoritesView for favorites tab
                  if (floorId === FAVORITES_FLOOR_ID) {
                    return (
                      <FavoritesView
                        favoriteScenes={favoriteScenes}
                        favoriteRooms={favoriteRooms}
                        favoriteEntities={favoriteEntities}
                        allRooms={rooms}
                        expandedRoomId={expandedRoomId}
                        onToggleExpand={handleToggleExpand}
                        onReorderScenes={handleReorderFavoriteScenes}
                        onReorderRooms={handleReorderFavoriteRooms}
                        onReorderEntities={handleReorderFavoriteEntities}
                      />
                    )
                  }

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
        hasFavorites={hasFavorites}
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

      <DeviceEditModal
        device={editingDevice}
        rooms={rooms}
        onClose={closeDeviceEdit}
        onDeviceHidden={deselect}
      />

      <BulkEditRoomsModal
        isOpen={showBulkEditRooms}
        rooms={bulkEditRooms}
        floors={floors}
        onClose={closeBulkRooms}
        onComplete={() => {}} // Keep selection after save
        onFloorCreated={handleSelectFloor}
      />

      <BulkEditDevicesModal
        isOpen={showBulkEditDevices}
        devices={bulkEditDevices}
        rooms={rooms}
        onClose={closeBulkDevices}
        onComplete={() => {}} // Keep selection after save
        onDevicesHidden={(entityIds) => entityIds.forEach(deselect)}
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

      {/* Connection error modal */}
      <ConnectionErrorModal
        isOpen={showConnectionError}
        onClose={handleCloseConnectionError}
        onRetry={handleRetryConnection}
        onOpenSettings={handleOpenConnectionSettings}
        diagnostic={connectionError}
      />

      {/* Connection settings modal (opened from error modal) */}
      <ConnectionSettingsModal
        isOpen={showConnectionSettings}
        onClose={() => {
          setShowConnectionSettings(false)
        }}
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
