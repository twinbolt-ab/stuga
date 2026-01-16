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
        onClick={onToggleSelection}
        className={clsx(
          'w-full flex items-center gap-2 px-2 py-2 rounded-lg',
          'transition-colors touch-feedback',
          isOn ? 'bg-accent/20' : 'bg-border/30'
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
              isHidden={entityMeta.isHidden}
              hasRoom={entityMeta.hasRoom}
              className="flex-shrink-0"
            />
          )}
        </div>
        {/* State indicator on right */}
        <span className="text-xs text-muted flex-shrink-0">{isOn ? 'On' : 'Off'}</span>
      </button>
    )
  }

  return (
    <div
      className={clsx(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg',
        'transition-colors',
        isOn ? 'bg-accent/20' : 'bg-border/30'
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
              isHidden={entityMeta.isHidden}
              hasRoom={entityMeta.hasRoom}
              className="flex-shrink-0"
            />
          )}
        </div>
        {/* State indicator on right */}
        <span className="text-xs text-muted flex-shrink-0">{isOn ? 'On' : 'Off'}</span>
      </button>
    </div>
  )
}
