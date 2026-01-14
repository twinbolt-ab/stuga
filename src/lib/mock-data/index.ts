import type { HAFloor, RoomWithDevices } from '@/types/ha'
import type { MockScenario } from '../hooks/useDevMode'
import { generateEmptyHome } from './empty'
import { generateMinimalHome } from './minimal'
import { generateComplexHome } from './complex'
import { generateEdgeCases } from './edge-cases'

export interface MockData {
  rooms: RoomWithDevices[]
  floors: HAFloor[]
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
    case 'none':
    default:
      return null
  }
}
