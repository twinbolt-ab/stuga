import { useRef, useCallback, useEffect } from 'react'
import { haptic } from '@/lib/haptics'

interface UseLongPressOptions {
  /** Duration in ms before long-press triggers (default: 500) */
  duration?: number
  /** Movement threshold in px that cancels the long-press (default: 10) */
  moveThreshold?: number
  /** Whether the long-press is disabled */
  disabled?: boolean
  /** Callback when long-press triggers */
  onLongPress: () => void
}

interface UseLongPressReturn {
  /** Whether a long-press was triggered (use to prevent click handling) */
  didLongPress: boolean
  /** Call on pointer down to start detecting */
  onPointerDown: (e: React.PointerEvent) => void
  /** Call on pointer move to check for cancellation */
  onPointerMove: (e: React.PointerEvent) => void
  /** Call on pointer up to clean up */
  onPointerUp: () => void
}

export function useLongPress({
  duration = 500,
  moveThreshold = 10,
  disabled = false,
  onLongPress,
}: UseLongPressOptions): UseLongPressReturn {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const didLongPressRef = useRef(false)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      didLongPressRef.current = false
      startPosRef.current = { x: e.clientX, y: e.clientY }
      clearTimer()

      if (disabled) return

      timerRef.current = setTimeout(() => {
        didLongPressRef.current = true
        haptic.medium()
        onLongPress()
      }, duration)
    },
    [disabled, duration, onLongPress, clearTimer]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!timerRef.current || !startPosRef.current) return

      const dx = Math.abs(e.clientX - startPosRef.current.x)
      const dy = Math.abs(e.clientY - startPosRef.current.y)

      if (dx > moveThreshold || dy > moveThreshold) {
        clearTimer()
      }
    },
    [moveThreshold, clearTimer]
  )

  const handlePointerUp = useCallback(() => {
    clearTimer()
    startPosRef.current = null
  }, [clearTimer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  return {
    didLongPress: didLongPressRef.current,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
  }
}
