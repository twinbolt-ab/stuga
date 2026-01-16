import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { EditModeProvider, useEditMode, editModeReducer, type EditMode } from '../EditModeContext'
import type { RoomWithDevices, HAFloor } from '@/types/ha'

// Mock data factories
function createMockRoom(overrides: Partial<RoomWithDevices> = {}): RoomWithDevices {
  return {
    id: 'room-1',
    name: 'Test Room',
    areaId: 'area-1',
    devices: [],
    lightsOn: 0,
    totalLights: 0,
    ...overrides,
  }
}

function createMockFloor(overrides: Partial<HAFloor> = {}): HAFloor {
  return {
    floor_id: 'floor-1',
    name: 'Test Floor',
    level: 0,
    ...overrides,
  }
}

describe('editModeReducer', () => {
  const normalState: EditMode = { type: 'normal' }

  describe('ENTER_ROOM_EDIT', () => {
    it('should enter room edit mode with empty selection', () => {
      const rooms = [createMockRoom()]
      const result = editModeReducer(normalState, {
        type: 'ENTER_ROOM_EDIT',
        rooms,
      })

      expect(result.type).toBe('edit-rooms')
      if (result.type === 'edit-rooms') {
        expect(result.selectedIds.size).toBe(0)
        expect(result.orderedRooms).toBe(rooms)
      }
    })

    it('should enter room edit mode with initial selection', () => {
      const rooms = [createMockRoom({ id: 'room-1' }), createMockRoom({ id: 'room-2' })]
      const result = editModeReducer(normalState, {
        type: 'ENTER_ROOM_EDIT',
        rooms,
        initialSelection: 'room-1',
      })

      expect(result.type).toBe('edit-rooms')
      if (result.type === 'edit-rooms') {
        expect(result.selectedIds.size).toBe(1)
        expect(result.selectedIds.has('room-1')).toBe(true)
      }
    })
  })

  describe('ENTER_DEVICE_EDIT', () => {
    it('should enter device edit mode with empty selection', () => {
      const result = editModeReducer(normalState, {
        type: 'ENTER_DEVICE_EDIT',
        roomId: 'room-1',
      })

      expect(result.type).toBe('edit-devices')
      if (result.type === 'edit-devices') {
        expect(result.roomId).toBe('room-1')
        expect(result.selectedIds.size).toBe(0)
      }
    })

    it('should enter device edit mode with initial selection', () => {
      const result = editModeReducer(normalState, {
        type: 'ENTER_DEVICE_EDIT',
        roomId: 'room-1',
        initialSelection: 'light.living_room',
      })

      expect(result.type).toBe('edit-devices')
      if (result.type === 'edit-devices') {
        expect(result.roomId).toBe('room-1')
        expect(result.selectedIds.size).toBe(1)
        expect(result.selectedIds.has('light.living_room')).toBe(true)
      }
    })
  })

  describe('ENTER_ALL_DEVICES_EDIT', () => {
    it('should enter all devices edit mode with empty selection', () => {
      const result = editModeReducer(normalState, {
        type: 'ENTER_ALL_DEVICES_EDIT',
      })

      expect(result.type).toBe('edit-all-devices')
      if (result.type === 'edit-all-devices') {
        expect(result.selectedIds.size).toBe(0)
      }
    })

    it('should enter all devices edit mode with initial selection', () => {
      const result = editModeReducer(normalState, {
        type: 'ENTER_ALL_DEVICES_EDIT',
        initialSelection: 'switch.garage',
      })

      expect(result.type).toBe('edit-all-devices')
      if (result.type === 'edit-all-devices') {
        expect(result.selectedIds.size).toBe(1)
        expect(result.selectedIds.has('switch.garage')).toBe(true)
      }
    })
  })

  describe('ENTER_FLOOR_EDIT', () => {
    it('should enter floor edit mode', () => {
      const floors = [createMockFloor({ floor_id: 'floor-1' })]
      const result = editModeReducer(normalState, {
        type: 'ENTER_FLOOR_EDIT',
        floors,
        selectedFloorId: 'floor-1',
      })

      expect(result.type).toBe('edit-floors')
      if (result.type === 'edit-floors') {
        expect(result.selectedFloorId).toBe('floor-1')
        expect(result.orderedFloors).toBe(floors)
      }
    })
  })

  describe('EXIT_EDIT_MODE', () => {
    it('should exit from room edit mode', () => {
      const editState: EditMode = {
        type: 'edit-rooms',
        selectedIds: new Set(['room-1']),
        orderedRooms: [],
      }
      const result = editModeReducer(editState, { type: 'EXIT_EDIT_MODE' })
      expect(result.type).toBe('normal')
    })

    it('should exit from device edit mode', () => {
      const editState: EditMode = {
        type: 'edit-devices',
        roomId: 'room-1',
        selectedIds: new Set(['light.1']),
      }
      const result = editModeReducer(editState, { type: 'EXIT_EDIT_MODE' })
      expect(result.type).toBe('normal')
    })

    it('should exit from all devices edit mode', () => {
      const editState: EditMode = {
        type: 'edit-all-devices',
        selectedIds: new Set(['switch.1']),
      }
      const result = editModeReducer(editState, { type: 'EXIT_EDIT_MODE' })
      expect(result.type).toBe('normal')
    })
  })

  describe('TOGGLE_SELECTION', () => {
    it('should add item to selection in room edit mode', () => {
      const editState: EditMode = {
        type: 'edit-rooms',
        selectedIds: new Set(),
        orderedRooms: [],
      }
      const result = editModeReducer(editState, {
        type: 'TOGGLE_SELECTION',
        id: 'room-1',
      })

      if (result.type === 'edit-rooms') {
        expect(result.selectedIds.has('room-1')).toBe(true)
      }
    })

    it('should remove item from selection in room edit mode', () => {
      const editState: EditMode = {
        type: 'edit-rooms',
        selectedIds: new Set(['room-1']),
        orderedRooms: [],
      }
      const result = editModeReducer(editState, {
        type: 'TOGGLE_SELECTION',
        id: 'room-1',
      })

      if (result.type === 'edit-rooms') {
        expect(result.selectedIds.has('room-1')).toBe(false)
      }
    })

    it('should toggle selection in device edit mode', () => {
      const editState: EditMode = {
        type: 'edit-devices',
        roomId: 'room-1',
        selectedIds: new Set(),
      }
      const result = editModeReducer(editState, {
        type: 'TOGGLE_SELECTION',
        id: 'light.1',
      })

      if (result.type === 'edit-devices') {
        expect(result.selectedIds.has('light.1')).toBe(true)
      }
    })

    it('should toggle selection in all devices edit mode', () => {
      const editState: EditMode = {
        type: 'edit-all-devices',
        selectedIds: new Set(['switch.1']),
      }
      const result = editModeReducer(editState, {
        type: 'TOGGLE_SELECTION',
        id: 'switch.2',
      })

      if (result.type === 'edit-all-devices') {
        expect(result.selectedIds.has('switch.1')).toBe(true)
        expect(result.selectedIds.has('switch.2')).toBe(true)
        expect(result.selectedIds.size).toBe(2)
      }
    })

    it('should not toggle selection in normal mode', () => {
      const result = editModeReducer(normalState, {
        type: 'TOGGLE_SELECTION',
        id: 'room-1',
      })
      expect(result.type).toBe('normal')
    })

    it('should not toggle selection in floor edit mode', () => {
      const floorEditState: EditMode = {
        type: 'edit-floors',
        selectedFloorId: 'floor-1',
        orderedFloors: [],
      }
      const result = editModeReducer(floorEditState, {
        type: 'TOGGLE_SELECTION',
        id: 'floor-1',
      })
      expect(result).toBe(floorEditState)
    })
  })

  describe('CLEAR_SELECTION', () => {
    it('should clear selection in room edit mode', () => {
      const editState: EditMode = {
        type: 'edit-rooms',
        selectedIds: new Set(['room-1', 'room-2']),
        orderedRooms: [],
      }
      const result = editModeReducer(editState, { type: 'CLEAR_SELECTION' })

      if (result.type === 'edit-rooms') {
        expect(result.selectedIds.size).toBe(0)
      }
    })

    it('should clear selection in device edit mode', () => {
      const editState: EditMode = {
        type: 'edit-devices',
        roomId: 'room-1',
        selectedIds: new Set(['light.1', 'light.2']),
      }
      const result = editModeReducer(editState, { type: 'CLEAR_SELECTION' })

      if (result.type === 'edit-devices') {
        expect(result.selectedIds.size).toBe(0)
      }
    })

    it('should clear selection in all devices edit mode', () => {
      const editState: EditMode = {
        type: 'edit-all-devices',
        selectedIds: new Set(['switch.1', 'switch.2']),
      }
      const result = editModeReducer(editState, { type: 'CLEAR_SELECTION' })

      if (result.type === 'edit-all-devices') {
        expect(result.selectedIds.size).toBe(0)
      }
    })

    it('should not affect normal mode', () => {
      const result = editModeReducer(normalState, { type: 'CLEAR_SELECTION' })
      expect(result).toBe(normalState)
    })
  })

  describe('REORDER_ROOMS', () => {
    it('should update ordered rooms in room edit mode', () => {
      const initialRooms = [createMockRoom({ id: 'room-1' }), createMockRoom({ id: 'room-2' })]
      const editState: EditMode = {
        type: 'edit-rooms',
        selectedIds: new Set(),
        orderedRooms: initialRooms,
      }
      const newOrder = [createMockRoom({ id: 'room-2' }), createMockRoom({ id: 'room-1' })]
      const result = editModeReducer(editState, {
        type: 'REORDER_ROOMS',
        rooms: newOrder,
      })

      if (result.type === 'edit-rooms') {
        expect(result.orderedRooms).toBe(newOrder)
      }
    })

    it('should not affect other modes', () => {
      const editState: EditMode = {
        type: 'edit-devices',
        roomId: 'room-1',
        selectedIds: new Set(),
      }
      const result = editModeReducer(editState, {
        type: 'REORDER_ROOMS',
        rooms: [],
      })
      expect(result).toBe(editState)
    })
  })

  describe('REORDER_FLOORS', () => {
    it('should update ordered floors in floor edit mode', () => {
      const initialFloors = [createMockFloor({ floor_id: 'floor-1' }), createMockFloor({ floor_id: 'floor-2' })]
      const editState: EditMode = {
        type: 'edit-floors',
        selectedFloorId: 'floor-1',
        orderedFloors: initialFloors,
      }
      const newOrder = [createMockFloor({ floor_id: 'floor-2' }), createMockFloor({ floor_id: 'floor-1' })]
      const result = editModeReducer(editState, {
        type: 'REORDER_FLOORS',
        floors: newOrder,
      })

      if (result.type === 'edit-floors') {
        expect(result.orderedFloors).toBe(newOrder)
      }
    })

    it('should not affect other modes', () => {
      const editState: EditMode = {
        type: 'edit-rooms',
        selectedIds: new Set(),
        orderedRooms: [],
      }
      const result = editModeReducer(editState, {
        type: 'REORDER_FLOORS',
        floors: [],
      })
      expect(result).toBe(editState)
    })
  })
})

