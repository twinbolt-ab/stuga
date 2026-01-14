import { Thermometer, Power, Pencil } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { haWebSocket } from '@/lib/ha-websocket'
import { t } from '@/lib/i18n'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface ClimateSectionProps {
  climates: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onToggle: (device: HAEntity) => void
  onEdit: (device: HAEntity) => void
  onToggleSelection: (id: string) => void
}

export function ClimateSection({
  climates,
  isInEditMode,
  isSelected,
  onToggle,
  onEdit,
  onToggleSelection,
}: ClimateSectionProps) {
  if (climates.length === 0) return null

  return (
    <div className="mb-4">
      <SectionHeader>{t.domains.climate}</SectionHeader>
      <div className="space-y-2">
        {climates.map((climate) => {
          const climateSelected = isSelected(climate.entity_id)
          const currentTemp = climate.attributes.current_temperature as
            | number
            | undefined
          const targetTemp = climate.attributes.temperature as number | undefined
          const hvacMode = climate.state
          const isOff = hvacMode === 'off'
          const climateIcon = haWebSocket.getEntityIcon(climate.entity_id)

          if (isInEditMode) {
            return (
              <div
                key={climate.entity_id}
                className={clsx(
                  'px-3 py-3 rounded-xl bg-border/30',
                  'ring-1 ring-accent/30',
                  climateSelected && 'ring-2 ring-accent'
                )}
              >
                <div className="flex items-center gap-2">
                  <SelectionCheckbox
                    isSelected={climateSelected}
                    onToggle={() => onToggleSelection(climate.entity_id)}
                  />
                  <button
                    onClick={() => onEdit(climate)}
                    className="p-1 rounded-lg hover:bg-border/50 transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-muted" />
                  </button>
                  <span className="flex-1 text-sm font-medium text-foreground truncate">
                    {getEntityDisplayName(climate)}
                  </span>
                </div>
              </div>
            )
          }

          return (
            <div
              key={climate.entity_id}
              className={clsx(
                'px-3 py-3 rounded-xl transition-colors',
                isOff ? 'bg-border/30' : 'bg-accent/10'
              )}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className={clsx(
                    'p-2 rounded-lg transition-colors flex-shrink-0',
                    isOff ? 'bg-border/50 text-muted' : 'bg-accent/20 text-accent'
                  )}
                >
                  {climateIcon ? (
                    <MdiIcon icon={climateIcon} className="w-5 h-5" />
                  ) : (
                    <Thermometer className="w-5 h-5" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {getEntityDisplayName(climate)}
                    </span>
                    {!isOff && (
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                          hvacMode === 'heat' && 'bg-orange-500/20 text-orange-500',
                          hvacMode === 'cool' && 'bg-blue-500/20 text-blue-500',
                          hvacMode === 'heat_cool' &&
                            'bg-purple-500/20 text-purple-500',
                          hvacMode === 'auto' && 'bg-green-500/20 text-green-500',
                          !['heat', 'cool', 'heat_cool', 'auto'].includes(hvacMode) &&
                            'bg-accent/20 text-accent'
                        )}
                      >
                        {hvacMode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
                    {currentTemp !== undefined && <span>Current: {currentTemp}°</span>}
                    {targetTemp !== undefined && !isOff && (
                      <span>Target: {targetTemp}°</span>
                    )}
                  </div>
                </div>

                {/* Power toggle */}
                <button
                  onClick={() => onToggle(climate)}
                  className={clsx(
                    'p-2 rounded-lg transition-colors touch-feedback',
                    isOff ? 'bg-border/50 text-muted' : 'bg-accent text-white'
                  )}
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
