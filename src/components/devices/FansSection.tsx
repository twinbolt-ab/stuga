import { Fan } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { DeviceToggleButton } from '@/components/ui/DeviceToggleButton'
import { haWebSocket } from '@/lib/ha-websocket'
import { t } from '@/lib/i18n'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface FansSectionProps {
  fans: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onToggle: (device: HAEntity) => void
  onEdit: (device: HAEntity) => void
  onToggleSelection: (id: string) => void
}

export function FansSection({
  fans,
  isInEditMode,
  isSelected,
  onToggle,
  onEdit,
  onToggleSelection,
}: FansSectionProps) {
  if (fans.length === 0) return null

  return (
    <div className="mb-4">
      <SectionHeader>{t.domains.fan}</SectionHeader>
      <div className="space-y-1">
        {fans.map((fan) => {
          const isOn = fan.state === 'on'
          const percentage = fan.attributes.percentage as number | undefined
          const fanIcon = haWebSocket.getEntityIcon(fan.entity_id)

          if (isInEditMode) {
            return (
              <DeviceToggleButton
                key={fan.entity_id}
                entity={fan}
                isInEditMode={isInEditMode}
                isSelected={isSelected(fan.entity_id)}
                onToggle={() => onToggle(fan)}
                onEdit={() => onEdit(fan)}
                onToggleSelection={() => onToggleSelection(fan.entity_id)}
                fallbackIcon={<Fan className="w-5 h-5" />}
              />
            )
          }

          return (
            <div
              key={fan.entity_id}
              className={clsx(
                'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors',
                isOn ? 'bg-accent/20' : 'bg-border/30'
              )}
            >
              {/* Icon */}
              <div
                className={clsx(
                  'p-2 rounded-lg transition-colors flex-shrink-0',
                  isOn ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
                )}
              >
                {fanIcon ? (
                  <MdiIcon icon={fanIcon} className="w-5 h-5" />
                ) : (
                  <Fan className="w-5 h-5" />
                )}
              </div>

              {/* Clickable area */}
              <button
                onClick={() => onToggle(fan)}
                className="flex-1 flex items-center gap-3 touch-feedback"
              >
                {/* Name */}
                <span
                  className={clsx(
                    'flex-1 text-sm font-medium truncate text-left',
                    isOn ? 'text-foreground' : 'text-muted'
                  )}
                >
                  {getEntityDisplayName(fan)}
                </span>

                {/* Speed indicator */}
                {isOn && percentage !== undefined && (
                  <span className="text-xs text-accent font-medium">{percentage}%</span>
                )}

                {/* State indicator */}
                <span className="text-xs text-muted">{isOn ? 'On' : 'Off'}</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
