import { useState, useCallback, useEffect, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Header } from '@/components/layout/Header'
import { EditModeHeader } from './EditModeHeader'
import { RoomsGrid } from './RoomsGrid'
import { RoomEditModal } from './RoomEditModal'
import { DeviceEditModal } from './DeviceEditModal'
import { BulkEditRoomsModal, BulkEditDevicesModal } from './BulkEditModal'
import { EditModeProvider, useEditMode } from '@/lib/contexts/EditModeContext'
import { useRooms } from '@/lib/hooks/useRooms'
import { useRoomOrderSync } from '@/lib/hooks/useRoomOrderSync'
import { useEnabledDomains } from '@/lib/hooks/useEnabledDomains'
import { useSettings } from '@/lib/hooks/useSettings'
import type { RoomWithDevices, HAEntity } from '@/types/ha'

// Auto threshold for showing scenes
const AUTO_SCENES_ROOM_THRESHOLD = 16

// Inner component that uses the context
function DashboardContent() {
  const { rooms, floors, isConnected } = useRooms()
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

  // Room order sync hook
  const { orderedRooms, handleReorder } = useRoomOrderSync({
    filteredRooms,
    isRoomEditMode,
    modeType: mode.type,
  })

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

  const handleExitEditMode = useCallback(() => {
    exitEditMode()
  }, [exitEditMode])

  // Handle clicks on empty area (gaps between cards)
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const isInsideCard = target.closest('.card')

    if (!isInsideCard) {
      if (isEditMode) {
        exitEditMode()
        return
      }
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

      <div className="px-4 py-4" onClick={handleBackgroundClick}>
        <section>
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
          />
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
