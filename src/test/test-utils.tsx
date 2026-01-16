import { render, RenderOptions } from '@testing-library/react'
import { ToastProvider } from '@/providers/ToastProvider'
import type { HAEntity, RoomWithDevices, HAFloor } from '@/types/ha'

// Wrapper with required providers
function AllProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

// Mock entity factories
export function createMockLight(overrides: Partial<HAEntity> = {}): HAEntity {
  return {
    entity_id: 'light.living_room',
    state: 'on',
    attributes: {
      friendly_name: 'Living Room Light',
      brightness: 255,
    },
    last_changed: '2024-01-01T00:00:00Z',
    last_updated: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

export function createMockSwitch(overrides: Partial<HAEntity> = {}): HAEntity {
  return {
    entity_id: 'switch.garage',
    state: 'off',
    attributes: {
      friendly_name: 'Garage Switch',
    },
    last_changed: '2024-01-01T00:00:00Z',
    last_updated: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

export function createMockScene(overrides: Partial<HAEntity> = {}): HAEntity {
  return {
    entity_id: 'scene.movie_time',
    state: 'scening',
    attributes: {
      friendly_name: 'Movie Time',
    },
    last_changed: '2024-01-01T00:00:00Z',
    last_updated: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

export function createMockRoom(overrides: Partial<RoomWithDevices> = {}): RoomWithDevices {
  return {
    id: 'living_room',
    areaId: 'living_room',
    name: 'Living Room',
    devices: [],
    lightsOn: 0,
    totalLights: 0,
    ...overrides,
  }
}

export function createMockFloor(overrides: Partial<HAFloor> = {}): HAFloor {
  return {
    floor_id: 'ground_floor',
    name: 'Ground Floor',
    level: 0,
    ...overrides,
  }
}

// Re-export testing library utilities
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
