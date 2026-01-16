import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, act, waitFor } from '@testing-library/react'
import { FloorEditModal } from '../FloorEditModal'
import {
  renderWithProviders,
  createMockFloor,
  createMockRoom,
} from '@/test/test-utils'
import {
  mockUpdateFloor,
  resetAllHAMocks,
} from '@/test/ha-mocks'

// Mock the ha-websocket module
vi.mock('@/lib/ha-websocket', () => ({
  updateFloor: (...args: unknown[]) => mockUpdateFloor(...args),
}))

describe('FloorEditModal', () => {
  const mockOnClose = vi.fn()
  const mockOnDeleted = vi.fn()
  const floors = [
    createMockFloor({ floor_id: 'ground', name: 'Ground Floor' }),
    createMockFloor({ floor_id: 'first', name: 'First Floor' }),
  ]
  const rooms = [
    createMockRoom({ id: 'living_room', areaId: 'living_room', name: 'Living Room', floorId: 'ground' }),
    createMockRoom({ id: 'bedroom', areaId: 'bedroom', name: 'Bedroom', floorId: 'first' }),
  ]

  beforeEach(() => {
    resetAllHAMocks()
    mockOnClose.mockClear()
    mockOnDeleted.mockClear()
  })

  it('should change floor name and save', async () => {
    const floor = createMockFloor({
      floor_id: 'ground',
      name: 'Ground Floor',
    })

    renderWithProviders(
      <FloorEditModal
        floor={floor}
        floors={floors}
        rooms={rooms}
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    )

    const nameInput = screen.getByPlaceholderText(/ground floor/i)
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Main Floor' } })
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(mockUpdateFloor).toHaveBeenCalledWith(
        'ground',
        expect.objectContaining({ name: 'Main Floor' })
      )
    })

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should cancel without saving', async () => {
    const floor = createMockFloor({
      floor_id: 'ground',
      name: 'Ground Floor',
    })

    renderWithProviders(
      <FloorEditModal
        floor={floor}
        floors={floors}
        rooms={rooms}
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await act(async () => {
      fireEvent.click(cancelButton)
    })

    expect(mockUpdateFloor).not.toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should show error toast on API failure', async () => {
    mockUpdateFloor.mockRejectedValueOnce(new Error('API Error'))

    const floor = createMockFloor({
      floor_id: 'ground',
      name: 'Ground Floor',
    })

    renderWithProviders(
      <FloorEditModal
        floor={floor}
        floors={floors}
        rooms={rooms}
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    )

    const nameInput = screen.getByPlaceholderText(/ground floor/i)
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
    const floor = createMockFloor({
      floor_id: 'ground',
      name: 'Ground Floor',
    })

    renderWithProviders(
      <FloorEditModal
        floor={floor}
        floors={floors}
        rooms={rooms}
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /delete/i })
    expect(deleteButton).toBeInTheDocument()
  })

  it('should not render when floor is null', () => {
    renderWithProviders(
      <FloorEditModal
        floor={null}
        floors={floors}
        rooms={rooms}
        onClose={mockOnClose}
        onDeleted={mockOnDeleted}
      />
    )

    // Modal is always mounted but hidden via pointer-events when closed
    const saveButton = screen.queryByRole('button', { name: /save/i })
    expect(saveButton).toBeInTheDocument()
    expect(saveButton?.closest('[style*="pointer-events"]')).toHaveStyle({ pointerEvents: 'none' })
  })
})
