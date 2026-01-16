import { useState, useRef, useCallback, useEffect } from 'react'

interface UseOptimisticStateOptions<T> {
  /** The actual value from the server/source */
  actualValue: T
  /** Duration in ms before optimistic state expires (default: 5000) */
  duration?: number
}

interface UseOptimisticStateReturn<T> {
  /** The value to display (optimistic if active, otherwise actual) */
  displayValue: T
  /** Whether currently using an optimistic value */
  isOptimistic: boolean
  /** Set an optimistic value that will expire after duration */
  setOptimistic: (value: T) => void
  /** Clear the optimistic state immediately */
  clearOptimistic: () => void
}

/**
 * Hook for managing optimistic UI updates that automatically expire.
 * Useful for showing immediate feedback while waiting for server confirmation.
 */
export function useOptimisticState<T>({
  actualValue,
  duration = 5000,
}: UseOptimisticStateOptions<T>): UseOptimisticStateReturn<T> {
  const [optimisticValue, setOptimisticValue] = useState<T | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const setOptimistic = useCallback(
    (value: T) => {
      clearTimer()
      setOptimisticValue(value)

      timerRef.current = setTimeout(() => {
        setOptimisticValue(null)
        timerRef.current = null
      }, duration)
    },
    [duration, clearTimer]
  )

  const clearOptimistic = useCallback(() => {
    clearTimer()
    setOptimisticValue(null)
  }, [clearTimer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  return {
    displayValue: optimisticValue !== null ? optimisticValue : actualValue,
    isOptimistic: optimisticValue !== null,
    setOptimistic,
    clearOptimistic,
  }
}
