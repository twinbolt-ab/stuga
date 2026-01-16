import { Fan } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { DeviceToggleButton } from '@/components/ui/DeviceToggleButton'
import { EntityBadges } from '@/components/ui/EntityBadge'
import { getEntityIcon } from '@/lib/ha-websocket'
import { useLongPress } from '@/lib/hooks/useLongPress'
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
}

function FanItem({
  fan,
  isInEditMode,
  isSelected,
  onToggle,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
}: {
  fan: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onToggle: (device: HAEntity) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  entityMeta?: EntityMeta
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
      className={clsx(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors',
        isOn ? 'bg-accent/20' : 'bg-border/30'
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
              isHidden={entityMeta.isHidden}
              hasRoom={entityMeta.hasRoom}
              className="flex-shrink-0"
            />
          )}
        </div>

        {/* Speed indicator */}
        {isOn && percentage !== undefined && (
          <span className="text-xs text-accent font-medium flex-shrink-0">{percentage}%</span>
        )}

        {/* State indicator */}
        <span className="text-xs text-muted flex-shrink-0">{isOn ? 'On' : 'Off'}</span>
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
}: FansSectionProps) {
  if (fans.length === 0) return null

  return (
    <div className="mb-4">
      <SectionHeader>{t.domains.fan}</SectionHeader>
      <div className="space-y-1">
        {fans.map((fan) => (
          <FanItem
            key={fan.entity_id}
            fan={fan}
            isInEditMode={isInEditMode}
            isSelected={isSelected(fan.entity_id)}
            onToggle={onToggle}
            onToggleSelection={onToggleSelection}
            onEnterEditModeWithSelection={onEnterEditModeWithSelection}
            entityMeta={entityMeta?.get(fan.entity_id)}
          />
        ))}
      </div>
    </div>
  )
}
