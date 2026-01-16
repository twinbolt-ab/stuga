import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, act, waitFor } from '@testing-library/react'
import { RoomEditModal } from '../RoomEditModal'
import {
  renderWithProviders,
  createMockRoom,
  createMockFloor,
} from '@/test/test-utils'
import {
  mockUpdateArea,
  mockCreateFloor,
  mockSetAreaTemperatureSensor,
  mockGetAreaTemperatureSensor,
  resetAllHAMocks,
} from '@/test/ha-mocks'

// Mock the ha-websocket module
vi.mock('@/lib/ha-websocket', () => ({
  updateArea: (...args: unknown[]) => mockUpdateArea(...args),
  createFloor: (...args: unknown[]) => mockCreateFloor(...args),
}))

// Mock the metadata module
vi.mock('@/lib/metadata', () => ({
  setAreaTemperatureSensor: (...args: unknown[]) => mockSetAreaTemperatureSensor(...args),
  getAreaTemperatureSensor: (areaId: string) => mockGetAreaTemperatureSensor(areaId),
}))

describe('RoomEditModal', () => {
  const mockOnClose = vi.fn()
  const mockOnFloorCreated = vi.fn()
  const floors = [
    createMockFloor({ floor_id: 'ground', name: 'Ground Floor' }),
    createMockFloor({ floor_id: 'first', name: 'First Floor' }),
  ]
  const allRooms = [
    createMockRoom({ id: 'living_room', areaId: 'living_room', name: 'Living Room' }),
    createMockRoom({ id: 'bedroom', areaId: 'bedroom', name: 'Bedroom' }),
  ]

  beforeEach(() => {
    resetAllHAMocks()
    mockOnClose.mockClear()
    mockOnFloorCreated.mockClear()
  })

  it('should change room name and save', async () => {
    const room = createMockRoom({
      id: 'living_room',
      areaId: 'living_room',
      name: 'Living Room',
    })

    renderWithProviders(
      <RoomEditModal
        room={room}
        allRooms={allRooms}
        floors={floors}
        onClose={mockOnClose}
        onFloorCreated={mockOnFloorCreated}
      />
    )

    const nameInput = screen.getByPlaceholderText(/living room/i)
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Main Living Area' } })
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(mockUpdateArea).toHaveBeenCalledWith(
        'living_room',
        expect.objectContaining({ name: 'Main Living Area' })
      )
    })

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should change room floor assignment', async () => {
    const room = createMockRoom({
      id: 'living_room',
      areaId: 'living_room',
      name: 'Living Room',
      floorId: undefined,
    })

    renderWithProviders(
      <RoomEditModal
        room={room}
        allRooms={allRooms}
        floors={floors}
        onClose={mockOnClose}
        onFloorCreated={mockOnFloorCreated}
      />
    )

    // Click the floor combobox button to open dropdown
    const buttons = screen.getAllByRole('button')
    const floorButton = buttons.find(btn => btn.textContent?.includes('None'))

    await act(async () => {
      fireEvent.click(floorButton!)
    })

    // Select "First Floor"
    const firstFloorOption = await screen.findByText('First Floor')
    await act(async () => {
      fireEvent.click(firstFloorOption)
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(mockUpdateArea).toHaveBeenCalledWith(
        'living_room',
        expect.objectContaining({ floor_id: 'first' })
      )
    })
  })

  it('should cancel without saving', async () => {
    const room = createMockRoom({
      id: 'living_room',
      areaId: 'living_room',
      name: 'Living Room',
    })

    renderWithProviders(
      <RoomEditModal
        room={room}
        allRooms={allRooms}
        floors={floors}
        onClose={mockOnClose}
        onFloorCreated={mockOnFloorCreated}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await act(async () => {
      fireEvent.click(cancelButton)
    })

    expect(mockUpdateArea).not.toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should show error toast on API failure', async () => {
    mockUpdateArea.mockRejectedValueOnce(new Error('API Error'))

    const room = createMockRoom({
      id: 'living_room',
      areaId: 'living_room',
      name: 'Living Room',
    })

    renderWithProviders(
      <RoomEditModal
        room={room}
        allRooms={allRooms}
        floors={floors}
        onClose={mockOnClose}
        onFloorCreated={mockOnFloorCreated}
      />
    )

    const nameInput = screen.getByPlaceholderText(/living room/i)
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'New Name' } })
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument()
    })

    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('should show delete button', async () => {
    const room = createMockRoom({
      id: 'living_room',
      areaId: 'living_room',
      name: 'Living Room',
    })

    renderWithProviders(
      <RoomEditModal
        room={room}
        allRooms={allRooms}
        floors={floors}
        onClose={mockOnClose}
        onFloorCreated={mockOnFloorCreated}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /delete/i })
    expect(deleteButton).toBeInTheDocument()
  })

  it('should not render when room is null', () => {
    renderWithProviders(
      <RoomEditModal
        room={null}
        allRooms={allRooms}
        floors={floors}
        onClose={mockOnClose}
        onFloorCreated={mockOnFloorCreated}
      />
    )

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })
})
