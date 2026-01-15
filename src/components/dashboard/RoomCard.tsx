import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { Lightbulb, LightbulbOff, Thermometer, ChevronDown, Home, Check } from 'lucide-react'
import type { RoomWithDevices, HAEntity } from '@/types/ha'
import { RoomExpanded } from './RoomExpanded'
import { RoomCardScenes } from './RoomCardScenes'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { useLightControl } from '@/lib/hooks/useLightControl'
import { useEditMode } from '@/lib/contexts/EditModeContext'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { useOptimisticState } from '@/lib/hooks/useOptimisticState'
import { useBrightnessGesture } from '@/lib/hooks/useBrightnessGesture'
import { useHAConnection } from '@/lib/hooks/useHAConnection'
import { t, interpolate } from '@/lib/i18n'
import { LONG_PRESS_DURATION, OPTIMISTIC_DURATION } from '@/lib/constants'

interface RoomCardProps {
  room: RoomWithDevices
  allRooms?: RoomWithDevices[]
  isExpanded: boolean
  shouldShowScenes?: boolean
  onToggleExpand: () => void
  onEnterEditModeWithSelection?: (roomId: string) => void
}

export function RoomCard({
  room,
  allRooms = [],
  isExpanded,
  shouldShowScenes = false,
  onToggleExpand,
  onEnterEditModeWithSelection,
}: RoomCardProps) {
  const { setRoomBrightness, getAverageBrightness, toggleRoomLights, getLightBrightnessMap, calculateRelativeBrightness } = useLightControl()
  const { callService } = useHAConnection()

  // Get edit mode state from context
  const {
    mode,
    isRoomEditMode,
    isDeviceEditMode,
    isSelected,
    toggleSelection,
    exitEditMode,
  } = useEditMode()

  // Derive edit mode states
  const isInEditMode = isRoomEditMode
  const isThisRoomSelected = isSelected(room.id)
  const isDeviceInEditMode = isDeviceEditMode && mode.type === 'edit-devices' && mode.roomId === room.id

  // Check if this room should be blurred (another room is being edited)
  const isOtherRoomInDeviceEdit = isDeviceEditMode && mode.type === 'edit-devices' && mode.roomId !== room.id
  const shouldBlur = isOtherRoomInDeviceEdit

  // Delayed width state for sequenced animation
  // On expand: width changes immediately
  // On collapse: width changes after height animation (0.2s delay)
  const [isWidthExpanded, setIsWidthExpanded] = useState(isExpanded)
  useEffect(() => {
    if (isExpanded) {
      // Expand: change width immediately
      setIsWidthExpanded(true)
    } else {
      // Collapse: delay width change until after height animation
      const timer = setTimeout(() => setIsWidthExpanded(false), 200)
      return () => clearTimeout(timer)
    }
  }, [isExpanded])

  // Room data
  const lights = room.devices.filter((d) => d.entity_id.startsWith('light.'))
  const switches = room.devices.filter((d) => d.entity_id.startsWith('switch.'))
  const hasLights = lights.length > 0
  const hasSwitches = switches.length > 0
  const hasControllableDevices = hasLights || hasSwitches
  const hasLightsOn = room.lightsOn > 0
  const hasSwitchesOn = switches.some((s) => s.state === 'on')
  const hasDevicesOn = hasLightsOn || hasSwitchesOn
  const initialBrightness = getAverageBrightness(lights)

  // Scenes for collapsed card view
  const scenes = useMemo(
    () => room.devices.filter((d) => d.entity_id.startsWith('scene.')),
    [room.devices]
  )
  // Show scenes row when shouldShowScenes is enabled and not expanded
  const showScenesRow = shouldShowScenes && !isExpanded

  // Scene activation handler
  const handleSceneActivate = useCallback((scene: HAEntity, e: React.MouseEvent) => {
    e.stopPropagation()
    callService('scene', 'turn_on', { entity_id: scene.entity_id })
  }, [callService])

  // Refs
  const cardRef = useRef<HTMLDivElement>(null)

  // Optimistic states
  const brightnessState = useOptimisticState<number>({
    actualValue: initialBrightness,
    duration: OPTIMISTIC_DURATION,
  })

  const lightsOnState = useOptimisticState<boolean>({
    actualValue: hasLightsOn,
    duration: OPTIMISTIC_DURATION,
  })

  // Brightness gesture hook for collapsed card
  const brightnessGesture = useBrightnessGesture({
    lights,
    disabled: isInEditMode || isExpanded || !hasLights,
    currentBrightness: brightnessState.displayValue,
    onBrightnessChange: brightnessState.setOptimistic,
    getAverageBrightness,
    getLightBrightnessMap,
    calculateRelativeBrightness,
    setRoomBrightness,
  })

  // Brightness gesture hook for expanded card slider
  const expandedBrightnessGesture = useBrightnessGesture({
    lights,
    disabled: isInEditMode || !isExpanded || !hasLights,
    currentBrightness: brightnessState.displayValue,
    onBrightnessChange: brightnessState.setOptimistic,
    getAverageBrightness,
    getLightBrightnessMap,
    calculateRelativeBrightness,
    setRoomBrightness,
  })

  // Long press for entering edit mode and selecting this room
  const handleLongPress = useCallback(() => {
    onEnterEditModeWithSelection?.(room.id)
  }, [onEnterEditModeWithSelection, room.id])

  const longPress = useLongPress({
    duration: LONG_PRESS_DURATION,
    disabled: isInEditMode || isExpanded,
    onLongPress: handleLongPress,
  })

  // Scroll when expanded if card would extend below visible area
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      const initialRect = cardRef.current.getBoundingClientRect()
      const initialCardTop = window.scrollY + initialRect.top

      setTimeout(() => {
        const card = cardRef.current
        if (!card) return

        const rect = card.getBoundingClientRect()
        const visibleHeight = window.innerHeight - 80 // Account for bottom nav

        if (rect.bottom > visibleHeight) {
          window.scrollTo({
            top: Math.max(0, initialCardTop - 16),
            behavior: 'smooth',
          })
        }
      }, 300)
    }
  }, [isExpanded])

  // Combined pointer handlers (long-press + brightness gesture)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    longPress.onPointerDown(e)
    brightnessGesture.onPointerDown(e)
  }, [longPress, brightnessGesture])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    longPress.onPointerMove(e)
    brightnessGesture.onPointerMove(e)
  }, [longPress, brightnessGesture])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    longPress.onPointerUp()
    if (!longPress.didLongPress) {
      brightnessGesture.onPointerUp(e)
    }
  }, [longPress, brightnessGesture])

  // Card click - toggle lights (or exit edit mode if blurred)
  const handleCardClick = useCallback(() => {
    if (brightnessGesture.didDragRef.current) return

    // If this room is blurred (another room in device edit mode), exit edit mode
    if (shouldBlur) {
      exitEditMode()
      return
    }

    if (isInEditMode || isExpanded || !hasControllableDevices) return

    const willTurnOn = !hasDevicesOn
    lightsOnState.setOptimistic(willTurnOn)
    brightnessState.setOptimistic(willTurnOn ? 100 : 0)
    toggleRoomLights(lights, switches)
  }, [hasControllableDevices, hasDevicesOn, isInEditMode, isExpanded, shouldBlur, exitEditMode, lightsOnState, brightnessState, toggleRoomLights, lights, switches])

  // Header click - collapse when expanded
  const handleHeaderClick = useCallback((e: React.MouseEvent) => {
    if (isInEditMode || brightnessGesture.didDragRef.current) return
    if (isExpanded) {
      e.stopPropagation()
      if (isDeviceInEditMode) exitEditMode()
      onToggleExpand()
    }
  }, [isInEditMode, isExpanded, isDeviceInEditMode, exitEditMode, onToggleExpand])

  const handleToggleSelection = useCallback(() => {
    toggleSelection(room.id)
  }, [toggleSelection, room.id])

  // Display values
  const displayBrightness = brightnessState.displayValue
  const displayLightsOn = lightsOnState.displayValue

  const cardClassName = clsx(
    'card w-full text-left relative overflow-hidden',
    isWidthExpanded ? 'col-span-2' : '',
    isThisRoomSelected && 'ring-2 ring-accent',
    shouldBlur && 'opacity-40 blur-[1px]'
  )

  const cardContent = (
    <>
      {/* Brightness fill background */}
      {hasLights && displayLightsOn && !isExpanded && (
        <motion.div
          className="absolute inset-0 origin-left pointer-events-none rounded-card"
          style={{ backgroundColor: 'var(--brightness-fill)' }}
          initial={false}
          animate={{ scaleX: displayBrightness / 100 }}
          transition={{ duration: brightnessGesture.isDragging ? 0 : 0.3 }}
        />
      )}

      {/* Brightness percentage overlay */}
      <AnimatePresence>
        {brightnessGesture.showOverlay && !isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm z-10 pointer-events-none"
          >
            <span className="text-4xl font-bold text-accent">{displayBrightness}%</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card content */}
      <div className="relative z-0">
        {/* Header row */}
        <div
          className={clsx(
            'flex items-center relative',
            isExpanded ? '-mx-4 px-2 mb-2 py-1.5 -mt-4 pt-3 cursor-ew-resize' : '-ml-2 mb-1'
          )}
          onClick={handleHeaderClick}
          onPointerDown={isExpanded && hasLights && !isInEditMode ? expandedBrightnessGesture.onPointerDown : undefined}
          onPointerMove={isExpanded && hasLights && !isInEditMode ? expandedBrightnessGesture.onPointerMove : undefined}
          onPointerUp={isExpanded && hasLights && !isInEditMode ? expandedBrightnessGesture.onPointerUp : undefined}
          onPointerCancel={isExpanded && hasLights && !isInEditMode ? expandedBrightnessGesture.onPointerUp : undefined}
          style={isExpanded && hasLights ? { touchAction: 'pan-y' } : undefined}
        >
          {/* Brightness fill background for expanded card */}
          {isExpanded && hasLights && displayLightsOn && (
            <motion.div
              className="absolute inset-0 origin-left pointer-events-none rounded-t-card"
              style={{ backgroundColor: 'var(--brightness-fill)' }}
              initial={false}
              animate={{ scaleX: displayBrightness / 100 }}
              transition={{ duration: expandedBrightnessGesture.isDragging ? 0 : 0.3 }}
            />
          )}
          {/* Brightness percentage overlay when dragging */}
          <AnimatePresence>
            {isExpanded && expandedBrightnessGesture.showOverlay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm pointer-events-none z-20 rounded-t-card"
              >
                <span className="text-3xl font-bold text-accent">{displayBrightness}%</span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Edit mode controls */}
          {isInEditMode && (
            <div className="flex items-center gap-1 mr-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleSelection() }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className={clsx(
                  'w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                  isThisRoomSelected ? 'bg-accent text-white' : 'bg-accent/20 ring-1 ring-inset ring-accent/40'
                )}
              >
                {isThisRoomSelected && <Check className="w-3 h-3" />}
              </button>
            </div>
          )}

          {/* Room icon */}
          <div
            className={clsx(
              'rounded-xl transition-colors flex-shrink-0 z-10',
              isExpanded ? 'p-2.5' : 'p-1.5',
              displayLightsOn ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
            )}
          >
            {room.icon ? (
              <MdiIcon icon={room.icon} className={isExpanded ? 'w-6 h-6' : 'w-7 h-7'} />
            ) : (
              <Home className={isExpanded ? 'w-6 h-6' : 'w-7 h-7'} />
            )}
          </div>

          {/* Room name */}
          <h3 className="font-semibold text-foreground truncate flex-1 text-center pl-2 pr-1 relative z-10">
            {room.name}
          </h3>
        </div>

        {/* Scenes row - shows for all cards when enabled to maintain consistent height */}
        {showScenesRow && (
          <RoomCardScenes
            scenes={scenes}
            isInEditMode={isInEditMode}
            onSceneActivate={handleSceneActivate}
          />
        )}

        {/* Status row */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted pointer-events-none">
            {room.temperature !== undefined ? (
              <span className="flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5" />
                <span>{room.temperature.toFixed(1)}°</span>
              </span>
            ) : hasControllableDevices && (
              <span className="flex items-center gap-1">
                {hasDevicesOn ? (
                  <Lightbulb className="w-3.5 h-3.5 text-accent" />
                ) : (
                  <LightbulbOff className="w-3.5 h-3.5 text-muted" />
                )}
                <span>
                  {hasDevicesOn
                    ? interpolate(t.devices.lightsOn, {
                        count: lightsOnState.isOptimistic
                          ? lights.length + switches.length
                          : room.lightsOn + switches.filter(s => s.state === 'on').length
                      })
                    : t.devices.lightsOff}
                </span>
              </span>
            )}
          </div>

          {/* Expand/collapse button */}
          {!isInEditMode && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (isExpanded && isDeviceInEditMode) exitEditMode()
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

        {/* Expanded content - always rendered for height measurement */}
        {!isInEditMode && (
          <RoomExpanded room={room} allRooms={allRooms} isExpanded={isExpanded} />
        )}
      </div>
    </>
  )

  // Edit mode: use regular div (ReorderableGrid handles drag via touch/pointer events)
  if (isInEditMode) {
    return (
      <div
        onClick={handleToggleSelection}
        className={cardClassName}
        style={{ padding: '6px 16px' }}
      >
        {cardContent}
      </div>
    )
  }

  // Normal mode: use motion.div with gesture handlers
  return (
    <motion.div
      ref={cardRef}
      layout="position"
      initial={false}
      animate={{
        padding: isWidthExpanded ? '16px' : '6px 16px',
      }}
      transition={{
        layout: { duration: 0.12, ease: [0.25, 0.1, 0.25, 1] },
        padding: { duration: 0.12, ease: [0.25, 0.1, 0.25, 1] },
      }}
      className={clsx(cardClassName, hasControllableDevices && !isExpanded && 'cursor-pointer')}
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
