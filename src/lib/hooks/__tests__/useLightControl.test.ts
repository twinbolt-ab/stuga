import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { HAEntity } from '@/types/ha'

// Mock useHAConnection at module level
const mockCallService = vi.fn().mockResolvedValue({ success: true })

vi.mock('@/lib/hooks/useHAConnection', () => ({
  useHAConnection: () => ({
    callService: mockCallService,
    isConnected: true,
    isConfigured: true,
    hasReceivedData: true,
    entities: new Map(),
    getEntity: vi.fn(),
    getEntitiesByDomain: vi.fn(),
    reconnect: vi.fn(),
    disconnect: vi.fn(),
  }),
}))

describe('useLightControl', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockCallService.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getAverageBrightness', () => {
    it('should return 0 when no lights are on', async () => {
      const { useLightControl } = await import('../useLightControl')
      const { result } = renderHook(() => useLightControl())

      const lights: HAEntity[] = [
        { entity_id: 'light.1', state: 'off', attributes: {}, last_changed: '', last_updated: '' },
        { entity_id: 'light.2', state: 'off', attributes: {}, last_changed: '', last_updated: '' },
      ]

      expect(result.current.getAverageBrightness(lights)).toBe(0)
    })

    it('should calculate average brightness correctly', async () => {
      const { useLightControl } = await import('../useLightControl')
      const { result } = renderHook(() => useLightControl())

      const lights: HAEntity[] = [
        {
          entity_id: 'light.1',
          state: 'on',
          attributes: { brightness: 255 },
          last_changed: '',
          last_updated: '',
        }, // 100%
        {
          entity_id: 'light.2',
          state: 'on',
          attributes: { brightness: 127 },
          last_changed: '',
          last_updated: '',
        }, // ~50%
      ]

      const avg = result.current.getAverageBrightness(lights)
      // (100 + 49.8) / 2 ≈ 75
      expect(avg).toBeGreaterThan(70)
      expect(avg).toBeLessThan(80)
    })

    it('should treat lights without brightness attribute as 100%', async () => {
      const { useLightControl } = await import('../useLightControl')
      const { result } = renderHook(() => useLightControl())

      const lights: HAEntity[] = [
        { entity_id: 'light.1', state: 'on', attributes: {}, last_changed: '', last_updated: '' },
      ]

      expect(result.current.getAverageBrightness(lights)).toBe(100)
    })
  })

  describe('getLightBrightness', () => {
    it('should return 0 for lights that are off', async () => {
      const { useLightControl } = await import('../useLightControl')
      const { result } = renderHook(() => useLightControl())

      const light: HAEntity = {
        entity_id: 'light.1',
        state: 'off',
        attributes: { brightness: 255 },
        last_changed: '',
        last_updated: '',
      }

      expect(result.current.getLightBrightness(light)).toBe(0)
    })

    it('should convert 0-255 brightness to 0-100 percentage', async () => {
      const { useLightControl } = await import('../useLightControl')
      const { result } = renderHook(() => useLightControl())

      const light: HAEntity = {
        entity_id: 'light.1',
        state: 'on',
        attributes: { brightness: 127 },
        last_changed: '',
        last_updated: '',
      }

      const brightness = result.current.getLightBrightness(light)
      expect(brightness).toBeGreaterThan(45)
      expect(brightness).toBeLessThan(55)
    })
  })

  describe('setRoomBrightness', () => {
    it('should clamp brightness values between 0 and 100', async () => {
      const { useLightControl } = await import('../useLightControl')
      const { result } = renderHook(() => useLightControl())

      const lights: HAEntity[] = [
        { entity_id: 'light.1', state: 'on', attributes: {}, last_changed: '', last_updated: '' },
      ]

      // Test with value over 100
      act(() => {
        result.current.setRoomBrightness(lights, 150, true)
      })

      expect(mockCallService).toHaveBeenCalledWith('light', 'turn_on', {
        entity_id: 'light.1',
        brightness_pct: 100, // Clamped to 100
      })

      mockCallService.mockClear()

      // Test with negative value
      act(() => {
        result.current.setRoomBrightness(lights, -50, true)
      })

      expect(mockCallService).toHaveBeenCalledWith('light', 'turn_off', {
        entity_id: 'light.1',
      })
    })
  })

  describe('calculateRelativeBrightness', () => {
    it('should handle starting average of 0', async () => {
      const { useLightControl } = await import('../useLightControl')
      const { result } = renderHook(() => useLightControl())

      const startingMap = new Map([
        ['light.1', 0],
        ['light.2', 0],
      ])

      const newValues = result.current.calculateRelativeBrightness(startingMap, 0, 50)

      expect(newValues.get('light.1')).toBe(50)
      expect(newValues.get('light.2')).toBe(50)
    })

    it('should maintain relative ratios', async () => {
      const { useLightControl } = await import('../useLightControl')
      const { result } = renderHook(() => useLightControl())

      const startingMap = new Map([
        ['light.1', 100], // Full brightness
        ['light.2', 50], // Half brightness
      ])
      const startingAvg = 75

      const newValues = result.current.calculateRelativeBrightness(startingMap, startingAvg, 50)

      // Ratio is 50/75 = 0.667
      // light.1: 100 * 0.667 ≈ 67
      // light.2: 50 * 0.667 ≈ 33
      expect(newValues.get('light.1')).toBeCloseTo(66.67, 0)
      expect(newValues.get('light.2')).toBeCloseTo(33.33, 0)
    })
  })
})
