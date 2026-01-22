import { useState, useRef, useCallback, useEffect, RefObject } from 'react'
import { haptic } from '@/lib/haptics'
import { LONG_PRESS_DURATION } from '@/lib/constants'
const MOVE_THRESHOLD = 10
const EDGE_THRESHOLD_PERCENT = 0.08 // 8% of screen width

interface Position {
  x: number
  y: number
}

interface UseGridDragOptions<T> {
  items: T[]
  getKey: (item: T) => string
  containerRef: RefObject<HTMLDivElement | null>
  cellSize: { width: number; height: number }
  getPositionFromIndex: (index: number) => Position
  getIndexFromPointer: (clientX: number, clientY: number) => number
  onReorder: (items: T[]) => void
  onDragStartCallback?: (item: T, index: number) => void
  onDragEndCallback?: (item: T) => void
  onDragPosition?: (clientX: number, clientY: number) => void
  onEdgeHover?: ((edge: 'left' | 'right' | null) => void) | null
  reorderingDisabled?: boolean
  selectedKeys?: Set<string>
  externalDragKey?: string | null
  externalDragPosition?: Position | null
}

interface UseGridDragReturn<T> {
  orderedItems: T[]
  draggedIndex: number | null
  draggedIndices: number[]
  dragOffset: Position
  handleTouchStart: (index: number) => (e: React.TouchEvent) => void
  handleMouseDown: (index: number) => (e: React.MouseEvent) => void
}

