import { useSyncExternalStore } from 'react'

// Always returns true on client, false during SSR
// Uses useSyncExternalStore to avoid hydration mismatch
const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
