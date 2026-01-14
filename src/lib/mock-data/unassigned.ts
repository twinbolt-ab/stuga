import type { HAEntity, HAFloor, RoomWithDevices } from '@/types/ha'
import type { MockData } from './index'

// Fixed timestamp for stable mock data
const MOCK_TIMESTAMP = '2024-01-01T12:00:00.000Z'

function createEntity(
  entityId: string,
  state: string,
  attributes: Record<string, unknown> = {}
): HAEntity {
  return {
    entity_id: entityId,
    state,
    attributes: {
      friendly_name: attributes.friendly_name as string || entityId.split('.')[1].replace(/_/g, ' '),
      ...attributes,
    },
    last_changed: MOCK_TIMESTAMP,
    last_updated: MOCK_TIMESTAMP,
  }
}

export function generateUnassignedDevices(): MockData {
  // No floors defined
  const floors: HAFloor[] = []

  // Devices without any room/area assignment - these won't appear in any room
  // This simulates a user who has added devices but hasn't organized them yet
  const unassignedDevices: HAEntity[] = [
    createEntity('light.smart_bulb_1', 'on', {
      friendly_name: 'Smart Bulb 1',
      brightness: 200,
      // No area attribute
    }),
    createEntity('light.smart_bulb_2', 'off', {
      friendly_name: 'Smart Bulb 2',
      brightness: 0,
    }),
    createEntity('light.kitchen_pendant', 'on', {
      friendly_name: 'Kitchen Pendant',
      brightness: 255,
    }),
    createEntity('switch.smart_plug_1', 'on', {
      friendly_name: 'Smart Plug 1',
    }),
    createEntity('switch.smart_plug_2', 'off', {
      friendly_name: 'Smart Plug 2',
    }),
    createEntity('sensor.temperature_sensor_1', '22.5', {
      friendly_name: 'Temperature Sensor',
      device_class: 'temperature',
      unit_of_measurement: '°C',
    }),
    createEntity('sensor.humidity_sensor_1', '45', {
      friendly_name: 'Humidity Sensor',
      device_class: 'humidity',
      unit_of_measurement: '%',
    }),
    createEntity('climate.thermostat_1', 'heat', {
      friendly_name: 'Smart Thermostat',
      current_temperature: 21,
      temperature: 22,
      hvac_modes: ['off', 'heat', 'cool', 'auto'],
    }),
    createEntity('cover.blinds_1', 'open', {
      friendly_name: 'Smart Blinds',
      current_position: 100,
    }),
  ]

  // No rooms since devices have no area assignments
  // The dashboard should show an empty state or prompt to organize devices
  const rooms: RoomWithDevices[] = []

  return { rooms, floors, uncategorizedEntities: unassignedDevices }
}
