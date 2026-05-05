import { useMemo } from 'react'
import { Blinds } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import type { DomainOrderMap } from '@/types/ordering'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { EntityBadges } from '@/components/ui/EntityBadge'
import { getEntityIcon } from '@/lib/ha-websocket'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { sortEntitiesByOrder } from '@/lib/utils/entity-sort'
import { ReorderableList } from '@/components/shared/ReorderableList'
import { haptic } from '@/lib/haptics'
import { t } from '@/lib/i18n'
import type { EntityMeta } from '@/lib/hooks/useAllEntities'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

function getCoverPosition(cover: HAEntity): number | undefined {
  const pos = cover.attributes.current_position
  if (typeof pos === 'number') return Math.max(0, Math.min(100, Math.round(pos)))
  if (cover.state === 'open') return 100
  if (cover.state === 'closed') return 0
  return undefined
}

function getCoverStateLabel(cover: HAEntity): string {
  switch (cover.state) {
    case 'opening':
      return t.devices.coverOpening
    case 'closing':
      return t.devices.coverClosing
    case 'open':
      return t.devices.coverOpen
    case 'closed':
      return t.devices.coverClosed
    default:
      return cover.state
  }
}

interface CoversSectionProps {
  covers: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onToggle: (cover: HAEntity) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  entityMeta?: Map<string, EntityMeta>
  entityOrder?: DomainOrderMap
  onReorderEntities?: (entities: HAEntity[]) => Promise<void>
  /** Selected entity IDs for multi-drag support in edit mode */
  selectedIds?: Set<string>
}

