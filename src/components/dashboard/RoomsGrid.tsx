import { RoomCard, MemoizedRoomCard } from './RoomCard'
import { ReorderableGrid } from './ReorderableGrid'
import { AllDevicesView } from './AllDevicesView'
import { t } from '@/lib/i18n'
import type { RoomWithDevices } from '@/types/ha'

interface RoomsGridProps {
  selectedFloorId: string | null
  displayRooms: RoomWithDevices[]
  orderedRooms: RoomWithDevices[]
  allRooms: RoomWithDevices[]
  expandedRoomId: string | null
  isConnected: boolean
  isRoomEditMode: boolean
  shouldShowScenes: boolean
  onReorder: (rooms: RoomWithDevices[]) => void
  onToggleExpand: (roomId: string) => void
  onClickOutside?: () => void
  onEnterEditModeWithSelection?: (roomId: string) => void
}

export function RoomsGrid({
  selectedFloorId,
  displayRooms,
  orderedRooms,
  allRooms,
  expandedRoomId,
  isConnected,
  isRoomEditMode,
  shouldShowScenes,
  onReorder,
  onToggleExpand,
  onClickOutside,
  onEnterEditModeWithSelection,
}: RoomsGridProps) {
  // All devices view
  if (selectedFloorId === '__all_devices__') {
    return <AllDevicesView />
  }

  // Empty state
  if (displayRooms.length === 0) {
    // Determine the appropriate message
    let emptyMessage: string
    if (!isConnected) {
      emptyMessage = t.rooms.connectingToHA
    } else if (allRooms.length === 0) {
      emptyMessage = t.rooms.loading
    } else if (selectedFloorId) {
      // Connected, has rooms elsewhere, but this floor is empty
      emptyMessage = t.rooms.emptyFloor
    } else {
      emptyMessage = t.rooms.noRoomsOnFloor
    }

    return (
      <div className="card p-8 text-center">
        <p className="text-muted">{emptyMessage}</p>
      </div>
    )
  }

  // Edit mode with reorderable grid
  if (isRoomEditMode) {
    return (
      <ReorderableGrid
        items={orderedRooms}
        onReorder={onReorder}
        onClickOutside={onClickOutside}
        getKey={(room) => room.id}
        columns={2}
        gap={12}
        renderItem={(room) => (
          <RoomCard
            room={room}
            isExpanded={false}
            shouldShowScenes={shouldShowScenes}
            onToggleExpand={() => {}}
          />
        )}
      />
    )
  }

  // Normal grid view - use MemoizedRoomCard and skip LayoutGroup for better performance
  return (
    <div className="grid grid-cols-2 gap-[12px]">
      {displayRooms.map((room) => (
        <MemoizedRoomCard
          key={room.id}
          room={room}
          allRooms={allRooms}
          isExpanded={expandedRoomId === room.id}
          shouldShowScenes={shouldShowScenes}
          onToggleExpand={() => onToggleExpand(room.id)}
          onEnterEditModeWithSelection={onEnterEditModeWithSelection}
        />
      ))}
    </div>
  )
}
