import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { haptic } from '@/lib/haptics'

const LONG_PRESS_DURATION = 400
const MOVE_THRESHOLD = 10
const EDGE_THRESHOLD = 60 // Distance from screen edge to trigger floor navigation

interface ReorderableGridProps<T> {
  items: T[]
  renderItem: (item: T, index: number, isDragging: boolean, isActive: boolean) => React.ReactNode
  onReorder: (items: T[]) => void
  onClickOutside?: () => void
  /** Callback when dragging near screen edge (for cross-floor navigation) */
  onEdgeHover?: ((edge: 'left' | 'right' | null) => void) | null
  getKey: (item: T) => string
  columns?: number
  gap?: number
  className?: string
}

export function ReorderableGrid<T>({
  items,
  renderItem,
  onReorder,
  onClickOutside,
  onEdgeHover,
  getKey,
  columns = 2,
  gap = 12,
  className,
}: ReorderableGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })
  const [orderedItems, setOrderedItems] = useState<T[]>(items)
  const [cellSize, setCellSize] = useState({ width: 0, height: 0 })

  // Long-press state for drag activation
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingDragIndex, setPendingDragIndex] = useState<number | null>(null)
  const pendingDragPosRef = useRef({ x: 0, y: 0 })

  // Sync items when they change externally (but not while dragging)
  useEffect(() => {
    if (draggedIndex === null && pendingDragIndex === null) {
      setOrderedItems(items)
    }
  }, [items, draggedIndex, pendingDragIndex])

  // Measure cell width
  useLayoutEffect(() => {
    const measure = () => {
      if (!containerRef.current) return
      const width = containerRef.current.offsetWidth
      if (width === 0) return // Skip if not laid out yet
      const cellWidth = (width - gap * (columns - 1)) / columns
      setCellSize((prev) => ({ ...prev, width: cellWidth }))
    }

    measure()
    const rafId = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', measure)
    }
  }, [columns, gap])

  // Measure cell height from first rendered item using ResizeObserver
  useLayoutEffect(() => {
    if (!measureRef.current || cellSize.width === 0) return

    const measureHeight = () => {
      if (!measureRef.current) return
      const actualHeight = measureRef.current.offsetHeight
      if (actualHeight > 0 && actualHeight !== cellSize.height) {
        setCellSize((prev) => ({ ...prev, height: actualHeight }))
      }
    }

    // Measure immediately
    measureHeight()

    // Use ResizeObserver to catch async content loading (e.g., icons)
    const resizeObserver = new ResizeObserver(() => {
      measureHeight()
    })
    resizeObserver.observe(measureRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [cellSize.width, cellSize.height, orderedItems])

  // Calculate pixel position from index
  const getPositionFromIndex = useCallback(
    (index: number) => {
      const col = index % columns
      const row = Math.floor(index / columns)
      return {
        x: col * (cellSize.width + gap),
        y: row * (cellSize.height + gap),
      }
    },
    [columns, cellSize, gap]
  )

  // Calculate index from pointer position
  const getIndexFromPointer = useCallback(
    (clientX: number, clientY: number): number => {
      if (!containerRef.current || cellSize.width === 0) return 0

      const rect = containerRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top

      const col = Math.min(columns - 1, Math.max(0, Math.floor(x / (cellSize.width + gap))))
      const row = Math.max(0, Math.floor(y / (cellSize.height + gap)))
      const index = row * columns + col

      return Math.min(orderedItems.length - 1, Math.max(0, index))
    },
    [columns, gap, cellSize, orderedItems.length]
  )

  // Clear long-press timer
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setPendingDragIndex(null)
  }, [])

  // Handle drag start (called after long-press completes)
  const handleDragStart = useCallback((index: number, clientX: number, clientY: number) => {
    haptic.medium()
    setDraggedIndex(index)
    setDragStartPos({ x: clientX, y: clientY })
    setDragOffset({ x: 0, y: 0 })
  }, [])

  // Handle pointer down - start long-press timer
  const handlePointerDown = useCallback(
    (index: number, clientX: number, clientY: number) => {
      clearLongPressTimer()
      setPendingDragIndex(index)
      pendingDragPosRef.current = { x: clientX, y: clientY }

      longPressTimerRef.current = setTimeout(() => {
        handleDragStart(index, clientX, clientY)
        longPressTimerRef.current = null
      }, LONG_PRESS_DURATION)
    },
    [clearLongPressTimer, handleDragStart]
  )

  // Handle pointer cancel (movement before long-press completes)
  const handlePointerCancel = useCallback(() => {
    clearLongPressTimer()
  }, [clearLongPressTimer])

  // Check if pointer moved beyond threshold during long-press wait
  const checkLongPressMove = useCallback(
    (clientX: number, clientY: number): boolean => {
      if (pendingDragIndex === null || draggedIndex !== null) return false
      const dx = clientX - pendingDragPosRef.current.x
      const dy = clientY - pendingDragPosRef.current.y
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        handlePointerCancel()
        return true
      }
      return false
    },
    [pendingDragIndex, draggedIndex, handlePointerCancel]
  )

  // Track current edge hover state
  const lastEdgeRef = useRef<'left' | 'right' | null>(null)

  // Handle drag move
  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (draggedIndex === null) return

      setDragOffset({
        x: clientX - dragStartPos.x,
        y: clientY - dragStartPos.y,
      })

      // Edge detection for cross-floor navigation
      if (onEdgeHover) {
        let currentEdge: 'left' | 'right' | null = null
        if (clientX < EDGE_THRESHOLD) {
          currentEdge = 'left'
        } else if (clientX > window.innerWidth - EDGE_THRESHOLD) {
          currentEdge = 'right'
        }

        // Only call callback when edge state changes
        if (currentEdge !== lastEdgeRef.current) {
          lastEdgeRef.current = currentEdge
          onEdgeHover(currentEdge)
        }
      }

      const newTargetIndex = getIndexFromPointer(clientX, clientY)

      if (newTargetIndex !== draggedIndex) {
        // Reorder items
        const newItems = [...orderedItems]
        const [draggedItem] = newItems.splice(draggedIndex, 1)
        newItems.splice(newTargetIndex, 0, draggedItem)
        setOrderedItems(newItems)
        setDraggedIndex(newTargetIndex)

        // Adjust drag start position so the item stays under the cursor
        const oldPos = getPositionFromIndex(draggedIndex)
        const newPos = getPositionFromIndex(newTargetIndex)
        setDragStartPos((prev) => ({
          x: prev.x + (newPos.x - oldPos.x),
          y: prev.y + (newPos.y - oldPos.y),
        }))
      }
    },
    [
      draggedIndex,
      dragStartPos,
      getIndexFromPointer,
      orderedItems,
      getPositionFromIndex,
      onEdgeHover,
    ]
  )

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    clearLongPressTimer()
    if (draggedIndex !== null) {
      onReorder(orderedItems)
    }
    setDraggedIndex(null)
    setDragOffset({ x: 0, y: 0 })
    // Clear edge hover state
    if (onEdgeHover && lastEdgeRef.current !== null) {
      lastEdgeRef.current = null
      onEdgeHover(null)
    }
  }, [draggedIndex, orderedItems, onReorder, clearLongPressTimer, onEdgeHover])

  // Touch handlers
  const handleTouchStart = useCallback(
    (index: number) => (e: React.TouchEvent) => {
      const touch = e.touches[0]
      handlePointerDown(index, touch.clientX, touch.clientY)
    },
    [handlePointerDown]
  )

  // Use native event listener for touchmove to allow preventDefault with passive: false
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (checkLongPressMove(touch.clientX, touch.clientY)) return
      if (draggedIndex === null) return
      e.preventDefault()
      handleDragMove(touch.clientX, touch.clientY)
    }

    const handleTouchEnd = () => {
      handleDragEnd()
    }

    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [draggedIndex, checkLongPressMove, handleDragMove, handleDragEnd])

  // Mouse handlers
  const handleMouseDown = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      handlePointerDown(index, e.clientX, e.clientY)
    },
    [handlePointerDown]
  )

  useEffect(() => {
    if (draggedIndex === null && pendingDragIndex === null) return

    const handleMouseMove = (e: MouseEvent) => {
      if (checkLongPressMove(e.clientX, e.clientY)) return
      if (draggedIndex !== null) {
        handleDragMove(e.clientX, e.clientY)
      }
    }

    const handleMouseUp = () => {
      handleDragEnd()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggedIndex, pendingDragIndex, checkLongPressMove, handleDragMove, handleDragEnd])

  // Click outside to save
  useEffect(() => {
    if (!onClickOutside) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      // Don't trigger if clicking inside the grid
      if (containerRef.current?.contains(target)) return
      // Don't trigger if clicking inside the floating bar (edit mode header)
      const floatingBar = document.querySelector('.floating-bar')
      if (floatingBar?.contains(target)) return

      onClickOutside()
    }

    // Use a small delay to avoid triggering on the same event that entered reorder mode
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [onClickOutside])

  // Calculate container height
  const rows = Math.ceil(orderedItems.length / columns)
  const containerHeight = rows * cellSize.height + (rows - 1) * gap
  const isReady = cellSize.width > 0 && cellSize.height > 0

  return (
    <div
      ref={containerRef}
      className={clsx('relative', className)}
      style={{
        touchAction: draggedIndex !== null ? 'none' : 'auto',
        height: containerHeight > 0 ? containerHeight : 'auto',
      }}
    >
      {orderedItems.map((item, index) => {
        // First item always renders for measurement, others wait until ready
        if (index > 0 && !isReady) return null
        const key = getKey(item)
        const isDragging = draggedIndex === index
        const position = getPositionFromIndex(index)
        // Apply wiggle to non-dragged items when something is being dragged
        const shouldWiggle = draggedIndex !== null && !isDragging

        return (
          <motion.div
            key={key}
            ref={index === 0 ? measureRef : undefined}
            data-grid-item
            className={clsx('absolute', isDragging && 'z-50')}
            style={{
              top: 0,
              left: 0,
              width:
                cellSize.width > 0
                  ? cellSize.width
                  : `calc((100% - ${gap * (columns - 1)}px) / ${columns})`,
              visibility: isReady ? 'visible' : 'hidden',
            }}
            initial={false}
            animate={{
              x: position.x + (isDragging ? dragOffset.x : 0),
              y: position.y + (isDragging ? dragOffset.y : 0),
              scale: isDragging ? 1.05 : 1,
              boxShadow: isDragging ? '0 20px 40px rgba(0,0,0,0.2)' : '0 0 0 rgba(0,0,0,0)',
            }}
            transition={{
              x: isDragging
                ? { duration: 0 }
                : { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 },
              y: isDragging
                ? { duration: 0 }
                : { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 },
              scale: { duration: 0.15 },
              boxShadow: { duration: 0.15 },
            }}
            onTouchStart={handleTouchStart(index)}
            onMouseDown={handleMouseDown(index)}
          >
            <div className={clsx(shouldWiggle && (index % 2 === 0 ? 'wiggle' : 'wiggle-alt'))}>
              {renderItem(item, index, draggedIndex !== null, isDragging)}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
