import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from './MdiIcon'
import { SelectionCheckbox } from './SelectionCheckbox'
import { EntityBadges } from './EntityBadge'
import { getEntityIcon } from '@/lib/ha-websocket'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { haptic } from '@/lib/haptics'
import type { EntityMeta } from '@/lib/hooks/useAllEntities'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface DeviceToggleButtonProps {
  entity: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onToggle: () => void
  onToggleSelection: () => void
  onEnterEditModeWithSelection?: () => void
  fallbackIcon: React.ReactNode
  entityMeta?: EntityMeta
  isReorderSelected?: boolean
}

export function DeviceToggleButton({
  entity,
  isInEditMode,
  isSelected,
  onToggle,
  onToggleSelection,
  onEnterEditModeWithSelection,
  fallbackIcon,
  entityMeta,
  isReorderSelected = false,
}: DeviceToggleButtonProps) {
  const isOn = entity.state === 'on'
  const entityIcon = getEntityIcon(entity.entity_id)

  const longPress = useLongPress({
    duration: 500,
    disabled: isInEditMode,
    onLongPress: () => onEnterEditModeWithSelection?.(),
  })

  // In edit mode, make the whole item clickable
  if (isInEditMode) {
    return (
      <button
        data-entity-id={entity.entity_id}
        onClick={onToggleSelection}
        className={clsx(
          'w-full flex items-center gap-2 px-2 py-2 rounded-lg',
          'transition-all touch-feedback',
          isOn ? 'bg-accent/20' : 'bg-border/30',
          isSelected && 'ring-2 ring-inset ring-accent'
        )}
      >
        <SelectionCheckbox isSelected={isSelected} />
        {/* Icon on left */}
        <div
          className={clsx(
            'p-2 rounded-lg transition-colors flex-shrink-0',
            isOn ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
          )}
        >
          {entityIcon ? <MdiIcon icon={entityIcon} className="w-5 h-5" /> : fallbackIcon}
        </div>
        {/* Name */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span
            className={clsx(
              'text-sm font-medium truncate text-left',
              isOn ? 'text-foreground' : 'text-muted'
            )}
          >
            {getEntityDisplayName(entity)}
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
        {/* Room name and state indicator on right */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {entityMeta?.roomName && (
            <span className="text-sm text-muted truncate w-20 text-right">
              {entityMeta.roomName}
            </span>
          )}
          <span className="text-xs text-muted w-6 text-right">{isOn ? 'On' : 'Off'}</span>
        </div>
      </button>
    )
  }

  return (
    <div
      data-entity-id={entity.entity_id}
      className={clsx(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg',
        'transition-all',
        isOn ? 'bg-accent/20' : 'bg-border/30',
        isReorderSelected && 'ring-2 ring-accent ring-offset-1 ring-offset-bg-primary'
      )}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerUp}
    >
      {/* Clickable area */}
      <button
        onClick={() => {
          haptic.light()
          onToggle()
        }}
        className={clsx('flex-1 flex items-center gap-3', 'touch-feedback')}
      >
        {/* Icon on left */}
        <div
          className={clsx(
            'p-2 rounded-lg transition-colors flex-shrink-0',
            isOn ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
          )}
        >
          {entityIcon ? <MdiIcon icon={entityIcon} className="w-5 h-5" /> : fallbackIcon}
        </div>
        {/* Name */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span
            className={clsx(
              'text-sm font-medium truncate text-left',
              isOn ? 'text-foreground' : 'text-muted'
            )}
          >
            {getEntityDisplayName(entity)}
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
        {/* Room name and state indicator on right */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {entityMeta?.roomName && (
            <span className="text-sm text-muted truncate w-20 text-right">
              {entityMeta.roomName}
            </span>
          )}
          <span className="text-xs text-muted w-6 text-right">{isOn ? 'On' : 'Off'}</span>
        </div>
      </button>
    </div>
  )
}
