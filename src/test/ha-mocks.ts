import { vi } from 'vitest'
import type { EntityRegistryEntry } from '@/types/ha'

// Default mock implementations
export const mockUpdateEntity = vi.fn().mockResolvedValue(undefined)
export const mockSetEntityHidden = vi.fn().mockResolvedValue(undefined)
export const mockDeleteScene = vi.fn().mockResolvedValue(undefined)
export const mockUpdateArea = vi.fn().mockResolvedValue(undefined)
export const mockCreateArea = vi.fn().mockResolvedValue('new-area-id')
export const mockDeleteArea = vi.fn().mockResolvedValue(undefined)
export const mockUpdateFloor = vi.fn().mockResolvedValue(undefined)
export const mockCreateFloor = vi.fn().mockResolvedValue('new-floor-id')
export const mockDeleteFloor = vi.fn().mockResolvedValue(undefined)
export const mockSetAreaTemperatureSensor = vi.fn().mockResolvedValue(undefined)
export const mockGetAreaTemperatureSensor = vi.fn().mockReturnValue(null)
export const mockGetEntityRegistry = vi.fn().mockReturnValue(new Map<string, EntityRegistryEntry>())
export const mockIsEntityHidden = vi.fn().mockReturnValue(false)
export const mockIsEntityHiddenInStuga = vi.fn().mockReturnValue(false)
export const mockIsEntityAuxiliary = vi.fn().mockReturnValue(false)

// Reset all mocks helper
export function resetAllHAMocks() {
  mockUpdateEntity.mockClear().mockResolvedValue(undefined)
  mockSetEntityHidden.mockClear().mockResolvedValue(undefined)
  mockDeleteScene.mockClear().mockResolvedValue(undefined)
  mockUpdateArea.mockClear().mockResolvedValue(undefined)
  mockCreateArea.mockClear().mockResolvedValue('new-area-id')
  mockDeleteArea.mockClear().mockResolvedValue(undefined)
  mockUpdateFloor.mockClear().mockResolvedValue(undefined)
  mockCreateFloor.mockClear().mockResolvedValue('new-floor-id')
  mockDeleteFloor.mockClear().mockResolvedValue(undefined)
  mockSetAreaTemperatureSensor.mockClear().mockResolvedValue(undefined)
  mockGetAreaTemperatureSensor.mockClear().mockReturnValue(null)
  mockGetEntityRegistry.mockClear().mockReturnValue(new Map())
  mockIsEntityHidden.mockClear().mockReturnValue(false)
  mockIsEntityHiddenInStuga.mockClear().mockReturnValue(false)
  mockIsEntityAuxiliary.mockClear().mockReturnValue(false)
}

// Mock module factory - use this in vi.mock()
export const haWebsocketMock = {
  updateEntity: mockUpdateEntity,
  setEntityHidden: mockSetEntityHidden,
  deleteScene: mockDeleteScene,
  updateArea: mockUpdateArea,
  createArea: mockCreateArea,
  deleteArea: mockDeleteArea,
  updateFloor: mockUpdateFloor,
  createFloor: mockCreateFloor,
  deleteFloor: mockDeleteFloor,
  getEntityRegistry: mockGetEntityRegistry,
  isEntityHidden: mockIsEntityHidden,
  isEntityHiddenInStuga: mockIsEntityHiddenInStuga,
  isEntityAuxiliary: mockIsEntityAuxiliary,
}

export const metadataMock = {
  setAreaTemperatureSensor: mockSetAreaTemperatureSensor,
  getAreaTemperatureSensor: mockGetAreaTemperatureSensor,
}
