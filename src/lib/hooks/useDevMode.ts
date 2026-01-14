import { useEffect, useCallback, useSyncExternalStore } from 'react'
import { STORAGE_KEYS } from '../constants'

export type MockScenario = 'none' | 'empty' | 'minimal' | 'complex' | 'edge-cases' | 'unassigned'

interface DevModeState {
  isDevMode: boolean
  activeMockScenario: MockScenario
}

const defaultState: DevModeState = {
  isDevMode: false,
  activeMockScenario: 'none',
}

// Shared state store
let currentState: DevModeState = defaultState
let listeners: Set<() => void> = new Set()

function loadState(): DevModeState {
  if (typeof window === 'undefined') return defaultState

  try {
    const isDevMode = localStorage.getItem(STORAGE_KEYS.DEV_MODE) === 'true'
    const activeMockScenario = (localStorage.getItem(STORAGE_KEYS.MOCK_SCENARIO) as MockScenario) || 'none'
    return { isDevMode, activeMockScenario }
  } catch {
    return defaultState
  }
}

function saveState(state: DevModeState) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEYS.DEV_MODE, state.isDevMode ? 'true' : 'false')
    localStorage.setItem(STORAGE_KEYS.MOCK_SCENARIO, state.activeMockScenario)
  } catch {
    // Ignore storage errors
  }
}

function notifyListeners() {
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return currentState
}

function getServerSnapshot() {
  return defaultState
}

function updateState(updates: Partial<DevModeState>) {
  currentState = { ...currentState, ...updates }
  saveState(currentState)
  notifyListeners()
}

// Initialize on first load
let initialized = false
function initializeState() {
  if (!initialized && typeof window !== 'undefined') {
    currentState = loadState()
    initialized = true
  }
}

export function useDevMode() {
  // Initialize state store
  useEffect(() => {
    initializeState()
  }, [])

  // Subscribe to state changes
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const enableDevMode = useCallback(() => {
    updateState({ isDevMode: true })
  }, [])

  const disableDevMode = useCallback(() => {
    updateState({ isDevMode: false, activeMockScenario: 'none' })
  }, [])

  const setMockScenario = useCallback((scenario: MockScenario) => {
    updateState({ activeMockScenario: scenario })
  }, [])

  return {
    isDevMode: state.isDevMode,
    activeMockScenario: state.activeMockScenario,
    enableDevMode,
    disableDevMode,
    setMockScenario,
  }
}

// Sync getter for use outside React (e.g., in useRooms)
export function getDevModeSync(): { isDevMode: boolean; activeMockScenario: MockScenario } {
  initializeState()
  return currentState
}
