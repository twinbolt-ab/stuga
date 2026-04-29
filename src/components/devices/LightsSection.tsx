import { useMemo } from 'react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import type { DomainOrderMap } from '@/types/ordering'
import { LightSlider } from '@/components/shared/LightSlider'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { sortEntitiesByOrder } from '@/lib/utils/entity-sort'
import { ReorderableList } from '@/components/shared/ReorderableList'
import { t } from '@/lib/i18n'
import type { EntityMeta } from '@/lib/hooks/useAllEntities'

interface LightsSectionProps {
  lights: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  compact?: boolean
  singleColumn?: boolean
  entityMeta?: Map<string, EntityMeta>
  entityOrder?: DomainOrderMap
  onReorderEntities?: (entities: HAEntity[]) => Promise<void>
  /** Selected entity IDs for multi-drag support in edit mode */
  selectedIds?: Set<string>
}

function LightItem({
  light,
  isInEditMode,
  isSelected,
  compact,
  entityMeta,
  isDragging = false,
}: {
  light: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  compact: boolean
  entityMeta?: EntityMeta
  isDragging?: boolean
}) {
  if (isInEditMode) {
    return (
      <div
        data-entity-id={light.entity_id}
        className={clsx(
          'flex items-center bg-card rounded-lg w-full transition-all',
          compact ? 'gap-1 pl-1 pr-0.5' : 'gap-2 pl-2 pr-1',
          isDragging && 'opacity-90'
        )}
      >
        <SelectionCheckbox isSelected={isSelected} />
        <div className="flex-1 min-w-0">
          <LightSlider
            light={light}
            disabled={true}
            compact={compact}
            entityMeta={entityMeta}
            isSelected={isSelected}
          />
        </div>
      </div>
    )
  }

  return (
    <div data-entity-id={light.entity_id} className="rounded-lg">
      <LightSlider light={light} disabled={false} compact={compact} entityMeta={entityMeta} />
    </div>
  )
}

function LightItemWithLongPress({
  light,
  onEnterEditModeWithSelection,
  compact,
  entityMeta,
}: {
  light: HAEntity
  onEnterEditModeWithSelection?: (deviceId: string) => void
  compact: boolean
  entityMeta?: EntityMeta
}) {
  const longPress = useLongPress({
    duration: 500,
    onLongPress: () => onEnterEditModeWithSelection?.(light.entity_id),
  })

  return (
    <div
      data-entity-id={light.entity_id}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerUp}
      className="rounded-lg"
    >
      <LightSlider light={light} disabled={false} compact={compact} entityMeta={entityMeta} />
    </div>
  )
}

export function LightsSection({
  lights,
  isInEditMode,
  isSelected,
  onToggleSelection,
  onEnterEditModeWithSelection,
  compact = false,
  singleColumn = false,
  entityMeta,
  entityOrder,
  onReorderEntities,
  selectedIds,
}: LightsSectionProps) {
  // Sort lights by order only if entityOrder is provided
  // When used in FavoritesView, lights are already in favorite order
  const sortedLights = useMemo(() => {
    if (!entityOrder || Object.keys(entityOrder).length === 0) {
      return lights
    }
    return sortEntitiesByOrder(lights, entityOrder)
  }, [lights, entityOrder])

  if (lights.length === 0) return null

  const handleReorder = (reorderedLights: HAEntity[]) => {
    void onReorderEntities?.(reorderedLights)
  }

  // Use two columns for lights when there are more than 6 (unless explicitly set or forced single)
  const useTwoColumn = !singleColumn && (compact || lights.length > 6)

  return (
    <div className="mb-4">
      <SectionHeader>{t.devices.lights}</SectionHeader>
      {isInEditMode ? (
        // Edit mode: use ReorderableList for drag-to-reorder + tap-to-select
        <ReorderableList
          items={sortedLights}
          getKey={(light) => light.entity_id}
          onReorder={handleReorder}
          layout="vertical"
          selectedKeys={selectedIds}
          onItemTap={onToggleSelection}
          renderItem={(light, _index, isDragging, _isReorderSelected) => (
            <LightItem
              key={light.entity_id}
              light={light}
              isInEditMode={true}
              isSelected={isSelected(light.entity_id)}
              compact={useTwoColumn}
              entityMeta={entityMeta?.get(light.entity_id)}
              isDragging={isDragging}
            />
          )}
        />
      ) : (
        // Normal mode: static list with long-press to enter edit mode
        <div className={clsx(useTwoColumn ? 'grid grid-cols-2 gap-x-2 gap-y-1' : 'space-y-1')}>
          {sortedLights.map((light) => (
            <LightItemWithLongPress
              key={light.entity_id}
              light={light}
              onEnterEditModeWithSelection={onEnterEditModeWithSelection}
              compact={useTwoColumn}
              entityMeta={entityMeta?.get(light.entity_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