export function useGridDrag<T>({
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
  reorderingDisabled = false,
  selectedKeys,
  externalDragKey,
  externalDragPosition,
}: UseGridDragOptions<T>): UseGridDragReturn<T> {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  const [dragStartPos, setDragStartPos] = useState<Position>({ x: 0, y: 0 })
  const [orderedItems, setOrderedItems] = useState<T[]>(items)
  const [draggedIndices, setDraggedIndices] = useState<number[]>([])

  // Long-press state
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingDragIndex, setPendingDragIndex] = useState<number | null>(null)
  const pendingDragPosRef = useRef<Position>({ x: 0, y: 0 })
  const lastEdgeRef = useRef<'left' | 'right' | null>(null)

  // Track previous items for change detection
  const [prevItems, setPrevItems] = useState(items)

  // Sync items when they change externally
  if (prevItems !== items) {
    setPrevItems(items)
    const isExternalDrag = externalDragKey !== null && externalDragKey !== undefined
    if (draggedIndex === null && pendingDragIndex === null) {
      setOrderedItems(items)
    } else if (isExternalDrag) {
      setOrderedItems(items)
      setDraggedIndex(null)
    }
  }

  // Handle external drag continuation
  useEffect(() => {
    if (!externalDragKey || !externalDragPosition || draggedIndex !== null) return

    const itemIndex = orderedItems.findIndex((item) => getKey(item) === externalDragKey)
    if (itemIndex === -1) return

    const container = containerRef.current
    if (!container) return

    // Calculate where the finger is pointing - this is where the item should be
    const targetIndex = getIndexFromPointer(externalDragPosition.x, externalDragPosition.y)

    // If the item is not at the target position, reorder it there first
    let finalIndex = itemIndex
    let currentItems = orderedItems
    if (targetIndex !== itemIndex) {
      const newItems = [...orderedItems]
      const [draggedItem] = newItems.splice(itemIndex, 1)
      newItems.splice(targetIndex, 0, draggedItem)
      setOrderedItems(newItems)
      currentItems = newItems
      finalIndex = targetIndex
    }

    // Calculate offset to center card under finger
    const gridPos = getPositionFromIndex(finalIndex)
    const rect = container.getBoundingClientRect()
    const fingerX = externalDragPosition.x - rect.left
    const fingerY = externalDragPosition.y - rect.top
    const offsetX = fingerX - gridPos.x - cellSize.width / 2
    const offsetY = fingerY - gridPos.y - cellSize.height / 2

    setDraggedIndex(finalIndex)
    setDragStartPos({ x: externalDragPosition.x - offsetX, y: externalDragPosition.y - offsetY })
    setDragOffset({ x: offsetX, y: offsetY })

    // Rebuild draggedIndices for multi-drag after floor switch
    if (selectedKeys && selectedKeys.size > 1) {
      const newDraggedIndices = currentItems
        .map((item, i) => ({ key: getKey(item), index: i }))
        .filter(({ key }) => selectedKeys.has(key))
        .map(({ index }) => index)
        .sort((a, b) => a - b)
      setDraggedIndices(newDraggedIndices.length > 1 ? newDraggedIndices : [finalIndex])
    } else {
      setDraggedIndices([finalIndex])
    }
  }, [
    externalDragKey,
    externalDragPosition,
    orderedItems,
    getKey,
    draggedIndex,
    getPositionFromIndex,
    getIndexFromPointer,
    cellSize,
    selectedKeys,
    containerRef,
  ])

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setPendingDragIndex(null)
  }, [])

  const handleDragStart = useCallback(
    (index: number, clientX: number, clientY: number) => {
      haptic.medium()
      setDraggedIndex(index)
      setDragStartPos({ x: clientX, y: clientY })
      setDragOffset({ x: 0, y: 0 })

      const itemKey = getKey(orderedItems[index])
      const isPartOfMultiSelection = selectedKeys?.has(itemKey) && selectedKeys.size > 1

      if (isPartOfMultiSelection) {
        const selectedIndices = orderedItems
          .map((item, i) => ({ key: getKey(item), index: i }))
          .filter(({ key }) => selectedKeys!.has(key))
          .map(({ index }) => index)
          .sort((a, b) => a - b)
        setDraggedIndices(selectedIndices)
      } else {
        setDraggedIndices([index])
      }

      onDragStartCallback?.(orderedItems[index], index)
    },
    [orderedItems, onDragStartCallback, selectedKeys, getKey]
  )

  const handlePointerDown = useCallback(
    (index: number, clientX: number, clientY: number) => {
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

  const handlePointerCancel = useCallback(() => {
    clearLongPressTimer()
  }, [clearLongPressTimer])

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

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (draggedIndex === null) return

      onDragPosition?.(clientX, clientY)

      // Edge detection (density-independent threshold)
      if (onEdgeHover) {
        const edgeThreshold = window.innerWidth * EDGE_THRESHOLD_PERCENT
        let currentEdge: 'left' | 'right' | null = null
        if (clientX < edgeThreshold) {
          currentEdge = 'left'
        } else if (clientX > window.innerWidth - edgeThreshold) {
          currentEdge = 'right'
        }

        if (currentEdge !== lastEdgeRef.current) {
          lastEdgeRef.current = currentEdge
          onEdgeHover(currentEdge)
        }
      }

      // Check if reordering is needed and calculate position adjustment
      const newTargetIndex = getIndexFromPointer(clientX, clientY)
      const isMultiDrag = draggedIndices.length > 1
      let effectiveDragStartPos = dragStartPos

      if (isMultiDrag && draggedIndex !== null) {
        const primaryPositionInSelection = draggedIndices.indexOf(draggedIndex)
        if (primaryPositionInSelection === -1) return

        const allIndicesValid = draggedIndices.every((i) => i >= 0 && i < orderedItems.length)
        if (!allIndicesValid) return

        const blockStartIndex = Math.max(
          0,
          Math.min(
            orderedItems.length - draggedIndices.length,
            newTargetIndex - primaryPositionInSelection
          )
        )

        const currentBlockStart = draggedIndices[0]
        if (blockStartIndex !== currentBlockStart) {
          const draggedItems = draggedIndices.map((i) => orderedItems[i])
          const newItems = orderedItems.filter((_, i) => !draggedIndices.includes(i))
          newItems.splice(blockStartIndex, 0, ...draggedItems)
          setOrderedItems(newItems)

          const newDraggedIndices = draggedIndices.map((_, i) => blockStartIndex + i)
          setDraggedIndices(newDraggedIndices)
          const newPrimaryIndex = blockStartIndex + primaryPositionInSelection
          setDraggedIndex(newPrimaryIndex)

          // Calculate adjusted dragStartPos for offset calculation
          const oldPos = getPositionFromIndex(draggedIndex)
          const newPos = getPositionFromIndex(newPrimaryIndex)
          effectiveDragStartPos = {
            x: dragStartPos.x + (newPos.x - oldPos.x),
            y: dragStartPos.y + (newPos.y - oldPos.y),
          }
          setDragStartPos(effectiveDragStartPos)
        }
      } else if (newTargetIndex !== draggedIndex && draggedIndex !== null) {
        const newItems = [...orderedItems]
        const [draggedItem] = newItems.splice(draggedIndex, 1)
        newItems.splice(newTargetIndex, 0, draggedItem)
        setOrderedItems(newItems)
        setDraggedIndex(newTargetIndex)
        setDraggedIndices([newTargetIndex])

        // Calculate adjusted dragStartPos for offset calculation
        const oldPos = getPositionFromIndex(draggedIndex)
        const newPos = getPositionFromIndex(newTargetIndex)
        effectiveDragStartPos = {
          x: dragStartPos.x + (newPos.x - oldPos.x),
          y: dragStartPos.y + (newPos.y - oldPos.y),
        }
        setDragStartPos(effectiveDragStartPos)
      }

      // Calculate offset using the (possibly adjusted) start position
      setDragOffset({
        x: clientX - effectiveDragStartPos.x,
        y: clientY - effectiveDragStartPos.y,
      })
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

  const handleDragEnd = useCallback(() => {
    clearLongPressTimer()
    const draggedItem = draggedIndex !== null ? orderedItems[draggedIndex] : null

    if (draggedIndex !== null) {
      onReorder(orderedItems)
    }
    setDraggedIndex(null)
    setDraggedIndices([])
    setDragOffset({ x: 0, y: 0 })

    if (onEdgeHover && lastEdgeRef.current !== null) {
      lastEdgeRef.current = null
      onEdgeHover(null)
    }

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

  // Touch move/end event listeners - attached to document during active drag
  // This mirrors the mouse event pattern and allows touch events to persist across floor switches
  useEffect(() => {
    if (draggedIndex === null && pendingDragIndex === null) return

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
      if (checkLongPressMove(touch.clientX, touch.clientY)) return
      if (draggedIndex === null) return
      e.preventDefault()
      handleDragMove(touch.clientX, touch.clientY)
    }

    const handleTouchEnd = () => {
      handleDragEnd()
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
    document.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [draggedIndex, pendingDragIndex, checkLongPressMove, handleDragMove, handleDragEnd])

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

    // Prevent context menu during long-press/drag on web
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('contextmenu', handleContextMenu)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [draggedIndex, pendingDragIndex, checkLongPressMove, handleDragMove, handleDragEnd])

  return {
    orderedItems,
    draggedIndex,
    draggedIndices,
    dragOffset,
    handleTouchStart,
    handleMouseDown,
  }
}
