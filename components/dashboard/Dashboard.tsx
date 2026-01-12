'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { X, Info } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { RoomCard } from '@/components/dashboard/RoomCard'
import { ReorderableGrid } from '@/components/dashboard/ReorderableGrid'
import { RoomEditModal } from '@/components/dashboard/RoomEditModal'
import { BulkEditRoomsModal, BulkEditDevicesModal } from '@/components/dashboard/BulkEditModal'
import { useRooms } from '@/lib/hooks/useRooms'
import { useRoomOrder } from '@/lib/hooks/useRoomOrder'
import { ORDER_GAP } from '@/lib/constants'
import { t, interpolate } from '@/lib/i18n'
import type { RoomWithDevices, HAEntity } from '@/types/ha'

export function Dashboard() {
  const { rooms, floors, isConnected } = useRooms()
  const { setAreaOrder } = useRoomOrder()
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null)
  const [isRoomReorderMode, setIsRoomReorderMode] = useState(false)
  const [isDeviceReorderMode, setIsDeviceReorderMode] = useState(false)
  const [orderedRooms, setOrderedRooms] = useState<RoomWithDevices[]>([])
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null)
  const [hasInitializedFloor, setHasInitializedFloor] = useState(false)
  const [editingRoom, setEditingRoom] = useState<RoomWithDevices | null>(null)
  const [showEditModeInfo, setShowEditModeInfo] = useState(false)

  // Selection state for bulk editing
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set())
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set())
  const [showBulkEditRooms, setShowBulkEditRooms] = useState(false)
  const [showBulkEditDevices, setShowBulkEditDevices] = useState(false)

  // Check if there are rooms without a floor that have controllable devices
  const hasUnassignedRooms = useMemo(() => {
    return rooms.some((room) => {
      if (room.floorId) return false
      // Only show "Other" if the room has lights, switches, or scenes
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
      // Show rooms without a floor assigned that have controllable devices
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

  // Keep orderedRooms in sync with filteredRooms when not in reorder mode
  const displayRooms = isRoomReorderMode ? orderedRooms : filteredRooms

  const handleToggleExpand = useCallback((roomId: string) => {
    if (isRoomReorderMode) return // Disable expand in room reorder mode
    setExpandedRoomId((current) => (current === roomId ? null : roomId))
  }, [isRoomReorderMode])

  const handleEditRoom = useCallback((room: RoomWithDevices) => {
    setEditingRoom(room)
  }, [])

  const handleEnterReorderMode = useCallback(() => {
    if (expandedRoomId) {
      // Room is expanded - enable device reordering
      setIsDeviceReorderMode(true)
    } else {
      // No room expanded - enable room reordering
      setIsRoomReorderMode(true)
      setOrderedRooms([...filteredRooms])
    }
  }, [expandedRoomId, filteredRooms])

  const handleExitReorderMode = useCallback(async () => {
    setShowEditModeInfo(false)

    if (isDeviceReorderMode) {
      // Just exit device reorder mode (saving happens in RoomExpanded)
      setIsDeviceReorderMode(false)
      setSelectedDeviceIds(new Set())
      return
    }

    // Save all room orders based on their final positions
    const updates = orderedRooms
      .map((room, idx) => ({ areaId: room.areaId, order: (idx + 1) * ORDER_GAP }))
      .filter(item => item.areaId)

    await Promise.all(updates.map(({ areaId, order }) => setAreaOrder(areaId!, order)))

    setIsRoomReorderMode(false)
    setSelectedRoomIds(new Set())
  }, [isDeviceReorderMode, orderedRooms, setAreaOrder])

  const handleReorder = useCallback((newOrder: RoomWithDevices[]) => {
    setOrderedRooms(newOrder)
  }, [])

  // Room selection handlers
  const handleToggleRoomSelection = useCallback((roomId: string) => {
    setSelectedRoomIds(prev => {
      const next = new Set(prev)
      if (next.has(roomId)) {
        next.delete(roomId)
      } else {
        next.add(roomId)
      }
      return next
    })
  }, [])

  const handleSelectAllRooms = useCallback(() => {
    const roomsToSelect = isRoomReorderMode ? orderedRooms : filteredRooms
    setSelectedRoomIds(new Set(roomsToSelect.map(r => r.id)))
  }, [isRoomReorderMode, orderedRooms, filteredRooms])

  const handleDeselectAllRooms = useCallback(() => {
    setSelectedRoomIds(new Set())
  }, [])

  // Device selection handlers
  const handleToggleDeviceSelection = useCallback((deviceId: string) => {
    setSelectedDeviceIds(prev => {
      const next = new Set(prev)
      if (next.has(deviceId)) {
        next.delete(deviceId)
      } else {
        next.add(deviceId)
      }
      return next
    })
  }, [])

  const handleSelectAllDevices = useCallback((devices: HAEntity[]) => {
    setSelectedDeviceIds(new Set(devices.map(d => d.entity_id)))
  }, [])

  const handleDeselectAllDevices = useCallback(() => {
    setSelectedDeviceIds(new Set())
  }, [])

  // Get selected rooms for bulk edit modal
  const selectedRoomsForEdit = useMemo(() => {
    const roomsToSearch = isRoomReorderMode ? orderedRooms : filteredRooms
    return roomsToSearch.filter(r => selectedRoomIds.has(r.id))
  }, [isRoomReorderMode, orderedRooms, filteredRooms, selectedRoomIds])

  // Get selected devices for bulk edit modal
  const getSelectedDevicesForEdit = useCallback((devices: HAEntity[]) => {
    return devices.filter(d => selectedDeviceIds.has(d.entity_id))
  }, [selectedDeviceIds])

  const gridRef = useRef<HTMLDivElement>(null)
  const isAnyReorderMode = isRoomReorderMode || isDeviceReorderMode

  return (
    <div className="min-h-screen bg-background pb-20" onClick={() => setShowEditModeInfo(false)}>
      {/* Edit mode header bar */}
      <AnimatePresence>
        {isAnyReorderMode && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="sticky top-0 z-20 bg-accent/10 backdrop-blur-md border-b border-accent/20"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {/* Show selection count or edit mode title */}
                {isRoomReorderMode && selectedRoomIds.size > 0 ? (
                  <>
                    <button
                      onClick={handleDeselectAllRooms}
                      className="p-1 rounded-full hover:bg-accent/20 transition-colors"
                      aria-label="Clear selection"
                    >
                      <X className="w-4 h-4 text-accent" />
                    </button>
                    <span className="text-sm font-semibold text-accent">
                      {interpolate(t.bulkEdit.selected, { count: selectedRoomIds.size })}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-accent uppercase tracking-wide">
                      {t.editMode.title}
                    </span>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowEditModeInfo(!showEditModeInfo)
                        }}
                        className="p-1 rounded-full hover:bg-accent/20 transition-colors"
                        aria-label="Info"
                      >
                        <Info className="w-4 h-4 text-accent" />
                      </button>
                      <AnimatePresence>
                        {showEditModeInfo && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 top-full mt-2 w-64 p-3 rounded-xl bg-card border border-border shadow-warm-lg text-sm text-muted z-50"
                          >
                            {t.editMode.info}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Edit button when items selected */}
                {isRoomReorderMode && selectedRoomIds.size > 0 && (
                  <button
                    onClick={() => setShowBulkEditRooms(true)}
                    className="px-3 py-1.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                  >
                    {t.bulkEdit.editSelected}
                  </button>
                )}
                {/* Done button */}
                <button
                  onClick={handleExitReorderMode}
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
          ) : isRoomReorderMode ? (
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
                  isReorderMode={true}
                  isDragging={isActive}
                  isSelected={selectedRoomIds.has(room.id)}
                  onToggleExpand={() => {}}
                  onEdit={() => handleEditRoom(room)}
                  onToggleSelection={() => handleToggleRoomSelection(room.id)}
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
                    isReorderMode={false}
                    isDeviceReorderMode={isDeviceReorderMode && expandedRoomId === room.id}
                    onToggleExpand={() => handleToggleExpand(room.id)}
                    onExitDeviceReorderMode={handleExitReorderMode}
                  />
                ))}
              </div>
            </LayoutGroup>
          )}
        </section>
      </div>

      <Header
        onEnterReorderMode={handleEnterReorderMode}
        floors={floors}
        selectedFloorId={selectedFloorId}
        onSelectFloor={setSelectedFloorId}
        hasUnassignedRooms={hasUnassignedRooms}
        isEditMode={isRoomReorderMode}
      />

      <RoomEditModal
        room={editingRoom}
        floors={floors}
        onClose={() => setEditingRoom(null)}
      />

      <BulkEditRoomsModal
        rooms={selectedRoomsForEdit}
        floors={floors}
        onClose={() => setShowBulkEditRooms(false)}
        onComplete={() => setSelectedRoomIds(new Set())}
      />

      <BulkEditDevicesModal
        devices={[]}
        rooms={rooms}
        onClose={() => setShowBulkEditDevices(false)}
        onComplete={() => setSelectedDeviceIds(new Set())}
      />
    </div>
  )
}
