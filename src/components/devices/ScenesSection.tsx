import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
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
import { t } from '@/lib/i18n'
import type { EntityMeta } from '@/lib/hooks/useAllEntities'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface ScenesSectionProps {
  scenes: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onActivate: (scene: HAEntity) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  getDisplayName?: (scene: HAEntity) => string
  entityMeta?: Map<string, EntityMeta>
  entityOrder?: DomainOrderMap
  onReorderEntities?: (entities: HAEntity[]) => Promise<void>
  /** Selected entity IDs for multi-drag support in edit mode */
  selectedIds?: Set<string>
}

function SceneItem({
  scene,
  isInEditMode,
  isSelected,
  onActivate,
  onToggleSelection,
  onEnterEditModeWithSelection,
  displayName,
  entityMeta,
  isReorderSelected = false,
}: {
  scene: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onActivate: (scene: HAEntity) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  displayName: (scene: HAEntity) => string
  entityMeta?: EntityMeta
  isReorderSelected?: boolean
}) {
  const sceneIcon = getEntityIcon(scene.entity_id)

  const longPress = useLongPress({
    duration: 500,
    disabled: isInEditMode,
    onLongPress: () => onEnterEditModeWithSelection?.(scene.entity_id),
  })

  if (isInEditMode) {
    return (
      <button
        data-entity-id={scene.entity_id}
        onClick={() => {
          onToggleSelection(scene.entity_id)
        }}
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
        {displayName(scene)}
        {entityMeta && (
          <EntityBadges
            isHiddenInStuga={entityMeta.isHiddenInStuga}
            isHiddenInHA={entityMeta.isHiddenInHA}
            hasRoom={entityMeta.hasRoom}
          />
        )}
      </button>
    )
  }

  return (
    <button
      data-entity-id={scene.entity_id}
      onClick={() => {
        onActivate(scene)
      }}
      className={clsx(
        'px-3 py-1.5 rounded-full text-sm font-medium',
        'bg-border/50 hover:bg-accent/20 hover:text-accent',
        'transition-all touch-feedback',
        'flex items-center gap-1.5',
        isReorderSelected && 'ring-2 ring-accent ring-offset-1 ring-offset-bg-primary'
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
      {displayName(scene)}
      {entityMeta && (
        <EntityBadges
          isHiddenInStuga={entityMeta.isHiddenInStuga}
          isHiddenInHA={entityMeta.isHiddenInHA}
          hasRoom={entityMeta.hasRoom}
        />
      )}
    </button>
  )
}

export function ScenesSection({
  scenes,
  isInEditMode,
  isSelected,
  onActivate,
  onToggleSelection,
  onEnterEditModeWithSelection,
  getDisplayName,
  entityMeta,
  entityOrder = {},
  onReorderEntities,
  selectedIds,
}: ScenesSectionProps) {
  const displayName = getDisplayName || getEntityDisplayName

  // Sort scenes by order
  const sortedScenes = useMemo(() => {
    return sortEntitiesByOrder(scenes, entityOrder)
  }, [scenes, entityOrder])

  if (scenes.length === 0) return null

  const handleReorder = (reorderedScenes: HAEntity[]) => {
    void onReorderEntities?.(reorderedScenes)
  }

  return (
    <div className="mb-4">
      <SectionHeader>{t.devices.scenes}</SectionHeader>
      {isInEditMode ? (
        // Edit mode: use ReorderableList for drag-to-reorder + tap-to-select
        <ReorderableList
          items={sortedScenes}
          getKey={(scene) => scene.entity_id}
          onReorder={handleReorder}
          layout="flex-wrap"
          selectedKeys={selectedIds}
          onItemTap={onToggleSelection}
          renderItem={(scene, _index, _isDragging, isReorderSelected) => (
            <SceneItem
              key={scene.entity_id}
              scene={scene}
              isInEditMode={true}
              isSelected={isSelected(scene.entity_id)}
              onActivate={onActivate}
              onToggleSelection={onToggleSelection}
              onEnterEditModeWithSelection={onEnterEditModeWithSelection}
              displayName={displayName}
              entityMeta={entityMeta?.get(scene.entity_id)}
              isReorderSelected={isReorderSelected}
            />
          )}
        />
      ) : (
        // Normal mode: static list with long-press to enter edit mode
        <div className="flex flex-wrap gap-2">
          {sortedScenes.map((scene) => (
            <SceneItem
              key={scene.entity_id}
              scene={scene}
              isInEditMode={false}
              isSelected={isSelected(scene.entity_id)}
              onActivate={onActivate}
              onToggleSelection={onToggleSelection}
              onEnterEditModeWithSelection={onEnterEditModeWithSelection}
              displayName={displayName}
              entityMeta={entityMeta?.get(scene.entity_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
