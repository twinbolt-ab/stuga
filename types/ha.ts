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

export interface EntityRegistryEntry {
  entity_id: string
  area_id?: string
  device_id?: string
  labels?: string[]
  name?: string
  icon?: string
  disabled_by?: string
  hidden_by?: string
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