function CoverItem({
  cover,
  isInEditMode,
  isSelected,
  onToggle,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
  isReorderSelected = false,
}: {
  cover: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onToggle: (cover: HAEntity) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  entityMeta?: EntityMeta
  isReorderSelected?: boolean
}) {
  const position = getCoverPosition(cover)
  const isClosed = cover.state === 'closed' || position === 0
  const isMoving = cover.state === 'opening' || cover.state === 'closing'
  // Treat "open" as the active/highlighted state — matches how lights highlight when on.
  const isActive = !isClosed
  const coverIcon = getEntityIcon(cover.entity_id)

  const longPress = useLongPress({
    duration: 500,
    disabled: isInEditMode,
    onLongPress: () => onEnterEditModeWithSelection?.(cover.entity_id),
  })

  if (isInEditMode) {
    return (
      <button
        data-entity-id={cover.entity_id}
        onClick={() => {
          onToggleSelection(cover.entity_id)
        }}
        className={clsx(
          'w-full flex items-center gap-2 px-2 py-2 rounded-lg',
          'transition-all touch-feedback',
          isActive ? 'bg-accent/20' : 'bg-border/30',
          isSelected && 'ring-2 ring-inset ring-accent'
        )}
      >
        <SelectionCheckbox isSelected={isSelected} />
        <div
          className={clsx(
            'p-2 rounded-lg transition-colors flex-shrink-0',
            isActive ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
          )}
        >
          {coverIcon ? (
            <MdiIcon icon={coverIcon} className="w-5 h-5" />
          ) : (
            <Blinds className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span
            className={clsx(
              'text-sm font-medium truncate text-left',
              isActive ? 'text-foreground' : 'text-muted'
            )}
          >
            {getEntityDisplayName(cover)}
          </span>
          {entityMeta && (
            <EntityBadges
              isHiddenInStuga={entityMeta.isHiddenInStuga}
              isHiddenInHA={entityMeta.isHiddenInHA}
              hasRoom={entityMeta.hasRoom}
              className="flex-shrink-0"
            />
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {entityMeta?.roomName && (
            <span className="text-sm text-muted truncate w-20 text-right">
              {entityMeta.roomName}
            </span>
          )}
          <span className="text-xs text-muted w-16 text-right">{getCoverStateLabel(cover)}</span>
        </div>
      </button>
    )
  }

  // Subtle position fill behind row — mirrors the brightness fill on lights, but static.
  const showFill = isActive && typeof position === 'number'

  return (
    <div
      data-entity-id={cover.entity_id}
      className={clsx(
        'relative w-full flex items-center gap-2 px-2 py-2 rounded-lg overflow-hidden',
        'transition-all',
        isActive ? 'bg-accent/20' : 'bg-border/30',
        isReorderSelected && 'ring-2 ring-accent ring-offset-1 ring-offset-bg-primary'
      )}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerUp}
    >
      {showFill && (
        <div
          className="absolute inset-0 origin-left pointer-events-none transition-transform duration-300"
          style={{
            backgroundColor: 'var(--brightness-fill)',
            transform: `scaleX(${(position ?? 0) / 100})`,
          }}
        />
      )}

      <button
        onClick={() => {
          haptic.light()
          onToggle(cover)
        }}
        className="relative z-0 flex-1 flex items-center gap-3 touch-feedback"
      >
        <div
          className={clsx(
            'p-2 rounded-lg transition-colors flex-shrink-0',
            isActive ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted',
            isMoving && 'animate-pulse'
          )}
        >
          {coverIcon ? (
            <MdiIcon icon={coverIcon} className="w-5 h-5" />
          ) : (
            <Blinds className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span
            className={clsx(
              'text-sm font-medium truncate text-left',
              isActive ? 'text-foreground' : 'text-muted'
            )}
          >
            {getEntityDisplayName(cover)}
          </span>
          {entityMeta && (
            <EntityBadges
              isHiddenInStuga={entityMeta.isHiddenInStuga}
              isHiddenInHA={entityMeta.isHiddenInHA}
              hasRoom={entityMeta.hasRoom}
              className="flex-shrink-0"
            />
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {entityMeta?.roomName && (
            <span className="text-sm text-muted truncate w-20 text-right">
              {entityMeta.roomName}
            </span>
          )}
          {/* Show partial position only when not fully open/closed */}
          {isActive && typeof position === 'number' && position > 0 && position < 100 && (
            <span className="text-xs text-accent font-medium w-8 text-right">{position}%</span>
          )}
          <span className="text-xs text-muted w-16 text-right">{getCoverStateLabel(cover)}</span>
        </div>
      </button>
    </div>
  )
}

export function CoversSection({
  covers,
  isInEditMode,
  isSelected,
  onToggle,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
  entityOrder,
  onReorderEntities,
  selectedIds,
}: CoversSectionProps) {
  const sortedCovers = useMemo(() => {
    if (!entityOrder || Object.keys(entityOrder).length === 0) {
      return covers
    }
    return sortEntitiesByOrder(covers, entityOrder)
  }, [covers, entityOrder])

  if (covers.length === 0) return null

  const handleReorder = (reorderedCovers: HAEntity[]) => {
    void onReorderEntities?.(reorderedCovers)
  }

  return (
    <div className="mb-4">
      <SectionHeader>{t.domains.cover}</SectionHeader>
      {isInEditMode ? (
        <ReorderableList
          items={sortedCovers}
          getKey={(cover) => cover.entity_id}
          onReorder={handleReorder}
          layout="vertical"
          selectedKeys={selectedIds}
          onItemTap={onToggleSelection}
          renderItem={(cover, _index, _isDragging, isReorderSelected) => (
            <CoverItem
              key={cover.entity_id}
              cover={cover}
              isInEditMode={true}
              isSelected={isSelected(cover.entity_id)}
              onToggle={onToggle}
              onToggleSelection={onToggleSelection}
              onEnterEditModeWithSelection={onEnterEditModeWithSelection}
              entityMeta={entityMeta?.get(cover.entity_id)}
              isReorderSelected={isReorderSelected}
            />
          )}
        />
      ) : (
        <div className="space-y-1">
          {sortedCovers.map((cover) => (
            <CoverItem
              key={cover.entity_id}
              cover={cover}
              isInEditMode={false}
              isSelected={isSelected(cover.entity_id)}
              onToggle={onToggle}
              onToggleSelection={onToggleSelection}
              onEnterEditModeWithSelection={onEnterEditModeWithSelection}
              entityMeta={entityMeta?.get(cover.entity_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
