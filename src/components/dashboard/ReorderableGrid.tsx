import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { useGridMeasurement } from '@/lib/hooks/useGridMeasurement'
import { useGridDrag } from '@/lib/hooks/useGridDrag'

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

// Animation spring config for grid items
const SPRING_CONFIG = { stiffness: 500, damping: 30, mass: 0.8 }

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
  // Grid measurement
  const {
    containerRef,
    measureRef,
    cellSize,
    isReady,
    containerHeight,
    getPositionFromIndex,
    getIndexFromPointer,
    getCellWidth,
  } = useGridMeasurement({
    columns,
    gap,
    itemCount: items.length,
  })

  // Drag state and handlers
  const {
    orderedItems,
    draggedIndex,
    draggedIndices,
    dragOffset,
    handleTouchStart,
    handleMouseDown,
  } = useGridDrag({
    items,
    getKey,
    containerRef,
    cellSize,
    getPositionFromIndex,
    getIndexFromPointer,
    onReorder,
    onDragStartCallback,
    onDragEndCallback,
    onDragPosition,
    onEdgeHover,
    reorderingDisabled,
    selectedKeys,
    externalDragKey,
    externalDragPosition,
  })

  // Click outside to save
  useEffect(() => {
    if (!onClickOutside) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      const floatingBar = document.querySelector('.floating-bar')
      if (floatingBar?.contains(target)) return

      onClickOutside()
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [onClickOutside, containerRef])

  // Multi-drag state
  const isMultiDrag = draggedIndices.length > 1
  const primaryDragPosition = draggedIndex !== null ? getPositionFromIndex(draggedIndex) : null

  // Ghost placeholder positions for multi-drag
  const ghostPositions = isMultiDrag
    ? draggedIndices.map((idx) => ({
        index: idx,
        position: getPositionFromIndex(idx),
      }))
    : []

  const cellWidth = getCellWidth()

  return (
    <div
      ref={containerRef}
      className={clsx('relative', className)}
      style={{
        touchAction: draggedIndex !== null ? 'none' : 'auto',
        height: containerHeight > 0 ? containerHeight : 'auto',
      }}
    >
      {/* Ghost placeholders for multi-drag */}
      {ghostPositions.map(({ index, position }) => (
        <motion.div
          key={`ghost-${index}`}
          className="absolute rounded-xl border-2 border-dashed border-accent/40 bg-accent/5"
          style={{
            top: 0,
            left: 0,
            width: cellWidth,
            height: cellSize.height > 0 ? cellSize.height : 'auto',
          }}
          initial={{ opacity: 0 }}
          animate={{
            x: position.x,
            y: position.y,
            opacity: 0.6,
          }}
          transition={{
            x: { type: 'spring', ...SPRING_CONFIG },
            y: { type: 'spring', ...SPRING_CONFIG },
            opacity: { duration: 0.15 },
          }}
        />
      ))}

      {orderedItems.map((item, index) => {
        if (index > 0 && !isReady) return null

        const key = getKey(item)
        const isPrimaryDrag = draggedIndex === index
        const isSecondaryDrag = isMultiDrag && draggedIndices.includes(index) && !isPrimaryDrag
        const isDragging = isPrimaryDrag || isSecondaryDrag
        const position = getPositionFromIndex(index)
        const shouldWiggle = draggedIndex !== null && !isDragging

        // Calculate stacking for secondary dragged items
        const stackPosition = isSecondaryDrag ? draggedIndices.indexOf(index) : 0
        const stackOffset = isSecondaryDrag
          ? { x: (stackPosition + 1) * 5, y: (stackPosition + 1) * 5 }
          : { x: 0, y: 0 }
        const stackScale = isSecondaryDrag ? 0.98 - stackPosition * 0.01 : 1
        const stackZIndex = isSecondaryDrag ? 45 - stackPosition : 0

        // Calculate target position and styling
        let targetX = position.x
        let targetY = position.y
        let targetScale = 1
        let targetShadow = '0 0 0 rgba(0,0,0,0)'

        if (isPrimaryDrag) {
          targetX = position.x + dragOffset.x
          targetY = position.y + dragOffset.y
          targetScale = 1.05
          targetShadow = '0 20px 40px rgba(0,0,0,0.2)'
        } else if (isSecondaryDrag && primaryDragPosition) {
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
              width: cellWidth,
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
              x: isDragging ? { duration: 0 } : { type: 'spring', ...SPRING_CONFIG },
              y: isDragging ? { duration: 0 } : { type: 'spring', ...SPRING_CONFIG },
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
