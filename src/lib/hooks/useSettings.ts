import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'

const SETTINGS_KEY = 'stuga-settings'
const SETTINGS_CHANGE_EVENT = 'stuga-settings-change'

export type ShowScenesOption = 'auto' | 'on' | 'off'

interface Settings {
  groupByFloors: boolean
  showScenes: ShowScenesOption
}

const defaultSettings: Settings = {
  groupByFloors: true,
  showScenes: 'off',
}

// Shared settings store
let currentSettings: Settings = defaultSettings
const listeners = new Set<() => void>()

function loadSettings(): Settings {
  if (typeof window === 'undefined') return defaultSettings

  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) }
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

  const setShowScenes = useCallback((value: ShowScenesOption) => {
    updateSettingsStore({ showScenes: value })
  }, [])

  return {
    groupByFloors: settings.groupByFloors,
    setGroupByFloors,
    showScenes: settings.showScenes,
    setShowScenes,
    isLoaded: initialized,
  }
}
