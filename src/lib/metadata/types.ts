/**
 * Metadata storage abstraction types
 *
 * Allows Stuga to store room ordering and preferences either in
 * Home Assistant labels or locally on the device.
 */

export interface MetadataBackend {
  // Room/Area ordering
  getAreaOrder(areaId: string): number
  setAreaOrder(areaId: string, order: number): Promise<void>

  // Temperature sensor selection per area
  getAreaTemperatureSensor(areaId: string): string | undefined
  setAreaTemperatureSensor(areaId: string, sensorEntityId: string | null): Promise<void>

  // Device/Entity ordering
  getEntityOrder(entityId: string): number
  setEntityOrder(entityId: string, order: number): Promise<void>
}

export type MetadataStorageMode = 'ha-labels' | 'local-storage'
