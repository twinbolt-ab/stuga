'use client'

import { useCallback, useEffect, useState } from 'react'
import { haWebSocket } from '../ha-websocket'
import { ORDER_GAP, DEFAULT_ORDER } from '../constants'
import type { HAEntity } from '@/types/ha'

export function useDeviceOrder() {
  const [, forceUpdate] = useState({})

  // Subscribe to registry updates
  useEffect(() => {
    const unsubscribe = haWebSocket.onRegistryUpdate(() => {
      forceUpdate({})
    })
    return () => { unsubscribe() }
  }, [])

  const getEntityOrder = useCallback((entityId: string): number => {
    return haWebSocket.getEntityOrder(entityId)
  }, [])

  const setEntityOrder = useCallback(async (entityId: string, order: number): Promise<void> => {
    await haWebSocket.setEntityOrder(entityId, order)
  }, [])

  // Sort devices by their order
  const sortDevicesByOrder = useCallback((devices: HAEntity[]): HAEntity[] => {
    return [...devices].sort((a, b) => {
      const orderA = haWebSocket.getEntityOrder(a.entity_id)
      const orderB = haWebSocket.getEntityOrder(b.entity_id)
      if (orderA !== orderB) return orderA - orderB
      // Fallback to friendly name alphabetically
      const nameA = a.attributes.friendly_name || a.entity_id
      const nameB = b.attributes.friendly_name || b.entity_id
      return nameA.localeCompare(nameB)
    })
  }, [])

  // Calculate new order values when reordering
  const calculateNewOrders = useCallback((
    devices: HAEntity[],
    fromIndex: number,
    toIndex: number
  ): Map<string, number> => {
    const newOrders = new Map<string, number>()

    // Get current orders
    const devicesWithOrder = devices.map(device => ({
      entityId: device.entity_id,
      order: haWebSocket.getEntityOrder(device.entity_id)
    }))

    // Move item from fromIndex to toIndex
    const [movedItem] = devicesWithOrder.splice(fromIndex, 1)
    devicesWithOrder.splice(toIndex, 0, movedItem)

    // Calculate new order for moved item based on neighbors
    if (toIndex === 0) {
      // First position: use half of first item's order
      const nextOrder = devicesWithOrder[1]?.order ?? ORDER_GAP
      newOrders.set(movedItem.entityId, Math.max(1, Math.floor(nextOrder / 2)))
    } else if (toIndex === devicesWithOrder.length - 1) {
      // Last position: use previous item's order + gap
      const prevOrder = devicesWithOrder[toIndex - 1]?.order ?? 0
      newOrders.set(movedItem.entityId, prevOrder + ORDER_GAP)
    } else {
      // Middle position: use midpoint between neighbors
      const prevOrder = devicesWithOrder[toIndex - 1]?.order ?? 0
      const nextOrder = devicesWithOrder[toIndex + 1]?.order ?? prevOrder + ORDER_GAP * 2
      const midpoint = Math.floor((prevOrder + nextOrder) / 2)

      // If orders are too close, renumber all items
      if (midpoint <= prevOrder || midpoint >= nextOrder) {
        devicesWithOrder.forEach((item, idx) => {
          newOrders.set(item.entityId, (idx + 1) * ORDER_GAP)
        })
      } else {
        newOrders.set(movedItem.entityId, midpoint)
      }
    }

    return newOrders
  }, [])

  // Apply reorder changes
  const reorderDevices = useCallback(async (
    devices: HAEntity[],
    fromIndex: number,
    toIndex: number
  ): Promise<void> => {
    const newOrders = calculateNewOrders(devices, fromIndex, toIndex)

    // Apply all order changes
    const updates = Array.from(newOrders.entries()).map(([entityId, order]) =>
      haWebSocket.setEntityOrder(entityId, order)
    )

    await Promise.all(updates)
  }, [calculateNewOrders])

  return {
    getEntityOrder,
    setEntityOrder,
    sortDevicesByOrder,
    reorderDevices,
    calculateNewOrders,
  }
}
