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
  /** When true, disables drag-to-reorder (items are static, no long-press activation) */
  reorderingDisabled?: boolean
  /** Callback when dragging near screen edge (for cross-floor navigation) */
  onEdgeHover?: ((edge: 'left' | 'right' | null) => void) | null
  /** Called when a drag starts, with the item being dragged */
  onDragStart?: (item: T, index: number) => void
  /** Called when drag ends (after onReorder if applicable) */
  onDragEnd?: (item: T) => void
  /** Called continuously during drag with current pointer position */
  onDragPosition?: (clientX: number, clientY: number) => void
  /**
   * Key of item being dragged externally (e.g., cross-floor drag continuation).
   * When set, the grid will initialize drag state for this item at externalDragPosition.
   */
  externalDragKey?: string | null
  /**
   * Current drag position when continuing an external drag.
   * Used with externalDragKey to position the item under the user's finger.
   */
  externalDragPosition?: { x: number; y: number } | null
  /** Keys of selected items for multi-drag support */
  selectedKeys?: Set<string>
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
  reorderingDisabled = false,
  onEdgeHover,
  onDragStart: onDragStartCallback,
  onDragEnd: onDragEndCallback,
  onDragPosition,
  externalDragKey,
  externalDragPosition,
  selectedKeys,
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
  // Multi-drag state: indices of all items being dragged together (sorted by position)
  const [draggedIndices, setDraggedIndices] = useState<number[]>([])

  // Long-press state for drag activation
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingDragIndex, setPendingDragIndex] = useState<number | null>(null)
  const pendingDragPosRef = useRef({ x: 0, y: 0 })

  // Track previous items for change detection
  const [prevItems, setPrevItems] = useState(items)

  // Sync items when they change externally (but not while dragging)
  // React-recommended pattern: adjust state during render based on prop changes
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (prevItems !== items) {
    setPrevItems(items)
    const isExternalDrag = externalDragKey !== null && externalDragKey !== undefined
    if (draggedIndex === null && pendingDragIndex === null) {
      setOrderedItems(items)
    } else if (isExternalDrag) {
      // External drag sync (cross-floor continuation):
      // When items change during an external drag (externalDragKey is set), we must:
      // 1. Sync the new items (e.g., new floor's rooms)
      // 2. Reset draggedIndex to null so the useEffect can re-initialize drag state
      // This makes the dragged item appear under the user's finger on the new floor.
      setOrderedItems(items)
      setDraggedIndex(null)
    }
  }

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

  // Handle external drag continuation (e.g., cross-floor drag):
  // When externalDragKey matches an item, initialize drag state to make the item appear under the finger
  useEffect(() => {
    if (!externalDragKey || !externalDragPosition || draggedIndex !== null) return

    // Find the item with the matching key
    const itemIndex = orderedItems.findIndex((item) => getKey(item) === externalDragKey)
    if (itemIndex === -1) return

    // Get container position to calculate relative coordinates
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()

    // Calculate where the finger is relative to the container
    const fingerX = externalDragPosition.x - rect.left
    const fingerY = externalDragPosition.y - rect.top

    // Calculate the grid position of the item
    const gridPos = getPositionFromIndex(itemIndex)

    // The offset is the difference between finger position and item's grid center
    // This makes the item appear centered under the finger
    const offsetX = fingerX - gridPos.x - cellSize.width / 2
    const offsetY = fingerY - gridPos.y - cellSize.height / 2

    // Set up the drag state so the item appears under the finger
    // dragOffset = fingerPos - gridPos - center => item appears at fingerPos - center
    setDraggedIndex(itemIndex)
    setDragStartPos({ x: externalDragPosition.x - offsetX, y: externalDragPosition.y - offsetY })
    setDragOffset({ x: offsetX, y: offsetY })

    // Rebuild draggedIndices for multi-drag after floor switch
    if (selectedKeys && selectedKeys.size > 1) {
      const newDraggedIndices = orderedItems
        .map((item, i) => ({ key: getKey(item), index: i }))
        .filter(({ key }) => selectedKeys.has(key))
        .map(({ index }) => index)
        .sort((a, b) => a - b)
      if (newDraggedIndices.length > 1) {
        setDraggedIndices(newDraggedIndices)
      } else {
        setDraggedIndices([itemIndex])
      }
    } else {
      setDraggedIndices([itemIndex])
    }
  }, [
    externalDragKey,
    externalDragPosition,
    orderedItems,
    getKey,
    draggedIndex,
    getPositionFromIndex,
    cellSize,
    selectedKeys,
  ])

  // Clear long-press timer
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setPendingDragIndex(null)
  }, [])

  // Handle drag start (called after long-press completes)
  const handleDragStart = useCallback(
    (index: number, clientX: number, clientY: number) => {
      haptic.medium()
      setDraggedIndex(index)
      setDragStartPos({ x: clientX, y: clientY })
      setDragOffset({ x: 0, y: 0 })

      // Check if this item is part of a multi-selection
      const itemKey = getKey(orderedItems[index])
      const isPartOfMultiSelection = selectedKeys?.has(itemKey) && selectedKeys.size > 1

      if (isPartOfMultiSelection) {
        // Get all selected items in their current order (by index)
        const selectedIndices = orderedItems
          .map((item, i) => ({ key: getKey(item), index: i }))
          .filter(({ key }) => selectedKeys!.has(key))
          .map(({ index }) => index)
          .sort((a, b) => a - b)
        setDraggedIndices(selectedIndices)
      } else {
        // Single item drag
        setDraggedIndices([index])
      }

      // Notify parent of drag start
      onDragStartCallback?.(orderedItems[index], index)
    },
    [orderedItems, onDragStartCallback, selectedKeys, getKey]
  )

  // Handle pointer down - start long-press timer
  const handlePointerDown = useCallback(
    (index: number, clientX: number, clientY: number) => {
      // Skip if reordering is disabled
      if (reorderingDisabled) return

      clearLongPressTimer()
      setPendingDragIndex(index)
      pendingDragPosRef.current = { x: clientX, y: clientY }

      longPressTimerRef.current = setTimeout(() => {
        handleDragStart(index, clientX, clientY)
        longPressTimerRef.current = null
      }, LONG_PRESS_DURATION)
    },
    [reorderingDisabled, clearLongPressTimer, handleDragStart]
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

      // Notify parent of drag position (for floor tab hit testing)
      onDragPosition?.(clientX, clientY)

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
      const isMultiDrag = draggedIndices.length > 1

      if (isMultiDrag && draggedIndex !== null) {
        // Multi-drag: move all selected items as a contiguous block
        // Find the position of the primary dragged item within the selection
        const primaryPositionInSelection = draggedIndices.indexOf(draggedIndex)

        // Safety check: if primary item isn't in draggedIndices or indices are out of bounds,
        // skip multi-drag reordering for this frame (keep visual stacking)
        if (primaryPositionInSelection === -1) {
          return
        }

        // Validate all indices are within bounds
        const allIndicesValid = draggedIndices.every((i) => i >= 0 && i < orderedItems.length)
        if (!allIndicesValid) {
          // Indices are stale (e.g., after floor switch), skip reordering for this frame
          return
        }

        // Calculate where the block should start
        const blockStartIndex = Math.max(
          0,
          Math.min(
            orderedItems.length - draggedIndices.length,
            newTargetIndex - primaryPositionInSelection
          )
        )

        // Check if block position has changed
        const currentBlockStart = draggedIndices[0]
        if (blockStartIndex !== currentBlockStart) {
          // Extract the dragged items (in their current order within draggedIndices)
          const draggedItems = draggedIndices.map((i) => orderedItems[i])
          // Create new array without the dragged items
          const newItems = orderedItems.filter((_, i) => !draggedIndices.includes(i))
          // Insert the block at the new position
          newItems.splice(blockStartIndex, 0, ...draggedItems)
          setOrderedItems(newItems)

          // Update indices - all dragged items now occupy contiguous positions starting at blockStartIndex
          const newDraggedIndices = draggedIndices.map((_, i) => blockStartIndex + i)
          setDraggedIndices(newDraggedIndices)
          // Update the primary dragged index
          const newPrimaryIndex = blockStartIndex + primaryPositionInSelection
          setDraggedIndex(newPrimaryIndex)

          // Adjust drag start position so the item stays under the cursor
          const oldPos = getPositionFromIndex(draggedIndex)
          const newPos = getPositionFromIndex(newPrimaryIndex)
          setDragStartPos((prev) => ({
            x: prev.x + (newPos.x - oldPos.x),
            y: prev.y + (newPos.y - oldPos.y),
          }))
        }
      } else if (newTargetIndex !== draggedIndex && draggedIndex !== null) {
        // Single item drag (original behavior)
        const newItems = [...orderedItems]
        const [draggedItem] = newItems.splice(draggedIndex, 1)
        newItems.splice(newTargetIndex, 0, draggedItem)
        setOrderedItems(newItems)
        setDraggedIndex(newTargetIndex)
        setDraggedIndices([newTargetIndex])

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
      draggedIndices,
      dragStartPos,
      getIndexFromPointer,
      orderedItems,
      getPositionFromIndex,
      onEdgeHover,
      onDragPosition,
    ]
  )

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    clearLongPressTimer()
    const draggedItem = draggedIndex !== null ? orderedItems[draggedIndex] : null

    if (draggedIndex !== null) {
      onReorder(orderedItems)
    }
    setDraggedIndex(null)
    setDraggedIndices([])
    setDragOffset({ x: 0, y: 0 })
    // Clear edge hover state
    if (onEdgeHover && lastEdgeRef.current !== null) {
      lastEdgeRef.current = null
      onEdgeHover(null)
    }

    // Notify parent of drag end
    if (draggedItem) {
      onDragEndCallback?.(draggedItem)
    }
  }, [draggedIndex, orderedItems, onReorder, clearLongPressTimer, onEdgeHover, onDragEndCallback])

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

  // Multi-drag state
  const isMultiDrag = draggedIndices.length > 1
  const primaryDragPosition = draggedIndex !== null ? getPositionFromIndex(draggedIndex) : null

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
        const isPrimaryDrag = draggedIndex === index
        const isSecondaryDrag = isMultiDrag && draggedIndices.includes(index) && !isPrimaryDrag
        const isDragging = isPrimaryDrag || isSecondaryDrag
        const position = getPositionFromIndex(index)

        // Calculate stacking offset for secondary dragged items (Finder-style)
        let stackOffset = { x: 0, y: 0 }
        let stackScale = 1
        let stackZIndex = 0
        if (isSecondaryDrag && primaryDragPosition) {
          const stackPosition = draggedIndices.indexOf(index)
          // Offset each secondary item by 5px in both directions (cascading stack)
          stackOffset = {
            x: (stackPosition + 1) * 5,
            y: (stackPosition + 1) * 5,
          }
          // Slightly smaller scale for stacked items
          stackScale = 0.98 - stackPosition * 0.01
          // Lower z-index than primary (50), decreasing for each item in stack
          stackZIndex = 45 - stackPosition
        }

        // Apply wiggle only to non-dragged items when something is being dragged
        const shouldWiggle = draggedIndex !== null && !isDragging

        // Calculate target position
        let targetX = position.x
        let targetY = position.y
        let targetScale = 1
        let targetShadow = '0 0 0 rgba(0,0,0,0)'

        if (isPrimaryDrag) {
          // Primary dragged item follows the finger
          targetX = position.x + dragOffset.x
          targetY = position.y + dragOffset.y
          targetScale = 1.05
          targetShadow = '0 20px 40px rgba(0,0,0,0.2)'
        } else if (isSecondaryDrag && primaryDragPosition) {
          // Secondary items animate to stack behind the primary
          targetX = primaryDragPosition.x + dragOffset.x + stackOffset.x
          targetY = primaryDragPosition.y + dragOffset.y + stackOffset.y
          targetScale = stackScale
          targetShadow = '0 10px 20px rgba(0,0,0,0.15)'
        }

        return (
          <motion.div
            key={key}
            ref={index === 0 ? measureRef : undefined}
            data-grid-item
            className={clsx(
              'absolute',
              isPrimaryDrag && 'z-50',
              isSecondaryDrag && `z-[${stackZIndex}]`
            )}
            style={{
              top: 0,
              left: 0,
              width:
                cellSize.width > 0
                  ? cellSize.width
                  : `calc((100% - ${gap * (columns - 1)}px) / ${columns})`,
              visibility: isReady ? 'visible' : 'hidden',
              zIndex: isPrimaryDrag ? 50 : isSecondaryDrag ? stackZIndex : undefined,
            }}
            initial={false}
            animate={{
              x: targetX,
              y: targetY,
              scale: targetScale,
              boxShadow: targetShadow,
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
