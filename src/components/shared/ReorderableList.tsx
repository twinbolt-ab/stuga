/**
 * ReorderableList - Generic reorderable list component for vertical/flex-wrap layouts
 *
 * Uses absolute positioning (like ReorderableGrid) for smoother drag animations.
 * Supports entity reordering with immediate activation, wiggle animations, and spring physics.
 */

import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { useListMeasurement } from '@/lib/hooks/useListMeasurement'
import { useListDrag } from '@/lib/hooks/useListDrag'
import { useSettings } from '@/lib/hooks/useSettings'

interface ReorderableListProps<T> {
  items: T[]
  renderItem: (item: T, index: number, isDragging: boolean, isSelected: boolean) => React.ReactNode
  onReorder: (items: T[]) => void
  getKey: (item: T) => string
  layout?: 'vertical' | 'flex-wrap'
  gap?: number
  className?: string
  onDragEnd?: () => void
  /** Keys of selected items for multi-drag stacking */
  selectedKeys?: Set<string>
  /** Called when an item is tapped (for selection toggle) */
  onItemTap?: (key: string) => void
}

export function ReorderableList<T>({
  items,
  renderItem,
  onReorder,
  getKey,
  layout = 'vertical',
  gap = layout === 'flex-wrap' ? 8 : 12,
  className,
  onDragEnd,
  selectedKeys,
  onItemTap,
}: ReorderableListProps<T>) {
  // Get custom order setting - reordering is disabled when custom order is OFF
  const { customOrderEnabled } = useSettings()
  const reorderingDisabled = !customOrderEnabled

  // List measurement for absolute positioning
  const { containerRef, measureRef, itemSize, isReady, containerHeight, getPositionFromIndex } =
    useListMeasurement({
      itemCount: items.length,
      gap,
      layout,
    })

  const { orderedItems, draggedIndex, draggedIndices, dragOffset, handlePointerDown } = useListDrag(
    {
      items,
      getKey,
      onReorder,
      onDragEnd,
      immediateMode: !reorderingDisabled, // Only enable drag if reordering is allowed
      selectedKeys,
      onItemTap: onItemTap
        ? (index: number) => {
            const item = orderedItems[index]
            if (item) onItemTap(getKey(item))
          }
        : undefined,
      layout,
      containerRef,
      reorderingDisabled,
    }
  )

  // Multi-drag state
  const isMultiDrag = draggedIndices.length > 1
  const primaryDragPosition = draggedIndex !== null ? getPositionFromIndex(draggedIndex) : null

  // Ghost placeholder positions for all dragged items
  const ghostPositions =
    draggedIndex !== null
      ? draggedIndices.map((idx) => ({
          index: idx,
          position: getPositionFromIndex(idx),
        }))
      : []

  return (
    <div
      ref={containerRef}
      className={clsx('relative', className)}
      style={{
        // Disable touch scrolling when dragging
        touchAction: draggedIndex !== null ? 'none' : 'auto',
        height: containerHeight > 0 ? containerHeight : 'auto',
      }}
    >
      {/* Ghost placeholders showing original positions during drag */}
      {ghostPositions.map(({ index, position }) => (
        <motion.div
          key={`ghost-${index}`}
          className="absolute rounded-lg border-2 border-dashed border-accent/40 bg-accent/5"
          style={{
            top: 0,
            left: 0,
            width: layout === 'flex-wrap' ? itemSize.width : '100%',
            height: itemSize.height > 0 ? itemSize.height : 'auto',
          }}
          initial={{ opacity: 0 }}
          animate={{
            x: position.x,
            y: position.y,
            opacity: 0.6,
          }}
          transition={{
            x: { duration: 0 },
            y: { duration: 0 },
            opacity: { duration: 0.15 },
          }}
        />
      ))}

      {orderedItems.map((item, index) => {
        // Only render first item until ready (for measurement)
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
          // Secondary items move to primary's position + stacking offset
          targetX = primaryDragPosition.x + dragOffset.x + stackOffset.x
          targetY = primaryDragPosition.y + dragOffset.y + stackOffset.y
          targetScale = stackScale
          targetShadow = '0 10px 20px rgba(0,0,0,0.15)'
        }

        return (
          <motion.div
            key={key}
            ref={index === 0 ? measureRef : undefined}
            data-list-item
            data-reorderable-item
            className={clsx('absolute', isPrimaryDrag && 'z-50')}
            style={{
              top: 0,
              left: 0,
              width: layout === 'flex-wrap' ? 'auto' : '100%',
              visibility: isReady ? 'visible' : 'hidden',
              cursor: draggedIndex === null ? 'grab' : isDragging ? 'grabbing' : 'grab',
              touchAction: 'none',
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
              x: { duration: 0 },
              y: { duration: 0 },
              scale: { duration: 0.15, delay: isDragging ? 0.2 : 0 },
              boxShadow: { duration: 0.15, delay: isDragging ? 0.2 : 0 },
            }}
            onPointerDown={handlePointerDown(index)}
          >
            {/* Disable pointer events on children so drag events go to motion.div */}
            {/* Wiggle animation on inner div to not conflict with framer-motion transforms */}
            <div
              style={{ pointerEvents: 'none' }}
              className={clsx(shouldWiggle && (index % 2 === 0 ? 'wiggle' : 'wiggle-alt'))}
            >
              {renderItem(item, index, isDragging, selectedKeys?.has(key) ?? false)}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
