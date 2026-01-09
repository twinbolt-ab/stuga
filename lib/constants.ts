// Giraff Dashboard configuration constants
// Used for custom attributes stored in Home Assistant

export const GIRAFF_PREFIX = 'giraff-'

// Label prefixes for ordering
export const ROOM_ORDER_LABEL_PREFIX = `${GIRAFF_PREFIX}room-order-`
export const DEVICE_ORDER_LABEL_PREFIX = `${GIRAFF_PREFIX}device-order-`

// Default order value for items without explicit order
export const DEFAULT_ORDER = 99

// Gap between order values when reordering (allows insertions without renumbering)
export const ORDER_GAP = 10

// Long-press duration to enter reorder mode (ms)
export const LONG_PRESS_DURATION = 500
