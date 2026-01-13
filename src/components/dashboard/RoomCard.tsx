import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { Lightbulb, Thermometer, ChevronDown, Home, Check, Pencil, GripVertical } from 'lucide-react'
import type { RoomWithDevices } from '@/types/ha'
import { RoomExpanded } from './RoomExpanded'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { useLightControl } from '@/lib/hooks/useLightControl'
import { useEditMode } from '@/lib/contexts/EditModeContext'
import { t, interpolate } from '@/lib/i18n'

interface RoomCardProps {
  room: RoomWithDevices
  allRooms?: RoomWithDevices[]
  index: number
  isExpanded: boolean
  isDragging?: boolean
  isDragOver?: boolean
  onToggleExpand: () => void
  onEdit?: () => void
  onDragStart?: () => void
  onDragOver?: () => void
  onDrop?: () => void
  onDragEnd?: () => void
}

// Minimum drag distance to trigger brightness change (prevents accidental drags)
const DRAG_THRESHOLD = 10

// Margins for brightness slider (0% at left margin, 100% at right margin)
const SLIDER_MARGIN = 24

export function RoomCard({
  room,
  allRooms = [],
  index,
  isExpanded,
  isDragging = false,
  isDragOver = false,
  onToggleExpand,
  onEdit,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: RoomCardProps) {
  const { setRoomBrightness, getAverageBrightness, toggleRoomLights } = useLightControl()

  // Get edit mode state from context
  const {
    mode,
    isRoomEditMode,
    isDeviceEditMode,
    isSelected,
    toggleSelection,
    exitEditMode,
  } = useEditMode()

  // Derive if this card is in an edit mode
  const isInEditMode = isRoomEditMode
  const isThisRoomSelected = isSelected(room.id)

  // Check if this room is in device edit mode
  const isDeviceInEditMode = isDeviceEditMode && mode.type === 'edit-devices' && mode.roomId === room.id

  const lights = room.devices.filter((d) => d.entity_id.startsWith('light.'))
  const hasLights = lights.length > 0
  const hasLightsOn = room.lightsOn > 0
  const initialBrightness = getAverageBrightness(lights)

  const [isBrightnessDragging, setIsBrightnessDragging] = useState(false)
  const [localBrightness, setLocalBrightness] = useState(initialBrightness)
  const [showBrightnessOverlay, setShowBrightnessOverlay] = useState(false)

  const dragStartRef = useRef<{ x: number; y: number; brightness: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const didDragRef = useRef(false)

  // Scroll when expanded if card would extend below visible area
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      // Store initial card position before animation
      const initialRect = cardRef.current.getBoundingClientRect()
      const initialCardTop = window.scrollY + initialRect.top

      setTimeout(() => {
        const card = cardRef.current
        if (!card) return

        const rect = card.getBoundingClientRect()
        // Account for bottom nav bar (~80px) when calculating visible area
        const visibleHeight = window.innerHeight - 80

        console.log('Expand scroll check:', { bottom: rect.bottom, visibleHeight, shouldScroll: rect.bottom > visibleHeight })

        // If bottom of card is below visible area, scroll top of card to top of screen
        if (rect.bottom > visibleHeight) {
          console.log('Scrolling to:', initialCardTop - 16)
          // Use initial card position for scroll target (before layout shift)
          window.scrollTo({
            top: Math.max(0, initialCardTop - 16),
            behavior: 'smooth',
          })
        }
      }, 300) // Wait for expand animation to complete
    }
  }, [isExpanded])

  // Swipe gesture handlers - disabled when expanded
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!hasLights || isInEditMode || isExpanded) return

    didDragRef.current = false
    const currentBrightness = isBrightnessDragging ? localBrightness : getAverageBrightness(lights)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      brightness: currentBrightness,
    }
    setLocalBrightness(currentBrightness)
  }, [hasLights, isBrightnessDragging, localBrightness, getAverageBrightness, lights, isInEditMode, isExpanded])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isInEditMode) return

    if (!dragStartRef.current || !hasLights) return

    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y

    if (!isBrightnessDragging) {
      if (Math.abs(deltaY) > DRAG_THRESHOLD) {
        dragStartRef.current = null
        return
      }

      if (Math.abs(deltaX) > DRAG_THRESHOLD) {
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          dragStartRef.current = null
          return
        }
        didDragRef.current = true
        setIsBrightnessDragging(true)
        setShowBrightnessOverlay(true)
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      }
    }

    if (isBrightnessDragging) {
      // Stretched scale mapping:
      // - Left margin = 0%, right margin = 100%
      // - Touch start position = starting brightness
      // - Scale stretches/compresses on each side to make this work
      const leftEdge = SLIDER_MARGIN
      const rightEdge = window.innerWidth - SLIDER_MARGIN
      const startX = dragStartRef.current.x
      const startBrightness = dragStartRef.current.brightness

      let newBrightness: number

      if (e.clientX <= startX) {
        // Dragging left: map [leftEdge, startX] to [0%, startBrightness%]
        const range = startX - leftEdge
        if (range > 0) {
          const ratio = (e.clientX - leftEdge) / range
          newBrightness = ratio * startBrightness
        } else {
          newBrightness = 0
        }
      } else {
        // Dragging right: map [startX, rightEdge] to [startBrightness%, 100%]
        const range = rightEdge - startX
        if (range > 0) {
          const ratio = (e.clientX - startX) / range
          newBrightness = startBrightness + ratio * (100 - startBrightness)
        } else {
          newBrightness = 100
        }
      }

      newBrightness = Math.max(0, Math.min(100, newBrightness))
      setLocalBrightness(Math.round(newBrightness))
      setRoomBrightness(lights, Math.round(newBrightness))
    }
  }, [hasLights, isBrightnessDragging, lights, setRoomBrightness, isInEditMode])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isBrightnessDragging) {
      setRoomBrightness(lights, localBrightness, true)
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      setTimeout(() => setShowBrightnessOverlay(false), 300)
    }

    setIsBrightnessDragging(false)
    dragStartRef.current = null
  }, [isBrightnessDragging, lights, localBrightness, setRoomBrightness])

  const handleCardClick = useCallback(() => {
    if (isInEditMode || didDragRef.current) return
    if (isExpanded) return
    if (!hasLights) return
    toggleRoomLights(lights)
  }, [hasLights, isInEditMode, isExpanded, lights, toggleRoomLights])

  const handleHeaderClick = useCallback((e: React.MouseEvent) => {
    if (isInEditMode || didDragRef.current) return
    if (isExpanded) {
      e.stopPropagation()
      // Exit device edit mode when collapsing this room
      if (isDeviceInEditMode) {
        exitEditMode()
      }
      onToggleExpand()
    }
  }, [isInEditMode, isExpanded, isDeviceInEditMode, exitEditMode, onToggleExpand])

  const handleToggleSelection = useCallback(() => {
    toggleSelection(room.id)
  }, [toggleSelection, room.id])

  const displayBrightness = isBrightnessDragging ? localBrightness : initialBrightness

  const cardClassName = clsx(
    'card w-full text-left relative overflow-hidden',
    !isInEditMode && 'transition-all duration-200',
    isExpanded ? 'p-4 col-span-2' : 'px-4 py-1.5',
    isInEditMode && 'cursor-grab active:cursor-grabbing',
    isDragging && 'opacity-50 scale-95',
    isDragOver && 'ring-2 ring-accent scale-105',
    isThisRoomSelected && 'ring-2 ring-accent'
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
          {/* Selection checkbox and edit button in edit mode */}
          {isInEditMode && (
            <div className="flex items-center gap-1 mr-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleSelection()
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className={clsx(
                  'w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                  isThisRoomSelected
                    ? 'bg-accent text-white'
                    : 'bg-accent/20 ring-1 ring-inset ring-accent/40'
                )}
              >
                {isThisRoomSelected && <Check className="w-3 h-3" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit?.()
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-muted hover:text-accent transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <GripVertical className="w-4 h-4 text-muted flex-shrink-0" />
            </div>
          )}
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
              <MdiIcon icon={room.icon} className={isExpanded ? 'w-6 h-6' : 'w-5 h-5'} />
            ) : (
              <Home className={isExpanded ? 'w-6 h-6' : 'w-5 h-5'} />
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

          {!isInEditMode && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                // Exit device edit mode when collapsing this room
                if (isExpanded && isDeviceInEditMode) {
                  exitEditMode()
                }
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
          {isExpanded && !isInEditMode && (
            <RoomExpanded
              room={room}
              allRooms={allRooms}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  )

  if (isInEditMode) {
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
      layout="position"
      initial={false}
      transition={{
        layout: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }
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
