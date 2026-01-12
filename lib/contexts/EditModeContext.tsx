'use client'

import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from 'react'

// State machine types
export type EditMode =
  | { type: 'normal' }
  | { type: 'edit-rooms'; selectedIds: Set<string> }
  | { type: 'edit-devices'; roomId: string; selectedIds: Set<string> }
  | { type: 'edit-uncategorized'; selectedIds: Set<string> }

// Actions
type EditModeAction =
  | { type: 'ENTER_ROOM_EDIT' }
  | { type: 'ENTER_DEVICE_EDIT'; roomId: string }
  | { type: 'ENTER_UNCATEGORIZED_EDIT' }
  | { type: 'EXIT_EDIT_MODE' }
  | { type: 'TOGGLE_SELECTION'; id: string }
  | { type: 'CLEAR_SELECTION' }

// Reducer
function editModeReducer(state: EditMode, action: EditModeAction): EditMode {
  switch (action.type) {
    case 'ENTER_ROOM_EDIT':
      return { type: 'edit-rooms', selectedIds: new Set() }

    case 'ENTER_DEVICE_EDIT':
      return { type: 'edit-devices', roomId: action.roomId, selectedIds: new Set() }

    case 'ENTER_UNCATEGORIZED_EDIT':
      return { type: 'edit-uncategorized', selectedIds: new Set() }

    case 'EXIT_EDIT_MODE':
      return { type: 'normal' }

    case 'TOGGLE_SELECTION':
      if (state.type === 'edit-rooms' || state.type === 'edit-devices' || state.type === 'edit-uncategorized') {
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
      if (state.type === 'edit-rooms' || state.type === 'edit-devices' || state.type === 'edit-uncategorized') {
        return { ...state, selectedIds: new Set() }
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
  isUncategorizedEditMode: boolean
  isSelected: (id: string) => boolean
  selectedCount: number
  selectedIds: Set<string>

  // Actions
  enterRoomEdit: () => void
  enterDeviceEdit: (roomId: string) => void
  enterUncategorizedEdit: () => void
  exitEditMode: () => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
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
  const isUncategorizedEditMode = mode.type === 'edit-uncategorized'

  const selectedIds = useMemo(() => {
    if (mode.type === 'edit-rooms' || mode.type === 'edit-devices' || mode.type === 'edit-uncategorized') {
      return mode.selectedIds
    }
    return new Set<string>()
  }, [mode])

  const selectedCount = selectedIds.size

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  // Actions
  const enterRoomEdit = useCallback(() => dispatch({ type: 'ENTER_ROOM_EDIT' }), [])
  const enterDeviceEdit = useCallback((roomId: string) => dispatch({ type: 'ENTER_DEVICE_EDIT', roomId }), [])
  const enterUncategorizedEdit = useCallback(() => dispatch({ type: 'ENTER_UNCATEGORIZED_EDIT' }), [])
  const exitEditMode = useCallback(() => dispatch({ type: 'EXIT_EDIT_MODE' }), [])
  const toggleSelection = useCallback((id: string) => dispatch({ type: 'TOGGLE_SELECTION', id }), [])
  const clearSelection = useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), [])

  const value = useMemo<EditModeContextValue>(() => ({
    mode,
    isEditMode,
    isRoomEditMode,
    isDeviceEditMode,
    isUncategorizedEditMode,
    isSelected,
    selectedCount,
    selectedIds,
    enterRoomEdit,
    enterDeviceEdit,
    enterUncategorizedEdit,
    exitEditMode,
    toggleSelection,
    clearSelection,
  }), [
    mode,
    isEditMode,
    isRoomEditMode,
    isDeviceEditMode,
    isUncategorizedEditMode,
    isSelected,
    selectedCount,
    selectedIds,
    enterRoomEdit,
    enterDeviceEdit,
    enterUncategorizedEdit,
    exitEditMode,
    toggleSelection,
    clearSelection,
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
