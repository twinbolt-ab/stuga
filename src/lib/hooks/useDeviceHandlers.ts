import { useCallback } from 'react'
import { useHAConnection } from './useHAConnection'
import type { HAEntity } from '@/types/ha'

export function useDeviceHandlers() {
  const { callService } = useHAConnection()

  const handleSceneActivate = useCallback(
    (scene: HAEntity) => {
      callService('scene', 'turn_on', { entity_id: scene.entity_id })
    },
    [callService]
  )

  const handleSwitchToggle = useCallback(
    (sw: HAEntity) => {
      const service = sw.state === 'on' ? 'turn_off' : 'turn_on'
      callService('switch', service, { entity_id: sw.entity_id })
    },
    [callService]
  )

  const handleInputBooleanToggle = useCallback(
    (input: HAEntity) => {
      const service = input.state === 'on' ? 'turn_off' : 'turn_on'
      callService('input_boolean', service, { entity_id: input.entity_id })
    },
    [callService]
  )

  const handleInputNumberChange = useCallback(
    (input: HAEntity, value: number) => {
      callService('input_number', 'set_value', { entity_id: input.entity_id, value })
    },
    [callService]
  )

  const handleClimateToggle = useCallback(
    (climate: HAEntity) => {
      const service = climate.state === 'off' ? 'turn_on' : 'turn_off'
      callService('climate', service, { entity_id: climate.entity_id })
    },
    [callService]
  )

  const handleCoverOpen = useCallback(
    (cover: HAEntity) => {
      callService('cover', 'open_cover', { entity_id: cover.entity_id })
    },
    [callService]
  )

  const handleCoverClose = useCallback(
    (cover: HAEntity) => {
      callService('cover', 'close_cover', { entity_id: cover.entity_id })
    },
    [callService]
  )

  const handleCoverStop = useCallback(
    (cover: HAEntity) => {
      callService('cover', 'stop_cover', { entity_id: cover.entity_id })
    },
    [callService]
  )

  const handleFanToggle = useCallback(
    (fan: HAEntity) => {
      const service = fan.state === 'on' ? 'turn_off' : 'turn_on'
      callService('fan', service, { entity_id: fan.entity_id })
    },
    [callService]
  )

  return {
    handleSceneActivate,
    handleSwitchToggle,
    handleInputBooleanToggle,
    handleInputNumberChange,
    handleClimateToggle,
    handleCoverOpen,
    handleCoverClose,
    handleCoverStop,
    handleFanToggle,
  }
}
