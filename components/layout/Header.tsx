'use client'

import { useState, useCallback, useEffect } from 'react'
import { Reorder } from 'framer-motion'
import { Settings } from 'lucide-react'
import { SettingsMenu } from './SettingsMenu'
import { FloorEditModal } from '@/components/dashboard/FloorEditModal'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { haWebSocket } from '@/lib/ha-websocket'
import { t } from '@/lib/i18n'
import type { HAFloor } from '@/types/ha'

interface BottomNavProps {
  onEnterEditMode: () => void
  floors: HAFloor[]
  selectedFloorId: string | null
  onSelectFloor: (floorId: string | null) => void
  hasUnassignedRooms: boolean
  isEditMode?: boolean
  onViewUncategorized?: () => void
}

export function BottomNav({
  onEnterEditMode,
  floors,
  selectedFloorId,
  onSelectFloor,
  hasUnassignedRooms,
  isEditMode = false,
  onViewUncategorized,
}: BottomNavProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [editingFloor, setEditingFloor] = useState<HAFloor | null>(null)
  const [orderedFloors, setOrderedFloors] = useState<HAFloor[]>(floors)

  // Sync ordered floors when floors change
  useEffect(() => {
    setOrderedFloors(floors)
  }, [floors])

  // Handle floor tab click
  const handleFloorClick = useCallback((floor: HAFloor | null, floorId: string) => {
    if (isEditMode && floor) {
      setEditingFloor(floor)
    } else {
      onSelectFloor(floorId === '__other__' ? null : floorId)
    }
  }, [isEditMode, onSelectFloor])

  // Handle reorder
  const handleReorder = useCallback(async (newOrder: HAFloor[]) => {
    setOrderedFloors(newOrder)
  }, [])

  // Save order when reorder completes (on pointer up)
  const saveFloorOrder = useCallback(async () => {
    if (!isEditMode) return

    for (let i = 0; i < orderedFloors.length; i++) {
      const floor = orderedFloors[i]
      const originalIndex = floors.findIndex(f => f.floor_id === floor.floor_id)
      if (originalIndex !== i) {
        try {
          await haWebSocket.setFloorOrder(floor.floor_id, i * 10)
        } catch (error) {
          console.error('Failed to save floor order:', error)
        }
      }
    }
  }, [isEditMode, orderedFloors, floors])

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-md border-t border-border pb-safe">
        <div className="flex items-center py-2">
          {/* Floor tabs */}
          {isEditMode ? (
            <Reorder.Group
              axis="x"
              values={orderedFloors}
              onReorder={handleReorder}
              className="flex items-center overflow-x-auto list-none p-0 m-0 border-0 hide-scrollbar"
            >
              {orderedFloors.map((floor, index) => {
                const isActive = selectedFloorId === floor.floor_id
                return (
                  <Reorder.Item
                    key={floor.floor_id}
                    value={floor}
                    onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                    onPointerUp={saveFloorOrder}
                    className="flex-shrink-0 cursor-grab active:cursor-grabbing list-none"
                    style={{ border: 'none', outline: 'none', boxShadow: 'none', background: 'transparent' }}
                    whileDrag={{ scale: 1.1, zIndex: 50 }}
                  >
                    <div
                      className={`flex flex-col items-center gap-1 px-4 py-2 min-w-[72px] transition-colors ${
                        isActive ? 'text-accent' : 'text-muted'
                      }`}
                      onClick={() => handleFloorClick(floor, floor.floor_id)}
                    >
                      {floor.icon ? (
                        <MdiIcon icon={floor.icon} className="w-6 h-6" />
                      ) : (
                        <div className="w-6 h-6 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-current" />
                        </div>
                      )}
                      <span className="text-xs font-medium truncate max-w-[64px]">{floor.name}</span>
                    </div>
                  </Reorder.Item>
                )
              })}
            </Reorder.Group>
          ) : (
            <div className="flex items-center overflow-x-auto">
              {orderedFloors.map((floor) => {
                const isActive = selectedFloorId === floor.floor_id
                return (
                  <button
                    key={floor.floor_id}
                    onClick={() => handleFloorClick(floor, floor.floor_id)}
                    className={`flex flex-col items-center gap-1 px-4 py-2 min-w-[72px] flex-shrink-0 transition-colors touch-feedback ${
                      isActive ? 'text-accent' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    {floor.icon ? (
                      <MdiIcon icon={floor.icon} className="w-6 h-6" />
                    ) : (
                      <div className="w-6 h-6 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-current" />
                      </div>
                    )}
                    <span className="text-xs font-medium truncate max-w-[64px]">{floor.name}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* "Other" tab (non-reorderable) */}
          {hasUnassignedRooms && (
            <button
              onClick={() => handleFloorClick(null, '__other__')}
              className={`flex flex-col items-center gap-1 px-4 py-2 min-w-[72px] flex-shrink-0 transition-colors touch-feedback ${
                selectedFloorId === null ? 'text-accent' : 'text-muted hover:text-foreground'
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-current" />
              </div>
              <span className="text-xs font-medium">{t.floors.other}</span>
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Settings button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex flex-col items-center gap-1 px-4 py-2 text-muted hover:text-foreground transition-colors touch-feedback flex-shrink-0"
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs font-medium">{t.nav.settings}</span>
          </button>
        </div>
      </nav>

      <SettingsMenu
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onEnterEditMode={onEnterEditMode}
        onViewUncategorized={onViewUncategorized}
      />

      <FloorEditModal
        floor={editingFloor}
        onClose={() => setEditingFloor(null)}
      />
    </>
  )
}

export { BottomNav as Header }
