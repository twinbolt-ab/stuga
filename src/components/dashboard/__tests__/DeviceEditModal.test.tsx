import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, act, waitFor } from '@testing-library/react'
import { DeviceEditModal } from '../DeviceEditModal'
import {
  renderWithProviders,
  createMockLight,
  createMockSwitch,
  createMockScene,
  createMockRoom,
} from '@/test/test-utils'
import {
  mockUpdateEntity,
  mockSetEntityHidden,
  mockDeleteScene,
  mockGetEntityRegistry,
  mockIsEntityHidden,
  mockIsEntityHiddenInStuga,
  resetAllHAMocks,
} from '@/test/ha-mocks'

// Mock the ha-websocket module
vi.mock('@/lib/ha-websocket', () => ({
  updateEntity: (...args: unknown[]) => mockUpdateEntity(...args),
  setEntityHidden: (...args: unknown[]) => mockSetEntityHidden(...args),
  setEntityHiddenInStuga: vi.fn().mockResolvedValue(undefined),
  deleteScene: (...args: unknown[]) => mockDeleteScene(...args),
  getEntityRegistry: () => mockGetEntityRegistry(),
  isEntityHidden: (id: string) => mockIsEntityHidden(id),
  isEntityHiddenInStuga: (id: string) => mockIsEntityHiddenInStuga(id),
  createArea: vi.fn().mockResolvedValue('new-area-id'),
}))

