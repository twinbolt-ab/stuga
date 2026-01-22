import { useState, useRef, useLayoutEffect, useCallback, RefObject } from 'react'
import {
  getPositionFromIndex as getPositionFromIndexPure,
  getIndexFromPosition,
  getContainerHeight,
  getCellWidthOrFallback,
  type GridGeometry,
} from './useGridGeometry'

interface CellSize {
  width: number
  height: number
}

interface UseGridMeasurementOptions {
  columns: number
  gap: number
  itemCount: number
}

interface UseGridMeasurementReturn {
  containerRef: RefObject<HTMLDivElement>
  measureRef: RefObject<HTMLDivElement>
  cellSize: CellSize
  isReady: boolean
  containerHeight: number
  getPositionFromIndex: (index: number) => { x: number; y: number }
  getIndexFromPointer: (clientX: number, clientY: number) => number
  getCellWidth: () => number | string
}

export function useGridMeasurement({
  columns,
  gap,
  itemCount,
}: UseGridMeasurementOptions): UseGridMeasurementReturn {
  const containerRef = useRef<HTMLDivElement>(null!)
  const measureRef = useRef<HTMLDivElement>(null!)
  const [cellSize, setCellSize] = useState<CellSize>({ width: 0, height: 0 })

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

    measureHeight()

    const resizeObserver = new ResizeObserver(() => {
      measureHeight()
    })
    resizeObserver.observe(measureRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [cellSize.width, cellSize.height])

  // Build geometry object for pure functions
  const geometry: GridGeometry = { cellSize, columns, gap }

  // Calculate pixel position from index (using pure function)
  const getPositionFromIndex = useCallback(
    (index: number) => getPositionFromIndexPure(geometry, index),
    [geometry]
  )

  // Calculate index from pointer position (using pure function)
  const getIndexFromPointer = useCallback(
    (clientX: number, clientY: number): number => {
      if (!containerRef.current || cellSize.width === 0) return 0

      const rect = containerRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top

      return getIndexFromPosition(geometry, x, y, itemCount)
    },
    [geometry, cellSize.width, itemCount]
  )

  // Get cell width as number or CSS calc fallback (using pure function)
  const getCellWidth = useCallback(() => getCellWidthOrFallback(geometry), [geometry])

  const containerHeight = getContainerHeight(geometry, itemCount)
  const isReady = cellSize.width > 0 && cellSize.height > 0

  return {
    containerRef,
    measureRef,
    cellSize,
    isReady,
    containerHeight,
    getPositionFromIndex,
    getIndexFromPointer,
    getCellWidth,
  }
}
