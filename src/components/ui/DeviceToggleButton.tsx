import { Pencil } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from './MdiIcon'
import { SelectionCheckbox } from './SelectionCheckbox'
import { haWebSocket } from '@/lib/ha-websocket'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface DeviceToggleButtonProps {
  entity: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onToggle: () => void
  onEdit: () => void
  onToggleSelection: () => void
  fallbackIcon: React.ReactNode
}

export function DeviceToggleButton({
  entity,
  isInEditMode,
  isSelected,
  onToggle,
  onEdit,
  onToggleSelection,
  fallbackIcon,
}: DeviceToggleButtonProps) {
  const isOn = entity.state === 'on'
  const entityIcon = haWebSocket.getEntityIcon(entity.entity_id)

  return (
    <div
      className={clsx(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg',
        'transition-colors',
        isOn ? 'bg-accent/20' : 'bg-border/30',
        isInEditMode && 'ring-1 ring-accent/30',
        isSelected && 'ring-2 ring-accent'
      )}
    >
      {/* Edit mode controls: checkbox, pencil */}
      {isInEditMode && (
        <>
          <SelectionCheckbox isSelected={isSelected} onToggle={onToggleSelection} />
          <button
            onClick={onEdit}
            className="p-1 rounded-lg hover:bg-border/50 transition-colors"
          >
            <Pencil className="w-4 h-4 text-muted" />
          </button>
        </>
      )}
      {/* Clickable area */}
      <button
        onClick={isInEditMode ? undefined : onToggle}
        disabled={isInEditMode}
        className={clsx(
          'flex-1 flex items-center gap-3',
          !isInEditMode && 'touch-feedback'
        )}
      >
        {/* Icon on left */}
        {!isInEditMode && (
          <div
            className={clsx(
              'p-2 rounded-lg transition-colors flex-shrink-0',
              isOn ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
            )}
          >
            {entityIcon ? (
              <MdiIcon icon={entityIcon} className="w-5 h-5" />
            ) : (
              fallbackIcon
            )}
          </div>
        )}
        {/* Name */}
        <span
          className={clsx(
            'flex-1 text-sm font-medium truncate text-left',
            isOn ? 'text-foreground' : 'text-muted'
          )}
        >
          {getEntityDisplayName(entity)}
        </span>
        {/* State indicator on right */}
        <span className="text-xs text-muted">{isOn ? 'On' : 'Off'}</span>
      </button>
    </div>
  )
}
