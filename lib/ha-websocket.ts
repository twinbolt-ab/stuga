import type { HAEntity, WebSocketMessage, HALabel, HAFloor, AreaRegistryEntry, EntityRegistryEntry } from '@/types/ha'
import { ROOM_ORDER_LABEL_PREFIX, DEVICE_ORDER_LABEL_PREFIX, DEFAULT_ORDER } from './constants'

type MessageHandler = (entities: Map<string, HAEntity>) => void
type ConnectionHandler = (connected: boolean) => void
type RegistryHandler = () => void

class HAWebSocket {
  private ws: WebSocket | null = null
  private url: string
  private token: string
  private messageId = 1
  private entities = new Map<string, HAEntity>()
  private entityAreas = new Map<string, string>() // entity_id -> area name
  private messageHandlers = new Set<MessageHandler>()
  private connectionHandlers = new Set<ConnectionHandler>()
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isAuthenticated = false
  private statesMessageId = 0
  private entityRegistryMessageId = 0
  private areaRegistryMessageId = 0
  private labelRegistryMessageId = 0
  private floorRegistryMessageId = 0
  private deviceRegistryMessageId = 0
  private areas = new Map<string, string>() // area_id -> area name
  private areaRegistry = new Map<string, AreaRegistryEntry>() // area_id -> full registry entry
  private entityRegistry = new Map<string, EntityRegistryEntry>() // entity_id -> full registry entry
  private deviceRegistry = new Map<string, { id: string; area_id?: string }>() // device_id -> device
  private labels = new Map<string, HALabel>() // label_id -> label
  private floors = new Map<string, HAFloor>() // floor_id -> floor
  private registryHandlers = new Set<RegistryHandler>()
  private pendingCallbacks = new Map<number, (success: boolean, result?: unknown, error?: { code: string; message: string }) => void>()

  constructor() {
    // Will be set from environment
    this.url = ''
    this.token = ''
  }