describe('useEditMode hook', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <EditModeProvider>{children}</EditModeProvider>
  )

  it('should start in normal mode', () => {
    const { result } = renderHook(() => useEditMode(), { wrapper })

    expect(result.current.isEditMode).toBe(false)
    expect(result.current.isRoomEditMode).toBe(false)
    expect(result.current.isDeviceEditMode).toBe(false)
    expect(result.current.isAllDevicesEditMode).toBe(false)
    expect(result.current.isFloorEditMode).toBe(false)
    expect(result.current.selectedCount).toBe(0)
  })

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useEditMode())
    }).toThrow('useEditMode must be used within an EditModeProvider')
  })

  describe('enterAllDevicesEdit', () => {
    it('should enter all devices edit mode without selection', () => {
      const { result } = renderHook(() => useEditMode(), { wrapper })

      act(() => {
        result.current.enterAllDevicesEdit()
      })

      expect(result.current.isEditMode).toBe(true)
      expect(result.current.isAllDevicesEditMode).toBe(true)
      expect(result.current.selectedCount).toBe(0)
    })

    it('should enter all devices edit mode with initial selection', () => {
      const { result } = renderHook(() => useEditMode(), { wrapper })

      act(() => {
        result.current.enterAllDevicesEdit('switch.garage')
      })

      expect(result.current.isAllDevicesEditMode).toBe(true)
      expect(result.current.selectedCount).toBe(1)
      expect(result.current.isSelected('switch.garage')).toBe(true)
    })
  })

  describe('enterDeviceEdit', () => {
    it('should enter device edit mode without selection', () => {
      const { result } = renderHook(() => useEditMode(), { wrapper })

      act(() => {
        result.current.enterDeviceEdit('room-1')
      })

      expect(result.current.isEditMode).toBe(true)
      expect(result.current.isDeviceEditMode).toBe(true)
      expect(result.current.selectedCount).toBe(0)
    })

    it('should enter device edit mode with initial selection', () => {
      const { result } = renderHook(() => useEditMode(), { wrapper })

      act(() => {
        result.current.enterDeviceEdit('room-1', 'light.bedroom')
      })

      expect(result.current.isDeviceEditMode).toBe(true)
      expect(result.current.selectedCount).toBe(1)
      expect(result.current.isSelected('light.bedroom')).toBe(true)
    })
  })

  describe('enterRoomEdit', () => {
    it('should enter room edit mode without selection', () => {
      const { result } = renderHook(() => useEditMode(), { wrapper })
      const rooms = [createMockRoom()]

      act(() => {
        result.current.enterRoomEdit(rooms)
      })

      expect(result.current.isEditMode).toBe(true)
      expect(result.current.isRoomEditMode).toBe(true)
      expect(result.current.selectedCount).toBe(0)
      expect(result.current.orderedRooms).toEqual(rooms)
    })

    it('should enter room edit mode with initial selection', () => {
      const { result } = renderHook(() => useEditMode(), { wrapper })
      const rooms = [createMockRoom({ id: 'room-1' }), createMockRoom({ id: 'room-2' })]

      act(() => {
        result.current.enterRoomEdit(rooms, 'room-1')
      })

      expect(result.current.isRoomEditMode).toBe(true)
      expect(result.current.selectedCount).toBe(1)
      expect(result.current.isSelected('room-1')).toBe(true)
      expect(result.current.isSelected('room-2')).toBe(false)
    })
  })

  describe('toggleSelection', () => {
    it('should add and remove items from selection', () => {
      const { result } = renderHook(() => useEditMode(), { wrapper })

      act(() => {
        result.current.enterAllDevicesEdit()
      })

      act(() => {
        result.current.toggleSelection('device-1')
      })
      expect(result.current.isSelected('device-1')).toBe(true)
      expect(result.current.selectedCount).toBe(1)

      act(() => {
        result.current.toggleSelection('device-2')
      })
      expect(result.current.isSelected('device-1')).toBe(true)
      expect(result.current.isSelected('device-2')).toBe(true)
      expect(result.current.selectedCount).toBe(2)

      act(() => {
        result.current.toggleSelection('device-1')
      })
      expect(result.current.isSelected('device-1')).toBe(false)
      expect(result.current.isSelected('device-2')).toBe(true)
      expect(result.current.selectedCount).toBe(1)
    })
  })

  describe('clearSelection', () => {
    it('should clear all selections', () => {
      const { result } = renderHook(() => useEditMode(), { wrapper })

      act(() => {
        result.current.enterAllDevicesEdit('device-1')
      })

      act(() => {
        result.current.toggleSelection('device-2')
      })
      expect(result.current.selectedCount).toBe(2)

      act(() => {
        result.current.clearSelection()
      })
      expect(result.current.selectedCount).toBe(0)
      expect(result.current.isSelected('device-1')).toBe(false)
      expect(result.current.isSelected('device-2')).toBe(false)
    })
  })

  describe('exitEditMode', () => {
    it('should return to normal mode and clear all state', () => {
      const { result } = renderHook(() => useEditMode(), { wrapper })

      act(() => {
        result.current.enterAllDevicesEdit('device-1')
      })

      act(() => {
        result.current.toggleSelection('device-2')
      })

      act(() => {
        result.current.exitEditMode()
      })

      expect(result.current.isEditMode).toBe(false)
      expect(result.current.isAllDevicesEditMode).toBe(false)
      expect(result.current.selectedCount).toBe(0)
      expect(result.current.selectedIds.size).toBe(0)
    })
  })

  describe('floor edit mode', () => {
    it('should enter floor edit mode', () => {
      const { result } = renderHook(() => useEditMode(), { wrapper })
      const floors = [createMockFloor({ floor_id: 'floor-1' })]

      act(() => {
        result.current.enterFloorEdit(floors, 'floor-1')
      })

      expect(result.current.isEditMode).toBe(true)
      expect(result.current.isFloorEditMode).toBe(true)
      expect(result.current.selectedFloorId).toBe('floor-1')
      expect(result.current.orderedFloors).toEqual(floors)
    })

    it('should reorder floors', () => {
      const { result } = renderHook(() => useEditMode(), { wrapper })
      const floors = [createMockFloor({ floor_id: 'floor-1' }), createMockFloor({ floor_id: 'floor-2' })]

      act(() => {
        result.current.enterFloorEdit(floors, 'floor-1')
      })

      const newOrder = [createMockFloor({ floor_id: 'floor-2' }), createMockFloor({ floor_id: 'floor-1' })]
      act(() => {
        result.current.reorderFloors(newOrder)
      })

      expect(result.current.orderedFloors).toEqual(newOrder)
    })
  })

  describe('room edit mode', () => {
    it('should reorder rooms', () => {
      const { result } = renderHook(() => useEditMode(), { wrapper })
      const rooms = [createMockRoom({ id: 'room-1' }), createMockRoom({ id: 'room-2' })]

      act(() => {
        result.current.enterRoomEdit(rooms)
      })

      const newOrder = [createMockRoom({ id: 'room-2' }), createMockRoom({ id: 'room-1' })]
      act(() => {
        result.current.reorderRooms(newOrder)
      })

      expect(result.current.orderedRooms).toEqual(newOrder)
    })
  })
})
