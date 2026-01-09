'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, Reorder } from 'framer-motion'
import { Thermometer, Droplets, Sparkles, GripVertical } from 'lucide-react'
import { clsx } from 'clsx'
import type { RoomWithDevices, HAEntity } from '@/types/ha'
import { LightSlider } from './LightSlider'
import { useHAConnection } from '@/lib/hooks/useHAConnection'
import { useDeviceOrder } from '@/lib/hooks/useDeviceOrder'
import { t } from '@/lib/i18n'

interface RoomExpandedProps {
  room: RoomWithDevices
  isReorderMode?: boolean
  onExitReorderMode?: () => void
}

export function RoomExpanded({ room, isReorderMode = false, onExitReorderMode }: RoomExpandedProps) {
  const { callService } = useHAConnection()
  const { sortDevicesByOrder, reorderDevices } = useDeviceOrder()

  // Filter and sort devices by type and order
  const lights = sortDevicesByOrder(room.devices.filter((d) => d.entity_id.startsWith('light.')))
  const scenes = room.devices.filter((d) => d.entity_id.startsWith('scene.'))

  const [orderedLights, setOrderedLights] = useState<HAEntity[]>(lights)

  // Sync orderedLights when lights change or reorder mode changes
  useEffect(() => {
    setOrderedLights(lights)
  }, [lights, isReorderMode])

  // Save order when reorder mode exits
  const handleReorder = useCallback(async (newOrder: HAEntity[]) => {
    setOrderedLights(newOrder)

    // Find which item moved and save
    const originalOrder = lights.map((l, i) => ({ entity_id: l.entity_id, index: i }))
    for (let i = 0; i < newOrder.length; i++) {
      const original = originalOrder.find(o => o.entity_id === newOrder[i].entity_id)
      if (original && original.index !== i) {
        await reorderDevices(lights, original.index, i)
        break
      }
    }
  }, [lights, reorderDevices])

  const handleSceneActivate = (scene: HAEntity) => {
    callService('scene', 'turn_on', { entity_id: scene.entity_id })
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="pt-3 mt-3 border-t border-border">
        {/* Scenes */}
        {scenes.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
              {t.devices.scenes}
            </h4>
            <div className="flex flex-wrap gap-2">
              {scenes.map((scene) => (
                <button
                  key={scene.entity_id}
                  onClick={() => handleSceneActivate(scene)}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-sm font-medium',
                    'bg-border/50 hover:bg-accent/20 hover:text-accent',
                    'transition-colors touch-feedback',
                    'flex items-center gap-1.5'
                  )}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {scene.attributes.friendly_name || scene.entity_id.split('.')[1]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lights */}
        {lights.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
              {t.devices.lights}
            </h4>
            {isReorderMode ? (
              <Reorder.Group
                axis="y"
                values={orderedLights}
                onReorder={handleReorder}
                className="space-y-1"
              >
                {orderedLights.map((light) => (
                  <Reorder.Item
                    key={light.entity_id}
                    value={light}
                    className="flex items-center gap-2 cursor-grab active:cursor-grabbing bg-card rounded-lg pl-2"
                    whileDrag={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  >
                    <GripVertical className="w-4 h-4 text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <LightSlider light={light} disabled />
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            ) : (
              <div className="space-y-1">
                {lights.map((light) => (
                  <LightSlider key={light.entity_id} light={light} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sensors */}
        {(room.temperature !== undefined || room.humidity !== undefined) && (
          <div className="flex items-center gap-4 text-sm text-muted pt-2">
            {room.temperature !== undefined && (
              <span className="flex items-center gap-1.5">
                <Thermometer className="w-4 h-4" />
                {room.temperature.toFixed(1)}°C
              </span>
            )}
            {room.humidity !== undefined && (
              <span className="flex items-center gap-1.5">
                <Droplets className="w-4 h-4" />
                {room.humidity}%
              </span>
            )}
          </div>
        )}

        {/* Empty state */}
        {lights.length === 0 && scenes.length === 0 && (
          <p className="text-sm text-muted py-2">
            {t.rooms.noDevices}
          </p>
        )}
      </div>
    </motion.div>
  )
}
