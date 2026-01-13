import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { X, Info } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { RoomCard } from '@/components/dashboard/RoomCard'
import { ReorderableGrid } from '@/components/dashboard/ReorderableGrid'
import { RoomEditModal } from '@/components/dashboard/RoomEditModal'
import { DeviceEditModal } from '@/components/dashboard/DeviceEditModal'
import { BulkEditRoomsModal, BulkEditDevicesModal } from '@/components/dashboard/BulkEditModal'
import { UncategorizedView } from '@/components/dashboard/UncategorizedView'
import { EditModeProvider, useEditMode } from '@/lib/contexts/EditModeContext'
import { useRooms } from '@/lib/hooks/useRooms'
import { useRoomOrder } from '@/lib/hooks/useRoomOrder'
import { useEnabledDomains } from '@/lib/hooks/useEnabledDomains'
import { useSettings } from '@/lib/hooks/useSettings'
import { ORDER_GAP } from '@/lib/constants'
import { t, interpolate } from '@/lib/i18n'
import type { RoomWithDevices, HAEntity } from '@/types/ha'

// Auto threshold for showing scenes
const AUTO_SCENES_ROOM_THRESHOLD = 16

// Inner component that uses the context
function DashboardContent() {
  const { rooms, floors, isConnected } = useRooms()
  const { setAreaOrder } = useRoomOrder()
  const { isEntityVisible } = useEnabledDomains()
  const { showScenes } = useSettings()

  // Edit mode from context
  const {
    mode,
    isEditMode,
    isRoomEditMode,
    isDeviceEditMode,
    isUncategorizedEditMode,
    selectedCount,
    selectedIds,
    enterRoomEdit,
    enterDeviceEdit,
    enterUncategorizedEdit,
    exitEditMode,
    clearSelection,
  } = useEditMode()

  // Local UI state
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null)
  const [orderedRooms, setOrderedRooms] = useState<RoomWithDevices[]>([])
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null)
  const [hasInitializedFloor, setHasInitializedFloor] = useState(false)
  const [editingRoom, setEditingRoom] = useState<RoomWithDevices | null>(null)
  const [editingDevice, setEditingDevice] = useState<HAEntity | null>(null)
  const [showBulkEditRooms, setShowBulkEditRooms] = useState(false)
  const [showBulkEditDevices, setShowBulkEditDevices] = useState(false)

  // Track mode changes to save room order when exiting
  const prevModeTypeRef = useRef(mode.type)

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

  // Save room order when exiting room edit mode
  useEffect(() => {
    const wasRoomEdit = prevModeTypeRef.current === 'edit-rooms'
    const isNowNormal = mode.type === 'normal'

    if (wasRoomEdit && isNowNormal && orderedRooms.length > 0) {
      // Save room order
      const updates = orderedRooms
        .map((room, idx) => ({ areaId: room.areaId, order: (idx + 1) * ORDER_GAP }))
        .filter(item => item.areaId)

      Promise.all(updates.map(({ areaId, order }) => setAreaOrder(areaId!, order)))

      // Clear orderedRooms so it gets re-initialized next time
      setOrderedRooms([])
    }

    prevModeTypeRef.current = mode.type
  }, [mode.type, orderedRooms, setAreaOrder])

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

  // Display rooms
  const displayRooms = isRoomEditMode ? orderedRooms : filteredRooms

  // Compute shouldShowScenes based on setting and room count
  const shouldShowScenes = useMemo(() => {
    if (showScenes === 'off') return false
    if (showScenes === 'on') return true
    // Auto: show if fewer than threshold rooms
    return displayRooms.length < AUTO_SCENES_ROOM_THRESHOLD
  }, [showScenes, displayRooms.length])

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
      enterRoomEdit()
    }
  }, [selectedFloorId, expandedRoomId, enterRoomEdit, enterDeviceEdit, enterUncategorizedEdit])

  // Initialize orderedRooms when entering room edit mode (works for both menu and long-press)
  useEffect(() => {
    if (isRoomEditMode && orderedRooms.length === 0 && filteredRooms.length > 0) {
      setOrderedRooms([...filteredRooms])
    }
  }, [isRoomEditMode, orderedRooms.length, filteredRooms])

  const handleExitEditMode = useCallback(() => {
    exitEditMode()
  }, [exitEditMode])

  const handleReorder = useCallback((newOrder: RoomWithDevices[]) => {
    setOrderedRooms(newOrder)
  }, [])

  // Handle clicks on empty area (gaps between cards)
  // - Collapse expanded room if one is expanded
  // - Exit edit mode if in edit mode
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    // Check if the click target is a card or inside a card
    const target = e.target as HTMLElement
    const isInsideCard = target.closest('.card')

    if (!isInsideCard) {
      // Exit any edit mode when clicking outside cards
      if (isEditMode) {
        exitEditMode()
        return
      }

      // Collapse expanded room
      if (expandedRoomId) {
        setExpandedRoomId(null)
      }
    }
  }, [expandedRoomId, isEditMode, exitEditMode])

  const handleViewUncategorized = useCallback(() => {
    setSelectedFloorId('__uncategorized__' as unknown as string)
  }, [])

  // Get selected rooms for bulk edit modal
  const selectedRoomsForEdit = useMemo(() => {
    const roomsToSearch = isRoomEditMode ? orderedRooms : filteredRooms
    return roomsToSearch.filter(r => selectedIds.has(r.id))
  }, [isRoomEditMode, orderedRooms, filteredRooms, selectedIds])

  // Get selected devices for bulk edit modal (from expanded room or uncategorized)
  const selectedDevicesForEdit = useMemo(() => {
    if (isUncategorizedEditMode) {
      // Get all entities and filter selected ones
      const allEntities: HAEntity[] = []
      rooms.forEach(r => allEntities.push(...r.devices))
      // Also need to get uncategorized entities - they're not in rooms
      // For now, we'll get them directly from the context/selection
      // The BulkEditDevicesModal just needs entity_ids to work
      return Array.from(selectedIds).map(id => ({ entity_id: id } as HAEntity))
    }
    if (!isDeviceEditMode || !expandedRoomId) return []
    const expandedRoom = rooms.find(r => r.id === expandedRoomId)
    if (!expandedRoom) return []
    return expandedRoom.devices.filter(d => selectedIds.has(d.entity_id))
  }, [isDeviceEditMode, isUncategorizedEditMode, expandedRoomId, rooms, selectedIds])

  // Handle edit button click - opens single editor for 1 item, bulk editor for multiple
  const handleEditButtonClick = useCallback(() => {
    const isDeviceOrUncategorized = isDeviceEditMode || isUncategorizedEditMode

    if (selectedCount === 1) {
      // Single selection - open single-item editor
      if (isDeviceOrUncategorized) {
        // Find the selected device
        const selectedDevice = selectedDevicesForEdit[0]
        if (selectedDevice) {
          setEditingDevice(selectedDevice)
        }
      } else {
        // Find the selected room
        const selectedRoom = selectedRoomsForEdit[0]
        if (selectedRoom) {
          setEditingRoom(selectedRoom)
        }
      }
    } else {
      // Multiple selection - open bulk editor
      if (isDeviceOrUncategorized) {
        setShowBulkEditDevices(true)
      } else {
        setShowBulkEditRooms(true)
      }
    }
  }, [selectedCount, isDeviceEditMode, isUncategorizedEditMode, selectedDevicesForEdit, selectedRoomsForEdit])

  const gridRef = useRef<HTMLDivElement>(null)

  return (
    <div className="min-h-screen bg-background pt-safe pb-nav">
      {/* Edit mode header bar */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="sticky top-0 z-20 bg-accent/10 backdrop-blur-md border-b border-accent/20"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {/* Edit mode badge */}
                <span className="px-2 py-0.5 rounded-md bg-accent/20 text-accent text-xs font-semibold uppercase tracking-wide">
                  {t.editMode.badge}
                </span>

                {/* Selection count or instructions */}
                {selectedCount > 0 ? (
                  <>
                    <button
                      onClick={clearSelection}
                      className="p-1 rounded-full hover:bg-accent/20 transition-colors"
                      aria-label="Clear selection"
                    >
                      <X className="w-4 h-4 text-accent" />
                    </button>
                    <span className="text-sm font-semibold text-accent">
                      {interpolate(t.bulkEdit.selected, { count: selectedCount })}
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-muted">
                    <span title={t.editMode.instructionsTooltip} className="flex-shrink-0 cursor-help">
                      <Info className="w-4 h-4 text-accent/70" />
                    </span>
                    {t.editMode.instructions}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <button
                    onClick={handleEditButtonClick}
                    className="px-3 py-1.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                  >
                    {selectedCount === 1
                      ? (isDeviceEditMode || isUncategorizedEditMode)
                        ? t.bulkEdit.editDevice
                        : t.bulkEdit.editRoom
                      : t.bulkEdit.editSelected}
                  </button>
                )}
                <button
                  onClick={handleExitEditMode}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-border/50 text-foreground text-sm font-medium hover:bg-border transition-colors"
                >
                  {t.editMode.done}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 py-4" onClick={handleBackgroundClick}>
        {/* Uncategorized view or Rooms grid */}
        <section>
          {selectedFloorId === '__uncategorized__' ? (
            <UncategorizedView allRooms={rooms} />
          ) : displayRooms.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-muted">
                {!isConnected
                  ? t.rooms.connectingToHA
                  : rooms.length === 0
                  ? t.rooms.loading
                  : t.rooms.noRoomsOnFloor}
              </p>
            </div>
          ) : isRoomEditMode ? (
            <ReorderableGrid
              items={orderedRooms}
              onReorder={handleReorder}
              getKey={(room) => room.id}
              columns={2}
              gap={12}
              renderItem={(room) => (
                <RoomCard
                  room={room}
                  isExpanded={false}
                  onToggleExpand={() => {}}
                />
              )}
            />
          ) : (
            <LayoutGroup>
              <div ref={gridRef} className="grid grid-cols-2 gap-[12px]">
                {displayRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    allRooms={rooms}
                    isExpanded={expandedRoomId === room.id}
                    shouldShowScenes={shouldShowScenes}
                    onToggleExpand={() => handleToggleExpand(room.id)}
                  />
                ))}
              </div>
            </LayoutGroup>
          )}
        </section>
      </div>

      <Header
        onEnterEditMode={handleEnterEditMode}
        floors={floors}
        selectedFloorId={selectedFloorId}
        onSelectFloor={setSelectedFloorId}
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
