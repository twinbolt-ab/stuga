import { useState, useCallback, useRef } from 'react'
import { Reorder } from 'framer-motion'
import { Settings } from 'lucide-react'
import { SettingsMenu } from './SettingsMenu'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { saveFloorOrderBatch } from '@/lib/ha-websocket'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { useEditMode } from '@/lib/contexts/EditModeContext'
import { LONG_PRESS_DURATION } from '@/lib/constants'
import { t } from '@/lib/i18n'
import { haptic } from '@/lib/haptics'
import type { HAFloor } from '@/types/ha'

interface BottomNavProps {
  onEnterEditMode: () => void
  floors: HAFloor[]
  selectedFloorId: string | null
  onSelectFloor: (floorId: string | null) => void
  hasUnassignedRooms: boolean
  isEditMode?: boolean
  onViewAllDevices?: () => void
  onEditFloor?: (floor: HAFloor | null) => void
  editingFloorId?: string | null
}

// Floor tab for normal mode - supports long-press to enter floor edit mode
interface FloorTabProps {
  floor: HAFloor
  isActive: boolean
  onSelect: () => void
  onLongPress: () => void
}

function FloorTab({ floor, isActive, onSelect, onLongPress }: FloorTabProps) {
  const longPress = useLongPress({
    duration: LONG_PRESS_DURATION,
    moveThreshold: 5, // Lower threshold to cancel on slight swipe
    onLongPress,
  })

  const handleClick = useCallback(() => {
    if (!longPress.didLongPress) {
      haptic.selection()
      onSelect()
    }
  }, [longPress.didLongPress, onSelect])

  return (
    <button
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onClick={handleClick}
      className={`flex flex-col items-center gap-1 px-4 py-2 min-w-[72px] flex-shrink-0 transition-colors touch-feedback ${
        isActive ? 'text-accent' : 'text-muted hover:text-foreground'
      }`}
      style={{ touchAction: 'pan-x' }}
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
}

// Reorderable floor tab for floor edit mode - drag is immediate (no long-press needed)
interface ReorderableFloorTabProps {
  floor: HAFloor
  isActive: boolean
  isSelected: boolean
  onTap: () => void
}

function ReorderableFloorTab({ floor, isActive, isSelected, onTap }: ReorderableFloorTabProps) {
  const didDragRef = useRef(false)

  return (
    <Reorder.Item
      value={floor}
      onDragStart={() => {
        didDragRef.current = true
        haptic.medium()
      }}
      onDragEnd={() => {
        // Reset after a short delay to allow click to be ignored
        setTimeout(() => {
          didDragRef.current = false
        }, 100)
      }}
      className="flex-shrink-0 list-none cursor-grab active:cursor-grabbing"
      style={{ border: 'none', outline: 'none', boxShadow: 'none', background: 'transparent' }}
      whileDrag={{ scale: 1.1, zIndex: 50 }}
    >
      <div
        onClick={() => {
          if (!didDragRef.current) onTap()
        }}
        className={`flex flex-col items-center gap-1 px-4 py-2 min-w-[72px] transition-colors ${
          isSelected ? 'text-accent' : isActive ? 'text-accent/60' : 'text-muted'
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
      </div>
    </Reorder.Item>
  )
}

export function BottomNav({
  onEnterEditMode,
  floors,
  selectedFloorId,
  onSelectFloor,
  hasUnassignedRooms,
  isEditMode: isRoomEditMode = false,
  onViewAllDevices,
  onEditFloor,
  editingFloorId,
}: BottomNavProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Get floor edit mode from context
  const {
    isFloorEditMode,
    orderedFloors: contextOrderedFloors,
    selectedFloorId: editSelectedFloorId,
    enterFloorEdit,
    exitEditMode,
    reorderFloors,
  } = useEditMode()

  // Use context ordered floors when in floor edit mode, otherwise use props
  const displayFloors = isFloorEditMode ? contextOrderedFloors : floors

  // Handle floor tab click in normal mode
  const handleFloorClick = useCallback(
    (floor: HAFloor | null, floorId: string) => {
      if (isRoomEditMode && floor) {
        // In room edit mode, tap floor opens edit modal
        onEditFloor?.(floor)
      } else {
        const newFloorId = floorId === '__other__' ? null : floorId
        if (newFloorId !== selectedFloorId) {
          onSelectFloor(newFloorId)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }
    },
    [isRoomEditMode, onSelectFloor, selectedFloorId, onEditFloor]
  )

  // Handle long-press to enter floor edit mode
  const handleFloorLongPress = useCallback(
    (floor: HAFloor) => {
      enterFloorEdit(floors, floor.floor_id)
    },
    [floors, enterFloorEdit]
  )

  // Handle reorder in floor edit mode
  const handleReorder = useCallback(
    (newOrder: HAFloor[]) => {
      reorderFloors(newOrder)
    },
    [reorderFloors]
  )

  // Save floor order to HA
  const handleSaveFloorOrder = useCallback(async () => {
    if (!isFloorEditMode) return
    await saveFloorOrderBatch(contextOrderedFloors, floors)
  }, [isFloorEditMode, contextOrderedFloors, floors])

  // Handle tap on floor in floor edit mode - open edit modal, or close if already open
  const handleFloorEditTap = useCallback(
    (floor: HAFloor) => {
      if (editingFloorId) {
        // Modal is open - close it
        onEditFloor?.(null)
      } else {
        onEditFloor?.(floor)
      }
    },
    [editingFloorId, onEditFloor]
  )

  // Handle click outside to exit floor edit mode
  const handleBackgroundClick = useCallback(() => {
    if (isFloorEditMode) {
      handleSaveFloorOrder()
      exitEditMode()
    }
  }, [isFloorEditMode, handleSaveFloorOrder, exitEditMode])

  const showBottomNav = floors.length > 0

  return (
    <>
      {/* Click outside handler for floor edit mode */}
      {isFloorEditMode && <div className="fixed inset-0 z-[5]" onClick={handleBackgroundClick} />}

      {/* Bottom nav bar - only show when floors exist */}
      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-md border-t border-border pb-safe">
          <div className="flex items-center py-2">
            {isFloorEditMode ? (
              // Floor edit mode - drag is immediate
              <Reorder.Group
                axis="x"
                values={contextOrderedFloors}
                onReorder={handleReorder}
                className="flex items-center overflow-x-auto list-none p-0 m-0 border-0 hide-scrollbar"
              >
                {contextOrderedFloors.map((floor) => {
                  // Use fresh data from floors prop if available (for immediate updates after edit)
                  const freshFloor = floors.find((f) => f.floor_id === floor.floor_id) || floor
                  const isActive = selectedFloorId === floor.floor_id
                  const isSelected = editSelectedFloorId === floor.floor_id
                  return (
                    <ReorderableFloorTab
                      key={floor.floor_id}
                      floor={freshFloor}
                      isActive={isActive}
                      isSelected={isSelected}
                      onTap={() => {
                        handleFloorEditTap(freshFloor)
                      }}
                    />
                  )
                })}
              </Reorder.Group>
            ) : isRoomEditMode ? (
              // Room edit mode - floors are reorderable (existing behavior)
              <Reorder.Group
                axis="x"
                values={displayFloors}
                onReorder={handleReorder}
                className="flex items-center overflow-x-auto list-none p-0 m-0 border-0 hide-scrollbar"
              >
                {displayFloors.map((floor) => {
                  const isActive = selectedFloorId === floor.floor_id
                  return (
                    <Reorder.Item
                      key={floor.floor_id}
                      value={floor}
                      onPointerDown={(e: React.PointerEvent) => {
                        e.stopPropagation()
                      }}
                      onPointerUp={handleSaveFloorOrder}
                      className="flex-shrink-0 cursor-grab active:cursor-grabbing list-none"
                      style={{
                        border: 'none',
                        outline: 'none',
                        boxShadow: 'none',
                        background: 'transparent',
                      }}
                      whileDrag={{ scale: 1.1, zIndex: 50 }}
                    >
                      <div
                        className={`flex flex-col items-center gap-1 px-4 py-2 min-w-[72px] transition-colors ${
                          isActive ? 'text-accent' : 'text-muted'
                        }`}
                        onClick={() => {
                          handleFloorClick(floor, floor.floor_id)
                        }}
                      >
                        {floor.icon ? (
                          <MdiIcon icon={floor.icon} className="w-6 h-6" />
                        ) : (
                          <div className="w-6 h-6 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-current" />
                          </div>
                        )}
                        <span className="text-xs font-medium truncate max-w-[64px]">
                          {floor.name}
                        </span>
                      </div>
                    </Reorder.Item>
                  )
                })}
              </Reorder.Group>
            ) : (
              // Normal mode - long-press to enter floor edit mode
              <div className="flex items-center overflow-x-auto">
                {displayFloors.map((floor) => {
                  const isActive = selectedFloorId === floor.floor_id
                  return (
                    <FloorTab
                      key={floor.floor_id}
                      floor={floor}
                      isActive={isActive}
                      onSelect={() => {
                        handleFloorClick(floor, floor.floor_id)
                      }}
                      onLongPress={() => {
                        handleFloorLongPress(floor)
                      }}
                    />
                  )
                })}
              </div>
            )}

            {/* "Other" tab (non-reorderable) - only show when floors exist and there are unassigned rooms */}
            {hasUnassignedRooms && !isFloorEditMode && (
              <button
                onClick={() => {
                  handleFloorClick(null, '__other__')
                }}
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
          </div>
        </nav>
      )}

      {/* Floating settings button - always visible */}
      <button
        onClick={() => {
          setIsSettingsOpen(true)
        }}
        className="fixed bottom-4 right-4 z-10 w-12 h-12 rounded-full bg-card border border-border shadow-warm flex items-center justify-center text-muted hover:text-foreground hover:shadow-warm-lg transition-all touch-feedback mb-safe"
        aria-label={t.nav.settings}
      >
        <Settings className="w-5 h-5" />
      </button>

      <SettingsMenu
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false)
        }}
        onEnterEditMode={onEnterEditMode}
        onViewAllDevices={onViewAllDevices}
      />
    </>
  )
}

export { BottomNav as Header }
