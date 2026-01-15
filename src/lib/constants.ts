// Stuga Dashboard configuration constants
// Used for custom attributes stored in Home Assistant

export const STUGA_PREFIX = 'stuga-'

// Label prefixes for ordering
export const ROOM_ORDER_LABEL_PREFIX = `${STUGA_PREFIX}room-order-`
export const DEVICE_ORDER_LABEL_PREFIX = `${STUGA_PREFIX}device-order-`
export const FLOOR_ORDER_LABEL_PREFIX = `${STUGA_PREFIX}floor-order-`

// Label prefix for enabled domains configuration
export const DOMAINS_LABEL_PREFIX = `${STUGA_PREFIX}domains-`

// Label prefix for selected temperature sensor per area (stores entity_id)
export const TEMPERATURE_SENSOR_LABEL_PREFIX = `${STUGA_PREFIX}temp-`

// Default order value for items without explicit order
export const DEFAULT_ORDER = 99

// Gap between order values when reordering (allows insertions without renumbering)
export const ORDER_GAP = 10

// Long-press duration to enter reorder mode (ms)
export const LONG_PRESS_DURATION = 500

// localStorage keys for credentials
export const STORAGE_KEYS = {
  HA_URL: 'stuga-ha-url',
  HA_TOKEN: 'stuga-ha-token',
  SETUP_COMPLETE: 'stuga-setup-complete',
  ENABLED_DOMAINS: 'stuga-enabled-domains',
  SHOW_HIDDEN_ITEMS: 'stuga-show-hidden-items',
  DEV_MODE: 'stuga-dev-mode',
  MOCK_SCENARIO: 'stuga-mock-scenario',
} as const
