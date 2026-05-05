import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from 'react'
import type { RoomWithDevices, HAFloor } from '@/types/ha'

// Entity domain type for tracking selected entity type
export type EntityDomain =
  | 'light'
  | 'switch'
  | 'scene'
  | 'input_boolean'
  | 'input_number'
  | 'fan'
  | 'cover'
  | 'vacuum'
  | 'media_player'
  | 'sensor'

// Helper to extract domain from entity_id
export function getEntityDomain(entityId: string): EntityDomain | null {
  const domain = entityId.split('.')[0]
  const validDomains: EntityDomain[] = [
    'light',
    'switch',
    'scene',
    'input_boolean',
    'input_number',
    'fan',
    'cover',
    'vacuum',
    'media_player',
    'sensor',
  ]
  return validDomains.includes(domain as EntityDomain) ? (domain as EntityDomain) : null
}

// Favorite item type for tracking what kind of item is selected
export type FavoriteItemType = 'scene' | 'room' | 'entity'

// State machine types
export type EditMode =
  | { type: 'normal' }
  | {
      type: 'edit-rooms'
      selectedIds: Set<string>
      orderedRooms: RoomWithDevices[]
      initialSelection?: string
    }
  | {
      type: 'edit-devices'
      roomId: string
      selectedIds: Set<string>
      selectedDomain: EntityDomain | null
      initialSelection?: string
    }
  | {
      type: 'edit-all-devices'
      selectedIds: Set<string>
      selectedDomain: EntityDomain | null
      initialSelection?: string
    }
  | { type: 'edit-floors'; selectedFloorId: string; orderedFloors: HAFloor[] }
  | {
      type: 'edit-favorites'
      selectedIds: Set<string>
      selectedItemType: FavoriteItemType | null
      selectedDomain: EntityDomain | null
      initialSelection?: string
    }

// Actions
type EditModeAction =
  | { type: 'ENTER_ROOM_EDIT'; rooms: RoomWithDevices[]; initialSelection?: string }
  | { type: 'ENTER_DEVICE_EDIT'; roomId: string; initialSelection?: string }
  | { type: 'ENTER_ALL_DEVICES_EDIT'; initialSelection?: string }
  | { type: 'ENTER_FLOOR_EDIT'; floors: HAFloor[]; selectedFloorId: string }
  | {
      type: 'ENTER_FAVORITES_EDIT'
      initialSelection?: string
      itemType: FavoriteItemType
    }
  | { type: 'EXIT_EDIT_MODE' }
  | { type: 'TOGGLE_SELECTION'; id: string }
  | { type: 'TOGGLE_FAVORITES_SELECTION'; id: string; itemType: FavoriteItemType }
  | { type: 'DESELECT'; id: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'REORDER_ROOMS'; rooms: RoomWithDevices[] }
  | { type: 'REORDER_FLOORS'; floors: HAFloor[] }
  | { type: 'SWITCH_FLOOR_ROOMS'; rooms: RoomWithDevices[] }

