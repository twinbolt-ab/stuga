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

function createRoomDevices(
  roomName: string,
  prefix: string,
  config: {
    lights?: number
    lightsOn?: number
    switches?: number
    temperature?: number
    humidity?: number
    climate?: boolean
    cover?: boolean
    scenes?: number
  }
): HAEntity[] {
  const devices: HAEntity[] = []

  // Lights
  const lightNames = [
    'Ceiling',
    'Floor Lamp',
    'Wall Sconce',
    'Pendant',
    'Spotlight',
    'Table Lamp',
    'LED Strip',
    'Chandelier',
  ]
  for (let i = 0; i < (config.lights || 0); i++) {
    const isOn = i < (config.lightsOn || 0)
    devices.push(
      createEntity(`light.${prefix}_${i}`, isOn ? 'on' : 'off', {
        friendly_name: lightNames[i] || `Light ${i + 1}`,
        brightness: isOn ? 200 + i * 10 : 0,
        area: roomName,
      })
    )
  }

  // Switches - alternate on/off based on index
  const switchNames = ['TV', 'Fan', 'Heater', 'Humidifier', 'Air Purifier']
  for (let i = 0; i < (config.switches || 0); i++) {
    devices.push(
      createEntity(`switch.${prefix}_${i}`, i % 2 === 0 ? 'on' : 'off', {
        friendly_name: switchNames[i] || `Switch ${i + 1}`,
        area: roomName,
      })
    )
  }

  // Temperature sensor
  if (config.temperature !== undefined) {
    devices.push(
      createEntity(`sensor.${prefix}_temperature`, config.temperature.toFixed(1), {
        friendly_name: 'Temperature',
        device_class: 'temperature',
        unit_of_measurement: '°C',
        area: roomName,
      })
    )
  }

  // Humidity sensor
  if (config.humidity !== undefined) {
    devices.push(
      createEntity(`sensor.${prefix}_humidity`, config.humidity.toString(), {
        friendly_name: 'Humidity',
        device_class: 'humidity',
        unit_of_measurement: '%',
        area: roomName,
      })
    )
  }

  // Climate
  if (config.climate) {
    devices.push(
      createEntity(`climate.${prefix}_thermostat`, 'heat', {
        friendly_name: 'Thermostat',
        current_temperature: config.temperature || 20,
        temperature: 22,
        hvac_modes: ['off', 'heat', 'cool', 'auto'],
        area: roomName,
      })
    )
  }

  // Cover
  if (config.cover) {
    devices.push(
      createEntity(`cover.${prefix}_blinds`, 'open', {
        friendly_name: 'Blinds',
        current_position: 100,
        area: roomName,
      })
    )
  }

  // Scenes
  for (let i = 0; i < (config.scenes || 0); i++) {
    const sceneNames = ['Movie Night', 'Bright', 'Relax', 'Morning', 'Evening']
    devices.push(
      createEntity(`scene.${prefix}_scene_${i}`, 'scening', {
        friendly_name: sceneNames[i] || `Scene ${i + 1}`,
        area: roomName,
      })
    )
  }

  return devices
}

