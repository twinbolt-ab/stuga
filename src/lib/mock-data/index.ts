import type { HAFloor, RoomWithDevices, HAEntity } from '@/types/ha'
import type { MockScenario } from '../dev-mode'
import { generateEmptyHome } from './empty'
import { generateMinimalHome } from './minimal'
import { generateComplexHome } from './complex'
import { generateEdgeCases } from './edge-cases'
import { generateUnassignedDevices } from './unassigned'
import { generateApartment } from './apartment'

export interface MockData {
  rooms: RoomWithDevices[]
  floors: HAFloor[]
  uncategorizedEntities?: HAEntity[]
}

export function generateMockData(scenario: MockScenario): MockData | null {
  switch (scenario) {
    case 'empty':
      return generateEmptyHome()
    case 'minimal':
      return generateMinimalHome()
    case 'complex':
      return generateComplexHome()
    case 'edge-cases':
      return generateEdgeCases()
    case 'unassigned':
      return generateUnassignedDevices()
    case 'apartment':
      return generateApartment()
    case 'none':
    default:
      return null
  }
}
