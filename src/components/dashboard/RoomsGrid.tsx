import { LayoutGroup } from 'framer-motion'
import { RoomCard } from './RoomCard'
import { ReorderableGrid } from './ReorderableGrid'
import { UncategorizedView } from './UncategorizedView'
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
  // Uncategorized view
  if (selectedFloorId === '__uncategorized__') {
    return <UncategorizedView allRooms={allRooms} />
  }

  // Empty state
  if (displayRooms.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-muted">
          {!isConnected
            ? t.rooms.connectingToHA
            : allRooms.length === 0
            ? t.rooms.loading
            : t.rooms.noRoomsOnFloor}
        </p>
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

  // Normal grid view
  return (
    <LayoutGroup>
      <div className="grid grid-cols-2 gap-[12px]">
        {displayRooms.map((room) => (
          <RoomCard
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
    </LayoutGroup>
  )
}
