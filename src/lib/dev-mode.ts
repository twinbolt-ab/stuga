import { STORAGE_KEYS } from './constants'

export type MockScenario =
  | 'none'
  | 'empty'
  | 'minimal'
  | 'complex'
  | 'edge-cases'
  | 'unassigned'
  | 'apartment'

export interface DevModeState {
  isDevMode: boolean
  activeMockScenario: MockScenario
}

const defaultState: DevModeState = {
  isDevMode: false,
  activeMockScenario: 'none',
}

let currentState: DevModeState = defaultState
const listeners = new Set<() => void>()

function loadState(): DevModeState {
  if (typeof window === 'undefined') return defaultState

  try {
    const isDevMode = localStorage.getItem(STORAGE_KEYS.DEV_MODE) === 'true'
    const activeMockScenario =
      (localStorage.getItem(STORAGE_KEYS.MOCK_SCENARIO) as MockScenario) || 'none'
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
  listeners.forEach((listener) => {
    listener()
  })
}

let initialized = false
function initializeState() {
  if (!initialized && typeof window !== 'undefined') {
    currentState = loadState()
    initialized = true
  }
}

export function subscribeDevMode(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDevModeSnapshot(): DevModeState {
  return currentState
}

export function getDevModeServerSnapshot(): DevModeState {
  return defaultState
}

export function updateDevModeState(updates: Partial<DevModeState>): void {
  currentState = { ...currentState, ...updates }
  saveState(currentState)
  notifyListeners()
}

/** Sync getter for use outside React (services, routes). */
export function getDevModeSync(): DevModeState {
  initializeState()
  return currentState
}

export function ensureDevModeInitialized(): void {
  initializeState()
}
