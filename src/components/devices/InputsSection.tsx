import { ToggleLeft, SlidersHorizontal, Pencil } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { DeviceToggleButton } from '@/components/ui/DeviceToggleButton'
import { haWebSocket } from '@/lib/ha-websocket'
import { t } from '@/lib/i18n'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface InputsSectionProps {
  inputBooleans: HAEntity[]
  inputNumbers: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onBooleanToggle: (device: HAEntity) => void
  onNumberChange: (device: HAEntity, value: number) => void
  onEdit: (device: HAEntity) => void
  onToggleSelection: (id: string) => void
}

export function InputsSection({
  inputBooleans,
  inputNumbers,
  isInEditMode,
  isSelected,
  onBooleanToggle,
  onNumberChange,
  onEdit,
  onToggleSelection,
}: InputsSectionProps) {
  if (inputBooleans.length === 0 && inputNumbers.length === 0) return null

  return (
    <div className="mb-4">
      <SectionHeader>{t.devices.inputs}</SectionHeader>
      <div className="space-y-1">
        {/* Input Booleans (toggles) */}
        {inputBooleans.map((input) => (
          <DeviceToggleButton
            key={input.entity_id}
            entity={input}
            isInEditMode={isInEditMode}
            isSelected={isSelected(input.entity_id)}
            onToggle={() => onBooleanToggle(input)}
            onEdit={() => onEdit(input)}
            onToggleSelection={() => onToggleSelection(input.entity_id)}
            fallbackIcon={<ToggleLeft className="w-5 h-5" />}
          />
        ))}

        {/* Input Numbers (sliders) */}
        {inputNumbers.map((input) => {
          const inputSelected = isSelected(input.entity_id)
          const value = parseFloat(input.state) || 0
          const min =
            typeof input.attributes.min === 'number' ? input.attributes.min : 0
          const max =
            typeof input.attributes.max === 'number' ? input.attributes.max : 100
          const step =
            typeof input.attributes.step === 'number' ? input.attributes.step : 1
          const unit =
            typeof input.attributes.unit_of_measurement === 'string'
              ? input.attributes.unit_of_measurement
              : ''
          const inputIcon = haWebSocket.getEntityIcon(input.entity_id)

          if (isInEditMode) {
            return (
              <div
                key={input.entity_id}
                className={clsx(
                  'px-2 py-2 rounded-lg bg-border/30',
                  'ring-1 ring-accent/30',
                  inputSelected && 'ring-2 ring-accent'
                )}
              >
                <div className="flex items-center gap-2">
                  <SelectionCheckbox
                    isSelected={inputSelected}
                    onToggle={() => onToggleSelection(input.entity_id)}
                  />
                  <button
                    onClick={() => onEdit(input)}
                    className="p-1 rounded-lg hover:bg-border/50 transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-muted" />
                  </button>
                  <span className="flex-1 text-sm font-medium text-foreground truncate">
                    {getEntityDisplayName(input)}
                  </span>
                </div>
              </div>
            )
          }

          return (
            <div key={input.entity_id} className="px-2 py-2 rounded-lg bg-border/30">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-border/50 text-muted flex-shrink-0">
                  {inputIcon ? (
                    <MdiIcon icon={inputIcon} className="w-5 h-5" />
                  ) : (
                    <SlidersHorizontal className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground truncate">
                      {getEntityDisplayName(input)}
                    </span>
                    <span className="text-xs text-muted tabular-nums ml-2">
                      {value}
                      {unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onNumberChange(input, parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer accent-accent"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
