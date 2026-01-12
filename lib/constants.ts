// Giraff Dashboard configuration constants
// Used for custom attributes stored in Home Assistant

export const GIRAFF_PREFIX = 'giraff-'

// Label prefixes for ordering
export const ROOM_ORDER_LABEL_PREFIX = `${GIRAFF_PREFIX}room-order-`
export const DEVICE_ORDER_LABEL_PREFIX = `${GIRAFF_PREFIX}device-order-`
export const FLOOR_ORDER_LABEL_PREFIX = `${GIRAFF_PREFIX}floor-order-`

// Label prefix for enabled domains configuration
export const DOMAINS_LABEL_PREFIX = `${GIRAFF_PREFIX}domains-`

// Default order value for items without explicit order
export const DEFAULT_ORDER = 99

// Gap between order values when reordering (allows insertions without renumbering)
export const ORDER_GAP = 10

// Long-press duration to enter reorder mode (ms)
export const LONG_PRESS_DURATION = 500

// localStorage keys for credentials
export const STORAGE_KEYS = {
  HA_URL: 'giraff-ha-url',
  HA_TOKEN: 'giraff-ha-token',
  SETUP_COMPLETE: 'giraff-setup-complete',
  ENABLED_DOMAINS: 'giraff-enabled-domains',
  SHOW_HIDDEN_ITEMS: 'giraff-show-hidden-items',
} as const
