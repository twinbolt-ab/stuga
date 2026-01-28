import { Thermometer, Droplets } from 'lucide-react'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { getEntityIcon } from '@/lib/ha-websocket'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { t } from '@/lib/i18n'
import { formatTemperature } from '@/lib/temperature'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface SensorItemProps {
  sensor: HAEntity
  fallbackIcon: React.ReactNode
  value: string
  isInEditMode: boolean
  isSelected: boolean
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
}

function SensorItem({
  sensor,
  fallbackIcon,
  value,
  isInEditMode,
  isSelected,
  onToggleSelection,
  onEnterEditModeWithSelection,
}: SensorItemProps) {
  const customIcon = getEntityIcon(sensor.entity_id)

  const longPress = useLongPress({
    duration: 500,
    disabled: isInEditMode,
    onLongPress: () => onEnterEditModeWithSelection?.(sensor.entity_id),
  })

  const iconElement = customIcon ? <MdiIcon icon={customIcon} className="w-4 h-4" /> : fallbackIcon

  if (isInEditMode) {
    return (
      <button
        onClick={() => {
          onToggleSelection(sensor.entity_id)
        }}
        className="w-full px-3 py-2.5 rounded-xl bg-border/30 touch-feedback"
      >
        <div className="flex items-center gap-2">
          <SelectionCheckbox isSelected={isSelected} />
          <div className="p-1.5 rounded-lg bg-border/50 text-muted flex-shrink-0">
            {iconElement}
          </div>
          <span className="flex-1 text-sm font-medium text-foreground truncate text-left">
            {getEntityDisplayName(sensor)}
          </span>
          <span className="text-sm text-muted tabular-nums">{value}</span>
        </div>
      </button>
    )
  }

  return (
    <div
      className="px-3 py-2.5 rounded-xl bg-border/30"
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerUp}
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-border/50 text-muted flex-shrink-0">{iconElement}</div>
        <span className="flex-1 text-sm font-medium text-foreground truncate">
          {getEntityDisplayName(sensor)}
        </span>
        <span className="text-sm text-muted tabular-nums">{value}</span>
      </div>
    </div>
  )
}

interface SensorsDisplayProps {
  temperatureSensors: HAEntity[]
  humiditySensors: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
}

export function SensorsDisplay({
  temperatureSensors,
  humiditySensors,
  isInEditMode,
  isSelected,
  onToggleSelection,
  onEnterEditModeWithSelection,
}: SensorsDisplayProps) {
  if (temperatureSensors.length === 0 && humiditySensors.length === 0) {
    return null
  }

  return (
    <div className="mb-4">
      <SectionHeader>{t.domains.sensor}</SectionHeader>
      <div className="space-y-2">
        {temperatureSensors.map((sensor) => (
          <SensorItem
            key={sensor.entity_id}
            sensor={sensor}
            fallbackIcon={<Thermometer className="w-4 h-4" />}
            value={formatTemperature(parseFloat(sensor.state))}
            isInEditMode={isInEditMode}
            isSelected={isSelected(sensor.entity_id)}
            onToggleSelection={onToggleSelection}
            onEnterEditModeWithSelection={onEnterEditModeWithSelection}
          />
        ))}
        {humiditySensors.map((sensor) => (
          <SensorItem
            key={sensor.entity_id}
            sensor={sensor}
            fallbackIcon={<Droplets className="w-4 h-4" />}
            value={`${Math.round(parseFloat(sensor.state))}%`}
            isInEditMode={isInEditMode}
            isSelected={isSelected(sensor.entity_id)}
            onToggleSelection={onToggleSelection}
            onEnterEditModeWithSelection={onEnterEditModeWithSelection}
          />
        ))}
      </div>
    </div>
  )
}
