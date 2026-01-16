import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createInitialState } from '../ha-websocket/types'
import { registerCallback, clearPendingCallbacks } from '../ha-websocket/message-router'

describe('HAWebSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('callService', () => {
    it('should return a Promise', async () => {
      const { callService } = await import('../ha-websocket')

      // Call the service - it returns a Promise even if WebSocket is not connected
      const promise = callService('light', 'turn_on', { entity_id: 'light.test' })

      // Verify it returns a Promise
      expect(promise).toBeInstanceOf(Promise)
    })

    it('should resolve with success false when not connected', async () => {
      const { callService } = await import('../ha-websocket')

      // Call service when not connected
      const promise = callService('light', 'turn_on', { entity_id: 'light.living_room' })

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(31000)

      const result = await promise
      expect(result.success).toBe(false)
    })
  })

  describe('registerCallback', () => {
    it('should timeout after specified duration', () => {
      const state = createInitialState()
      const callback = vi.fn()

      // Register callback with 5 second timeout
      registerCallback(state, 999, callback, 5000)

      // Callback should not be called immediately
      expect(callback).not.toHaveBeenCalled()

      // Advance timer past timeout
      vi.advanceTimersByTime(5001)

      // Callback should be called with timeout error
      expect(callback).toHaveBeenCalledWith(false, undefined, {
        code: 'timeout',
        message: 'Request timed out',
      })
    })
  })

  describe('clearPendingCallbacks', () => {
    it('should clear pending callbacks on disconnect', () => {
      const state = createInitialState()
      const callback = vi.fn()

      // Register a callback
      registerCallback(state, 888, callback, 30000)

      // Clear all pending callbacks (simulates disconnect)
      clearPendingCallbacks(state)

      // Callback should be called with disconnected error
      expect(callback).toHaveBeenCalledWith(false, undefined, {
        code: 'disconnected',
        message: 'WebSocket disconnected',
      })
    })
  })
})
