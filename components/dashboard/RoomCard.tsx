'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { Lightbulb, Thermometer, ChevronDown, Home } from 'lucide-react'
import type { RoomWithDevices } from '@/types/ha'
import { RoomExpanded } from './RoomExpanded'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { useLightControl } from '@/lib/hooks/useLightControl'
import { t, interpolate } from '@/lib/i18n'

interface RoomCardProps {
  room: RoomWithDevices
  index: number
  isExpanded: boolean
  isReorderMode?: boolean
  isDeviceReorderMode?: boolean
  isDragging?: boolean
  isDragOver?: boolean
  onToggleExpand: () => void
  onExitDeviceReorderMode?: () => void
  onDragStart?: () => void
  onDragOver?: () => void
  onDrop?: () => void
  onDragEnd?: () => void
}

// Minimum drag distance to trigger brightness change (prevents accidental drags)
const DRAG_THRESHOLD = 10
// Pixels to move for full brightness range
const DRAG_RANGE = 200

export function RoomCard({
  room,
  index,
  isExpanded,
  isReorderMode = false,
  isDeviceReorderMode = false,
  isDragging = false,
  isDragOver = false,
  onToggleExpand,
  onExitDeviceReorderMode,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: RoomCardProps) {
  const { setRoomBrightness, getAverageBrightness, toggleRoomLights } = useLightControl()

  const lights = room.devices.filter((d) => d.entity_id.startsWith('light.'))
  const hasLights = lights.length > 0
  const hasLightsOn = room.lightsOn > 0
  const initialBrightness = getAverageBrightness(lights)

  const [isBrightnessDragging, setIsBrightnessDragging] = useState(false)
  const [localBrightness, setLocalBrightness] = useState(initialBrightness)
  const [showBrightnessOverlay, setShowBrightnessOverlay] = useState(false)

  const dragStartRef = useRef<{ x: number; brightness: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const didDragRef = useRef(false)

  // Scroll to center when expanded
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      // Small delay to let the expansion animation start
      setTimeout(() => {
        cardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }, 50)
    }
  }, [isExpanded])

  // Swipe gesture handlers - disabled when expanded
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!hasLights || isReorderMode || isExpanded) return

    didDragRef.current = false
    dragStartRef.current = {
      x: e.clientX,
      brightness: isBrightnessDragging ? localBrightness : getAverageBrightness(lights),
    }
    setLocalBrightness(dragStartRef.current.brightness)
  }, [hasLights, isBrightnessDragging, localBrightness, getAverageBrightness, lights, isReorderMode, isExpanded])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isReorderMode) return

    if (!dragStartRef.current || !hasLights) return

    const deltaX = e.clientX - dragStartRef.current.x

    // Check if we've crossed the drag threshold for brightness control
    if (!isBrightnessDragging && Math.abs(deltaX) > DRAG_THRESHOLD) {
      didDragRef.current = true
      setIsBrightnessDragging(true)
      setShowBrightnessOverlay(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    if (isBrightnessDragging) {
      // Calculate new brightness based on drag distance
      const brightnessChange = (deltaX / DRAG_RANGE) * 100
      const newBrightness = Math.max(0, Math.min(100, dragStartRef.current.brightness + brightnessChange))
      setLocalBrightness(Math.round(newBrightness))
      setRoomBrightness(lights, Math.round(newBrightness))
    }
  }, [hasLights, isBrightnessDragging, lights, setRoomBrightness, isReorderMode])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isBrightnessDragging) {
      // Commit the brightness change
      setRoomBrightness(lights, localBrightness, true)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

      // Hide overlay after a short delay
      setTimeout(() => setShowBrightnessOverlay(false), 300)
    }

    setIsBrightnessDragging(false)
    dragStartRef.current = null
  }, [isBrightnessDragging, lights, localBrightness, setRoomBrightness])

  // Handle card click - toggle lights if collapsed, do nothing if expanded (header handles collapse)
  const handleCardClick = useCallback(() => {
    if (isReorderMode || didDragRef.current) return
    if (isExpanded) return // Header area handles collapse
    if (!hasLights) return
    toggleRoomLights(lights)
  }, [hasLights, isReorderMode, isExpanded, lights, toggleRoomLights])

  // Handle header click - collapse if expanded, otherwise let card click handle it
  const handleHeaderClick = useCallback((e: React.MouseEvent) => {
    if (isReorderMode || didDragRef.current) return
    if (isExpanded) {
      e.stopPropagation()
      onToggleExpand()
    }
  }, [isReorderMode, isExpanded, onToggleExpand])

  // Display brightness - use local when dragging, otherwise calculate from actual state
  const displayBrightness = isBrightnessDragging ? localBrightness : initialBrightness

  const cardClassName = clsx(
    'card w-full text-left relative overflow-hidden',
    'transition-all duration-200',
    isExpanded ? 'p-4 col-span-2' : 'px-4 py-1.5',
    isReorderMode && 'cursor-grab active:cursor-grabbing',
    isDragging && 'opacity-50 scale-95',
    isDragOver && 'ring-2 ring-accent scale-105'
  )

  const cardContent = (
    <>
      {/* Brightness fill background - hidden when expanded */}
      {hasLights && hasLightsOn && !isExpanded && (
        <motion.div
          className="absolute inset-0 origin-left pointer-events-none rounded-card"
          style={{ backgroundColor: 'var(--brightness-fill)' }}
          initial={false}
          animate={{
            scaleX: displayBrightness / 100,
          }}
          transition={{ duration: isBrightnessDragging ? 0 : 0.3 }}
        />
      )}

      {/* Brightness percentage overlay - hidden when expanded */}
      <AnimatePresence>
        {showBrightnessOverlay && !isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm z-10 pointer-events-none"
          >
            <span className="text-4xl font-bold text-accent">
              {displayBrightness}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card content */}
      <div className="relative z-0">
        {/* Header row - icon left, name centered */}
        <div
          className={clsx(
            'flex items-center -ml-2',
            isExpanded ? 'mb-2 cursor-pointer' : 'mb-1'
          )}
          onClick={handleHeaderClick}
        >
          <div
            className={clsx(
              'rounded-xl transition-colors flex-shrink-0 z-10',
              isExpanded ? 'p-2.5' : 'p-2',
              hasLightsOn
                ? 'bg-accent/20 text-accent'
                : 'bg-border/50 text-muted'
            )}
          >
            {room.icon ? (
              <MdiIcon icon={room.icon} className={isExpanded ? 'w-5 h-5' : 'w-4 h-4'} />
            ) : (
              <Home className={isExpanded ? 'w-5 h-5' : 'w-4 h-4'} />
            )}
          </div>
          <h3 className="font-semibold text-foreground truncate flex-1 text-center pl-2 pr-1">
            {room.name}
          </h3>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted">
          {room.totalLights > 0 && (
            <span className="flex items-center gap-1">
              <Lightbulb
                className={clsx(
                  'w-3.5 h-3.5',
                  hasLightsOn ? 'text-accent' : 'text-muted'
                )}
              />
              <span>
                {hasLightsOn
                  ? interpolate(t.devices.lightsOn, { count: room.lightsOn })
                  : t.devices.lightsOff}
              </span>
            </span>
          )}

          {room.temperature !== undefined && (
            <span className="flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5" />
              <span>{room.temperature.toFixed(1)}°</span>
            </span>
          )}

          </div>

          {!isReorderMode && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand()
              }}
              className="p-1.5 -mr-1.5 rounded-lg hover:bg-border/50 transition-colors touch-feedback"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-muted" />
              </motion.div>
            </button>
          )}
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && !isReorderMode && (
            <RoomExpanded
              room={room}
              isReorderMode={isDeviceReorderMode}
              onExitReorderMode={onExitDeviceReorderMode}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  )

  if (isReorderMode) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', String(index))
          onDragStart?.()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onDragOver?.()
        }}
        onDrop={(e) => {
          e.preventDefault()
          onDrop?.()
        }}
        onDragEnd={() => {
          onDragEnd?.()
        }}
        className={cardClassName}
      >
        {cardContent}
      </div>
    )
  }

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.3,
        layout: { duration: 0.2 }
      }}
      className={clsx(cardClassName, hasLights && !isExpanded && 'cursor-pointer')}
      onClick={handleCardClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'pan-y' }}
    >
      {cardContent}
    </motion.div>
  )
}
