'use client'

import { useCallback, useRef } from 'react'
import { useHAConnection } from './useHAConnection'
import type { HAEntity } from '@/types/ha'

interface UseLightControlOptions {
  debounceMs?: number
}

export function useLightControl(options: UseLightControlOptions = {}) {
  const { debounceMs = 100 } = options
  const { callService } = useHAConnection()
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingCallsRef = useRef<Map<string, number>>(new Map())

  // Set brightness for a single light
  const setLightBrightness = useCallback(
    (entityId: string, brightnessPct: number, immediate = false) => {
      // Store the pending brightness
      pendingCallsRef.current.set(entityId, brightnessPct)

      if (immediate) {
        // Immediate call (e.g., on release)
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        flushPendingCalls()
        return
      }

      // Debounced call
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        flushPendingCalls()
        debounceTimerRef.current = null
      }, debounceMs)
    },
    [callService, debounceMs]
  )

  // Flush all pending brightness changes
  const flushPendingCalls = useCallback(() => {
    for (const [entityId, brightness] of pendingCallsRef.current) {
      if (brightness === 0) {
        callService('light', 'turn_off', { entity_id: entityId })
      } else {
        callService('light', 'turn_on', {
          entity_id: entityId,
          brightness_pct: brightness,
        })
      }
    }
    pendingCallsRef.current.clear()
  }, [callService])

  // Set brightness for multiple lights at once
  const setRoomBrightness = useCallback(
    (lights: HAEntity[], brightnessPct: number, immediate = false) => {
      for (const light of lights) {
        pendingCallsRef.current.set(light.entity_id, brightnessPct)
      }

      if (immediate) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        flushPendingCalls()
        return
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        flushPendingCalls()
        debounceTimerRef.current = null
      }, debounceMs)
    },
    [debounceMs, flushPendingCalls]
  )

  // Toggle a light on/off
  const toggleLight = useCallback(
    (entityId: string) => {
      callService('light', 'toggle', { entity_id: entityId })
    },
    [callService]
  )

  // Toggle all lights in a room on/off
  const toggleRoomLights = useCallback(
    (lights: HAEntity[]) => {
      // If any light is on, turn all off. Otherwise turn all on.
      const anyOn = lights.some((l) => l.state === 'on')
      const service = anyOn ? 'turn_off' : 'turn_on'
      for (const light of lights) {
        callService('light', service, { entity_id: light.entity_id })
      }
    },
    [callService]
  )

  // Get average brightness of lights (0-100)
  const getAverageBrightness = useCallback((lights: HAEntity[]): number => {
    const onLights = lights.filter((l) => l.state === 'on')
    if (onLights.length === 0) return 0

    const totalBrightness = onLights.reduce((sum, light) => {
      const brightness = light.attributes.brightness
      // brightness is 0-255, convert to 0-100
      return sum + (typeof brightness === 'number' ? (brightness / 255) * 100 : 100)
    }, 0)

    return Math.round(totalBrightness / onLights.length)
  }, [])

  // Get brightness of a single light (0-100)
  const getLightBrightness = useCallback((light: HAEntity): number => {
    if (light.state !== 'on') return 0
    const brightness = light.attributes.brightness
    if (typeof brightness !== 'number') return 100
    return Math.round((brightness / 255) * 100)
  }, [])

  return {
    setLightBrightness,
    setRoomBrightness,
    toggleLight,
    toggleRoomLights,
    getAverageBrightness,
    getLightBrightness,
  }
}
