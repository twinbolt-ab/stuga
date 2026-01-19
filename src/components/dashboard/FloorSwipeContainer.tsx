import { useLayoutEffect, useCallback, useMemo, memo } from 'react'
import {
  motion,
  useMotionValue,
  animate,
  useDragControls,
  useReducedMotion,
  PanInfo,
} from 'framer-motion'
import type { HAFloor } from '@/types/ha'
import { useWindowWidth } from '@/lib/hooks/useWindowWidth'
import { scrollTo } from '@/lib/constants'

// Spring animation config for floor transitions
const SPRING_CONFIG = { type: 'spring', stiffness: 300, damping: 30 } as const

// Placeholder for non-visible floors to maintain layout
const FloorPlaceholder = memo(function FloorPlaceholder({ width }: { width: number }) {
  return (
    <div
      style={{
        width: width > 0 ? width : '100vw',
        flexShrink: 0,
      }}
    />
  )
})

// Minimum height for swipeable area
// Account for: safe-area-top + py-4 padding (32px top+bottom) at top, pb-nav (5rem + safe-area-bottom) at bottom
const MIN_HEIGHT =
  'calc(100vh - env(safe-area-inset-top, 0px) - 32px - 5rem - env(safe-area-inset-bottom, 0px))'

interface FloorSwipeContainerProps {
  /** All floors in order */
  floors: HAFloor[]
  /** Whether there are uncategorized rooms */
  hasUncategorized: boolean
  /** Currently selected floor ID (or null for uncategorized) */
  selectedFloorId: string | null
  /** Callback when floor selection changes */
  onSelectFloor: (floorId: string | null) => void
  /** Render function for floor content */
  children: (floorId: string | null, floorIndex: number) => React.ReactNode
  /** Whether swipe is disabled (e.g., during edit mode) */
  disabled?: boolean
}

export function FloorSwipeContainer({
  floors,
  hasUncategorized,
  selectedFloorId,
  onSelectFloor,
  children,
  disabled = false,
}: FloorSwipeContainerProps) {
  const prefersReducedMotion = useReducedMotion()
  const width = useWindowWidth()
  const x = useMotionValue(0)
  const dragControls = useDragControls()

  // Build list of floor IDs (including uncategorized at end if present)
  const floorIds = useMemo((): (string | null)[] => {
    const ids: (string | null)[] = floors.map((f) => f.floor_id)
    if (hasUncategorized) {
      ids.push(null) // null represents uncategorized
    }
    return ids
  }, [floors, hasUncategorized])

  // Get current index from selected floor ID
  const currentIndex = useMemo(() => {
    if (selectedFloorId === null || selectedFloorId === '__all_devices__') {
      const idx = floorIds.indexOf(null)
      return idx >= 0 ? idx : 0
    }
    const idx = floorIds.indexOf(selectedFloorId)
    return idx >= 0 ? idx : 0
  }, [selectedFloorId, floorIds])

  // Snap to current floor when index changes externally (tab click) or width changes
  useLayoutEffect(() => {
    if (width > 0) {
      const targetX = -currentIndex * width
      if (prefersReducedMotion) {
        x.set(targetX)
      } else {
        animate(x, targetX, SPRING_CONFIG)
      }
    }
  }, [currentIndex, width, x, prefersReducedMotion])

  // Track which floors are "visible" (current + adjacent) for rendering optimization
  const visibleRange = useMemo(
    () => ({
      start: Math.max(0, currentIndex - 1),
      end: Math.min(floorIds.length - 1, currentIndex + 1),
    }),
    [currentIndex, floorIds.length]
  )

  // Handle drag end - determine target floor
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (width === 0) return

      const velocity = info.velocity.x
      const offset = info.offset.x

      let targetIndex = currentIndex

      // Velocity-based navigation (fast swipe)
      if (Math.abs(velocity) > 500) {
        targetIndex = velocity > 0 ? currentIndex - 1 : currentIndex + 1
      }
      // Distance-based navigation (slow drag past 25% threshold)
      else if (Math.abs(offset) > width * 0.25) {
        targetIndex = offset > 0 ? currentIndex - 1 : currentIndex + 1
      }

      // Clamp to valid range
      targetIndex = Math.max(0, Math.min(floorIds.length - 1, targetIndex))

      if (targetIndex !== currentIndex) {
        // Navigate to new floor
        const newFloorId = floorIds[targetIndex]
        onSelectFloor(newFloorId)
        // Scroll to top when changing floors (instant to avoid jank)
        scrollTo({ top: 0 })
      } else {
        // Snap back to current floor
        const targetX = -currentIndex * width
        if (prefersReducedMotion) {
          x.set(targetX)
        } else {
          animate(x, targetX, SPRING_CONFIG)
        }
      }
    },
    [width, currentIndex, floorIds, onSelectFloor, x, prefersReducedMotion]
  )

  // Handle pointer down - only start drag on empty areas
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return

      const target = e.target as HTMLElement
      // Don't start drag if touching a card or interactive element
      if (target.closest('.card, button, input, nav, [role="button"], a')) {
        return
      }

      // Start the drag
      dragControls.start(e.nativeEvent)
    },
    [disabled, dragControls]
  )

  // Don't render until we have width and floors
  if (floorIds.length === 0) {
    return <>{children(null, 0)}</>
  }

  // Single floor - no swipe needed, just render content
  if (floorIds.length === 1) {
    return <>{children(floorIds[0], 0)}</>
  }

  // Calculate drag constraints
  const dragConstraints = {
    left: -(floorIds.length - 1) * width,
    right: 0,
  }

  return (
    <div className="overflow-hidden" style={{ touchAction: 'pan-y', minHeight: MIN_HEIGHT }}>
      <motion.div
        className="flex h-full"
        style={{ x, minHeight: MIN_HEIGHT }}
        drag={disabled ? false : 'x'}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={width > 0 ? dragConstraints : undefined}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        onPointerDown={handlePointerDown}
      >
        {floorIds.map((floorId, index) => {
          // Only render floors within visible range (current ± 1)
          const isVisible = index >= visibleRange.start && index <= visibleRange.end

          if (!isVisible) {
            return <FloorPlaceholder key={floorId ?? '__uncategorized__'} width={width} />
          }

          return (
            <div
              key={floorId ?? '__uncategorized__'}
              style={{
                width: width > 0 ? width : '100vw',
                flexShrink: 0,
                minHeight: MIN_HEIGHT,
              }}
            >
              {children(floorId, index)}
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}
