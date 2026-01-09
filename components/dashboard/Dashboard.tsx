'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { LayoutGroup } from 'framer-motion'
import { Header } from '@/components/layout/Header'
import { RoomCard } from '@/components/dashboard/RoomCard'
import { ReorderableGrid } from '@/components/dashboard/ReorderableGrid'
import { useRooms } from '@/lib/hooks/useRooms'
import { useRoomOrder } from '@/lib/hooks/useRoomOrder'
import { t } from '@/lib/i18n'
import type { RoomWithDevices } from '@/types/ha'

export function Dashboard() {
  const { rooms, floors, isConnected } = useRooms()
  const { reorderAreas } = useRoomOrder()
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null)
  const [isRoomReorderMode, setIsRoomReorderMode] = useState(false)
  const [isDeviceReorderMode, setIsDeviceReorderMode] = useState(false)
  const [orderedRooms, setOrderedRooms] = useState<RoomWithDevices[]>([])
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null)

  // Check if there are rooms without a floor
  const hasUnassignedRooms = useMemo(() => {
    return rooms.some((room) => !room.floorId)
  }, [rooms])

  // Auto-select first floor when floors load
  useEffect(() => {
    if (floors.length > 0 && selectedFloorId === null) {
      setSelectedFloorId(floors[0].floor_id)
    }
  }, [floors, selectedFloorId])

  // Filter rooms by selected floor
  const filteredRooms = useMemo(() => {
    if (selectedFloorId === null) {
      // Show rooms without a floor assigned
      return rooms.filter((room) => !room.floorId)
    }
    return rooms.filter((room) => room.floorId === selectedFloorId)
  }, [rooms, selectedFloorId])

  // Keep orderedRooms in sync with filteredRooms when not in reorder mode
  const displayRooms = isRoomReorderMode ? orderedRooms : filteredRooms

  const handleToggleExpand = useCallback((roomId: string) => {
    if (isRoomReorderMode) return // Disable expand in room reorder mode
    setExpandedRoomId((current) => (current === roomId ? null : roomId))
  }, [isRoomReorderMode])

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
    if (isDeviceReorderMode) {
      // Just exit device reorder mode (saving happens in RoomExpanded)
      setIsDeviceReorderMode(false)
      return
    }

    // Save all room order changes to HA
    const items = orderedRooms
      .map((r, idx) => ({ id: r.id, areaId: r.areaId || '', newIndex: idx }))
      .filter(item => item.areaId)

    // Find items that moved and save their new positions
    for (let i = 0; i < orderedRooms.length; i++) {
      const room = orderedRooms[i]
      const originalIndex = filteredRooms.findIndex(r => r.id === room.id)
      if (originalIndex !== i && room.areaId) {
        await reorderAreas(items, originalIndex, i)
      }
    }

    setIsRoomReorderMode(false)
  }, [isDeviceReorderMode, filteredRooms, orderedRooms, reorderAreas])

  const handleReorder = useCallback((newOrder: RoomWithDevices[]) => {
    setOrderedRooms(newOrder)
  }, [])

  // Handle click outside for device reorder mode
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDeviceReorderMode) return

    const handleClickOutside = (e: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        handleExitReorderMode()
      }
    }

    // Add listener with a small delay to prevent immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isDeviceReorderMode, handleExitReorderMode])

  const isAnyReorderMode = isRoomReorderMode || isDeviceReorderMode

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 py-4">
        {/* Rooms grid */}
        <section>
          {isAnyReorderMode && (
            <p className="text-xs text-muted mb-4 text-right">{t.rooms.reorderHint}</p>
          )}

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
              onClickOutside={handleExitReorderMode}
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
                  onToggleExpand={() => {}}
                />
              )}
            />
          ) : (
            <LayoutGroup>
              <div ref={gridRef} className="grid grid-cols-2 gap-3">
                {displayRooms.map((room, index) => (
                  <RoomCard
                    key={room.id}
                    room={room}
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
        isConnected={isConnected}
        onEnterReorderMode={handleEnterReorderMode}
        floors={floors}
        selectedFloorId={selectedFloorId}
        onSelectFloor={setSelectedFloorId}
        hasUnassignedRooms={hasUnassignedRooms}
      />
    </div>
  )
}
