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

export function generateEdgeCases(): MockData {
  // Only 2 floors - some rooms will have no floor
  const floors: HAFloor[] = [
    { floor_id: 'ground_floor', name: 'Ground Floor', level: 0, icon: 'mdi:home-floor-g' },
    { floor_id: 'upper_floor', name: 'Upper Floor', level: 1, icon: 'mdi:home-floor-1' },
  ]

  const rooms: RoomWithDevices[] = [
    // Normal room on ground floor
    {
      id: 'living-room',
      name: 'Living Room',
      areaId: 'living_room',
      floorId: 'ground_floor',
      icon: 'mdi:sofa',
      devices: [
        createEntity('light.living_main', 'on', { friendly_name: 'Main Light', brightness: 255, area: 'Living Room' }),
        createEntity('light.living_accent', 'off', { friendly_name: 'Accent Light', area: 'Living Room' }),
      ],
      lightsOn: 1,
      totalLights: 2,
      temperature: 21.5,
      order: 10,
    },

    // Room with VERY long name
    {
      id: 'super-long-name-room',
      name: 'The Extremely Long Named Room That Should Test Text Truncation',
      areaId: 'long_room',
      floorId: 'ground_floor',
      devices: [
        createEntity('light.long_main', 'on', {
          friendly_name: 'Super Duper Extremely Long Light Name That Should Be Truncated',
          brightness: 200,
          area: 'The Extremely Long Named Room That Should Test Text Truncation',
        }),
      ],
      lightsOn: 1,
      totalLights: 1,
      order: 20,
    },

    // Room with NO floor assignment (should appear in "Other")
    {
      id: 'attic',
      name: 'Attic',
      areaId: 'attic',
      // No floorId - orphan room
      icon: 'mdi:home-roof',
      devices: [
        createEntity('light.attic_main', 'off', { friendly_name: 'Attic Light', area: 'Attic' }),
        createEntity('sensor.attic_temperature', '28.5', {
          friendly_name: 'Temperature',
          device_class: 'temperature',
          unit_of_measurement: '°C',
          area: 'Attic',
        }),
      ],
      lightsOn: 0,
      totalLights: 1,
      temperature: 28.5,
      order: 30,
    },

    // Another orphan room
    {
      id: 'shed',
      name: 'Garden Shed',
      areaId: 'shed',
      // No floorId
      icon: 'mdi:greenhouse',
      devices: [
        createEntity('light.shed_main', 'on', { friendly_name: 'Shed Light', brightness: 128, area: 'Garden Shed' }),
      ],
      lightsOn: 1,
      totalLights: 1,
      order: 40,
    },

    // Room with ONLY sensors (no controllable devices)
    {
      id: 'weather-station',
      name: 'Weather Station',
      areaId: 'weather',
      floorId: 'upper_floor',
      icon: 'mdi:weather-partly-cloudy',
      devices: [
        createEntity('sensor.weather_temperature', '15.2', {
          friendly_name: 'Outdoor Temperature',
          device_class: 'temperature',
          unit_of_measurement: '°C',
          area: 'Weather Station',
        }),
        createEntity('sensor.weather_humidity', '72', {
          friendly_name: 'Outdoor Humidity',
          device_class: 'humidity',
          unit_of_measurement: '%',
          area: 'Weather Station',
        }),
        createEntity('sensor.weather_pressure', '1013', {
          friendly_name: 'Pressure',
          device_class: 'pressure',
          unit_of_measurement: 'hPa',
          area: 'Weather Station',
        }),
      ],
      lightsOn: 0,
      totalLights: 0,
      temperature: 15.2,
      humidity: 72,
      order: 50,
    },

    // Room on upper floor
    {
      id: 'bedroom',
      name: 'Bedroom',
      areaId: 'bedroom',
      floorId: 'upper_floor',
      icon: 'mdi:bed',
      devices: [
        createEntity('light.bedroom_main', 'off', { friendly_name: 'Main Light', area: 'Bedroom' }),
        createEntity('light.bedroom_bedside_left', 'on', { friendly_name: 'Bedside Left', brightness: 64, area: 'Bedroom' }),
        createEntity('light.bedroom_bedside_right', 'off', { friendly_name: 'Bedside Right', area: 'Bedroom' }),
      ],
      lightsOn: 1,
      totalLights: 3,
      temperature: 19.0,
      order: 60,
    },

    // Third orphan room to test "Other" tab
    {
      id: 'pool',
      name: 'Pool Area',
      areaId: 'pool',
      // No floorId
      icon: 'mdi:pool',
      devices: [
        createEntity('light.pool_underwater', 'on', { friendly_name: 'Underwater Lights', brightness: 180, area: 'Pool Area' }),
        createEntity('light.pool_deck', 'on', { friendly_name: 'Deck Lights', brightness: 255, area: 'Pool Area' }),
        createEntity('switch.pool_pump', 'on', { friendly_name: 'Pool Pump', area: 'Pool Area' }),
        createEntity('sensor.pool_temperature', '26.5', {
          friendly_name: 'Water Temperature',
          device_class: 'temperature',
          unit_of_measurement: '°C',
          area: 'Pool Area',
        }),
      ],
      lightsOn: 2,
      totalLights: 2,
      temperature: 26.5,
      order: 70,
    },
  ]

  return { rooms, floors }
}
