import { useCallback, useEffect, useState } from 'react'
import * as ws from '../ha-websocket'
import * as metadata from '../metadata'
import { ORDER_GAP } from '../constants'

export function useRoomOrder() {
  const [, forceUpdate] = useState({})

  // Subscribe to registry updates
  useEffect(() => {
    const unsubscribe = ws.onRegistryUpdate(() => {
      forceUpdate({})
    })
    return () => { unsubscribe() }
  }, [])

  const getAreaOrder = useCallback((areaId: string): number => {
    return metadata.getAreaOrder(areaId)
  }, [])

  const setAreaOrder = useCallback(async (areaId: string, order: number): Promise<void> => {
    await metadata.setAreaOrder(areaId, order)
  }, [])

  // Calculate new order values when reordering
  const calculateNewOrders = useCallback((
    items: { id: string; areaId: string }[],
    fromIndex: number,
    toIndex: number
  ): Map<string, number> => {
    const newOrders = new Map<string, number>()

    // Get current orders
    const itemsWithOrder = items.map(item => ({
      ...item,
      order: metadata.getAreaOrder(item.areaId)
    }))

    // Move item from fromIndex to toIndex
    const [movedItem] = itemsWithOrder.splice(fromIndex, 1)
    itemsWithOrder.splice(toIndex, 0, movedItem)

    // Calculate new order for moved item based on neighbors
    if (toIndex === 0) {
      // First position: use half of first item's order
      const nextOrder = itemsWithOrder[1]?.order ?? ORDER_GAP
      newOrders.set(movedItem.areaId, Math.max(1, Math.floor(nextOrder / 2)))
    } else if (toIndex === itemsWithOrder.length - 1) {
      // Last position: use previous item's order + gap
      const prevOrder = itemsWithOrder[toIndex - 1]?.order ?? 0
      newOrders.set(movedItem.areaId, prevOrder + ORDER_GAP)
    } else {
      // Middle position: use midpoint between neighbors
      const prevOrder = itemsWithOrder[toIndex - 1]?.order ?? 0
      const nextOrder = itemsWithOrder[toIndex + 1]?.order ?? prevOrder + ORDER_GAP * 2
      const midpoint = Math.floor((prevOrder + nextOrder) / 2)

      // If orders are too close, renumber all items
      if (midpoint <= prevOrder || midpoint >= nextOrder) {
        itemsWithOrder.forEach((item, idx) => {
          newOrders.set(item.areaId, (idx + 1) * ORDER_GAP)
        })
      } else {
        newOrders.set(movedItem.areaId, midpoint)
      }
    }

    return newOrders
  }, [])

  // Apply reorder changes
  const reorderAreas = useCallback(async (
    items: { id: string; areaId: string }[],
    fromIndex: number,
    toIndex: number
  ): Promise<void> => {
    const newOrders = calculateNewOrders(items, fromIndex, toIndex)

    // Apply all order changes
    const updates = Array.from(newOrders.entries()).map(([areaId, order]) =>
      metadata.setAreaOrder(areaId, order)
    )

    await Promise.all(updates)
  }, [calculateNewOrders])

  return {
    getAreaOrder,
    setAreaOrder,
    reorderAreas,
    calculateNewOrders,
  }
}
