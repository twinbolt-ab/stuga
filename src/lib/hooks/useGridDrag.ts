import { useState, useRef, useCallback, useEffect, RefObject } from 'react'
import { haptic } from '@/lib/haptics'
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
  const [_dragStartPos, setDragStartPos] = useState<Position>({ x: 0, y: 0 })
  const [orderedItems, setOrderedItems] = useState<T[]>(items)
  const [draggedIndices, setDraggedIndices] = useState<number[]>([])
  const lastEdgeRef = useRef<'left' | 'right' | null>(null)

  // Refs to track current values for event handlers (avoids stale closure issues)
  const dragStartPosRef = useRef<Position>({ x: 0, y: 0 })
  const draggedIndexRef = useRef<number | null>(null)
  // Track the initial grid position of the item when drag started
  // This allows us to compute visual position without complex adjustment logic
  const initialGridPosRef = useRef<Position>({ x: 0, y: 0 })

  // Track previous items for change detection
  const [prevItems, setPrevItems] = useState(items)

  // Sync items when they change externally
  if (prevItems !== items) {
    console.log('[useGridDrag] Items prop changed, draggedIndex:', draggedIndex)
    setPrevItems(items)
    const isExternalDrag = externalDragKey !== null && externalDragKey !== undefined
    if (draggedIndex === null) {
      console.log('[useGridDrag] Syncing orderedItems to new items')
      setOrderedItems(items)
    } else if (isExternalDrag) {
      setOrderedItems(items)
      setDraggedIndex(null)
    }
  }

  // Handle external drag continuation - intentional setState to sync external drag state
  useEffect(() => {
    if (!externalDragKey || !externalDragPosition || draggedIndexRef.current !== null) return

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

    // For external drag, the visual position should be centered under finger
    // So initialGridPos is set such that: initialGridPos + touchDelta = fingerPos - cellCenter
    // At this moment touchDelta = 0, so initialGridPos = fingerPos - cellCenter = gridPos + offset
    const newDragStartPos = { x: externalDragPosition.x, y: externalDragPosition.y }
    draggedIndexRef.current = finalIndex
    dragStartPosRef.current = newDragStartPos
    initialGridPosRef.current = { x: gridPos.x + offsetX, y: gridPos.y + offsetY }
    setDraggedIndex(finalIndex)
    setDragStartPos(newDragStartPos)
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
    getPositionFromIndex,
    getIndexFromPointer,
    cellSize,
    selectedKeys,
    containerRef,
  ])

  const handleDragStart = useCallback(
    (index: number, clientX: number, clientY: number) => {
      const itemKey = getKey(orderedItems[index])
      const isItemSelected = selectedKeys?.has(itemKey)
      const hasSelection = selectedKeys && selectedKeys.size > 0

      // If there's a selection but this item isn't part of it, don't start drag
      if (hasSelection && !isItemSelected) {
        return
      }

      haptic.medium()
      draggedIndexRef.current = index
      dragStartPosRef.current = { x: clientX, y: clientY }
      initialGridPosRef.current = getPositionFromIndex(index)
      setDraggedIndex(index)
      setDragStartPos({ x: clientX, y: clientY })
      setDragOffset({ x: 0, y: 0 })

      const isPartOfMultiSelection = isItemSelected && selectedKeys!.size > 1

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
    [orderedItems, onDragStartCallback, selectedKeys, getKey, getPositionFromIndex]
  )

  const handlePointerDown = useCallback(
    (index: number, clientX: number, clientY: number) => {
      if (reorderingDisabled) return

      // Start drag immediately - ReorderableGrid is only used in edit mode
      handleDragStart(index, clientX, clientY)
    },
    [reorderingDisabled, handleDragStart]
  )

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      // Use refs for current values to avoid stale closure issues
      const currentDraggedIndex = draggedIndexRef.current
      if (currentDraggedIndex === null) return

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

      // Check if reordering is needed
      const newTargetIndex = getIndexFromPointer(clientX, clientY)
      const isMultiDrag = draggedIndices.length > 1

      if (isMultiDrag && currentDraggedIndex !== null) {
        const primaryPositionInSelection = draggedIndices.indexOf(currentDraggedIndex)
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
          draggedIndexRef.current = newPrimaryIndex
          setDraggedIndex(newPrimaryIndex)
        }
      } else if (newTargetIndex !== currentDraggedIndex && currentDraggedIndex !== null) {
        const newItems = [...orderedItems]
        const [draggedItem] = newItems.splice(currentDraggedIndex, 1)
        newItems.splice(newTargetIndex, 0, draggedItem)
        setOrderedItems(newItems)
        draggedIndexRef.current = newTargetIndex
        setDraggedIndex(newTargetIndex)
        setDraggedIndices([newTargetIndex])
      }

      // Calculate visual position from initial grid position + touch delta
      // This approach doesn't require adjustment when reordering - the visual
      // position is always: initialGridPos + (currentTouch - startTouch)
      const touchDelta = {
        x: clientX - dragStartPosRef.current.x,
        y: clientY - dragStartPosRef.current.y,
      }
      const visualPos = {
        x: initialGridPosRef.current.x + touchDelta.x,
        y: initialGridPosRef.current.y + touchDelta.y,
      }

      // Compute dragOffset so that: currentGridPos + dragOffset = visualPos
      const currentGridPos = getPositionFromIndex(draggedIndexRef.current!)
      setDragOffset({
        x: visualPos.x - currentGridPos.x,
        y: visualPos.y - currentGridPos.y,
      })
    },
    [
      draggedIndices,
      getIndexFromPointer,
      orderedItems,
      getPositionFromIndex,
      onEdgeHover,
      onDragPosition,
    ]
  )

  const handleDragEnd = useCallback(() => {
    const currentDraggedIndex = draggedIndexRef.current
    const draggedItem = currentDraggedIndex !== null ? orderedItems[currentDraggedIndex] : null

    if (currentDraggedIndex !== null) {
      onReorder(orderedItems)
    }
    draggedIndexRef.current = null
    dragStartPosRef.current = { x: 0, y: 0 }
    initialGridPosRef.current = { x: 0, y: 0 }
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
  }, [orderedItems, onReorder, onEdgeHover, onDragEndCallback])

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
    if (draggedIndex === null) return

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
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
  }, [draggedIndex, handleDragMove, handleDragEnd])

  // Mouse handlers
  const handleMouseDown = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.preventDefault()
      handlePointerDown(index, e.clientX, e.clientY)
    },
    [handlePointerDown]
  )

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

  return {
    orderedItems,
    draggedIndex,
    draggedIndices,
    dragOffset,
    handleTouchStart,
    handleMouseDown,
  }
}
