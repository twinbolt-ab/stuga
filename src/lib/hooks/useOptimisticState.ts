import { useState, useRef, useCallback, useEffect } from 'react'
import { useDevMode } from './useDevMode'

interface UseOptimisticStateOptions<T> {
  /** The actual value from the server/source */
  actualValue: T
  /** Duration in ms before optimistic state expires (default: 5000, 5min in demo mode) */
  duration?: number
  /**
   * Custom comparison function for determining if actual matches optimistic.
   * For numbers: considers values within ±2 as equal (handles rounding from 0-255 conversion)
   * For other types: uses strict equality
   */
  isEqual?: (a: T, b: T) => boolean
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

// Default comparison: for numbers, allow ±2 tolerance (handles brightness rounding)
const defaultIsEqual = <T>(a: T, b: T): boolean => {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= 2
  }
  return a === b
}

/**
 * Hook for managing optimistic UI updates that automatically expire.
 * Useful for showing immediate feedback while waiting for server confirmation.
 * Automatically clears when the actual value matches the optimistic value.
 */
export function useOptimisticState<T>({
  actualValue,
  duration = 5000,
  isEqual = defaultIsEqual,
}: UseOptimisticStateOptions<T>): UseOptimisticStateReturn<T> {
  const [optimisticValue, setOptimisticValue] = useState<T | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const { isDevMode } = useDevMode()

  // In demo mode, use much longer duration (5 min) since no real state will arrive
  const effectiveDuration = isDevMode ? 300000 : duration

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
      }, effectiveDuration)
    },
    [effectiveDuration, clearTimer]
  )

  const clearOptimistic = useCallback(() => {
    clearTimer()
    setOptimisticValue(null)
  }, [clearTimer])

  // Clear optimistic state when actual value matches (server confirmed our optimistic update)
  // This is valid: effect subscribes to actualValue changes from external source
  useEffect(() => {
    if (optimisticValue !== null && isEqual(actualValue, optimisticValue)) {
      clearTimer()
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptimisticValue(null)
    }
  }, [actualValue, optimisticValue, isEqual, clearTimer])

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
