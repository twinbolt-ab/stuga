import type { HAEntity, HALabel, HAFloor, AreaRegistryEntry, EntityRegistryEntry } from '@/types/ha'
import type { DiagnosticResult } from '@/lib/connection-diagnostics'

// Optimistic state override for immediate UI feedback
export interface OptimisticOverride {
  state: string
  brightness?: number // 0-255 for lights
  expiresAt: number
}

// Handler types
export type MessageHandler = (entities: Map<string, HAEntity>) => void
export type ConnectionHandler = (connected: boolean) => void
export type RegistryHandler = () => void
export type ConnectionErrorHandler = (diagnostic: DiagnosticResult) => void

// Callback for pending WebSocket requests
export interface PendingCallback {
  callback: (success: boolean, result?: unknown, error?: { code: string; message: string }) => void
  timeout: NodeJS.Timeout
}

// Home Assistant unit system from config
export interface HAUnitSystem {
  length: string
  mass: string
  temperature: string // "°C" or "°F"
  volume: string
}

// Home Assistant config response
export interface HAConfig {
  unit_system: HAUnitSystem
  location_name?: string
  time_zone?: string
  version?: string
}

// Shared state interface - internal state accessible by all modules
export interface HAWebSocketState {
  // Connection
  ws: WebSocket | null
  url: string
  token: string
  useOAuth: boolean
  messageId: number
  isAuthenticated: boolean
  reconnectTimeout: NodeJS.Timeout | null
  isInitialConnection: boolean
  lastDiagnostic: DiagnosticResult | null

  // HA config (unit system, etc.)
  config: HAConfig | null

  // Message IDs for registry fetches
  statesMessageId: number
  entityRegistryMessageId: number
  areaRegistryMessageId: number
  labelRegistryMessageId: number
  floorRegistryMessageId: number
  deviceRegistryMessageId: number
  configMessageId: number

  // Entities
  entities: Map<string, HAEntity>
  entityAreas: Map<string, string>
  optimisticOverrides: Map<string, OptimisticOverride>

  // Registries
  areas: Map<string, string>
  areaRegistry: Map<string, AreaRegistryEntry>
  entityRegistry: Map<string, EntityRegistryEntry>
  deviceRegistry: Map<string, { id: string; area_id?: string }>
  labels: Map<string, HALabel>
  floors: Map<string, HAFloor>

  // Handlers
  messageHandlers: Set<MessageHandler>
  connectionHandlers: Set<ConnectionHandler>
  registryHandlers: Set<RegistryHandler>
  connectionErrorHandlers: Set<ConnectionErrorHandler>
  pendingCallbacks: Map<number, PendingCallback>
}

// Create initial state
export function createInitialState(): HAWebSocketState {
  return {
    ws: null,
    url: '',
    token: '',
    useOAuth: false,
    messageId: 1,
    isAuthenticated: false,
    reconnectTimeout: null,
    isInitialConnection: true,
    lastDiagnostic: null,

    config: null,

    statesMessageId: 0,
    entityRegistryMessageId: 0,
    areaRegistryMessageId: 0,
    labelRegistryMessageId: 0,
    floorRegistryMessageId: 0,
    deviceRegistryMessageId: 0,
    configMessageId: 0,

    entities: new Map(),
    entityAreas: new Map(),
    optimisticOverrides: new Map(),

    areas: new Map(),
    areaRegistry: new Map(),
    entityRegistry: new Map(),
    deviceRegistry: new Map(),
    labels: new Map(),
    floors: new Map(),

    messageHandlers: new Set(),
    connectionHandlers: new Set(),
    registryHandlers: new Set(),
    connectionErrorHandlers: new Set(),
    pendingCallbacks: new Map(),
  }
}