// Reducer - exported for testing
export function editModeReducer(state: EditMode, action: EditModeAction): EditMode {
  switch (action.type) {
    case 'ENTER_ROOM_EDIT': {
      const selectedIds = action.initialSelection
        ? new Set([action.initialSelection])
        : new Set<string>()
      return {
        type: 'edit-rooms',
        selectedIds,
        orderedRooms: action.rooms,
        initialSelection: action.initialSelection,
      }
    }

    case 'ENTER_DEVICE_EDIT': {
      const selectedIds = action.initialSelection
        ? new Set([action.initialSelection])
        : new Set<string>()
      const selectedDomain = action.initialSelection
        ? getEntityDomain(action.initialSelection)
        : null
      return {
        type: 'edit-devices',
        roomId: action.roomId,
        selectedIds,
        selectedDomain,
        initialSelection: action.initialSelection,
      }
    }

    case 'ENTER_ALL_DEVICES_EDIT': {
      const selectedIds = action.initialSelection
        ? new Set([action.initialSelection])
        : new Set<string>()
      const selectedDomain = action.initialSelection
        ? getEntityDomain(action.initialSelection)
        : null
      return {
        type: 'edit-all-devices',
        selectedIds,
        selectedDomain,
        initialSelection: action.initialSelection,
      }
    }

    case 'ENTER_FLOOR_EDIT':
      return {
        type: 'edit-floors',
        selectedFloorId: action.selectedFloorId,
        orderedFloors: action.floors,
      }

    case 'ENTER_FAVORITES_EDIT': {
      const selectedIds = action.initialSelection
        ? new Set([action.initialSelection])
        : new Set<string>()
      // Derive domain if itemType is 'entity'
      const selectedDomain =
        action.itemType === 'entity' && action.initialSelection
          ? getEntityDomain(action.initialSelection)
          : null
      return {
        type: 'edit-favorites',
        selectedIds,
        selectedItemType: action.itemType,
        selectedDomain,
        initialSelection: action.initialSelection,
      }
    }

    case 'EXIT_EDIT_MODE':
      return { type: 'normal' }

    case 'TOGGLE_SELECTION':
      if (state.type === 'edit-rooms') {
        const newSelectedIds = new Set(state.selectedIds)
        if (newSelectedIds.has(action.id)) {
          newSelectedIds.delete(action.id)
        } else {
          newSelectedIds.add(action.id)
        }
        // Exit edit mode if all items are deselected
        if (newSelectedIds.size === 0) {
          return { type: 'normal' }
        }
        return { ...state, selectedIds: newSelectedIds }
      }
      if (state.type === 'edit-devices' || state.type === 'edit-all-devices') {
        // Check if the entity domain matches the currently selected domain
        const entityDomain = getEntityDomain(action.id)

        // If we have a selected domain and this entity is a different type, exit edit mode
        if (state.selectedDomain && entityDomain !== state.selectedDomain) {
          return { type: 'normal' }
        }

        const newSelectedIds = new Set(state.selectedIds)
        if (newSelectedIds.has(action.id)) {
          newSelectedIds.delete(action.id)
        } else {
          newSelectedIds.add(action.id)
        }
        // Exit edit mode if all items are deselected
        if (newSelectedIds.size === 0) {
          return { type: 'normal' }
        }

        // Update the selected domain if this is the first selection
        const newSelectedDomain = state.selectedDomain || entityDomain
        return { ...state, selectedIds: newSelectedIds, selectedDomain: newSelectedDomain }
      }
      return state

    case 'TOGGLE_FAVORITES_SELECTION':
      if (state.type === 'edit-favorites') {
        // If selecting a different item type, exit edit mode
        if (state.selectedItemType && action.itemType !== state.selectedItemType) {
          return { type: 'normal' }
        }

        // For entity type, also check domain match
        if (action.itemType === 'entity') {
          const entityDomain = getEntityDomain(action.id)
          if (state.selectedDomain && entityDomain !== state.selectedDomain) {
            return { type: 'normal' }
          }
        }

        const newSelectedIds = new Set(state.selectedIds)
        if (newSelectedIds.has(action.id)) {
          newSelectedIds.delete(action.id)
        } else {
          newSelectedIds.add(action.id)
        }
        // Exit edit mode if all items are deselected
        if (newSelectedIds.size === 0) {
          return { type: 'normal' }
        }

        // Update the selected item type if this is the first selection
        const newSelectedItemType = state.selectedItemType || action.itemType
        // Update the selected domain if this is an entity and first selection
        const newSelectedDomain =
          action.itemType === 'entity'
            ? state.selectedDomain || getEntityDomain(action.id)
            : state.selectedDomain
        return {
          ...state,
          selectedIds: newSelectedIds,
          selectedItemType: newSelectedItemType,
          selectedDomain: newSelectedDomain,
        }
      }
      return state

    case 'DESELECT':
      if (
        state.type === 'edit-rooms' ||
        state.type === 'edit-devices' ||
        state.type === 'edit-all-devices' ||
        state.type === 'edit-favorites'
      ) {
        const newSelectedIds = new Set(state.selectedIds)
        newSelectedIds.delete(action.id)
        // Exit edit mode if all items are deselected
        if (newSelectedIds.size === 0) {
          return { type: 'normal' }
        }
        return { ...state, selectedIds: newSelectedIds }
      }
      return state

    case 'CLEAR_SELECTION':
      if (
        state.type === 'edit-rooms' ||
        state.type === 'edit-devices' ||
        state.type === 'edit-all-devices' ||
        state.type === 'edit-favorites'
      ) {
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

    case 'SWITCH_FLOOR_ROOMS':
      // Switch to a new floor's rooms during cross-floor drag
      // Preserve selection so the dragged room stays selected
      if (state.type === 'edit-rooms') {
        return { ...state, orderedRooms: action.rooms }
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
  isFavoritesEditMode: boolean
  isSelected: (id: string) => boolean
  selectedCount: number
  selectedIds: Set<string>
  selectedDomain: EntityDomain | null
  selectedFavoriteItemType: FavoriteItemType | null
  orderedRooms: RoomWithDevices[]
  orderedFloors: HAFloor[]
  selectedFloorId: string | null
  initialSelection: string | null

  // Actions
  enterRoomEdit: (rooms: RoomWithDevices[], initialSelection?: string) => void
  enterDeviceEdit: (roomId: string, initialSelection?: string) => void
  enterAllDevicesEdit: (initialSelection?: string) => void
  enterFloorEdit: (floors: HAFloor[], selectedFloorId: string) => void
  enterFavoritesEdit: (itemType: FavoriteItemType, initialSelection?: string) => void
  exitEditMode: () => void
  toggleSelection: (id: string) => void
  toggleFavoritesSelection: (id: string, itemType: FavoriteItemType) => void
  deselect: (id: string) => void
  clearSelection: () => void
  reorderRooms: (rooms: RoomWithDevices[]) => void
  reorderFloors: (floors: HAFloor[]) => void
  switchFloorRooms: (rooms: RoomWithDevices[]) => void
}

const EditModeContext = createContext<EditModeContextValue | null>(null)

// Stable empty values to avoid unnecessary re-renders
const EMPTY_SET = new Set<string>()
const EMPTY_ROOMS: RoomWithDevices[] = []
const EMPTY_FLOORS: HAFloor[] = []

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
  const isFavoritesEditMode = mode.type === 'edit-favorites'

  const selectedIds = useMemo(() => {
    if (
      mode.type === 'edit-rooms' ||
      mode.type === 'edit-devices' ||
      mode.type === 'edit-all-devices' ||
      mode.type === 'edit-favorites'
    ) {
      return mode.selectedIds
    }
    return EMPTY_SET
  }, [mode])

  const selectedCount = selectedIds.size

  const selectedDomain = useMemo(() => {
    if (mode.type === 'edit-devices' || mode.type === 'edit-all-devices') {
      return mode.selectedDomain
    }
    if (mode.type === 'edit-favorites') {
      return mode.selectedDomain
    }
    return null
  }, [mode])

  const orderedRooms = useMemo(() => {
    if (mode.type === 'edit-rooms') {
      return mode.orderedRooms
    }
    return EMPTY_ROOMS
  }, [mode])

  const orderedFloors = useMemo(() => {
    if (mode.type === 'edit-floors') {
      return mode.orderedFloors
    }
    return EMPTY_FLOORS
  }, [mode])

  const selectedFloorId = useMemo(() => {
    if (mode.type === 'edit-floors') {
      return mode.selectedFloorId
    }
    return null
  }, [mode])

  const initialSelection = useMemo(() => {
    if (
      mode.type === 'edit-rooms' ||
      mode.type === 'edit-devices' ||
      mode.type === 'edit-all-devices' ||
      mode.type === 'edit-favorites'
    ) {
      return mode.initialSelection ?? null
    }
    return null
  }, [mode])

  const selectedFavoriteItemType = useMemo(() => {
    if (mode.type === 'edit-favorites') {
      return mode.selectedItemType
    }
    return null
  }, [mode])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  // Actions
  const enterRoomEdit = useCallback((rooms: RoomWithDevices[], initialSelection?: string) => {
    dispatch({ type: 'ENTER_ROOM_EDIT', rooms, initialSelection })
  }, [])
  const enterDeviceEdit = useCallback((roomId: string, initialSelection?: string) => {
    dispatch({ type: 'ENTER_DEVICE_EDIT', roomId, initialSelection })
  }, [])
  const enterAllDevicesEdit = useCallback((initialSelection?: string) => {
    dispatch({ type: 'ENTER_ALL_DEVICES_EDIT', initialSelection })
  }, [])
  const enterFloorEdit = useCallback((floors: HAFloor[], selectedFloorId: string) => {
    dispatch({ type: 'ENTER_FLOOR_EDIT', floors, selectedFloorId })
  }, [])
  const enterFavoritesEdit = useCallback(
    (itemType: FavoriteItemType, initialSelection?: string) => {
      dispatch({ type: 'ENTER_FAVORITES_EDIT', itemType, initialSelection })
    },
    []
  )
  const exitEditMode = useCallback(() => {
    dispatch({ type: 'EXIT_EDIT_MODE' })
  }, [])
  const toggleSelection = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECTION', id })
  }, [])
  const toggleFavoritesSelection = useCallback((id: string, itemType: FavoriteItemType) => {
    dispatch({ type: 'TOGGLE_FAVORITES_SELECTION', id, itemType })
  }, [])
  const deselect = useCallback((id: string) => {
    dispatch({ type: 'DESELECT', id })
  }, [])
  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' })
  }, [])
  const reorderRooms = useCallback((rooms: RoomWithDevices[]) => {
    dispatch({ type: 'REORDER_ROOMS', rooms })
  }, [])
  const reorderFloors = useCallback((floors: HAFloor[]) => {
    dispatch({ type: 'REORDER_FLOORS', floors })
  }, [])
  const switchFloorRooms = useCallback((rooms: RoomWithDevices[]) => {
    dispatch({ type: 'SWITCH_FLOOR_ROOMS', rooms })
  }, [])

  const value = useMemo<EditModeContextValue>(
    () => ({
      mode,
      isEditMode,
      isRoomEditMode,
      isDeviceEditMode,
      isAllDevicesEditMode,
      isFloorEditMode,
      isFavoritesEditMode,
      isSelected,
      selectedCount,
      selectedIds,
      selectedDomain,
      selectedFavoriteItemType,
      orderedRooms,
      orderedFloors,
      selectedFloorId,
      initialSelection,
      enterRoomEdit,
      enterDeviceEdit,
      enterAllDevicesEdit,
      enterFloorEdit,
      enterFavoritesEdit,
      exitEditMode,
      toggleSelection,
      toggleFavoritesSelection,
      deselect,
      clearSelection,
      reorderRooms,
      reorderFloors,
      switchFloorRooms,
    }),
    [
      mode,
      isEditMode,
      isRoomEditMode,
      isDeviceEditMode,
      isAllDevicesEditMode,
      isFloorEditMode,
      isFavoritesEditMode,
      isSelected,
      selectedCount,
      selectedIds,
      selectedDomain,
      selectedFavoriteItemType,
      orderedRooms,
      orderedFloors,
      selectedFloorId,
      initialSelection,
      enterRoomEdit,
      enterDeviceEdit,
      enterAllDevicesEdit,
      enterFloorEdit,
      enterFavoritesEdit,
      exitEditMode,
      toggleSelection,
      toggleFavoritesSelection,
      deselect,
      clearSelection,
      reorderRooms,
      reorderFloors,
      switchFloorRooms,
    ]
  )

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>
}

// Hook to use the context
export function useEditMode(): EditModeContextValue {
  const context = useContext(EditModeContext)
  if (!context) {
    throw new Error('useEditMode must be used within an EditModeProvider')
  }
  return context
}
