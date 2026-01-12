'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lightbulb, LightbulbOff } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { useLightControl } from '@/lib/hooks/useLightControl'
import { haWebSocket } from '@/lib/ha-websocket'

// Minimum drag distance to trigger brightness change
const DRAG_THRESHOLD = 10

interface LightSliderProps {
  light: HAEntity
  disabled?: boolean
}

export function LightSlider({ light, disabled = false }: LightSliderProps) {
  const { setLightBrightness, toggleLight, getLightBrightness } = useLightControl()
  const initialBrightness = getLightBrightness(light)
  const [localBrightness, setLocalBrightness] = useState(initialBrightness)
  const [isDragging, setIsDragging] = useState(false)
  const [showBrightnessOverlay, setShowBrightnessOverlay] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; y: number; brightness: number } | null>(null)

  const isOn = light.state === 'on'
  const displayName = light.attributes.friendly_name || light.entity_id.split('.')[1]
  const entityIcon = haWebSocket.getEntityIcon(light.entity_id)

  // Swipe gesture handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      brightness: isDragging ? localBrightness : initialBrightness,
    }
    setLocalBrightness(dragStartRef.current.brightness)
  }, [disabled, isDragging, localBrightness, initialBrightness])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || disabled) return

    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y

    // If not yet dragging, check gesture direction
    if (!isDragging) {
      // If vertical movement exceeds threshold first, cancel tracking to allow scroll
      if (Math.abs(deltaY) > DRAG_THRESHOLD) {
        dragStartRef.current = null
        return
      }

      // Check if we've crossed the drag threshold for brightness control
      if (Math.abs(deltaX) > DRAG_THRESHOLD) {
        // Only start brightness drag if horizontal movement is dominant
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          dragStartRef.current = null
          return
        }
        setIsDragging(true)
        setShowBrightnessOverlay(true)
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      }
    }

    if (isDragging) {
      // Map screen position to brightness with padding for easier mobile use
      // 0% starts at 24px from left, 100% ends at 24px from right
      // Dragging past these points still clamps to 0% or 100%
      const padding = 24
      const screenWidth = window.innerWidth
      const effectiveWidth = screenWidth - padding * 2
      const relativeX = e.clientX - padding
      const newBrightness = Math.max(0, Math.min(100, (relativeX / effectiveWidth) * 100))
      setLocalBrightness(Math.round(newBrightness))
      setLightBrightness(light.entity_id, Math.round(newBrightness))
    }
  }, [disabled, isDragging, light.entity_id, setLightBrightness])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDragging) {
      // Commit the brightness change
      setLightBrightness(light.entity_id, localBrightness, true)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

      // Hide overlay after a short delay
      setTimeout(() => setShowBrightnessOverlay(false), 300)
    }

    setIsDragging(false)
    dragStartRef.current = null
  }, [isDragging, light.entity_id, localBrightness, setLightBrightness])

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled || isDragging) return
    toggleLight(light.entity_id)
  }, [light.entity_id, toggleLight, disabled, isDragging])

  // Sync local state with actual state when not dragging
  const displayBrightness = isDragging ? localBrightness : initialBrightness

  return (
    <div
      ref={cardRef}
      className="relative rounded-lg overflow-hidden bg-card"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Brightness fill background */}
      {isOn && (
        <motion.div
          className="absolute inset-0 origin-left pointer-events-none"
          style={{ backgroundColor: 'var(--brightness-fill)' }}
          initial={false}
          animate={{
            scaleX: displayBrightness / 100,
          }}
          transition={{ duration: isDragging ? 0 : 0.3 }}
        />
      )}

      {/* Brightness percentage overlay */}
      <AnimatePresence>
        {showBrightnessOverlay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm z-10 pointer-events-none"
          >
            <span className="text-2xl font-bold text-accent">
              {displayBrightness}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-0 flex items-center gap-3 py-2 px-2">
        {/* Toggle button */}
        <button
          onClick={handleToggle}
          className={clsx(
            'p-2 rounded-lg transition-colors touch-feedback',
            isOn
              ? 'bg-accent/20 text-accent'
              : 'bg-border/50 text-muted hover:bg-border'
          )}
          aria-label={`Toggle ${displayName}`}
        >
          {entityIcon ? (
            <MdiIcon icon={entityIcon} className="w-5 h-5" />
          ) : isOn ? (
            <Lightbulb className="w-5 h-5" />
          ) : (
            <LightbulbOff className="w-5 h-5" />
          )}
        </button>

        {/* Light name and brightness */}
        <div className="flex-1 min-w-0 flex items-center justify-between">
          <span className="text-sm font-medium truncate">{displayName}</span>
          <span className="text-xs text-muted ml-2">
            {isOn ? `${displayBrightness}%` : 'Off'}
          </span>
        </div>
      </div>
    </div>
  )
}
