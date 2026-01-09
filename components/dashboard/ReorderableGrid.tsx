'use client'

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'

interface ReorderableGridProps<T> {
  items: T[]
  renderItem: (item: T, index: number, isDragging: boolean, isActive: boolean) => React.ReactNode
  onReorder: (items: T[]) => void
  onClickOutside?: () => void
  getKey: (item: T) => string
  columns?: number
  gap?: number
  className?: string
}

// iOS-style wiggle keyframes - angle scales inversely with cell size
const getWiggleKeyframes = (index: number, cellWidth: number) => {
  // Scale angle based on cell size: smaller cells = larger angle
  // Mobile (~150px): 75/150 = 0.5°, Tablet (~300px): 75/300 = 0.25°
  const baseAngle = Math.min(1.2, Math.max(0.2, 75 / Math.max(cellWidth, 50)))
  const startPositive = index % 2 === 0
  return startPositive
    ? [baseAngle, -baseAngle]
    : [-baseAngle, baseAngle]
}

// Each item gets slightly different timing for organic feel
const getWiggleDuration = (index: number) => {
  const durations = [0.11, 0.12, 0.13, 0.115] // Different durations
  return durations[index % durations.length]
}

export function ReorderableGrid<T>({
  items,
  renderItem,
  onReorder,
  onClickOutside,
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
  const [containerWidth, setContainerWidth] = useState(0)

  // Sync items when they change externally
  useEffect(() => {
    setOrderedItems(items)
  }, [items])

  // Measure cell size
  useLayoutEffect(() => {
    const measure = () => {
      if (!containerRef.current) return
      const width = containerRef.current.offsetWidth
      setContainerWidth(width)
      const cellWidth = (width - gap * (columns - 1)) / columns
      setCellSize({ width: cellWidth, height: cellWidth }) // Square cells initially
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [columns, gap])

  // Update cell height after first render
  useLayoutEffect(() => {
    if (!measureRef.current || cellSize.width === 0) return
    const actualHeight = measureRef.current.offsetHeight
    if (actualHeight > 0 && actualHeight !== cellSize.height) {
      setCellSize(prev => ({ ...prev, height: actualHeight }))
    }
  }, [cellSize.width, orderedItems])

  // Calculate pixel position from index
  const getPositionFromIndex = useCallback((index: number) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    return {
      x: col * (cellSize.width + gap),
      y: row * (cellSize.height + gap),
    }
  }, [columns, cellSize, gap])

  // Calculate index from pointer position
  const getIndexFromPointer = useCallback((clientX: number, clientY: number): number => {
    if (!containerRef.current || cellSize.width === 0) return 0

    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    const col = Math.min(columns - 1, Math.max(0, Math.floor(x / (cellSize.width + gap))))
    const row = Math.max(0, Math.floor(y / (cellSize.height + gap)))
    const index = row * columns + col

    return Math.min(orderedItems.length - 1, Math.max(0, index))
  }, [columns, gap, cellSize, orderedItems.length])

  // Handle drag start
  const handleDragStart = useCallback((index: number, clientX: number, clientY: number) => {
    setDraggedIndex(index)
    setDragStartPos({ x: clientX, y: clientY })
    setDragOffset({ x: 0, y: 0 })
  }, [])

  // Handle drag move
  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (draggedIndex === null) return

    setDragOffset({
      x: clientX - dragStartPos.x,
      y: clientY - dragStartPos.y,
    })

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
      setDragStartPos(prev => ({
        x: prev.x + (newPos.x - oldPos.x),
        y: prev.y + (newPos.y - oldPos.y),
      }))
    }
  }, [draggedIndex, dragStartPos, getIndexFromPointer, orderedItems, getPositionFromIndex])

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null) {
      onReorder(orderedItems)
    }
    setDraggedIndex(null)
    setDragOffset({ x: 0, y: 0 })
  }, [draggedIndex, orderedItems, onReorder])

  // Touch handlers
  const handleTouchStart = useCallback((index: number) => (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleDragStart(index, touch.clientX, touch.clientY)
  }, [handleDragStart])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (draggedIndex === null) return
    e.preventDefault()
    const touch = e.touches[0]
    handleDragMove(touch.clientX, touch.clientY)
  }, [draggedIndex, handleDragMove])

  const handleTouchEnd = useCallback(() => {
    handleDragEnd()
  }, [handleDragEnd])

  // Mouse handlers
  const handleMouseDown = useCallback((index: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    handleDragStart(index, e.clientX, e.clientY)
  }, [handleDragStart])

  useEffect(() => {
    if (draggedIndex === null) return

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY)
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
  }, [draggedIndex, handleDragMove, handleDragEnd])

  // Click outside to save
  useEffect(() => {
    if (!onClickOutside) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClickOutside()
      }
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

  return (
    <div
      ref={containerRef}
      className={clsx('relative', className)}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        touchAction: draggedIndex !== null ? 'none' : 'auto',
        height: containerHeight > 0 ? containerHeight : 'auto',
      }}
    >
      {orderedItems.map((item, index) => {
        const key = getKey(item)
        const isDragging = draggedIndex === index
        const position = getPositionFromIndex(index)

        return (
          <motion.div
            key={key}
            ref={index === 0 ? measureRef : undefined}
            data-grid-item
            className={clsx(
              'absolute',
              isDragging && 'z-50'
            )}
            style={{
              width: cellSize.width > 0 ? cellSize.width : `calc((100% - ${gap * (columns - 1)}px) / ${columns})`,
            }}
            initial={{
              x: position.x,
              y: position.y,
              scale: 1,
              rotate: 0
            }}
            animate={{
              x: position.x + (isDragging ? dragOffset.x : 0),
              y: position.y + (isDragging ? dragOffset.y : 0),
              scale: isDragging ? 1.05 : 1,
              rotate: isDragging ? 0 : getWiggleKeyframes(index, cellSize.width),
              boxShadow: isDragging
                ? '0 20px 40px rgba(0,0,0,0.2)'
                : '0 0 0 rgba(0,0,0,0)',
            }}
            transition={{
              x: isDragging
                ? { duration: 0 }
                : { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 },
              y: isDragging
                ? { duration: 0 }
                : { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 },
              scale: { duration: 0.15 },
              rotate: isDragging
                ? { duration: 0.1 }
                : {
                    duration: getWiggleDuration(index),
                    repeat: Infinity,
                    repeatType: 'mirror',
                    ease: 'easeInOut',
                  },
              boxShadow: { duration: 0.15 },
            }}
            onTouchStart={handleTouchStart(index)}
            onMouseDown={handleMouseDown(index)}
          >
            {renderItem(item, index, draggedIndex !== null, isDragging)}
          </motion.div>
        )
      })}
    </div>
  )
}
