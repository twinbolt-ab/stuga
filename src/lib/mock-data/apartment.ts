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
      friendly_name:
        (attributes.friendly_name as string) || entityId.split('.')[1].replace(/_/g, ' '),
      ...attributes,
    },
    last_changed: MOCK_TIMESTAMP,
    last_updated: MOCK_TIMESTAMP,
  }
}

export function generateApartment(): MockData {
  // No floors - typical apartment setup
  const floors: HAFloor[] = []

  // Living Room entities
  const livingRoomDevices: HAEntity[] = [
    createEntity('light.living_ceiling', 'on', {
      friendly_name: 'Ceiling Light',
      brightness: 255,
    }),
    createEntity('light.living_floor_lamp', 'on', {
      friendly_name: 'Floor Lamp',
      brightness: 180,
    }),
    createEntity('light.living_tv_backlight', 'off', {
      friendly_name: 'TV Backlight',
      brightness: 0,
    }),
    createEntity('sensor.living_temperature', '22.3', {
      friendly_name: 'Temperature',
      device_class: 'temperature',
      unit_of_measurement: '°C',
    }),
    createEntity('switch.living_tv', 'on', {
      friendly_name: 'TV',
    }),
    createEntity('media_player.living_sonos', 'playing', {
      friendly_name: 'Sonos',
      media_title: 'Chill Vibes',
    }),
  ]

  // Kitchen entities
  const kitchenDevices: HAEntity[] = [
    createEntity('light.kitchen_main', 'on', {
      friendly_name: 'Main Light',
      brightness: 255,
    }),
    createEntity('light.kitchen_counter', 'on', {
      friendly_name: 'Counter Lights',
      brightness: 200,
    }),
    createEntity('sensor.kitchen_temperature', '23.1', {
      friendly_name: 'Temperature',
      device_class: 'temperature',
      unit_of_measurement: '°C',
    }),
    createEntity('switch.kitchen_coffee', 'off', {
      friendly_name: 'Coffee Machine',
    }),
  ]

  // Bedroom entities
  const bedroomDevices: HAEntity[] = [
    createEntity('light.bedroom_ceiling', 'off', {
      friendly_name: 'Ceiling Light',
      brightness: 0,
    }),
    createEntity('light.bedroom_bedside_left', 'on', {
      friendly_name: 'Bedside Left',
      brightness: 80,
    }),
    createEntity('light.bedroom_bedside_right', 'off', {
      friendly_name: 'Bedside Right',
      brightness: 0,
    }),
    createEntity('sensor.bedroom_temperature', '19.5', {
      friendly_name: 'Temperature',
      device_class: 'temperature',
      unit_of_measurement: '°C',
    }),
    createEntity('cover.bedroom_blinds', 'closed', {
      friendly_name: 'Blinds',
      current_position: 0,
    }),
  ]

  // Bathroom entities
  const bathroomDevices: HAEntity[] = [
    createEntity('light.bathroom_main', 'off', {
      friendly_name: 'Main Light',
      brightness: 0,
    }),
    createEntity('light.bathroom_mirror', 'off', {
      friendly_name: 'Mirror Light',
      brightness: 0,
    }),
    createEntity('sensor.bathroom_temperature', '21.0', {
      friendly_name: 'Temperature',
      device_class: 'temperature',
      unit_of_measurement: '°C',
    }),
    createEntity('sensor.bathroom_humidity', '65', {
      friendly_name: 'Humidity',
      device_class: 'humidity',
      unit_of_measurement: '%',
    }),
  ]

  // Hallway entities
  const hallwayDevices: HAEntity[] = [
    createEntity('light.hallway_main', 'off', {
      friendly_name: 'Hallway Light',
      brightness: 0,
    }),
    createEntity('lock.front_door', 'locked', {
      friendly_name: 'Front Door',
    }),
  ]

  const rooms: RoomWithDevices[] = [
    {
      id: 'living-room',
      name: 'Living Room',
      areaId: 'living_room',
      floorId: undefined,
      icon: 'mdi:sofa',
      devices: livingRoomDevices,
      lightsOn: 2,
      totalLights: 3,
      temperature: 22.3,
      order: 10,
    },
    {
      id: 'kitchen',
      name: 'Kitchen',
      areaId: 'kitchen',
      floorId: undefined,
      icon: 'mdi:stove',
      devices: kitchenDevices,
      lightsOn: 2,
      totalLights: 2,
      temperature: 23.1,
      order: 20,
    },
    {
      id: 'bedroom',
      name: 'Bedroom',
      areaId: 'bedroom',
      floorId: undefined,
      icon: 'mdi:bed',
      devices: bedroomDevices,
      lightsOn: 1,
      totalLights: 3,
      temperature: 19.5,
      order: 30,
    },
    {
      id: 'bathroom',
      name: 'Bathroom',
      areaId: 'bathroom',
      floorId: undefined,
      icon: 'mdi:shower',
      devices: bathroomDevices,
      lightsOn: 0,
      totalLights: 2,
      temperature: 21.0,
      order: 40,
    },
    {
      id: 'hallway',
      name: 'Hallway',
      areaId: 'hallway',
      floorId: undefined,
      icon: 'mdi:door',
      devices: hallwayDevices,
      lightsOn: 0,
      totalLights: 1,
      order: 50,
    },
  ]

  return { rooms, floors }
}
