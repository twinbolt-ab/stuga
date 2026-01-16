import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from 'react'
import type { RoomWithDevices, HAFloor } from '@/types/ha'

// State machine types
export type EditMode =
  | { type: 'normal' }
  | { type: 'edit-rooms'; selectedIds: Set<string>; orderedRooms: RoomWithDevices[] }
  | { type: 'edit-devices'; roomId: string; selectedIds: Set<string> }
  | { type: 'edit-all-devices'; selectedIds: Set<string> }
  | { type: 'edit-floors'; selectedFloorId: string; orderedFloors: HAFloor[] }

// Actions
type EditModeAction =
  | { type: 'ENTER_ROOM_EDIT'; rooms: RoomWithDevices[]; initialSelection?: string }
  | { type: 'ENTER_DEVICE_EDIT'; roomId: string; initialSelection?: string }
  | { type: 'ENTER_ALL_DEVICES_EDIT'; initialSelection?: string }
  | { type: 'ENTER_FLOOR_EDIT'; floors: HAFloor[]; selectedFloorId: string }
  | { type: 'EXIT_EDIT_MODE' }
  | { type: 'TOGGLE_SELECTION'; id: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'REORDER_ROOMS'; rooms: RoomWithDevices[] }
  | { type: 'REORDER_FLOORS'; floors: HAFloor[] }

// Reducer - exported for testing
export function editModeReducer(state: EditMode, action: EditModeAction): EditMode {
  switch (action.type) {
    case 'ENTER_ROOM_EDIT': {
      const selectedIds = action.initialSelection ? new Set([action.initialSelection]) : new Set<string>()
      return { type: 'edit-rooms', selectedIds, orderedRooms: action.rooms }
    }

    case 'ENTER_DEVICE_EDIT': {
      const selectedIds = action.initialSelection ? new Set([action.initialSelection]) : new Set<string>()
      return { type: 'edit-devices', roomId: action.roomId, selectedIds }
    }

    case 'ENTER_ALL_DEVICES_EDIT': {
      const selectedIds = action.initialSelection ? new Set([action.initialSelection]) : new Set<string>()
      return { type: 'edit-all-devices', selectedIds }
    }

    case 'ENTER_FLOOR_EDIT':
      return { type: 'edit-floors', selectedFloorId: action.selectedFloorId, orderedFloors: action.floors }

    case 'EXIT_EDIT_MODE':
      return { type: 'normal' }

    case 'TOGGLE_SELECTION':
      if (state.type === 'edit-rooms' || state.type === 'edit-devices' || state.type === 'edit-all-devices') {
        const newSelectedIds = new Set(state.selectedIds)
        if (newSelectedIds.has(action.id)) {
          newSelectedIds.delete(action.id)
        } else {
          newSelectedIds.add(action.id)
        }
        return { ...state, selectedIds: newSelectedIds }
      }
      return state

    case 'CLEAR_SELECTION':
      if (state.type === 'edit-rooms' || state.type === 'edit-devices' || state.type === 'edit-all-devices') {
        return { ...state, selectedIds: new Set() }
      }
      return state

    case 'REORDER_ROOMS':
      if (state.type === 'edit-rooms') {
        return { ...state, orderedRooms: action.rooms }
      }
      return state

    case 'REORDER_FLOORS':
      if (state.type === 'edit-floors') {
        return { ...state, orderedFloors: action.floors }
      }
      return state

    default:
      return state
  }
}

// Context value type
interface EditModeContextValue {
  // State
  mode: EditMode

  // Derived helpers
  isEditMode: boolean
  isRoomEditMode: boolean
  isDeviceEditMode: boolean
  isAllDevicesEditMode: boolean
  isFloorEditMode: boolean
  isSelected: (id: string) => boolean
  selectedCount: number
  selectedIds: Set<string>
  orderedRooms: RoomWithDevices[]
  orderedFloors: HAFloor[]
  selectedFloorId: string | null

  // Actions
  enterRoomEdit: (rooms: RoomWithDevices[], initialSelection?: string) => void
  enterDeviceEdit: (roomId: string, initialSelection?: string) => void
  enterAllDevicesEdit: (initialSelection?: string) => void
  enterFloorEdit: (floors: HAFloor[], selectedFloorId: string) => void
  exitEditMode: () => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  reorderRooms: (rooms: RoomWithDevices[]) => void
  reorderFloors: (floors: HAFloor[]) => void
}

