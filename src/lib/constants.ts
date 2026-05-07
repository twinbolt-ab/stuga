// Stuga Dashboard configuration constants
// Used for custom attributes stored in Home Assistant

export const STUGA_PREFIX = 'stuga-'

// Label prefixes for ordering
export const ROOM_ORDER_LABEL_PREFIX = `${STUGA_PREFIX}room-order-`
export const DEVICE_ORDER_LABEL_PREFIX = `${STUGA_PREFIX}device-order-`
export const FLOOR_ORDER_LABEL_PREFIX = `${STUGA_PREFIX}floor-order-`

// Label prefix for enabled domains configuration
export const DOMAINS_LABEL_PREFIX = `${STUGA_PREFIX}domains-`

// Label prefixes for favorites (A=scenes, B=rooms, C=entities)
export const FAVORITE_LABEL_PREFIX = `${STUGA_PREFIX}favorite-`
export const FAVORITE_SCENE_PREFIX = `${FAVORITE_LABEL_PREFIX}A-`
export const FAVORITE_ROOM_PREFIX = `${FAVORITE_LABEL_PREFIX}B-`
export const FAVORITE_ENTITY_PREFIX = `${FAVORITE_LABEL_PREFIX}C-`

// Special floor ID for favorites tab
export const FAVORITES_FLOOR_ID = '__favorites__'

// Label prefix for selected temperature sensor per area (stores entity_id)
export const TEMPERATURE_SENSOR_LABEL_PREFIX = `${STUGA_PREFIX}temp-`

// Label for entities hidden in Stuga (but not necessarily in HA)
export const STUGA_HIDDEN_LABEL = `${STUGA_PREFIX}hidden`

// Per-cover Stuga-side overrides (HA's reported direction/range can be wrong on
// some integrations — see CoversSection.tsx for usage).
// Single label, presence means inverted.
export const COVER_INVERTED_LABEL = `${STUGA_PREFIX}cover-inverted`
// Prefix label encoding the HA-position the user calls "fully closed" (0-100).
// e.g. `stuga-cover-closed-prc-70` means HA position 70 (after inversion) is
// the user's closed position.
export const COVER_CLOSED_PRC_PREFIX = `${STUGA_PREFIX}cover-closed-prc-`

// Default order value for items without explicit order
export const DEFAULT_ORDER = 99

// Gap between order values when reordering (allows insertions without renumbering)
export const ORDER_GAP = 10

// Long-press duration to enter reorder mode (ms)
export const LONG_PRESS_DURATION = 500

// WebSocket reconnect delay (ms)
export const RECONNECT_DELAY = 5000

// Duration for optimistic UI updates before reverting (ms)
export const OPTIMISTIC_DURATION = 5000

// Delay before hiding brightness/overlay UI elements (ms)
export const OVERLAY_HIDE_DELAY = 300

// Room expand/collapse animation duration (seconds)
export const ROOM_EXPAND_DURATION = 0.25

// localStorage keys for credentials and settings
export const STORAGE_KEYS = {
  HA_URL: 'stuga-ha-url',
  HA_TOKEN: 'stuga-ha-token',
  SETUP_COMPLETE: 'stuga-setup-complete',
  ENABLED_DOMAINS: 'stuga-enabled-domains',
  DEV_MODE: 'stuga-dev-mode',
  MOCK_SCENARIO: 'stuga-mock-scenario',
  STRUCTURE_HINT_DISMISSED: 'stuga-structure-hint-dismissed',
  FLOORS_HINT_DISMISSED: 'stuga-floors-hint-dismissed',
  DEBUG_ID: 'stuga-debug-id',
  // Ordering
  ENTITY_ORDER_PREFIX: 'stuga-entity-order-',
  ROOM_ORDER: 'stuga-room-order',
  ROOM_ORDER_MIGRATED: 'stuga-room-order-migrated',
  ROOM_ORDER_SYNC_TO_HA: 'stuga-room-order-sync-to-ha',
  CUSTOM_ORDER_ENABLED: 'stuga-custom-order-enabled',
  RATE_APP_DISMISSED: 'stuga-rate-app-dismissed-v2',
  // Layout cache for optimistic loading
  LAYOUT_CACHE: 'stuga-layout-cache',
} as const

/**
 * Get the scroll container element (#root on iOS to prevent viewport scrolling)
 */
export function getScrollContainer(): HTMLElement {
  return document.getElementById('root') || document.documentElement
}

/**
 * Get the current scroll position
 */
export function getScrollTop(): number {
  return getScrollContainer().scrollTop
}

/**
 * Scroll to a position within the app container
 */
export function scrollTo(options: { top: number; behavior?: ScrollBehavior }): void {
  getScrollContainer().scrollTo(options)
}
