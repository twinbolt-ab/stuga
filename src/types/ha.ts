export interface HAEntity {
  entity_id: string
  state: string
  attributes: {
    friendly_name?: string
    device_class?: string
    unit_of_measurement?: string
    brightness?: number
    [key: string]: unknown
  }
  last_changed: string
  last_updated: string
}

export interface HAArea {
  area_id: string
  name: string
  picture?: string
  labels?: string[]
}

export interface HALabel {
  label_id: string
  name: string
  description?: string
  color?: string
  icon?: string
}

export interface AreaRegistryEntry {
  area_id: string
  name: string
  picture?: string
  labels?: string[]
  floor_id?: string
  icon?: string
}

export interface HAFloor {
  floor_id: string
  name: string
  level?: number
  icon?: string
  labels?: string[]
}

export interface EntityRegistryEntry {
  entity_id: string
  area_id?: string
  device_id?: string
  labels?: string[]
  name?: string
  icon?: string
  disabled_by?: string
  hidden_by?: string
  device_class?: string | null
  original_device_class?: string | null
  entity_category?: 'config' | 'diagnostic' | null
}

export interface HADevice {
  id: string
  name: string
  area_id?: string
}

export type EntityDomain =
  | 'light'
  | 'switch'
  | 'sensor'
  | 'binary_sensor'
  | 'climate'
  | 'cover'
  | 'lock'
  | 'vacuum'
  | 'scene'

export interface RoomWithDevices {
  id: string
  name: string
  areaId?: string
  floorId?: string
  icon?: string
  devices: HAEntity[]
  lightsOn: number
  totalLights: number
  temperature?: number
  humidity?: number
  order?: number
}

export interface WebSocketMessage {
  id?: number
  type: string
  event_type?: string
  event?: {
    event_type: string
    data: {
      entity_id: string
      new_state: HAEntity
      old_state: HAEntity
    }
  }
  result?: unknown
  success?: boolean
  access_token?: string
  error?: {
    code: string
    message: string
  }
}

export interface ServiceCallPayload {
  domain: string
  service: string
  service_data?: {
    entity_id?: string | string[]
    brightness?: number
    brightness_pct?: number
    [key: string]: unknown
  }
}

// Configurable domains that can be shown in the dashboard
export type ConfigurableDomain =
  | 'light'
  | 'switch'
  | 'scene'
  | 'input_boolean'
  | 'input_number'
  | 'climate'
  | 'cover'
  | 'fan'
  | 'vacuum'
  | 'media_player'

export const DEFAULT_ENABLED_DOMAINS: ConfigurableDomain[] = [
  'light',
  'switch',
  'scene',
  'input_boolean',
  'input_number',
]

export const ALL_CONFIGURABLE_DOMAINS: ConfigurableDomain[] = [
  'light',
  'switch',
  'scene',
  'input_boolean',
  'input_number',
  'climate',
  'cover',
  'fan',
]

// Type guards for runtime validation
export function isHALabel(value: unknown): value is HALabel {
  return (
    typeof value === 'object' &&
    value !== null &&
    'label_id' in value &&
    'name' in value &&
    typeof (value as HALabel).label_id === 'string' &&
    typeof (value as HALabel).name === 'string'
  )
}

export function isHAFloor(value: unknown): value is HAFloor {
  return (
    typeof value === 'object' &&
    value !== null &&
    'floor_id' in value &&
    'name' in value &&
    typeof (value as HAFloor).floor_id === 'string' &&
    typeof (value as HAFloor).name === 'string'
  )
}

export function isAreaRegistryEntry(value: unknown): value is AreaRegistryEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'area_id' in value &&
    'name' in value &&
    typeof (value as AreaRegistryEntry).area_id === 'string' &&
    typeof (value as AreaRegistryEntry).name === 'string'
  )
}