const EditModeContext = createContext<EditModeContextValue | null>(null)

// Provider component
interface EditModeProviderProps {
  children: ReactNode
}

export function EditModeProvider({ children }: EditModeProviderProps) {
  const [mode, dispatch] = useReducer(editModeReducer, { type: 'normal' })

  // Derived state
  const isEditMode = mode.type !== 'normal'
  const isRoomEditMode = mode.type === 'edit-rooms'
  const isDeviceEditMode = mode.type === 'edit-devices'
  const isAllDevicesEditMode = mode.type === 'edit-all-devices'
  const isFloorEditMode = mode.type === 'edit-floors'

  const selectedIds = useMemo(() => {
    if (mode.type === 'edit-rooms' || mode.type === 'edit-devices' || mode.type === 'edit-all-devices') {
      return mode.selectedIds
    }
    return new Set<string>()
  }, [mode])

  const selectedCount = selectedIds.size

  const orderedRooms = useMemo(() => {
    if (mode.type === 'edit-rooms') {
      return mode.orderedRooms
    }
    return []
  }, [mode])

  const orderedFloors = useMemo(() => {
    if (mode.type === 'edit-floors') {
      return mode.orderedFloors
    }
    return []
  }, [mode])

  const selectedFloorId = useMemo(() => {
    if (mode.type === 'edit-floors') {
      return mode.selectedFloorId
    }
    return null
  }, [mode])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  // Actions
  const enterRoomEdit = useCallback((rooms: RoomWithDevices[], initialSelection?: string) => dispatch({ type: 'ENTER_ROOM_EDIT', rooms, initialSelection }), [])
  const enterDeviceEdit = useCallback((roomId: string, initialSelection?: string) => dispatch({ type: 'ENTER_DEVICE_EDIT', roomId, initialSelection }), [])
  const enterAllDevicesEdit = useCallback((initialSelection?: string) => dispatch({ type: 'ENTER_ALL_DEVICES_EDIT', initialSelection }), [])
  const enterFloorEdit = useCallback((floors: HAFloor[], selectedFloorId: string) => dispatch({ type: 'ENTER_FLOOR_EDIT', floors, selectedFloorId }), [])
  const exitEditMode = useCallback(() => dispatch({ type: 'EXIT_EDIT_MODE' }), [])
  const toggleSelection = useCallback((id: string) => dispatch({ type: 'TOGGLE_SELECTION', id }), [])
  const clearSelection = useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), [])
  const reorderRooms = useCallback((rooms: RoomWithDevices[]) => dispatch({ type: 'REORDER_ROOMS', rooms }), [])
  const reorderFloors = useCallback((floors: HAFloor[]) => dispatch({ type: 'REORDER_FLOORS', floors }), [])

  const value = useMemo<EditModeContextValue>(() => ({
    mode,
    isEditMode,
    isRoomEditMode,
    isDeviceEditMode,
    isAllDevicesEditMode,
    isFloorEditMode,
    isSelected,
    selectedCount,
    selectedIds,
    orderedRooms,
    orderedFloors,
    selectedFloorId,
    enterRoomEdit,
    enterDeviceEdit,
    enterAllDevicesEdit,
    enterFloorEdit,
    exitEditMode,
    toggleSelection,
    clearSelection,
    reorderRooms,
    reorderFloors,
  }), [
    mode,
    isEditMode,
    isRoomEditMode,
    isDeviceEditMode,
    isAllDevicesEditMode,
    isFloorEditMode,
    isSelected,
    selectedCount,
    selectedIds,
    orderedRooms,
    orderedFloors,
    selectedFloorId,
    enterRoomEdit,
    enterDeviceEdit,
    enterAllDevicesEdit,
    enterFloorEdit,
    exitEditMode,
    toggleSelection,
    clearSelection,
    reorderRooms,
    reorderFloors,
  ])

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  )
}

// Hook to use the context
export function useEditMode(): EditModeContextValue {
  const context = useContext(EditModeContext)
  if (!context) {
    throw new Error('useEditMode must be used within an EditModeProvider')
  }
  return context
}
