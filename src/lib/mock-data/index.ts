import type { HAFloor, RoomWithDevices, HAEntity } from '@/types/ha'
import type { MockScenario } from '../hooks/useDevMode'
import { generateEmptyHome } from './empty'
import { generateMinimalHome } from './minimal'
import { generateComplexHome } from './complex'
import { generateEdgeCases } from './edge-cases'
import { generateUnassignedDevices } from './unassigned'

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
    case 'none':
    default:
      return null
  }
}
