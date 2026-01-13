import { useState, useRef, useCallback, useEffect } from 'react'
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
  compact?: boolean
}

export function LightSlider({ light, disabled = false, compact = false }: LightSliderProps) {
  const { setLightBrightness, toggleLight, getLightBrightness } = useLightControl()
  const initialBrightness = getLightBrightness(light)
  const [localBrightness, setLocalBrightness] = useState(initialBrightness)
  const [isDragging, setIsDragging] = useState(false)
  const [showBrightnessOverlay, setShowBrightnessOverlay] = useState(false)
  const [useOptimisticValue, setUseOptimisticValue] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; y: number; brightness: number } | null>(null)
  const currentBrightnessRef = useRef(initialBrightness)
  const isDraggingRef = useRef(false)
  const optimisticTimerRef = useRef<NodeJS.Timeout | null>(null)

  const isOn = light.state === 'on'
  const displayName = light.attributes.friendly_name || light.entity_id.split('.')[1]
  const entityIcon = haWebSocket.getEntityIcon(light.entity_id)

  // Swipe gesture handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return

    // Use local brightness if dragging or in optimistic period, otherwise use HA value
    const startBrightness = isDragging || useOptimisticValue ? localBrightness : initialBrightness
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      brightness: startBrightness,
    }
    setLocalBrightness(startBrightness)
  }, [disabled, isDragging, useOptimisticValue, localBrightness, initialBrightness])

  const calculateBrightness = useCallback((clientX: number) => {
    // Map screen position to brightness with padding for easier mobile use
    // 0% starts at 24px from left, 100% ends at 24px from right
    // Dragging past these points still clamps to 0% or 100%
    const padding = 24
    const screenWidth = window.innerWidth
    const effectiveWidth = screenWidth - padding * 2
    const relativeX = clientX - padding
    return Math.round(Math.max(0, Math.min(100, (relativeX / effectiveWidth) * 100)))
  }, [])

  const updateBrightness = useCallback((clientX: number) => {
    const newBrightness = calculateBrightness(clientX)
    currentBrightnessRef.current = newBrightness
    setLocalBrightness(newBrightness)
    setLightBrightness(light.entity_id, newBrightness)
  }, [calculateBrightness, light.entity_id, setLightBrightness])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || disabled) return

    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y

    // If not yet dragging, check gesture direction
    if (!isDraggingRef.current) {
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
        isDraggingRef.current = true
        setIsDragging(true)
        setShowBrightnessOverlay(true)
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        // Update brightness immediately when starting drag
        updateBrightness(e.clientX)
      }
    } else {
      updateBrightness(e.clientX)
    }
  }, [disabled, updateBrightness])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      // Calculate final brightness from the release position
      const finalBrightness = calculateBrightness(e.clientX)
      currentBrightnessRef.current = finalBrightness
      setLocalBrightness(finalBrightness)

      // Commit the brightness change
      setLightBrightness(light.entity_id, finalBrightness, true)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

      // Use optimistic value for 5 seconds, then sync with HA
      setUseOptimisticValue(true)
      if (optimisticTimerRef.current) {
        clearTimeout(optimisticTimerRef.current)
      }
      optimisticTimerRef.current = setTimeout(() => {
        setUseOptimisticValue(false)
        optimisticTimerRef.current = null
      }, 5000)

      // Hide overlay after a short delay
      setTimeout(() => setShowBrightnessOverlay(false), 300)
    }

    isDraggingRef.current = false
    setIsDragging(false)
    dragStartRef.current = null
  }, [calculateBrightness, light.entity_id, setLightBrightness])

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled || isDragging) return
    toggleLight(light.entity_id)
  }, [light.entity_id, toggleLight, disabled, isDragging])

  // Cleanup optimistic timer on unmount
  useEffect(() => {
    return () => {
      if (optimisticTimerRef.current) {
        clearTimeout(optimisticTimerRef.current)
      }
    }
  }, [])

  // Show local brightness while dragging or during optimistic period, otherwise use HA value
  const displayBrightness = isDragging || useOptimisticValue ? localBrightness : initialBrightness

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

      <div className={clsx(
        'relative z-0 flex items-center py-2',
        compact ? 'gap-2 px-1.5' : 'gap-3 px-2'
      )}>
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