describe('DeviceEditModal', () => {
  const mockOnClose = vi.fn()
  const rooms = [
    createMockRoom({ id: 'living_room', areaId: 'living_room', name: 'Living Room' }),
    createMockRoom({ id: 'bedroom', areaId: 'bedroom', name: 'Bedroom' }),
  ]

  beforeEach(() => {
    resetAllHAMocks()
    mockOnClose.mockClear()
  })

  describe('Light Entity Tests', () => {
    it('should change light name and save', async () => {
      const light = createMockLight({
        entity_id: 'light.living_room',
        attributes: { friendly_name: 'Living Room Light' },
      })

      renderWithProviders(<DeviceEditModal device={light} rooms={rooms} onClose={mockOnClose} />)

      // Find name input by placeholder
      const nameInput = screen.getByPlaceholderText(/living room light/i)
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Main Light' } })
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockUpdateEntity).toHaveBeenCalledWith(
          'light.living_room',
          expect.objectContaining({ name: 'Main Light' })
        )
      })

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should hide light via toggle', async () => {
      const light = createMockLight({ entity_id: 'light.living_room' })
      mockIsEntityHidden.mockReturnValue(false)

      renderWithProviders(<DeviceEditModal device={light} rooms={rooms} onClose={mockOnClose} />)

      // Find hidden toggle (uses role="switch")
      const hiddenToggle = screen.getByRole('switch')
      await act(async () => {
        fireEvent.click(hiddenToggle)
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockSetEntityHidden).toHaveBeenCalledWith('light.living_room', true)
      })
    })

    it('should unhide light via toggle', async () => {
      const light = createMockLight({ entity_id: 'light.living_room' })
      mockIsEntityHidden.mockReturnValue(true)

      renderWithProviders(<DeviceEditModal device={light} rooms={rooms} onClose={mockOnClose} />)

      const hiddenToggle = screen.getByRole('switch')
      expect(hiddenToggle).toHaveAttribute('aria-checked', 'true')

      await act(async () => {
        fireEvent.click(hiddenToggle)
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockSetEntityHidden).toHaveBeenCalledWith('light.living_room', false)
      })
    })

    it('should cancel without saving', async () => {
      const light = createMockLight({ entity_id: 'light.living_room' })

      renderWithProviders(<DeviceEditModal device={light} rooms={rooms} onClose={mockOnClose} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      expect(mockUpdateEntity).not.toHaveBeenCalled()
      expect(mockSetEntityHidden).not.toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should show error toast on API failure', async () => {
      mockUpdateEntity.mockRejectedValueOnce(new Error('API Error'))

      const light = createMockLight({
        entity_id: 'light.living_room',
        attributes: { friendly_name: 'Living Room Light' },
      })

      renderWithProviders(<DeviceEditModal device={light} rooms={rooms} onClose={mockOnClose} />)

      // Change name to trigger save
      const nameInput = screen.getByPlaceholderText(/living room light/i)
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
  })

  describe('Switch Entity Tests', () => {
    it('should change switch name and save', async () => {
      const switchEntity = createMockSwitch({
        entity_id: 'switch.garage',
        attributes: { friendly_name: 'Garage Switch' },
      })

      renderWithProviders(
        <DeviceEditModal device={switchEntity} rooms={rooms} onClose={mockOnClose} />
      )

      const nameInput = screen.getByPlaceholderText(/garage switch/i)
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Garage Door' } })
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockUpdateEntity).toHaveBeenCalledWith(
          'switch.garage',
          expect.objectContaining({ name: 'Garage Door' })
        )
      })
    })

    it('should hide switch via toggle', async () => {
      const switchEntity = createMockSwitch({ entity_id: 'switch.garage' })
      mockIsEntityHidden.mockReturnValue(false)

      renderWithProviders(
        <DeviceEditModal device={switchEntity} rooms={rooms} onClose={mockOnClose} />
      )

      const hiddenToggle = screen.getByRole('switch')
      await act(async () => {
        fireEvent.click(hiddenToggle)
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockSetEntityHidden).toHaveBeenCalledWith('switch.garage', true)
      })
    })

    it('should cancel without saving', async () => {
      const switchEntity = createMockSwitch({ entity_id: 'switch.garage' })

      renderWithProviders(
        <DeviceEditModal device={switchEntity} rooms={rooms} onClose={mockOnClose} />
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      expect(mockUpdateEntity).not.toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Scene Tests', () => {
    it('should show delete button for scenes', async () => {
      const scene = createMockScene({
        entity_id: 'scene.movie_time',
        attributes: { friendly_name: 'Movie Time' },
      })

      renderWithProviders(<DeviceEditModal device={scene} rooms={rooms} onClose={mockOnClose} />)

      // Delete button should exist for scenes
      const deleteButton = screen.getByRole('button', { name: /delete/i })
      expect(deleteButton).toBeInTheDocument()
    })

    it('should delete scene after confirmation', async () => {
      const scene = createMockScene({
        entity_id: 'scene.movie_time',
        attributes: { friendly_name: 'Movie Time' },
      })

      renderWithProviders(<DeviceEditModal device={scene} rooms={rooms} onClose={mockOnClose} />)

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      // Confirmation dialog should appear - wait for the confirmation message
      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument()
      })

      // Find both "Delete Scene" buttons - the confirm button is the last one (in the dialog)
      const deleteButtons = screen.getAllByRole('button', { name: /delete scene/i })
      const confirmButton = deleteButtons[deleteButtons.length - 1]
      await act(async () => {
        fireEvent.click(confirmButton)
      })

      await waitFor(() => {
        expect(mockDeleteScene).toHaveBeenCalledWith('scene.movie_time')
      })
    })

    it('should show error toast on scene deletion failure', async () => {
      mockDeleteScene.mockRejectedValueOnce(new Error('Delete failed'))

      const scene = createMockScene({
        entity_id: 'scene.movie_time',
        attributes: { friendly_name: 'Movie Time' },
      })

      renderWithProviders(<DeviceEditModal device={scene} rooms={rooms} onClose={mockOnClose} />)

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      // Confirmation dialog should appear - wait for the confirmation message
      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument()
      })

      // Find both "Delete Scene" buttons - the confirm button is the last one (in the dialog)
      const deleteButtons = screen.getAllByRole('button', { name: /delete scene/i })
      const confirmButton = deleteButtons[deleteButtons.length - 1]
      await act(async () => {
        fireEvent.click(confirmButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/failed/i)).toBeInTheDocument()
      })
    })
  })

  describe('Modal Behavior', () => {
    it('should be hidden when device is null', () => {
      renderWithProviders(<DeviceEditModal device={null} rooms={rooms} onClose={mockOnClose} />)

      // Modal is always mounted but hidden via pointer-events when closed
      const saveButton = screen.queryByRole('button', { name: /save/i })
      expect(saveButton).toBeInTheDocument()
      expect(saveButton?.closest('[style*="pointer-events"]')).toHaveStyle({
        pointerEvents: 'none',
      })
    })
  })
})
