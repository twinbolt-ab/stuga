import { useEffect, useCallback, useSyncExternalStore } from 'react'

const SETTINGS_KEY = 'stuga-settings'

export type GridColumnsOption = 1 | 2 | 3

interface Settings {
  groupByFloors: boolean
  roomOrderingEnabled: boolean
  showTemperature: boolean
  showHumidity: boolean
  gridColumns: GridColumnsOption
}

const defaultSettings: Settings = {
  groupByFloors: true,
  roomOrderingEnabled: true,
  showTemperature: true,
  showHumidity: false,
  gridColumns: 2,
}

// Shared settings store
let currentSettings: Settings = defaultSettings
const listeners = new Set<() => void>()

function loadSettings(): Settings {
  if (typeof window === 'undefined') return defaultSettings

  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (typeof parsed === 'object' && parsed !== null) {
        return { ...defaultSettings, ...(parsed as Partial<Settings>) }
      }
    }
  } catch {
    // Ignore parse errors
  }
  return defaultSettings
}

function saveSettings(settings: Settings) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors
  }
}

function notifyListeners() {
  listeners.forEach((listener) => {
    listener()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return currentSettings
}

function getServerSnapshot() {
  return defaultSettings
}

function updateSettingsStore(updates: Partial<Settings>) {
  currentSettings = { ...currentSettings, ...updates }
  saveSettings(currentSettings)
  notifyListeners()
}

// Initialize on first load
let initialized = false
function initializeSettings() {
  if (!initialized && typeof window !== 'undefined') {
    currentSettings = loadSettings()
    initialized = true
  }
}

export function useSettings() {
  // Initialize settings store
  useEffect(() => {
    initializeSettings()
  }, [])

  // Subscribe to settings changes
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setGroupByFloors = useCallback((value: boolean) => {
    updateSettingsStore({ groupByFloors: value })
  }, [])

  const setRoomOrderingEnabled = useCallback((value: boolean) => {
    updateSettingsStore({ roomOrderingEnabled: value })
  }, [])

  const setShowTemperature = useCallback((value: boolean) => {
    updateSettingsStore({ showTemperature: value })
  }, [])

  const setShowHumidity = useCallback((value: boolean) => {
    updateSettingsStore({ showHumidity: value })
  }, [])

  const setGridColumns = useCallback((value: GridColumnsOption) => {
    updateSettingsStore({ gridColumns: value })
  }, [])

  return {
    groupByFloors: settings.groupByFloors,
    setGroupByFloors,
    roomOrderingEnabled: settings.roomOrderingEnabled,
    setRoomOrderingEnabled,
    showTemperature: settings.showTemperature,
    setShowTemperature,
    showHumidity: settings.showHumidity,
    setShowHumidity,
    gridColumns: settings.gridColumns,
    setGridColumns,
    isLoaded: initialized,
  }
}
