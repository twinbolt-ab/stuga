import { useState, useRef, useCallback } from 'react'
import type { HAEntity } from '@/types/ha'
import { OVERLAY_HIDE_DELAY } from '@/lib/constants'

// Minimum drag distance to trigger brightness change (prevents accidental drags)
const DRAG_THRESHOLD = 10
// Margins for brightness slider (0% at left margin, 100% at right margin)
const SLIDER_MARGIN = 24

interface DragState {
  x: number
  y: number
  brightness: number
  brightnessMap: Map<string, number>
}

interface UseBrightnessGestureOptions {
  /** The lights to control */
  lights: HAEntity[]
  /** Whether gestures are disabled */
  disabled?: boolean
  /** Current brightness value (for optimistic state integration) */
  currentBrightness: number
  /** Callback when brightness changes during drag */
  onBrightnessChange: (brightness: number) => void
  /** Get current brightness for lights */
  getAverageBrightness: (lights: HAEntity[]) => number
  /** Get brightness map for all lights */
  getLightBrightnessMap: (lights: HAEntity[]) => Map<string, number>
  /** Calculate relative brightness values */
  calculateRelativeBrightness: (
    startingBrightnessMap: Map<string, number>,
    startingAverage: number,
    newAverage: number
  ) => Map<string, number>
  /** Set brightness for lights */
  setRoomBrightness: (
    lights: HAEntity[],
    brightnessValues: number | Map<string, number>,
    immediate?: boolean
  ) => void
}

interface UseBrightnessGestureReturn {
  /** Whether currently dragging brightness */
  isDragging: boolean
  /** Whether to show the brightness overlay */
  showOverlay: boolean
  /** Ref to track if a drag occurred (for preventing click handlers) */
  didDragRef: React.MutableRefObject<boolean>
  /** Handler for pointer down event */
  onPointerDown: (e: React.PointerEvent) => void
  /** Handler for pointer move event */
  onPointerMove: (e: React.PointerEvent) => void
  /** Handler for pointer up event */
  onPointerUp: (e: React.PointerEvent) => void
}

export function useBrightnessGesture({
  lights,
  disabled = false,
  currentBrightness,
  onBrightnessChange,
  getAverageBrightness,
  getLightBrightnessMap,
  calculateRelativeBrightness,
  setRoomBrightness,
}: UseBrightnessGestureOptions): UseBrightnessGestureReturn {
  const [isDragging, setIsDragging] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)

  const dragStartRef = useRef<DragState | null>(null)
  const didDragRef = useRef(false)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      didDragRef.current = false

      if (disabled || lights.length === 0) return

      const brightness = getAverageBrightness(lights)
      const brightnessMap = getLightBrightnessMap(lights)

      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        brightness,
        brightnessMap,
      }
    },
    [disabled, lights, getAverageBrightness, getLightBrightnessMap]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || !dragStartRef.current || lights.length === 0) return

      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y

      // Not yet dragging - check if we should start
      if (!isDragging) {
        // If vertical movement exceeds threshold, cancel
        if (Math.abs(deltaY) > DRAG_THRESHOLD) {
          dragStartRef.current = null
          return
        }

        // If horizontal movement exceeds threshold and is dominant, start dragging
        if (Math.abs(deltaX) > DRAG_THRESHOLD) {
          if (Math.abs(deltaY) > Math.abs(deltaX)) {
            dragStartRef.current = null
            return
          }
          didDragRef.current = true
          setIsDragging(true)
          setShowOverlay(true)
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }
        return
      }

      // Calculate new brightness using stretched scale mapping
      const leftEdge = SLIDER_MARGIN
      const rightEdge = window.innerWidth - SLIDER_MARGIN
      const startX = dragStartRef.current.x
      const startBrightness = dragStartRef.current.brightness

      let newBrightness: number

      if (e.clientX <= startX) {
        // Dragging left: map [leftEdge, startX] to [0%, startBrightness%]
        const range = startX - leftEdge
        newBrightness = range > 0 ? ((e.clientX - leftEdge) / range) * startBrightness : 0
      } else {
        // Dragging right: map [startX, rightEdge] to [startBrightness%, 100%]
        const range = rightEdge - startX
        newBrightness =
          range > 0
            ? startBrightness + ((e.clientX - startX) / range) * (100 - startBrightness)
            : 100
      }

      newBrightness = Math.round(Math.max(0, Math.min(100, newBrightness)))
      onBrightnessChange(newBrightness)

      // Apply relative brightness to all lights
      const relativeBrightness = calculateRelativeBrightness(
        dragStartRef.current.brightnessMap,
        startBrightness,
        newBrightness
      )
      setRoomBrightness(lights, relativeBrightness)
    },
    [
      disabled,
      lights,
      isDragging,
      onBrightnessChange,
      calculateRelativeBrightness,
      setRoomBrightness,
    ]
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging && dragStartRef.current) {
        // Apply final brightness
        const relativeBrightness = calculateRelativeBrightness(
          dragStartRef.current.brightnessMap,
          dragStartRef.current.brightness,
          currentBrightness
        )
        setRoomBrightness(lights, relativeBrightness, true)
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

        setTimeout(() => {
          setShowOverlay(false)
        }, OVERLAY_HIDE_DELAY)
      }

      setIsDragging(false)
      dragStartRef.current = null
    },
    [isDragging, lights, currentBrightness, calculateRelativeBrightness, setRoomBrightness]
  )

  return {
    isDragging,
    showOverlay,
    didDragRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
