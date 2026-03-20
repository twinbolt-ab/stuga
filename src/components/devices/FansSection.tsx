import { useMemo } from 'react'
import { Fan } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import type { DomainOrderMap } from '@/types/ordering'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { DeviceToggleButton } from '@/components/ui/DeviceToggleButton'
import { EntityBadges } from '@/components/ui/EntityBadge'
import { getEntityIcon } from '@/lib/ha-websocket'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { sortEntitiesByOrder } from '@/lib/utils/entity-sort'
import { ReorderableList } from '@/components/dashboard/ReorderableList'
import { t } from '@/lib/i18n'
import type { EntityMeta } from '@/lib/hooks/useAllEntities'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface FansSectionProps {
  fans: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onToggle: (device: HAEntity) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  entityMeta?: Map<string, EntityMeta>
  entityOrder?: DomainOrderMap
  onReorderEntities?: (entities: HAEntity[]) => Promise<void>
  /** Selected entity IDs for multi-drag support in edit mode */
  selectedIds?: Set<string>
}

function FanItem({
  fan,
  isInEditMode,
  isSelected,
  onToggle,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
  isReorderSelected = false,
}: {
  fan: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onToggle: (device: HAEntity) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  entityMeta?: EntityMeta
  isReorderSelected?: boolean
}) {
  const isOn = fan.state === 'on'
  const percentage = fan.attributes.percentage as number | undefined
  const fanIcon = getEntityIcon(fan.entity_id)

  const longPress = useLongPress({
    duration: 500,
    disabled: isInEditMode,
    onLongPress: () => onEnterEditModeWithSelection?.(fan.entity_id),
  })

  if (isInEditMode) {
    return (
      <DeviceToggleButton
        entity={fan}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onToggle={() => {
          onToggle(fan)
        }}
        onToggleSelection={() => {
          onToggleSelection(fan.entity_id)
        }}
        onEnterEditModeWithSelection={() => onEnterEditModeWithSelection?.(fan.entity_id)}
        fallbackIcon={<Fan className="w-5 h-5" />}
        entityMeta={entityMeta}
      />
    )
  }

  return (
    <div
      data-entity-id={fan.entity_id}
      className={clsx(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all',
        isOn ? 'bg-accent/20' : 'bg-border/30',
        isReorderSelected && 'ring-2 ring-accent ring-offset-1 ring-offset-bg-primary'
      )}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerUp}
    >
      {/* Icon */}
      <div
        className={clsx(
          'p-2 rounded-lg transition-colors flex-shrink-0',
          isOn ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
        )}
      >
        {fanIcon ? <MdiIcon icon={fanIcon} className="w-5 h-5" /> : <Fan className="w-5 h-5" />}
      </div>

      {/* Clickable area */}
      <button
        onClick={() => {
          onToggle(fan)
        }}
        className="flex-1 flex items-center gap-3 touch-feedback"
      >
        {/* Name */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span
            className={clsx(
              'text-sm font-medium truncate text-left',
              isOn ? 'text-foreground' : 'text-muted'
            )}
          >
            {getEntityDisplayName(fan)}
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

        {/* Room name and state indicators */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {entityMeta?.roomName && (
            <span className="text-sm text-muted truncate w-20 text-right">
              {entityMeta.roomName}
            </span>
          )}
          {/* Speed indicator */}
          {isOn && percentage !== undefined && (
            <span className="text-xs text-accent font-medium w-8 text-right">{percentage}%</span>
          )}
          {/* State indicator */}
          <span className="text-xs text-muted w-6 text-right">{isOn ? 'On' : 'Off'}</span>
        </div>
      </button>
    </div>
  )
}

export function FansSection({
  fans,
  isInEditMode,
  isSelected,
  onToggle,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
  entityOrder,
  onReorderEntities,
  selectedIds,
}: FansSectionProps) {
  // Sort fans by order only if entityOrder is provided
  const sortedFans = useMemo(() => {
    if (!entityOrder || Object.keys(entityOrder).length === 0) {
      return fans
    }
    return sortEntitiesByOrder(fans, entityOrder)
  }, [fans, entityOrder])

  if (fans.length === 0) return null

  const handleReorder = (reorderedFans: HAEntity[]) => {
    void onReorderEntities?.(reorderedFans)
  }

  return (
    <div className="mb-4">
      <SectionHeader>{t.domains.fan}</SectionHeader>
      {isInEditMode ? (
        // Edit mode: use ReorderableList for drag-to-reorder + tap-to-select
        <ReorderableList
          items={sortedFans}
          getKey={(fan) => fan.entity_id}
          onReorder={handleReorder}
          layout="vertical"
          selectedKeys={selectedIds}
          onItemTap={onToggleSelection}
          renderItem={(fan, _index, _isDragging, isReorderSelected) => (
            <FanItem
              key={fan.entity_id}
              fan={fan}
              isInEditMode={true}
              isSelected={isSelected(fan.entity_id)}
              onToggle={onToggle}
              onToggleSelection={onToggleSelection}
              onEnterEditModeWithSelection={onEnterEditModeWithSelection}
              entityMeta={entityMeta?.get(fan.entity_id)}
              isReorderSelected={isReorderSelected}
            />
          )}
        />
      ) : (
        // Normal mode: static list with long-press to enter edit mode
        <div className="space-y-1">
          {sortedFans.map((fan) => (
            <FanItem
              key={fan.entity_id}
              fan={fan}
              isInEditMode={false}
              isSelected={isSelected(fan.entity_id)}
              onToggle={onToggle}
              onToggleSelection={onToggleSelection}
              onEnterEditModeWithSelection={onEnterEditModeWithSelection}
              entityMeta={entityMeta?.get(fan.entity_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
