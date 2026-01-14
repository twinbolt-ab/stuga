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

export function generateMinimalHome(): MockData {
  const floors: HAFloor[] = [
    { floor_id: 'ground_floor', name: 'Ground Floor', level: 0, icon: 'mdi:home-floor-g' },
  ]

  // Living Room entities
  const livingRoomDevices: HAEntity[] = [
    createEntity('light.living_ceiling', 'on', {
      friendly_name: 'Ceiling Light',
      brightness: 255,
      area: 'Living Room',
    }),
    createEntity('light.living_lamp', 'off', {
      friendly_name: 'Floor Lamp',
      brightness: 0,
      area: 'Living Room',
    }),
    createEntity('sensor.living_temperature', '21.5', {
      friendly_name: 'Temperature',
      device_class: 'temperature',
      unit_of_measurement: '°C',
      area: 'Living Room',
    }),
    createEntity('switch.living_tv', 'off', {
      friendly_name: 'TV Power',
      area: 'Living Room',
    }),
  ]

  // Bedroom entities
  const bedroomDevices: HAEntity[] = [
    createEntity('light.bedroom_main', 'off', {
      friendly_name: 'Main Light',
      brightness: 0,
      area: 'Bedroom',
    }),
    createEntity('light.bedroom_bedside', 'on', {
      friendly_name: 'Bedside Lamp',
      brightness: 128,
      area: 'Bedroom',
    }),
    createEntity('sensor.bedroom_temperature', '19.8', {
      friendly_name: 'Temperature',
      device_class: 'temperature',
      unit_of_measurement: '°C',
      area: 'Bedroom',
    }),
  ]

  const rooms: RoomWithDevices[] = [
    {
      id: 'living-room',
      name: 'Living Room',
      areaId: 'living_room',
      floorId: 'ground_floor',
      icon: 'mdi:sofa',
      devices: livingRoomDevices,
      lightsOn: 1,
      totalLights: 2,
      temperature: 21.5,
      order: 10,
    },
    {
      id: 'bedroom',
      name: 'Bedroom',
      areaId: 'bedroom',
      floorId: 'ground_floor',
      icon: 'mdi:bed',
      devices: bedroomDevices,
      lightsOn: 1,
      totalLights: 2,
      temperature: 19.8,
      order: 20,
    },
  ]

  return { rooms, floors }
}
