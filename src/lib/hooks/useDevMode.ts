import { useEffect, useCallback, useSyncExternalStore } from 'react'
import {
  ensureDevModeInitialized,
  getDevModeServerSnapshot,
  getDevModeSnapshot,
  subscribeDevMode,
  updateDevModeState,
  type MockScenario,
} from '../dev-mode'

export type { MockScenario }

export function useDevMode() {
  useEffect(() => {
    ensureDevModeInitialized()
  }, [])

  const state = useSyncExternalStore(subscribeDevMode, getDevModeSnapshot, getDevModeServerSnapshot)

  const enableDevMode = useCallback(() => {
    updateDevModeState({ isDevMode: true })
  }, [])

  const disableDevMode = useCallback(() => {
    updateDevModeState({ isDevMode: false, activeMockScenario: 'none' })
  }, [])

  const setMockScenario = useCallback((scenario: MockScenario) => {
    updateDevModeState({ activeMockScenario: scenario })
  }, [])

  return {
    isDevMode: state.isDevMode,
    activeMockScenario: state.activeMockScenario,
    enableDevMode,
    disableDevMode,
    setMockScenario,
  }
}
