import { useCallback, useRef } from 'react'
import { useHAConnection } from './useHAConnection'
import { getEntity, setOptimisticState } from '@/lib/ha-websocket'
import type { HAEntity } from '@/types/ha'

interface UseLightControlOptions {
  debounceMs?: number
}

export function useLightControl(options: UseLightControlOptions = {}) {
  const { debounceMs = 100 } = options
  const { callService } = useHAConnection()
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingCallsRef = useRef<Map<string, number>>(new Map())

  // Flush all pending brightness changes
  const flushPendingCalls = useCallback(() => {
    for (const [entityId, brightness] of pendingCallsRef.current) {
      if (brightness === 0) {
        void callService('light', 'turn_off', { entity_id: entityId })
      } else {
        void callService('light', 'turn_on', {
          entity_id: entityId,
          brightness_pct: brightness,
        })
      }
    }
    pendingCallsRef.current.clear()
  }, [callService])

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
    [debounceMs, flushPendingCalls]
  )

  // Set brightness for multiple lights at once
  // Can accept either a single brightness value (absolute) or a Map of per-light values (relative)
  const setRoomBrightness = useCallback(
    (lights: HAEntity[], brightnessValues: number | Map<string, number>, immediate = false) => {
      for (const light of lights) {
        const brightness =
          typeof brightnessValues === 'number'
            ? brightnessValues
            : (brightnessValues.get(light.entity_id) ?? 0)
        pendingCallsRef.current.set(
          light.entity_id,
          Math.round(Math.max(0, Math.min(100, brightness)))
        )
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
      const entity = getEntity(entityId)
      if (entity) {
        const newState = entity.state === 'on' ? 'off' : 'on'
        // For lights going on, default to full brightness
        const brightness = newState === 'on' ? 255 : undefined
        setOptimisticState(entityId, newState, brightness)
      }
      void callService('light', 'toggle', { entity_id: entityId })
    },
    [callService]
  )

  // Toggle all lights and switches in a room on/off
  const toggleRoomLights = useCallback(
    (lights: HAEntity[], switches: HAEntity[] = []) => {
      // All lights are included in room toggle
      // Only switches with device_class === 'light' are included (configured via "Show as" in HA)
      const includedSwitches = switches.filter((sw) => sw.attributes.device_class === 'light')

      // If any light or included switch is on, turn all off. Otherwise turn all on.
      const anyOn =
        lights.some((l) => l.state === 'on') || includedSwitches.some((s) => s.state === 'on')
      const newState = anyOn ? 'off' : 'on'
      const service = anyOn ? 'turn_off' : 'turn_on'

      // Apply optimistic state for all lights
      for (const light of lights) {
        const brightness = newState === 'on' ? 255 : undefined
        setOptimisticState(light.entity_id, newState, brightness)
        void callService('light', service, { entity_id: light.entity_id })
      }
      // Apply optimistic state for included switches only
      for (const sw of includedSwitches) {
        setOptimisticState(sw.entity_id, newState)
        void callService('switch', service, { entity_id: sw.entity_id })
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

  // Get brightness values for all lights as a Map
  const getLightBrightnessMap = useCallback((lights: HAEntity[]): Map<string, number> => {
    const map = new Map<string, number>()
    for (const light of lights) {
      if (light.state !== 'on') {
        map.set(light.entity_id, 0)
      } else {
        const brightness = light.attributes.brightness
        map.set(
          light.entity_id,
          typeof brightness === 'number' ? Math.round((brightness / 255) * 100) : 100
        )
      }
    }
    return map
  }, [])

  // Calculate relative brightness values based on a ratio change from starting average
  const calculateRelativeBrightness = useCallback(
    (
      startingBrightnessMap: Map<string, number>,
      startingAverage: number,
      newAverage: number
    ): Map<string, number> => {
      const result = new Map<string, number>()

      // If starting average is 0, just set all lights to the new value
      if (startingAverage === 0) {
        for (const [entityId] of startingBrightnessMap) {
          result.set(entityId, newAverage)
        }
        return result
      }

      // Calculate ratio and apply to each light
      const ratio = newAverage / startingAverage
      for (const [entityId, startBrightness] of startingBrightnessMap) {
        const newBrightness = startBrightness * ratio
        result.set(entityId, Math.max(0, Math.min(100, newBrightness)))
      }
      return result
    },
    []
  )

  return {
    setLightBrightness,
    setRoomBrightness,
    toggleLight,
    toggleRoomLights,
    getAverageBrightness,
    getLightBrightness,
    getLightBrightnessMap,
    calculateRelativeBrightness,
  }
}
