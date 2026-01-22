import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Reorder } from 'framer-motion'
import { Settings } from 'lucide-react'
import { SettingsMenu } from './SettingsMenu'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { saveFloorOrderBatch } from '@/lib/ha-websocket'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { useEditMode } from '@/lib/contexts/EditModeContext'
import { LONG_PRESS_DURATION, scrollTo } from '@/lib/constants'
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
  /** Current drag position (for floor tab hit detection during room drag) */
  dragPosition?: { x: number; y: number } | null
  /** Floor ID being hovered over during drag (for visual feedback) */
  hoveredFloorId?: string | null | undefined
  /** Callback when drag enters a floor tab */
  onDragEnterFloor?: (floorId: string | null) => void
  /** Callback when drag leaves floor tabs */
  onDragLeaveFloor?: () => void
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
    // longPress.didLongPress is a getter on a ref - doesn't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSelect])

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

function ReorderableFloorTab({ floor, onTap }: ReorderableFloorTabProps) {
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
        className="flex flex-col items-center gap-1 px-4 py-2 min-w-[72px] transition-colors text-foreground"
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
  dragPosition,
  hoveredFloorId,
  onDragEnterFloor,
  onDragLeaveFloor,
}: BottomNavProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Refs for floor tab hit detection
  const floorTabsContainerRef = useRef<HTMLDivElement>(null)
  const floorTabRefs = useRef<Map<string, HTMLElement>>(new Map())

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
          scrollTo({ top: 0, behavior: 'smooth' })
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
  const handleBackgroundClick = useCallback(async () => {
    if (isFloorEditMode) {
      await handleSaveFloorOrder()
      exitEditMode()
    }
  }, [isFloorEditMode, handleSaveFloorOrder, exitEditMode])

  // Build list of floor IDs for hit detection (matching useCrossFloorDrag)
  const floorIdsForHitTest = useMemo((): (string | null)[] => {
    const ids: (string | null)[] = floors.map((f) => f.floor_id)
    if (hasUnassignedRooms) {
      ids.push(null) // null represents "Other" tab
    }
    return ids
  }, [floors, hasUnassignedRooms])

  // Track last hit floor to avoid repeated callbacks
  const lastHitFloorRef = useRef<string | null | undefined>(undefined)

  // Hit detection for floor tabs during room drag
  useEffect(() => {
    if (!dragPosition || !isRoomEditMode || !onDragEnterFloor || !onDragLeaveFloor) {
      // Reset tracking when drag ends
      lastHitFloorRef.current = undefined
      return
    }

    const { x, y } = dragPosition

    // Check each floor tab for hit
    let hitFloorId: string | null | undefined = undefined

    for (const floorId of floorIdsForHitTest) {
      const key = floorId ?? '__other__'
      const tabElement = floorTabRefs.current.get(key)
      if (!tabElement) continue

      const rect = tabElement.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        hitFloorId = floorId
        break
      }
    }

    // Only fire callbacks on change
    if (hitFloorId !== lastHitFloorRef.current) {
      lastHitFloorRef.current = hitFloorId

      if (hitFloorId !== undefined) {
        onDragEnterFloor(hitFloorId)
      } else {
        onDragLeaveFloor()
      }
    }
  }, [dragPosition, isRoomEditMode, floorIdsForHitTest, onDragEnterFloor, onDragLeaveFloor])

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
              // Room edit mode - floors show drag targets for cross-floor moves
              // py-1 -my-1 creates space for ring border and scale without changing layout
              <div
                ref={floorTabsContainerRef}
                className="flex items-center overflow-x-auto hide-scrollbar py-1 -my-1"
              >
                {displayFloors.map((floor) => {
                  const isActive = selectedFloorId === floor.floor_id
                  const isDragTarget = hoveredFloorId === floor.floor_id
                  return (
                    <div
                      key={floor.floor_id}
                      ref={(el) => {
                        if (el) {
                          floorTabRefs.current.set(floor.floor_id, el)
                        } else {
                          floorTabRefs.current.delete(floor.floor_id)
                        }
                      }}
                      className={`flex flex-col items-center gap-1 px-4 py-2 min-w-[72px] flex-shrink-0 transition-all rounded-xl ${
                        isDragTarget
                          ? 'text-accent bg-accent/30 scale-105'
                          : isActive
                            ? 'text-accent'
                            : 'text-muted'
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
                  )
                })}
              </div>
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
              <div
                ref={(el) => {
                  if (el) {
                    floorTabRefs.current.set('__other__', el)
                  } else {
                    floorTabRefs.current.delete('__other__')
                  }
                }}
                onClick={() => {
                  handleFloorClick(null, '__other__')
                }}
                className={`flex flex-col items-center gap-1 px-4 py-2 min-w-[72px] flex-shrink-0 transition-all cursor-pointer rounded-xl ${
                  isRoomEditMode && hoveredFloorId === null
                    ? 'text-accent bg-accent/30 scale-105'
                    : selectedFloorId === null
                      ? 'text-accent'
                      : 'text-muted hover:text-foreground'
                }`}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-current" />
                </div>
                <span className="text-xs font-medium">{t.floors.other}</span>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Floating settings button - positioned to align with nav */}
      <button
        onClick={() => {
          setIsSettingsOpen(true)
        }}
        className="fixed z-10 w-12 h-12 rounded-full bg-card border border-border shadow-warm flex items-center justify-center text-muted hover:text-foreground hover:shadow-warm-lg transition-all touch-feedback right-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
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
