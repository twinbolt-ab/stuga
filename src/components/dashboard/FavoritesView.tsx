import { useMemo, useCallback, useRef, useState, useLayoutEffect, Fragment } from 'react'
import { Star, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'
import { motion } from 'framer-motion'
import type { HAEntity, RoomWithDevices } from '@/types/ha'
import type { EntityMeta } from '@/lib/hooks/useAllEntities'
import { ReorderableGrid } from './ReorderableGrid'
import { ReorderableList } from './ReorderableList'
import { RoomCard } from './RoomCard'
import { ROOM_EXPAND_DURATION } from '@/lib/constants'
import { LightsSection, SwitchesSection, InputsSection, FansSection } from '@/components/devices'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { EditModeContainer } from '@/components/ui/EditModeContainer'
import { DomainSection } from '@/components/ui/DomainSection'
import { useDeviceHandlers } from '@/lib/hooks/useDeviceHandlers'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { useEditMode, type FavoriteItemType } from '@/lib/contexts/EditModeContext'
import { getEntityIcon } from '@/lib/ha-websocket'
import { t } from '@/lib/i18n'

interface FavoritesViewProps {
  favoriteScenes: HAEntity[]
  favoriteRooms: RoomWithDevices[]
  favoriteEntities: HAEntity[]
  allRooms: RoomWithDevices[]
  expandedRoomId: string | null
  onToggleExpand: (roomId: string) => void
  onEnterEditModeWithSelection?: (roomId: string) => void
  onReorderScenes?: (scenes: HAEntity[]) => void
  onReorderRooms?: (rooms: RoomWithDevices[]) => void
  onReorderEntities?: (entities: HAEntity[]) => void
}

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

// Scene item for favorites view
function FavoriteSceneItem({
  scene,
  isInEditMode,
  isSelected,
  onActivate,
  onToggleSelection,
  onEnterEditModeWithSelection,
}: {
  scene: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onActivate: (scene: HAEntity) => void
  onToggleSelection: (id: string, itemType: FavoriteItemType) => void
  onEnterEditModeWithSelection: (id: string, itemType: FavoriteItemType) => void
}) {
  const sceneIcon = getEntityIcon(scene.entity_id)
  const displayName = getEntityDisplayName(scene)

  const longPress = useLongPress({
    duration: 500,
    disabled: isInEditMode,
    onLongPress: () => onEnterEditModeWithSelection(scene.entity_id, 'scene'),
  })

  if (isInEditMode) {
    return (
      <button
        data-entity-id={scene.entity_id}
        onClick={() => onToggleSelection(scene.entity_id, 'scene')}
        className={clsx(
          'px-3 py-1.5 rounded-full text-sm font-medium',
          'bg-border/50 hover:bg-accent/20 hover:text-accent',
          'transition-all touch-feedback',
          'flex items-center gap-1.5',
          isSelected && 'ring-2 ring-inset ring-accent'
        )}
      >
        <SelectionCheckbox isSelected={isSelected} />
        {sceneIcon ? (
          <MdiIcon icon={sceneIcon} className="w-3.5 h-3.5" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {displayName}
      </button>
    )
  }

  return (
    <button
      data-entity-id={scene.entity_id}
      onClick={() => onActivate(scene)}
      className={clsx(
        'px-3 py-1.5 rounded-full text-sm font-medium',
        'bg-border/50 hover:bg-accent/20 hover:text-accent',
        'transition-all touch-feedback',
        'flex items-center gap-1.5'
      )}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerUp}
    >
      {sceneIcon ? (
        <MdiIcon icon={sceneIcon} className="w-3.5 h-3.5" />
      ) : (
        <Sparkles className="w-3.5 h-3.5" />
      )}
      {displayName}
    </button>
  )
}

// Favorite room card wrapper for long-press
function FavoriteRoomCard({
  room,
  allRooms,
  isExpanded,
  onToggleExpand,
  isInEditMode,
  isSelected,
  onToggleSelection,
  onEnterEditModeWithSelection,
}: {
  room: RoomWithDevices
  allRooms: RoomWithDevices[]
  isExpanded: boolean
  onToggleExpand: (roomId: string) => void
  isInEditMode: boolean
  isSelected: boolean
  onToggleSelection: (id: string, itemType: FavoriteItemType) => void
  onEnterEditModeWithSelection: (id: string, itemType: FavoriteItemType) => void
}) {
  const longPress = useLongPress({
    duration: 500,
    disabled: isInEditMode,
    onLongPress: () => onEnterEditModeWithSelection(room.areaId!, 'room'),
  })

  if (isInEditMode) {
    return (
      <div
        onClick={() => onToggleSelection(room.areaId!, 'room')}
        className={clsx('cursor-pointer', isSelected && 'ring-2 ring-accent rounded-card')}
      >
        <RoomCard room={room} isExpanded={false} onToggleExpand={() => {}} />
      </div>
    )
  }

  return (
    <div
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerUp}
    >
      <RoomCard
        room={room}
        allRooms={allRooms}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
    </div>
  )
}

const GAP = 12
const GRID_COLUMNS = 2

// Normal grid for favorite rooms with expansion support (mirrors RoomsGrid behavior)
function FavoriteRoomsNormalGrid({
  favoriteRooms,
  allRooms,
  expandedRoomId,
  onToggleExpand,
  onToggleSelection,
  onEnterEditModeWithSelection,
}: {
  favoriteRooms: RoomWithDevices[]
  allRooms: RoomWithDevices[]
  expandedRoomId: string | null
  onToggleExpand: (roomId: string) => void
  onToggleSelection: (id: string, itemType: FavoriteItemType) => void
  onEnterEditModeWithSelection: (id: string, itemType: FavoriteItemType) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateWidth = () => setContainerWidth(container.offsetWidth)
    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // Calculate card widths in pixels
  const singleColumnWidth = (containerWidth - (GRID_COLUMNS - 1) * GAP) / GRID_COLUMNS
  const fullWidth = containerWidth

  // CSS calc fallback for before container is measured
  const calcWidth = `calc(${100 / GRID_COLUMNS}% - ${((GRID_COLUMNS - 1) * GAP) / GRID_COLUMNS}px)`

  // Find expanded card index for col-span
  const expandedIndex = expandedRoomId
    ? favoriteRooms.findIndex((r) => r.id === expandedRoomId)
    : -1
  const expandedColumn = expandedIndex !== -1 ? expandedIndex % GRID_COLUMNS : -1

  return (
    <div ref={containerRef} className="flex flex-wrap gap-[12px] mt-4">
      {favoriteRooms.map((room, index) => {
        const isExpanded = room.id === expandedRoomId
        // Cards to the left of an expanded card in the same row need placeholders
        const rowStart = expandedIndex - expandedColumn
        const needsPlaceholder = expandedColumn > 0 && index >= rowStart && index < expandedIndex

        // Use pixel width when measured, calc() fallback before measurement
        const targetWidth = containerWidth
          ? isExpanded
            ? fullWidth
            : singleColumnWidth
          : isExpanded
            ? '100%'
            : calcWidth

        return (
          <Fragment key={room.id}>
            <motion.div
              initial={false}
              animate={{ width: targetWidth }}
              transition={{
                width: {
                  duration: ROOM_EXPAND_DURATION,
                  ease: [0.25, 0.1, 0.25, 1],
                },
              }}
            >
              <FavoriteRoomCard
                room={room}
                allRooms={allRooms}
                isExpanded={isExpanded}
                onToggleExpand={onToggleExpand}
                isInEditMode={false}
                isSelected={false}
                onToggleSelection={onToggleSelection}
                onEnterEditModeWithSelection={onEnterEditModeWithSelection}
              />
            </motion.div>
            {/* Invisible placeholder to preserve gap when non-first-column card expands */}
            {needsPlaceholder && (
              <div
                style={{ width: containerWidth ? singleColumnWidth : calcWidth }}
                className="invisible"
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

export function FavoritesView({
  favoriteScenes,
  favoriteRooms,
  favoriteEntities,
  allRooms,
  expandedRoomId,
  onToggleExpand,
  onReorderScenes,
  onReorderRooms,
  onReorderEntities,
}: FavoritesViewProps) {
  const handlers = useDeviceHandlers()
  const {
    isFavoritesEditMode,
    selectedFavoriteItemType,
    selectedIds,
    selectedDomain,
    isSelected,
    enterFavoritesEdit,
    toggleFavoritesSelection,
    exitEditMode,
  } = useEditMode()

  // Group favorite entities by domain
  const entityGroups = useMemo(() => {
    const lights = favoriteEntities.filter((e) => e.entity_id.startsWith('light.'))
    const switches = favoriteEntities.filter((e) => e.entity_id.startsWith('switch.'))
    const inputBooleans = favoriteEntities.filter((e) => e.entity_id.startsWith('input_boolean.'))
    const inputNumbers = favoriteEntities.filter((e) => e.entity_id.startsWith('input_number.'))
    const climates = favoriteEntities.filter((e) => e.entity_id.startsWith('climate.'))
    const covers = favoriteEntities.filter((e) => e.entity_id.startsWith('cover.'))
    const fans = favoriteEntities.filter((e) => e.entity_id.startsWith('fan.'))

    return { lights, switches, inputBooleans, inputNumbers, climates, covers, fans }
  }, [favoriteEntities])

  // Build entityMeta map with room names for favorites view
  const entityMeta = useMemo(() => {
    const meta = new Map<string, EntityMeta>()
    for (const entity of favoriteEntities) {
      const area = entity.attributes.area
      meta.set(entity.entity_id, {
        isHiddenInStuga: false,
        isHiddenInHA: false,
        hasRoom: !!area,
        roomName: typeof area === 'string' ? area : undefined,
      })
    }
    return meta
  }, [favoriteEntities])

  const hasScenes = favoriteScenes.length > 0
  const hasRooms = favoriteRooms.length > 0
  const hasEntities = favoriteEntities.length > 0
  const isEmpty = !hasScenes && !hasRooms && !hasEntities

  // Determine if we're in edit mode for a specific section
  const isScenesEditMode = isFavoritesEditMode && selectedFavoriteItemType === 'scene'
  const isRoomsEditMode = isFavoritesEditMode && selectedFavoriteItemType === 'room'
  const isEntitiesEditMode = isFavoritesEditMode && selectedFavoriteItemType === 'entity'

  // Handlers for entering edit mode with initial selection
  const handleEnterEditModeWithSelection = useCallback(
    (id: string, itemType: FavoriteItemType) => {
      enterFavoritesEdit(itemType, id)
    },
    [enterFavoritesEdit]
  )

  // Handler for toggling selection
  const handleToggleSelection = useCallback(
    (id: string, itemType: FavoriteItemType) => {
      toggleFavoritesSelection(id, itemType)
    },
    [toggleFavoritesSelection]
  )

  // Handler for reordering scenes
  const handleReorderScenes = useCallback(
    (scenes: HAEntity[]) => {
      onReorderScenes?.(scenes)
    },
    [onReorderScenes]
  )

  // Handler for reordering rooms
  const handleReorderRooms = useCallback(
    (rooms: RoomWithDevices[]) => {
      onReorderRooms?.(rooms)
    },
    [onReorderRooms]
  )

  // Handler for reordering entities - returns a promise for compatibility with Section components
  const handleReorderEntities = useCallback(
    async (entities: HAEntity[]) => {
      onReorderEntities?.(entities)
    },
    [onReorderEntities]
  )

  if (isEmpty) {
    return (
      <div className="px-4 pt-4">
        <div className="card p-8 text-center">
          <Star className="w-12 h-12 mx-auto mb-4 text-muted opacity-50" />
          <p className="text-muted">{t.favorites.empty}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Scenes Section (Section A) */}
      {hasScenes && (
        <div className="mb-6">
          <SectionHeader>{t.favorites.scenes}</SectionHeader>
          {isScenesEditMode ? (
            <ReorderableList
              items={favoriteScenes}
              getKey={(scene) => scene.entity_id}
              onReorder={handleReorderScenes}
              layout="flex-wrap"
              selectedKeys={selectedIds}
              onItemTap={(key) => handleToggleSelection(key, 'scene')}
              renderItem={(scene, _index, _isDragging, _isReorderSelected) => (
                <FavoriteSceneItem
                  key={scene.entity_id}
                  scene={scene}
                  isInEditMode={true}
                  isSelected={isSelected(scene.entity_id)}
                  onActivate={handlers.handleSceneActivate}
                  onToggleSelection={handleToggleSelection}
                  onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
                />
              )}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {favoriteScenes.map((scene) => (
                <FavoriteSceneItem
                  key={scene.entity_id}
                  scene={scene}
                  isInEditMode={false}
                  isSelected={false}
                  onActivate={handlers.handleSceneActivate}
                  onToggleSelection={handleToggleSelection}
                  onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rooms Section (Section B) */}
      {hasRooms && (
        <div className="mb-6">
          <SectionHeader>{t.favorites.rooms}</SectionHeader>
          {isRoomsEditMode ? (
            <ReorderableGrid
              items={favoriteRooms}
              gridId="favorite-rooms"
              onReorder={handleReorderRooms}
              selectedKeys={selectedIds}
              className="mt-4"
              getKey={(room) => room.areaId!}
              columns={2}
              gap={12}
              renderItem={(room) => (
                <FavoriteRoomCard
                  room={room}
                  allRooms={allRooms}
                  isExpanded={false}
                  onToggleExpand={() => {}}
                  isInEditMode={true}
                  isSelected={isSelected(room.areaId!)}
                  onToggleSelection={handleToggleSelection}
                  onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
                />
              )}
            />
          ) : (
            <FavoriteRoomsNormalGrid
              favoriteRooms={favoriteRooms}
              allRooms={allRooms}
              expandedRoomId={expandedRoomId}
              onToggleExpand={onToggleExpand}
              onToggleSelection={handleToggleSelection}
              onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
            />
          )}
        </div>
      )}

      {/* Entities Section (Section C) - grouped by domain, each group reorderable in edit mode */}
      {hasEntities && (
        <EditModeContainer isInEditMode={isEntitiesEditMode} onExitEditMode={exitEditMode}>
          <div className="space-y-4" data-no-swipe>
            {entityGroups.lights.length > 0 && (
              <DomainSection domain="light" selectedDomain={selectedDomain}>
                <LightsSection
                  lights={entityGroups.lights}
                  isInEditMode={isEntitiesEditMode && selectedDomain === 'light'}
                  isSelected={isSelected}
                  onToggleSelection={(id) =>
                    isEntitiesEditMode
                      ? handleToggleSelection(id, 'entity')
                      : handleEnterEditModeWithSelection(id, 'entity')
                  }
                  onEnterEditModeWithSelection={(id) =>
                    handleEnterEditModeWithSelection(id, 'entity')
                  }
                  entityMeta={entityMeta}
                  onReorderEntities={handleReorderEntities}
                  selectedIds={selectedIds}
                />
              </DomainSection>
            )}
            {entityGroups.switches.length > 0 && (
              <DomainSection domain="switch" selectedDomain={selectedDomain}>
                <SwitchesSection
                  switches={entityGroups.switches}
                  isInEditMode={isEntitiesEditMode && selectedDomain === 'switch'}
                  isSelected={isSelected}
                  onToggle={handlers.handleSwitchToggle}
                  onToggleSelection={(id) =>
                    isEntitiesEditMode
                      ? handleToggleSelection(id, 'entity')
                      : handleEnterEditModeWithSelection(id, 'entity')
                  }
                  onEnterEditModeWithSelection={(id) =>
                    handleEnterEditModeWithSelection(id, 'entity')
                  }
                  entityMeta={entityMeta}
                  onReorderEntities={handleReorderEntities}
                  selectedIds={selectedIds}
                />
              </DomainSection>
            )}
            {(entityGroups.inputBooleans.length > 0 || entityGroups.inputNumbers.length > 0) && (
              <DomainSection
                domain={['input_boolean', 'input_number']}
                selectedDomain={selectedDomain}
              >
                <InputsSection
                  inputBooleans={entityGroups.inputBooleans}
                  inputNumbers={entityGroups.inputNumbers}
                  isInEditMode={
                    isEntitiesEditMode &&
                    (selectedDomain === 'input_boolean' || selectedDomain === 'input_number')
                  }
                  isSelected={isSelected}
                  onBooleanToggle={handlers.handleInputBooleanToggle}
                  onNumberChange={handlers.handleInputNumberChange}
                  onToggleSelection={(id) =>
                    isEntitiesEditMode
                      ? handleToggleSelection(id, 'entity')
                      : handleEnterEditModeWithSelection(id, 'entity')
                  }
                  onEnterEditModeWithSelection={(id) =>
                    handleEnterEditModeWithSelection(id, 'entity')
                  }
                  entityMeta={entityMeta}
                  onReorderEntities={handleReorderEntities}
                  selectedIds={selectedIds}
                />
              </DomainSection>
            )}
            {entityGroups.fans.length > 0 && (
              <DomainSection domain="fan" selectedDomain={selectedDomain}>
                <FansSection
                  fans={entityGroups.fans}
                  isInEditMode={isEntitiesEditMode && selectedDomain === 'fan'}
                  isSelected={isSelected}
                  onToggle={handlers.handleFanToggle}
                  onToggleSelection={(id) =>
                    isEntitiesEditMode
                      ? handleToggleSelection(id, 'entity')
                      : handleEnterEditModeWithSelection(id, 'entity')
                  }
                  onEnterEditModeWithSelection={(id) =>
                    handleEnterEditModeWithSelection(id, 'entity')
                  }
                  entityMeta={entityMeta}
                  onReorderEntities={handleReorderEntities}
                  selectedIds={selectedIds}
                />
              </DomainSection>
            )}
          </div>
        </EditModeContainer>
      )}
    </div>
  )
}
