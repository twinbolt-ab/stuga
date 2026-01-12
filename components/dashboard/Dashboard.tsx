'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { X } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { RoomCard } from '@/components/dashboard/RoomCard'
import { ReorderableGrid } from '@/components/dashboard/ReorderableGrid'
import { RoomEditModal } from '@/components/dashboard/RoomEditModal'
import { BulkEditRoomsModal, BulkEditDevicesModal } from '@/components/dashboard/BulkEditModal'
import { EditModeProvider, useEditMode } from '@/lib/contexts/EditModeContext'
import { useRooms } from '@/lib/hooks/useRooms'
import { useRoomOrder } from '@/lib/hooks/useRoomOrder'
import { ORDER_GAP } from '@/lib/constants'
import { t, interpolate } from '@/lib/i18n'
import type { RoomWithDevices } from '@/types/ha'

// Inner component that uses the context
function DashboardContent() {
  const { rooms, floors, isConnected } = useRooms()
  const { setAreaOrder } = useRoomOrder()

  // Edit mode from context
  const {
    mode,
    isEditMode,
    isRoomEditMode,
    isDeviceEditMode,
    selectedCount,
    selectedIds,
    enterRoomEdit,
    enterDeviceEdit,
    exitEditMode,
    clearSelection,
  } = useEditMode()

  // Local UI state
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null)
  const [orderedRooms, setOrderedRooms] = useState<RoomWithDevices[]>([])
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null)
  const [hasInitializedFloor, setHasInitializedFloor] = useState(false)
  const [editingRoom, setEditingRoom] = useState<RoomWithDevices | null>(null)
  const [showBulkEditRooms, setShowBulkEditRooms] = useState(false)
  const [showBulkEditDevices, setShowBulkEditDevices] = useState(false)

  // Track mode changes to save room order when exiting
  const prevModeTypeRef = useRef(mode.type)

  // Check if there are rooms without a floor that have controllable devices
  const hasUnassignedRooms = useMemo(() => {
    return rooms.some((room) => {
      if (room.floorId) return false
      const hasControllableDevices = room.devices.some((d) =>
        d.entity_id.startsWith('light.') ||
        d.entity_id.startsWith('switch.') ||
        d.entity_id.startsWith('scene.') ||
        d.entity_id.startsWith('input_boolean.') ||
        d.entity_id.startsWith('input_number.')
      )
      return hasControllableDevices
    })
  }, [rooms])

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
        return room.devices.some((d) =>
          d.entity_id.startsWith('light.') ||
          d.entity_id.startsWith('switch.') ||
          d.entity_id.startsWith('scene.') ||
          d.entity_id.startsWith('input_boolean.') ||
          d.entity_id.startsWith('input_number.')
        )
      })
    }
    return rooms.filter((room) => room.floorId === selectedFloorId)
  }, [rooms, selectedFloorId])

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
    }

    prevModeTypeRef.current = mode.type
  }, [mode.type, orderedRooms, setAreaOrder])

  // Display rooms
  const displayRooms = isRoomEditMode ? orderedRooms : filteredRooms

  const handleToggleExpand = useCallback((roomId: string) => {
    if (isRoomEditMode) return
    setExpandedRoomId((current) => (current === roomId ? null : roomId))
  }, [isRoomEditMode])

  const handleEditRoom = useCallback((room: RoomWithDevices) => {
    setEditingRoom(room)
  }, [])

  const handleEnterEditMode = useCallback(() => {
    if (expandedRoomId) {
      enterDeviceEdit(expandedRoomId)
    } else {
      enterRoomEdit()
      setOrderedRooms([...filteredRooms])
    }
  }, [expandedRoomId, filteredRooms, enterRoomEdit, enterDeviceEdit])

  const handleExitEditMode = useCallback(() => {
    exitEditMode()
  }, [exitEditMode])

  const handleReorder = useCallback((newOrder: RoomWithDevices[]) => {
    setOrderedRooms(newOrder)
  }, [])

  // Get selected rooms for bulk edit modal
  const selectedRoomsForEdit = useMemo(() => {
    const roomsToSearch = isRoomEditMode ? orderedRooms : filteredRooms
    return roomsToSearch.filter(r => selectedIds.has(r.id))
  }, [isRoomEditMode, orderedRooms, filteredRooms, selectedIds])

  // Get selected devices for bulk edit modal (from expanded room)
  const selectedDevicesForEdit = useMemo(() => {
    if (!isDeviceEditMode || !expandedRoomId) return []
    const expandedRoom = rooms.find(r => r.id === expandedRoomId)
    if (!expandedRoom) return []
    return expandedRoom.devices.filter(d => selectedIds.has(d.entity_id))
  }, [isDeviceEditMode, expandedRoomId, rooms, selectedIds])

  const gridRef = useRef<HTMLDivElement>(null)

  return (
    <div className="min-h-screen bg-background pb-20">
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
                  <span className="text-sm text-muted">
                    {t.editMode.instructions}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <button
                    onClick={() => isDeviceEditMode ? setShowBulkEditDevices(true) : setShowBulkEditRooms(true)}
                    className="px-3 py-1.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                  >
                    {t.bulkEdit.editSelected}
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

      <div className="px-4 py-4">
        {/* Rooms grid */}
        <section>
          {displayRooms.length === 0 ? (
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
              renderItem={(room, index, isDraggingAny, isActive) => (
                <RoomCard
                  room={room}
                  index={index}
                  isExpanded={false}
                  isDragging={isActive}
                  onToggleExpand={() => {}}
                  onEdit={() => handleEditRoom(room)}
                />
              )}
            />
          ) : (
            <LayoutGroup>
              <div ref={gridRef} className="grid grid-cols-2 gap-[12px]">
                {displayRooms.map((room, index) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    allRooms={rooms}
                    index={index}
                    isExpanded={expandedRoomId === room.id}
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
      />

      <RoomEditModal
        room={editingRoom}
        floors={floors}
        onClose={() => setEditingRoom(null)}
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