export function generateComplexHome(): MockData {
  const floors: HAFloor[] = [
    {
      floor_id: 'sub_basement',
      name: 'Sub-Basement',
      level: -2,
      icon: 'mdi:home-floor-negative-1',
    },
    { floor_id: 'basement', name: 'Basement', level: -1, icon: 'mdi:home-floor-b' },
    { floor_id: 'ground_floor', name: 'Ground', level: 0, icon: 'mdi:home-floor-g' },
    { floor_id: 'upper_floor', name: 'Upper', level: 1, icon: 'mdi:home-floor-1' },
    { floor_id: 'second_floor', name: 'Second', level: 2, icon: 'mdi:home-floor-2' },
    { floor_id: 'third_floor', name: 'Third', level: 3, icon: 'mdi:home-floor-3' },
    { floor_id: 'rooftop', name: 'Rooftop', level: 4, icon: 'mdi:home-roof' },
  ]

  // Sub-basement rooms
  const subBasementRooms: RoomWithDevices[] = [
    {
      id: 'wine-cellar',
      name: 'Wine Cellar',
      areaId: 'wine_cellar',
      floorId: 'sub_basement',
      icon: 'mdi:glass-wine',
      devices: createRoomDevices('Wine Cellar', 'wine_cellar', {
        lights: 2,
        lightsOn: 0,
        temperature: 14.0,
        humidity: 70,
      }),
      lightsOn: 0,
      totalLights: 2,
      temperature: 14.0,
      humidity: 70,
      order: 10,
    },
    {
      id: 'utility-room',
      name: 'Utility Room',
      areaId: 'utility_room',
      floorId: 'sub_basement',
      icon: 'mdi:water-boiler',
      devices: createRoomDevices('Utility Room', 'utility', {
        lights: 1,
        lightsOn: 0,
        switches: 2,
        temperature: 18.0,
      }),
      lightsOn: 0,
      totalLights: 1,
      temperature: 18.0,
      order: 20,
    },
  ]

  // Basement rooms
  const basementRooms: RoomWithDevices[] = [
    {
      id: 'garage',
      name: 'Garage',
      areaId: 'garage',
      floorId: 'basement',
      icon: 'mdi:garage',
      devices: createRoomDevices('Garage', 'garage', { lights: 2, lightsOn: 0, switches: 1 }),
      lightsOn: 0,
      totalLights: 2,
      order: 10,
    },
    {
      id: 'laundry',
      name: 'Laundry Room',
      areaId: 'laundry',
      floorId: 'basement',
      icon: 'mdi:washing-machine',
      devices: createRoomDevices('Laundry Room', 'laundry', {
        lights: 1,
        lightsOn: 1,
        switches: 2,
      }),
      lightsOn: 1,
      totalLights: 1,
      order: 20,
    },
    {
      id: 'storage',
      name: 'Storage',
      areaId: 'storage',
      floorId: 'basement',
      icon: 'mdi:package-variant',
      devices: createRoomDevices('Storage', 'storage', { lights: 1, lightsOn: 0 }),
      lightsOn: 0,
      totalLights: 1,
      order: 30,
    },
  ]

  // Ground floor rooms
  const groundFloorRooms: RoomWithDevices[] = [
    {
      id: 'living-room',
      name: 'Living Room',
      areaId: 'living_room',
      floorId: 'ground_floor',
      icon: 'mdi:sofa',
      devices: createRoomDevices('Living Room', 'living', {
        lights: 5,
        lightsOn: 2,
        switches: 2,
        temperature: 22.1,
        humidity: 45,
        climate: true,
        cover: true,
        scenes: 3,
      }),
      lightsOn: 2,
      totalLights: 5,
      temperature: 22.1,
      humidity: 45,
      order: 10,
    },
    {
      id: 'kitchen',
      name: 'Kitchen',
      areaId: 'kitchen',
      floorId: 'ground_floor',
      icon: 'mdi:stove',
      devices: createRoomDevices('Kitchen', 'kitchen', {
        lights: 4,
        lightsOn: 3,
        switches: 3,
        temperature: 23.5,
      }),
      lightsOn: 3,
      totalLights: 4,
      temperature: 23.5,
      order: 20,
    },
    {
      id: 'dining-room',
      name: 'Dining Room',
      areaId: 'dining_room',
      floorId: 'ground_floor',
      icon: 'mdi:silverware-fork-knife',
      devices: createRoomDevices('Dining Room', 'dining', {
        lights: 2,
        lightsOn: 0,
        scenes: 2,
      }),
      lightsOn: 0,
      totalLights: 2,
      order: 30,
    },
    {
      id: 'hallway',
      name: 'Hallway',
      areaId: 'hallway',
      floorId: 'ground_floor',
      icon: 'mdi:door',
      devices: createRoomDevices('Hallway', 'hallway', { lights: 2, lightsOn: 1 }),
      lightsOn: 1,
      totalLights: 2,
      order: 40,
    },
    {
      id: 'office',
      name: 'Home Office',
      areaId: 'office',
      floorId: 'ground_floor',
      icon: 'mdi:desk',
      devices: createRoomDevices('Home Office', 'office', {
        lights: 3,
        lightsOn: 2,
        switches: 2,
        temperature: 21.0,
        climate: true,
        cover: true,
      }),
      lightsOn: 2,
      totalLights: 3,
      temperature: 21.0,
      order: 50,
    },
  ]

  // Upper floor rooms
  const upperFloorRooms: RoomWithDevices[] = [
    {
      id: 'master-bedroom',
      name: 'Master Bedroom',
      areaId: 'master_bedroom',
      floorId: 'upper_floor',
      icon: 'mdi:bed-king',
      devices: createRoomDevices('Master Bedroom', 'master', {
        lights: 4,
        lightsOn: 1,
        switches: 1,
        temperature: 19.5,
        humidity: 50,
        climate: true,
        cover: true,
        scenes: 2,
      }),
      lightsOn: 1,
      totalLights: 4,
      temperature: 19.5,
      humidity: 50,
      order: 10,
    },
    {
      id: 'kids-room',
      name: "Kids' Room",
      areaId: 'kids_room',
      floorId: 'upper_floor',
      icon: 'mdi:teddy-bear',
      devices: createRoomDevices("Kids' Room", 'kids', {
        lights: 3,
        lightsOn: 0,
        temperature: 20.5,
      }),
      lightsOn: 0,
      totalLights: 3,
      temperature: 20.5,
      order: 20,
    },
    {
      id: 'guest-room',
      name: 'Guest Room',
      areaId: 'guest_room',
      floorId: 'upper_floor',
      icon: 'mdi:bed',
      devices: createRoomDevices('Guest Room', 'guest', {
        lights: 2,
        lightsOn: 0,
        temperature: 18.0,
      }),
      lightsOn: 0,
      totalLights: 2,
      temperature: 18.0,
      order: 30,
    },
    {
      id: 'bathroom',
      name: 'Bathroom',
      areaId: 'bathroom',
      floorId: 'upper_floor',
      icon: 'mdi:shower',
      devices: createRoomDevices('Bathroom', 'bathroom', {
        lights: 2,
        lightsOn: 0,
        switches: 1,
        temperature: 24.0,
        humidity: 65,
      }),
      lightsOn: 0,
      totalLights: 2,
      temperature: 24.0,
      humidity: 65,
      order: 40,
    },
  ]

  // Second floor rooms
  const secondFloorRooms: RoomWithDevices[] = [
    {
      id: 'media-room',
      name: 'Media Room',
      areaId: 'media_room',
      floorId: 'second_floor',
      icon: 'mdi:television',
      devices: createRoomDevices('Media Room', 'media', {
        lights: 4,
        lightsOn: 0,
        switches: 3,
        temperature: 21.5,
        climate: true,
        scenes: 3,
      }),
      lightsOn: 0,
      totalLights: 4,
      temperature: 21.5,
      order: 10,
    },
    {
      id: 'library',
      name: 'Library',
      areaId: 'library',
      floorId: 'second_floor',
      icon: 'mdi:bookshelf',
      devices: createRoomDevices('Library', 'library', {
        lights: 3,
        lightsOn: 1,
        temperature: 20.0,
        humidity: 45,
        cover: true,
      }),
      lightsOn: 1,
      totalLights: 3,
      temperature: 20.0,
      humidity: 45,
      order: 20,
    },
    {
      id: 'game-room',
      name: 'Game Room',
      areaId: 'game_room',
      floorId: 'second_floor',
      icon: 'mdi:gamepad-variant',
      devices: createRoomDevices('Game Room', 'game', {
        lights: 3,
        lightsOn: 2,
        switches: 2,
        temperature: 22.0,
      }),
      lightsOn: 2,
      totalLights: 3,
      temperature: 22.0,
      order: 30,
    },
  ]

  // Third floor rooms
  const thirdFloorRooms: RoomWithDevices[] = [
    {
      id: 'studio',
      name: 'Studio',
      areaId: 'studio',
      floorId: 'third_floor',
      icon: 'mdi:palette',
      devices: createRoomDevices('Studio', 'studio', {
        lights: 5,
        lightsOn: 3,
        switches: 1,
        temperature: 21.0,
        cover: true,
      }),
      lightsOn: 3,
      totalLights: 5,
      temperature: 21.0,
      order: 10,
    },
    {
      id: 'gym',
      name: 'Gym',
      areaId: 'gym',
      floorId: 'third_floor',
      icon: 'mdi:dumbbell',
      devices: createRoomDevices('Gym', 'gym', {
        lights: 3,
        lightsOn: 0,
        switches: 2,
        temperature: 19.0,
        humidity: 55,
        climate: true,
      }),
      lightsOn: 0,
      totalLights: 3,
      temperature: 19.0,
      humidity: 55,
      order: 20,
    },
    {
      id: 'sauna',
      name: 'Sauna',
      areaId: 'sauna',
      floorId: 'third_floor',
      icon: 'mdi:heat-wave',
      devices: createRoomDevices('Sauna', 'sauna', {
        lights: 1,
        lightsOn: 0,
        temperature: 25.0,
        humidity: 80,
        climate: true,
      }),
      lightsOn: 0,
      totalLights: 1,
      temperature: 25.0,
      humidity: 80,
      order: 30,
    },
  ]

  // Rooftop rooms
  const rooftopRooms: RoomWithDevices[] = [
    {
      id: 'rooftop-terrace',
      name: 'Rooftop Terrace',
      areaId: 'rooftop_terrace',
      floorId: 'rooftop',
      icon: 'mdi:balcony',
      devices: createRoomDevices('Rooftop Terrace', 'terrace', {
        lights: 6,
        lightsOn: 4,
        switches: 2,
        temperature: 18.0,
        scenes: 2,
      }),
      lightsOn: 4,
      totalLights: 6,
      temperature: 18.0,
      order: 10,
    },
    {
      id: 'greenhouse',
      name: 'Greenhouse',
      areaId: 'greenhouse',
      floorId: 'rooftop',
      icon: 'mdi:greenhouse',
      devices: createRoomDevices('Greenhouse', 'greenhouse', {
        lights: 2,
        lightsOn: 1,
        switches: 3,
        temperature: 26.0,
        humidity: 75,
        climate: true,
        cover: true,
      }),
      lightsOn: 1,
      totalLights: 2,
      temperature: 26.0,
      humidity: 75,
      order: 20,
    },
  ]

  const rooms = [
    ...subBasementRooms,
    ...basementRooms,
    ...groundFloorRooms,
    ...upperFloorRooms,
    ...secondFloorRooms,
    ...thirdFloorRooms,
    ...rooftopRooms,
  ]

  return { rooms, floors }
}
