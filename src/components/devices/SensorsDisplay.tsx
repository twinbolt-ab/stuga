import { Thermometer, Droplets } from 'lucide-react'
import type { HAEntity } from '@/types/ha'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface SensorsDisplayProps {
  temperatureSensors: HAEntity[]
  humiditySensors: HAEntity[]
}

export function SensorsDisplay({
  temperatureSensors,
  humiditySensors,
}: SensorsDisplayProps) {
  if (temperatureSensors.length === 0 && humiditySensors.length === 0) {
    return null
  }

  return (
    <div className="text-sm text-muted pt-2 space-y-1">
      {/* Temperature sensors */}
      {temperatureSensors.length === 1 ? (
        <span className="flex items-center gap-1.5">
          <Thermometer className="w-4 h-4" />
          {parseFloat(temperatureSensors[0].state).toFixed(1)}°C
        </span>
      ) : temperatureSensors.length > 1 ? (
        <div className="space-y-0.5">
          {temperatureSensors.map((sensor) => (
            <div key={sensor.entity_id} className="flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{getEntityDisplayName(sensor)}</span>
              <span className="ml-auto tabular-nums">
                {parseFloat(sensor.state).toFixed(1)}°C
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Humidity sensors */}
      {humiditySensors.length === 1 ? (
        <span className="flex items-center gap-1.5">
          <Droplets className="w-4 h-4" />
          {Math.round(parseFloat(humiditySensors[0].state))}%
        </span>
      ) : humiditySensors.length > 1 ? (
        <div className="space-y-0.5">
          {humiditySensors.map((sensor) => (
            <div key={sensor.entity_id} className="flex items-center gap-1.5">
              <Droplets className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{getEntityDisplayName(sensor)}</span>
              <span className="ml-auto tabular-nums">
                {Math.round(parseFloat(sensor.state))}%
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
