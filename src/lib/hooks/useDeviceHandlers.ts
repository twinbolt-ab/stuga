import { useCallback } from 'react'
import { useHAConnection } from './useHAConnection'
import { setOptimisticState } from '@/lib/ha-websocket'
import type { HAEntity } from '@/types/ha'

export function useDeviceHandlers() {
  const { callService } = useHAConnection()

  const handleSceneActivate = useCallback(
    (scene: HAEntity) => {
      void callService('scene', 'turn_on', { entity_id: scene.entity_id })
    },
    [callService]
  )

  const handleSwitchToggle = useCallback(
    (sw: HAEntity) => {
      const newState = sw.state === 'on' ? 'off' : 'on'
      setOptimisticState(sw.entity_id, newState)
      const service = sw.state === 'on' ? 'turn_off' : 'turn_on'
      void callService('switch', service, { entity_id: sw.entity_id })
    },
    [callService]
  )

  const handleInputBooleanToggle = useCallback(
    (input: HAEntity) => {
      const newState = input.state === 'on' ? 'off' : 'on'
      setOptimisticState(input.entity_id, newState)
      const service = input.state === 'on' ? 'turn_off' : 'turn_on'
      void callService('input_boolean', service, { entity_id: input.entity_id })
    },
    [callService]
  )

  const handleInputNumberChange = useCallback(
    (input: HAEntity, value: number) => {
      void callService('input_number', 'set_value', { entity_id: input.entity_id, value })
    },
    [callService]
  )

  const handleFanToggle = useCallback(
    (fan: HAEntity) => {
      const newState = fan.state === 'on' ? 'off' : 'on'
      setOptimisticState(fan.entity_id, newState)
      const service = fan.state === 'on' ? 'turn_off' : 'turn_on'
      void callService('fan', service, { entity_id: fan.entity_id })
    },
    [callService]
  )

  const handleCoverToggle = useCallback(
    (cover: HAEntity) => {
      // While moving, tap stops. Otherwise, toggle: closed → open; open/partial → close.
      if (cover.state === 'opening' || cover.state === 'closing') {
        void callService('cover', 'stop_cover', { entity_id: cover.entity_id })
        return
      }
      const isClosed = cover.state === 'closed'
      const service = isClosed ? 'open_cover' : 'close_cover'
      setOptimisticState(cover.entity_id, isClosed ? 'opening' : 'closing')
      void callService('cover', service, { entity_id: cover.entity_id })
    },
    [callService]
  )

  const handleCoverPosition = useCallback(
    (cover: HAEntity, position: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(position)))
      // Optimistic: while moving we don't know exact position, but mark direction.
      const current =
        typeof cover.attributes.current_position === 'number'
          ? cover.attributes.current_position
          : cover.state === 'open'
            ? 100
            : 0
      if (clamped > current) {
        setOptimisticState(cover.entity_id, 'opening')
      } else if (clamped < current) {
        setOptimisticState(cover.entity_id, 'closing')
      }
      void callService('cover', 'set_cover_position', {
        entity_id: cover.entity_id,
        position: clamped,
      })
    },
    [callService]
  )

  return {
    handleSceneActivate,
    handleSwitchToggle,
    handleInputBooleanToggle,
    handleInputNumberChange,
    handleFanToggle,
    handleCoverToggle,
    handleCoverPosition,
  }
}
