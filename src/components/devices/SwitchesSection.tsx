import { useMemo } from 'react'
import { Power } from 'lucide-react'
import type { HAEntity } from '@/types/ha'
import type { DomainOrderMap } from '@/types/ordering'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { DeviceToggleButton } from '@/components/ui/DeviceToggleButton'
import { sortEntitiesByOrder } from '@/lib/utils/entity-sort'
import { ReorderableList } from '@/components/shared/ReorderableList'
import { t } from '@/lib/i18n'
import type { EntityMeta } from '@/lib/hooks/useAllEntities'

interface SwitchesSectionProps {
  switches: HAEntity[]
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

export function SwitchesSection({
  switches,
  isInEditMode,
  isSelected,
  onToggle,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
  entityOrder,
  onReorderEntities,
  selectedIds,
}: SwitchesSectionProps) {
  // Sort switches by order only if entityOrder is provided
  const sortedSwitches = useMemo(() => {
    if (!entityOrder || Object.keys(entityOrder).length === 0) {
      return switches
    }
    return sortEntitiesByOrder(switches, entityOrder)
  }, [switches, entityOrder])

  if (switches.length === 0) return null

  const handleReorder = (reorderedSwitches: HAEntity[]) => {
    void onReorderEntities?.(reorderedSwitches)
  }

  return (
    <div className="mb-4">
      <SectionHeader>{t.devices.switches}</SectionHeader>
      {isInEditMode ? (
        // Edit mode: use ReorderableList for drag-to-reorder + tap-to-select
        <ReorderableList
          items={sortedSwitches}
          getKey={(sw) => sw.entity_id}
          onReorder={handleReorder}
          layout="vertical"
          selectedKeys={selectedIds}
          onItemTap={onToggleSelection}
          renderItem={(sw, _index, _isDragging, isReorderSelected) => (
            <DeviceToggleButton
              key={sw.entity_id}
              entity={sw}
              isInEditMode={true}
              isSelected={isSelected(sw.entity_id)}
              onToggle={() => {
                onToggle(sw)
              }}
              onToggleSelection={() => {
                onToggleSelection(sw.entity_id)
              }}
              onEnterEditModeWithSelection={() => onEnterEditModeWithSelection?.(sw.entity_id)}
              fallbackIcon={<Power className="w-5 h-5" />}
              entityMeta={entityMeta?.get(sw.entity_id)}
              isReorderSelected={isReorderSelected}
            />
          )}
        />
      ) : (
        // Normal mode: static list with long-press to enter edit mode
        <div className="space-y-1">
          {sortedSwitches.map((sw) => (
            <DeviceToggleButton
              key={sw.entity_id}
              entity={sw}
              isInEditMode={false}
              isSelected={isSelected(sw.entity_id)}
              onToggle={() => {
                onToggle(sw)
              }}
              onToggleSelection={() => {
                onToggleSelection(sw.entity_id)
              }}
              onEnterEditModeWithSelection={() => onEnterEditModeWithSelection?.(sw.entity_id)}
              fallbackIcon={<Power className="w-5 h-5" />}
              entityMeta={entityMeta?.get(sw.entity_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