  configure(url: string, token: string) {
    this.url = url.replace('http', 'ws') + '/api/websocket'
    this.token = token
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('[HA WS] Connected')
      }

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data))
      }

      this.ws.onclose = () => {
        console.log('[HA WS] Disconnected')
        this.isAuthenticated = false
        this.notifyConnectionHandlers(false)
        this.scheduleReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('[HA WS] Error:', error)
      }
    } catch (error) {
      console.error('[HA WS] Connection failed:', error)
      this.scheduleReconnect()
    }
  }

  private handleMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'auth_required':
        this.authenticate()
        break

      case 'auth_ok':
        console.log('[HA WS] Authenticated')
        this.isAuthenticated = true
        this.notifyConnectionHandlers(true)
        this.subscribeToStateChanges()
        this.fetchLabelRegistry()
        this.fetchFloorRegistry()
        this.fetchAreaRegistry()
        this.fetchDeviceRegistry()
        this.fetchEntityRegistry()
        this.fetchAllStates()
        break

      case 'auth_invalid':
        console.error('[HA WS] Authentication failed')
        this.disconnect()
        break

      case 'result':
        // Handle pending callbacks first
        if (message.id && this.pendingCallbacks.has(message.id)) {
          const callback = this.pendingCallbacks.get(message.id)!
          this.pendingCallbacks.delete(message.id)
          if (!message.success && message.error) {
            console.error('[HA WS] Command failed:', message.error.code, message.error.message)
          }
          callback(message.success ?? false, message.result, message.error)
        }

        if (message.success) {
          if (message.id === this.labelRegistryMessageId && Array.isArray(message.result)) {
            // Label registry response
            for (const label of message.result as HALabel[]) {
              this.labels.set(label.label_id, label)
            }
            console.log('[HA WS] Loaded', this.labels.size, 'labels')
          } else if (message.id === this.floorRegistryMessageId && Array.isArray(message.result)) {
            // Floor registry response
            for (const floor of message.result as HAFloor[]) {
              this.floors.set(floor.floor_id, floor)
            }
            console.log('[HA WS] Loaded', this.floors.size, 'floors')
            this.notifyRegistryHandlers()
          } else if (message.id === this.areaRegistryMessageId && Array.isArray(message.result)) {
            // Area registry response
            for (const area of message.result as AreaRegistryEntry[]) {
              this.areas.set(area.area_id, area.name)
              this.areaRegistry.set(area.area_id, area)
            }
            console.log('[HA WS] Loaded', this.areas.size, 'areas')
            this.notifyRegistryHandlers()
          } else if (message.id === this.deviceRegistryMessageId && Array.isArray(message.result)) {
            // Device registry response
            for (const device of message.result as { id: string; area_id?: string }[]) {
              this.deviceRegistry.set(device.id, device)
            }
            console.log('[HA WS] Loaded', this.deviceRegistry.size, 'devices')
            // Re-map entity areas in case entity registry loaded first
            this.remapEntityAreas()
          } else if (message.id === this.entityRegistryMessageId && Array.isArray(message.result)) {
            // Entity registry response - map entity_id to area name
            for (const entry of message.result as EntityRegistryEntry[]) {
              this.entityRegistry.set(entry.entity_id, entry)
              // Check entity area first, then fall back to device area
              let areaId = entry.area_id
              if (!areaId && entry.device_id) {
                const device = this.deviceRegistry.get(entry.device_id)
                areaId = device?.area_id
              }
              if (areaId) {
                const areaName = this.areas.get(areaId)
                if (areaName) {
                  this.entityAreas.set(entry.entity_id, areaName)
                }
              }
            }
            console.log('[HA WS] Mapped', this.entityAreas.size, 'entities to areas')
            // Re-notify with updated area info
            this.applyAreasToEntities()
            this.notifyMessageHandlers()
            this.notifyRegistryHandlers()
          } else if (message.id === this.statesMessageId && Array.isArray(message.result)) {
            // Initial state fetch
            for (const entity of message.result as HAEntity[]) {
              this.entities.set(entity.entity_id, entity)
            }
            this.applyAreasToEntities()
            this.notifyMessageHandlers()
          }
        }
        break

      case 'event':
        if (message.event?.event_type === 'state_changed') {
          const { entity_id, new_state } = message.event.data
          if (new_state) {
            // Apply area info if we have it
            const areaName = this.entityAreas.get(entity_id)
            if (areaName) {
              new_state.attributes.area = areaName
            }
            this.entities.set(entity_id, new_state)
          } else {
            this.entities.delete(entity_id)
          }
          this.notifyMessageHandlers()
        }
        break
    }
  }

  private authenticate() {
    this.send({
      type: 'auth',
      access_token: this.token,
    })
  }

  private subscribeToStateChanges() {
    this.send({
      id: this.messageId++,
      type: 'subscribe_events',
      event_type: 'state_changed',
    })
  }

  private fetchAreaRegistry() {
    this.areaRegistryMessageId = this.messageId++
    this.send({
      id: this.areaRegistryMessageId,
      type: 'config/area_registry/list',
    })
  }

  private fetchEntityRegistry() {
    this.entityRegistryMessageId = this.messageId++
    this.send({
      id: this.entityRegistryMessageId,
      type: 'config/entity_registry/list',
    })
  }

  private fetchLabelRegistry() {
    this.labelRegistryMessageId = this.messageId++
    this.send({
      id: this.labelRegistryMessageId,
      type: 'config/label_registry/list',
    })
  }

  private fetchFloorRegistry() {
    this.floorRegistryMessageId = this.messageId++
    this.send({
      id: this.floorRegistryMessageId,
      type: 'config/floor_registry/list',
    })
  }

  private fetchDeviceRegistry() {
    this.deviceRegistryMessageId = this.messageId++
    this.send({
      id: this.deviceRegistryMessageId,
      type: 'config/device_registry/list',
    })
  }

  private fetchAllStates() {
    this.statesMessageId = this.messageId++
    this.send({
      id: this.statesMessageId,
      type: 'get_states',
    })
  }

  private applyAreasToEntities() {
    // Add area info to entity attributes
    for (const [entityId, areaName] of this.entityAreas) {
      const entity = this.entities.get(entityId)
      if (entity) {
        entity.attributes.area = areaName
      }
    }
  }

  private remapEntityAreas() {
    // Re-process entity-to-area mappings (called when device registry loads)
    for (const [entityId, entry] of this.entityRegistry) {
      if (this.entityAreas.has(entityId)) continue // Already mapped

      // Check device area
      if (entry.device_id) {
        const device = this.deviceRegistry.get(entry.device_id)
        if (device?.area_id) {
          const areaName = this.areas.get(device.area_id)
          if (areaName) {
            this.entityAreas.set(entityId, areaName)
          }
        }
      }
    }
    this.applyAreasToEntities()
    this.notifyMessageHandlers()
    this.notifyRegistryHandlers()
  }

  private send(message: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      console.log('[HA WS] Attempting reconnect...')
      this.connect()
    }, 5000)
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    this.ws?.close()
    this.ws = null
    this.isAuthenticated = false
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler)
    // Immediately call with current state
    if (this.entities.size > 0) {
      handler(this.entities)
    }
    return () => this.messageHandlers.delete(handler)
  }

  onConnection(handler: ConnectionHandler) {
    this.connectionHandlers.add(handler)
    // Immediately notify of current state
    handler(this.isAuthenticated)
    return () => this.connectionHandlers.delete(handler)
  }

  private notifyMessageHandlers() {
    for (const handler of this.messageHandlers) {
      handler(this.entities)
    }
  }

  private notifyConnectionHandlers(connected: boolean) {
    for (const handler of this.connectionHandlers) {
      handler(connected)
    }
  }

  private notifyRegistryHandlers() {
    for (const handler of this.registryHandlers) {
      handler()
    }
  }

  onRegistryUpdate(handler: RegistryHandler) {
    this.registryHandlers.add(handler)
    return () => this.registryHandlers.delete(handler)
  }

  getEntities() {
    return this.entities
  }

  getEntity(entityId: string) {
    return this.entities.get(entityId)
  }

  callService(domain: string, service: string, data?: Record<string, unknown>) {
    this.send({
      id: this.messageId++,
      type: 'call_service',
      domain,
      service,
      service_data: data,
    })
  }

  isConnected() {
    return this.isAuthenticated
  }

  // Registry getters
  getAreaRegistry() {
    return this.areaRegistry
  }

  getEntityRegistry() {
    return this.entityRegistry
  }

  getLabels() {
    return this.labels
  }

  getFloors() {
    return this.floors
  }

  getFloor(floorId: string) {
    return this.floors.get(floorId)
  }

  // Update floor properties (name, icon)
  async updateFloor(floorId: string, updates: { name?: string; icon?: string | null }): Promise<void> {
    const floor = this.floors.get(floorId)
    if (!floor) throw new Error('Floor not found')

    return new Promise((resolve, reject) => {
      const msgId = this.messageId++
      this.pendingCallbacks.set(msgId, (success, result) => {
        if (success) {
          // Update local registry - merge our updates with existing floor
          const updatedFloor: HAFloor = {
            ...floor,
            ...(result as Partial<HAFloor> || {}),
          }
          // Explicitly apply our updates in case they're not in the result
          if (updates.name !== undefined) updatedFloor.name = updates.name
          if (updates.icon !== undefined) updatedFloor.icon = updates.icon || undefined

          this.floors.set(floorId, updatedFloor)
          this.notifyRegistryHandlers()
          resolve()
        } else {
          reject(new Error('Failed to update floor'))
        }
      })

      const payload: Record<string, unknown> = {
        id: msgId,
        type: 'config/floor_registry/update',
        floor_id: floorId,
      }

      if (updates.name !== undefined) payload.name = updates.name
      if (updates.icon !== undefined) payload.icon = updates.icon

      this.send(payload)
    })
  }

  // Get floor order from level
  getFloorOrder(floorId: string): number {
    const floor = this.floors.get(floorId)
    return floor?.level ?? DEFAULT_ORDER
  }

  // Set floor order using the built-in level field
  async setFloorOrder(floorId: string, order: number): Promise<void> {
    const floor = this.floors.get(floorId)
    if (!floor) return

    return new Promise((resolve, reject) => {
      const msgId = this.messageId++
      this.pendingCallbacks.set(msgId, (success, _result, error) => {
        if (success) {
          // Update local registry
          floor.level = order
          this.notifyRegistryHandlers()
          resolve()
        } else {
          reject(new Error(`Failed to update floor level: ${error?.message || 'Unknown error'}`))
        }
      })
      this.send({
        id: msgId,
        type: 'config/floor_registry/update',
        floor_id: floorId,
        level: order,
      })
    })
  }

  // Get icon for an area
  getAreaIcon(areaId: string): string | undefined {
    return this.areaRegistry.get(areaId)?.icon
  }

  // Get icon for an entity (from registry or attributes)
  getEntityIcon(entityId: string): string | undefined {
    const registryEntry = this.entityRegistry.get(entityId)
    if (registryEntry?.icon) return registryEntry.icon

    const entity = this.entities.get(entityId)
    if (entity?.attributes.icon && typeof entity.attributes.icon === 'string') {
      return entity.attributes.icon
    }

    return undefined
  }

  // Order helpers - extract order from giraff-*-order-XX labels
  getAreaOrder(areaId: string): number {
    const area = this.areaRegistry.get(areaId)
    if (!area?.labels) return DEFAULT_ORDER

    for (const labelId of area.labels) {
      const label = this.labels.get(labelId)
      if (label?.name.startsWith(ROOM_ORDER_LABEL_PREFIX)) {
        const orderStr = label.name.slice(ROOM_ORDER_LABEL_PREFIX.length)
        const order = parseInt(orderStr, 10)
        if (!isNaN(order)) return order
      }
    }
    return DEFAULT_ORDER
  }

  getEntityOrder(entityId: string): number {
    const entity = this.entityRegistry.get(entityId)
    if (!entity?.labels) return DEFAULT_ORDER

    for (const labelId of entity.labels) {
      const label = this.labels.get(labelId)
      if (label?.name.startsWith(DEVICE_ORDER_LABEL_PREFIX)) {
        const orderStr = label.name.slice(DEVICE_ORDER_LABEL_PREFIX.length)
        const order = parseInt(orderStr, 10)
        if (!isNaN(order)) return order
      }
    }
    return DEFAULT_ORDER
  }

  // Create or get order label
  private async ensureOrderLabel(prefix: string, order: number): Promise<string> {
    const paddedOrder = order.toString().padStart(2, '0')
    const labelName = `${prefix}${paddedOrder}`

    // Check if label already exists
    for (const [labelId, label] of this.labels) {
      if (label.name === labelName) {
        return labelId
      }
    }

    // Create new label
    return new Promise((resolve, reject) => {
      const msgId = this.messageId++
      this.pendingCallbacks.set(msgId, (success, result) => {
        if (success && result && typeof result === 'object' && 'label_id' in result) {
          const newLabel = result as HALabel
          this.labels.set(newLabel.label_id, newLabel)
          resolve(newLabel.label_id)
        } else {
          reject(new Error('Failed to create label'))
        }
      })
      this.send({
        id: msgId,
        type: 'config/label_registry/create',
        name: labelName,
      })
    })
  }

  // Update area order
  async setAreaOrder(areaId: string, order: number): Promise<void> {
    const area = this.areaRegistry.get(areaId)
    if (!area) return

    // Get existing non-order labels
    const existingLabels = (area.labels || []).filter(labelId => {
      const label = this.labels.get(labelId)
      return !label?.name.startsWith(ROOM_ORDER_LABEL_PREFIX)
    })

    // Get or create the order label
    const orderLabelId = await this.ensureOrderLabel(ROOM_ORDER_LABEL_PREFIX, order)

    // Update area with new labels
    return new Promise((resolve, reject) => {
      const msgId = this.messageId++
      this.pendingCallbacks.set(msgId, (success) => {
        if (success) {
          // Update local registry
          area.labels = [...existingLabels, orderLabelId]
          this.notifyRegistryHandlers()
          resolve()
        } else {
          reject(new Error('Failed to update area labels'))
        }
      })
      this.send({
        id: msgId,
        type: 'config/area_registry/update',
        area_id: areaId,
        labels: [...existingLabels, orderLabelId],
      })
    })
  }

  // Update entity order
  async setEntityOrder(entityId: string, order: number): Promise<void> {
    const entity = this.entityRegistry.get(entityId)
    if (!entity) return

    // Get existing non-order labels
    const existingLabels = (entity.labels || []).filter(labelId => {
      const label = this.labels.get(labelId)
      return !label?.name.startsWith(DEVICE_ORDER_LABEL_PREFIX)
    })

    // Get or create the order label
    const orderLabelId = await this.ensureOrderLabel(DEVICE_ORDER_LABEL_PREFIX, order)

    // Update entity with new labels
    return new Promise((resolve, reject) => {
      const msgId = this.messageId++
      this.pendingCallbacks.set(msgId, (success) => {
        if (success) {
          // Update local registry
          entity.labels = [...existingLabels, orderLabelId]
          this.notifyRegistryHandlers()
          resolve()
        } else {
          reject(new Error('Failed to update entity labels'))
        }
      })
      this.send({
        id: msgId,
        type: 'config/entity_registry/update',
        entity_id: entityId,
        labels: [...existingLabels, orderLabelId],
      })
    })
  }

  // Update area properties (name, floor, icon)
  async updateArea(areaId: string, updates: { name?: string; floor_id?: string | null; icon?: string | null }): Promise<void> {
    const area = this.areaRegistry.get(areaId)
    if (!area) throw new Error('Area not found')

    const oldName = area.name

    return new Promise((resolve, reject) => {
      const msgId = this.messageId++
      this.pendingCallbacks.set(msgId, (success, result) => {
        if (success) {
          // Update local registry - merge our updates with existing area
          // HA may return partial result, so we manually apply our changes
          const updatedArea: AreaRegistryEntry = {
            ...area,
            ...(result as Partial<AreaRegistryEntry> || {}),
          }
          // Explicitly apply our updates in case they're not in the result
          if (updates.name !== undefined) updatedArea.name = updates.name
          if (updates.floor_id !== undefined) updatedArea.floor_id = updates.floor_id || undefined
          if (updates.icon !== undefined) updatedArea.icon = updates.icon || undefined

          this.areaRegistry.set(areaId, updatedArea)
          this.areas.set(areaId, updatedArea.name)

          // If name changed, update entityAreas to use the new name
          if (updates.name && updates.name !== oldName) {
            for (const [entityId, areaName] of this.entityAreas) {
              if (areaName === oldName) {
                this.entityAreas.set(entityId, updates.name)
              }
            }
            // Re-apply area names to entity attributes
            this.applyAreasToEntities()
            this.notifyMessageHandlers()
          }

          this.notifyRegistryHandlers()
          resolve()
        } else {
          reject(new Error('Failed to update area'))
        }
      })

      const payload: Record<string, unknown> = {
        id: msgId,
        type: 'config/area_registry/update',
        area_id: areaId,
      }

      if (updates.name !== undefined) payload.name = updates.name
      if (updates.floor_id !== undefined) payload.floor_id = updates.floor_id
      if (updates.icon !== undefined) payload.icon = updates.icon

      this.send(payload)
    })
  }

  // Delete an area
  async deleteArea(areaId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const msgId = this.messageId++
      this.pendingCallbacks.set(msgId, (success) => {
        if (success) {
          // Remove from local registries
          this.areaRegistry.delete(areaId)
          this.areas.delete(areaId)
          this.notifyRegistryHandlers()
          resolve()
        } else {
          reject(new Error('Failed to delete area'))
        }
      })

      this.send({
        id: msgId,
        type: 'config/area_registry/delete',
        area_id: areaId,
      })
    })
  }

  // Create a new area (room)
  async createArea(name: string, floorId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const msgId = this.messageId++
      this.pendingCallbacks.set(msgId, (success, result) => {
        if (success && result && typeof result === 'object' && 'area_id' in result) {
          const newArea = result as AreaRegistryEntry
          // Add to local registries
          this.areaRegistry.set(newArea.area_id, newArea)
          this.areas.set(newArea.area_id, newArea.name)
          this.notifyRegistryHandlers()
          resolve(newArea.area_id)
        } else {
          reject(new Error('Failed to create area'))
        }
      })

      const payload: Record<string, unknown> = {
        id: msgId,
        type: 'config/area_registry/create',
        name,
      }
      if (floorId) payload.floor_id = floorId

      this.send(payload)
    })
  }

  // Create a new floor
  async createFloor(name: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const msgId = this.messageId++
      this.pendingCallbacks.set(msgId, (success, result) => {
        if (success && result && typeof result === 'object' && 'floor_id' in result) {
          const newFloor = result as HAFloor
          // Add to local registry
          this.floors.set(newFloor.floor_id, newFloor)
          this.notifyRegistryHandlers()
          resolve(newFloor.floor_id)
        } else {
          reject(new Error('Failed to create floor'))
        }
      })

      this.send({
        id: msgId,
        type: 'config/floor_registry/create',
        name,
      })
    })
  }

  // Delete a scene
  async deleteScene(entityId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const msgId = this.messageId++
      this.pendingCallbacks.set(msgId, (success) => {
        if (success) {
          // Remove from local registries
          this.entities.delete(entityId)
          this.entityRegistry.delete(entityId)
          this.entityAreas.delete(entityId)
          this.notifyMessageHandlers()
          this.notifyRegistryHandlers()
          resolve()
        } else {
          reject(new Error('Failed to delete scene'))
        }
      })

      this.send({
        id: msgId,
        type: 'call_service',
        domain: 'scene',
        service: 'delete',
        service_data: {
          entity_id: entityId,
        },
      })
    })
  }

  // Update entity properties (name, area)
  async updateEntity(entityId: string, updates: { name?: string | null; area_id?: string | null }): Promise<void> {
    const entity = this.entityRegistry.get(entityId)
    // Entity might not be in registry (e.g., YAML-defined scenes), but we can still try to update it

    return new Promise((resolve, reject) => {
      const msgId = this.messageId++
      this.pendingCallbacks.set(msgId, (success, result) => {
        if (success) {
          // Update local registry - merge our updates with existing entity
          const baseEntity = entity || { entity_id: entityId } as EntityRegistryEntry
          const updatedEntity: EntityRegistryEntry = {
            ...baseEntity,
            ...(result as Partial<EntityRegistryEntry> || {}),
          }
          // Explicitly apply our updates in case they're not in the result
          if (updates.name !== undefined) updatedEntity.name = updates.name || undefined
          if (updates.area_id !== undefined) updatedEntity.area_id = updates.area_id || undefined

          this.entityRegistry.set(entityId, updatedEntity)

          // Update entity-to-area mapping
          if (updatedEntity.area_id) {
            const areaName = this.areas.get(updatedEntity.area_id)
            if (areaName) {
              this.entityAreas.set(entityId, areaName)
              // Update entity attributes
              const stateEntity = this.entities.get(entityId)
              if (stateEntity) {
                stateEntity.attributes.area = areaName
              }
            }
          } else {
            this.entityAreas.delete(entityId)
            // Clear area from entity attributes
            const stateEntity = this.entities.get(entityId)
            if (stateEntity) {
              delete stateEntity.attributes.area
            }
          }

          this.notifyMessageHandlers()
          this.notifyRegistryHandlers()
          resolve()
        } else {
          reject(new Error('Failed to update entity'))
        }
      })

      const payload: Record<string, unknown> = {
        id: msgId,
        type: 'config/entity_registry/update',
        entity_id: entityId,
      }

      if (updates.name !== undefined) payload.name = updates.name
      if (updates.area_id !== undefined) payload.area_id = updates.area_id

      this.send(payload)
    })
  }

  // Check if an entity is hidden (uses HA's native hidden_by property)
  isEntityHidden(entityId: string): boolean {
    const entity = this.entityRegistry.get(entityId)
    return !!entity?.hidden_by
  }

  // Get all hidden entity IDs
  getHiddenEntities(): Set<string> {
    const hidden = new Set<string>()
    for (const [entityId, entity] of this.entityRegistry) {
      if (entity.hidden_by) {
        hidden.add(entityId)
      }
    }
    return hidden
  }

  // Set entity hidden state (uses HA's native hidden_by property)
  async setEntityHidden(entityId: string, hidden: boolean): Promise<void> {
    const entity = this.entityRegistry.get(entityId)

    // Check if already in desired state
    const isCurrentlyHidden = !!entity?.hidden_by
    if (isCurrentlyHidden === hidden) return

    return new Promise((resolve, reject) => {
      const msgId = this.messageId++
      this.pendingCallbacks.set(msgId, (success) => {
        if (success) {
          // Update local cache
          if (entity) {
            entity.hidden_by = hidden ? 'user' : undefined
          }
          this.notifyRegistryHandlers()
          resolve()
        } else {
          reject(new Error('Failed to update entity hidden state'))
        }
      })
      this.send({
        id: msgId,
        type: 'config/entity_registry/update',
        entity_id: entityId,
        hidden_by: hidden ? 'user' : null,
      })
    })
  }
}

// Singleton instance
export const haWebSocket = new HAWebSocket()
