import { useCallback } from 'react'
import { useHAConnection } from './useHAConnection'
import { setOptimisticState, getCoverSettings } from '@/lib/ha-websocket'
import { userToHaPosition, supportsCoverFeature, COVER_FEATURE } from '@/lib/utils/cover'
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
      // Trust is_closed when present (more reliable than state for IKEA Tradfri shades).
      const haIsClosed =
        typeof cover.attributes.is_closed === 'boolean'
          ? cover.attributes.is_closed
          : cover.state === 'closed'
      const settings = getCoverSettings(cover.entity_id)
      const userIsClosed = settings.inverted ? !haIsClosed : haIsClosed
      const userWantsToOpen = userIsClosed

      // When closing, honor the user's custom "fully closed" position by sending
      // set_cover_position to that target instead of close_cover.
      if (
        !userWantsToOpen &&
        settings.closedPrc > 0 &&
        supportsCoverFeature(cover, COVER_FEATURE.SET_POSITION)
      ) {
        const haTarget = userToHaPosition(0, settings)
        const current =
          typeof cover.attributes.current_position === 'number'
            ? cover.attributes.current_position
            : haIsClosed
              ? 0
              : 100
        if (haTarget !== current) {
          setOptimisticState(cover.entity_id, haTarget > current ? 'opening' : 'closing')
        }
        void callService('cover', 'set_cover_position', {
          entity_id: cover.entity_id,
          position: haTarget,
        })
        return
      }

      // XOR: if the cover is inverted in Stuga, "open" the user-facing direction
      // means closing in HA's frame.
      const wantHaOpen = userWantsToOpen !== settings.inverted
      const service = wantHaOpen ? 'open_cover' : 'close_cover'
      setOptimisticState(cover.entity_id, wantHaOpen ? 'opening' : 'closing')
      void callService('cover', service, { entity_id: cover.entity_id })
    },
    [callService]
  )

  const handleCoverPosition = useCallback(
    // `userPosition` is in user space (0-100). Map to HA's frame using the
    // per-entity Stuga settings before sending.
    (cover: HAEntity, userPosition: number) => {
      const settings = getCoverSettings(cover.entity_id)
      const haTarget = userToHaPosition(userPosition, settings)
      // Optimistic: while moving we don't know exact position, but mark direction.
      const current =
        typeof cover.attributes.current_position === 'number'
          ? cover.attributes.current_position
          : cover.state === 'open'
            ? 100
            : 0
      if (haTarget > current) {
        setOptimisticState(cover.entity_id, 'opening')
      } else if (haTarget < current) {
        setOptimisticState(cover.entity_id, 'closing')
      }
      void callService('cover', 'set_cover_position', {
        entity_id: cover.entity_id,
        position: haTarget,
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
