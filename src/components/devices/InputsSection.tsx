import { ToggleLeft, SlidersHorizontal } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { DeviceToggleButton } from '@/components/ui/DeviceToggleButton'
import { haWebSocket } from '@/lib/ha-websocket'
import { useLongPress } from '@/lib/hooks/useLongPress'
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
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
}

function InputNumberItem({
  input,
  isInEditMode,
  isSelected,
  onNumberChange,
  onToggleSelection,
  onEnterEditModeWithSelection,
}: {
  input: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onNumberChange: (device: HAEntity, value: number) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
}) {
  const value = parseFloat(input.state) || 0
  const min = typeof input.attributes.min === 'number' ? input.attributes.min : 0
  const max = typeof input.attributes.max === 'number' ? input.attributes.max : 100
  const step = typeof input.attributes.step === 'number' ? input.attributes.step : 1
  const unit = typeof input.attributes.unit_of_measurement === 'string' ? input.attributes.unit_of_measurement : ''
  const inputIcon = haWebSocket.getEntityIcon(input.entity_id)

  const longPress = useLongPress({
    duration: 500,
    disabled: isInEditMode,
    onLongPress: () => onEnterEditModeWithSelection?.(input.entity_id),
  })

  if (isInEditMode) {
    return (
      <button
        onClick={() => onToggleSelection(input.entity_id)}
        className="w-full px-2 py-2 rounded-lg bg-border/30 touch-feedback"
      >
        <div className="flex items-center gap-2">
          <SelectionCheckbox isSelected={isSelected} />
          <div className="p-2 rounded-lg bg-border/50 text-muted flex-shrink-0">
            {inputIcon ? (
              <MdiIcon icon={inputIcon} className="w-5 h-5" />
            ) : (
              <SlidersHorizontal className="w-5 h-5" />
            )}
          </div>
          <span className="flex-1 text-sm font-medium text-foreground truncate text-left">
            {getEntityDisplayName(input)}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div
      className="px-2 py-2 rounded-lg bg-border/30"
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerUp}
    >
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
}

export function InputsSection({
  inputBooleans,
  inputNumbers,
  isInEditMode,
  isSelected,
  onBooleanToggle,
  onNumberChange,
  onToggleSelection,
  onEnterEditModeWithSelection,
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
            onToggleSelection={() => onToggleSelection(input.entity_id)}
            onEnterEditModeWithSelection={() => onEnterEditModeWithSelection?.(input.entity_id)}
            fallbackIcon={<ToggleLeft className="w-5 h-5" />}
          />
        ))}

        {/* Input Numbers (sliders) */}
        {inputNumbers.map((input) => (
          <InputNumberItem
            key={input.entity_id}
            input={input}
            isInEditMode={isInEditMode}
            isSelected={isSelected(input.entity_id)}
            onNumberChange={onNumberChange}
            onToggleSelection={onToggleSelection}
            onEnterEditModeWithSelection={onEnterEditModeWithSelection}
          />
        ))}
      </div>
    </div>
  )
}
