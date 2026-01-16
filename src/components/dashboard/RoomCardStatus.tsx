import { motion } from 'framer-motion'
import { Lightbulb, LightbulbOff, Thermometer, ChevronDown } from 'lucide-react'
import { t, interpolate } from '@/lib/i18n'

interface RoomCardStatusProps {
  temperature?: number
  totalLights: number
  lightsOn: number
  displayLightsOn: boolean
  isOptimistic: boolean
  isExpanded: boolean
  isInEditMode: boolean
  isDeviceInEditMode: boolean
  onToggleExpand: () => void
  onExitEditMode: () => void
}

export function RoomCardStatus({
  temperature,
  totalLights,
  lightsOn,
  displayLightsOn,
  isOptimistic,
  isExpanded,
  isInEditMode,
  isDeviceInEditMode,
  onToggleExpand,
  onExitEditMode,
}: RoomCardStatusProps) {
  return (
    <div className="relative flex items-center justify-between">
      <div className="flex items-center gap-3 text-sm text-muted pointer-events-none">
        {temperature !== undefined ? (
          <span className="flex items-center gap-1">
            <Thermometer className="w-3.5 h-3.5" />
            <span>{temperature.toFixed(1)}°</span>
          </span>
        ) : (
          totalLights > 0 && (
            <span className="flex items-center gap-1">
              {displayLightsOn ? (
                <Lightbulb className="w-3.5 h-3.5 text-accent" />
              ) : (
                <LightbulbOff className="w-3.5 h-3.5 text-muted" />
              )}
              <span>
                {displayLightsOn
                  ? interpolate(t.devices.lightsOn, {
                      count: isOptimistic ? totalLights : lightsOn,
                    })
                  : t.devices.lightsOff}
              </span>
            </span>
          )
        )}
      </div>

      {/* Expand/collapse button */}
      {!isInEditMode && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (isExpanded && isDeviceInEditMode) onExitEditMode()
            onToggleExpand()
          }}
          className="absolute inset-0 -mx-4 -my-2 px-4 py-2 flex items-center justify-end hover:bg-border/30 transition-colors touch-feedback"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-muted" />
          </motion.div>
        </button>
      )}
    </div>
  )
}
