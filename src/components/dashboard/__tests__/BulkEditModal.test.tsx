import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, act, waitFor } from '@testing-library/react'
import { BulkEditDevicesModal, BulkEditRoomsModal } from '../BulkEditModal'
import {
  renderWithProviders,
  createMockLight,
  createMockSwitch,
  createMockRoom,
  createMockFloor,
} from '@/test/test-utils'
import {
  mockUpdateEntity,
  mockSetEntityHiddenInStuga,
  mockUpdateArea,
  mockCreateFloor,
  mockAddEntityToFavorites,
  mockRemoveEntityFromFavorites,
  resetAllHAMocks,
} from '@/test/ha-mocks'

// Mock the ha-websocket module
vi.mock('@/lib/ha-websocket', () => ({
  updateEntity: (...args: unknown[]) => mockUpdateEntity(...args),
  setEntityHiddenInStuga: (...args: unknown[]) => mockSetEntityHiddenInStuga(...args),
  updateArea: (...args: unknown[]) => mockUpdateArea(...args),
  createArea: vi.fn().mockResolvedValue('new-area-id'),
  createFloor: (...args: unknown[]) => mockCreateFloor(...args),
  addEntityToFavorites: (...args: unknown[]) => mockAddEntityToFavorites(...args),
  removeEntityFromFavorites: (...args: unknown[]) => mockRemoveEntityFromFavorites(...args),
}))

describe('BulkEditDevicesModal', () => {
  const mockOnClose = vi.fn()
  const mockOnComplete = vi.fn()
  const rooms = [
    createMockRoom({ id: 'living_room', areaId: 'living_room', name: 'Living Room' }),
    createMockRoom({ id: 'bedroom', areaId: 'bedroom', name: 'Bedroom' }),
  ]

  beforeEach(() => {
    resetAllHAMocks()
    mockOnClose.mockClear()
    mockOnComplete.mockClear()
  })

  // Helper to click the Hide all / Unhide all button in the hide/unhide button group
  async function clickHiddenButton(value: 'hide' | 'unhide') {
    const label = value === 'hide' ? /^hide all$/i : /^unhide all$/i
    const button = screen.getByRole('button', { name: label })
    await act(async () => {
      fireEvent.click(button)
    })
  }

  // Helper to select an option from a ComboBox
  async function selectComboBoxOption(label: string) {
    // Click the combobox button to open
    const buttons = screen.getAllByRole('button')
    const comboboxButton = buttons.find(
      (btn) =>
        btn.textContent?.includes('Select') ||
        btn.textContent?.includes('No change') ||
        btn.textContent?.includes('None')
    )
    if (comboboxButton) {
      await act(async () => {
        fireEvent.click(comboboxButton)
      })
      // Find and click the option
      const option = await screen.findByText(label)
      await act(async () => {
        fireEvent.click(option)
      })
    }
  }

  describe('Hide/Unhide Operations', () => {
    it('should bulk hide multiple lights', async () => {
      const lights = [
        createMockLight({
          entity_id: 'light.living_room',
          attributes: { friendly_name: 'Living Room' },
        }),
        createMockLight({ entity_id: 'light.bedroom', attributes: { friendly_name: 'Bedroom' } }),
      ]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={lights}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      await clickHiddenButton('hide')

      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledTimes(2)
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledWith('light.living_room', true, false)
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledWith('light.bedroom', true, false)
      })

      expect(mockOnComplete).toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should bulk unhide multiple lights', async () => {
      const lights = [
        createMockLight({ entity_id: 'light.living_room' }),
        createMockLight({ entity_id: 'light.bedroom' }),
      ]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={lights}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      await clickHiddenButton('unhide')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledTimes(2)
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledWith('light.living_room', false, false)
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledWith('light.bedroom', false, false)
      })
    })

    it('should bulk hide multiple switches', async () => {
      const switches = [
        createMockSwitch({ entity_id: 'switch.garage' }),
        createMockSwitch({ entity_id: 'switch.outdoor' }),
      ]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={switches}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      await clickHiddenButton('hide')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledTimes(2)
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledWith('switch.garage', true, false)
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledWith('switch.outdoor', true, false)
      })
    })

    it('should bulk unhide multiple switches', async () => {
      const switches = [
        createMockSwitch({ entity_id: 'switch.garage' }),
        createMockSwitch({ entity_id: 'switch.outdoor' }),
      ]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={switches}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      await clickHiddenButton('unhide')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledTimes(2)
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledWith('switch.garage', false, false)
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledWith('switch.outdoor', false, false)
      })
    })

    it('should bulk hide mixed lights and switches', async () => {
      const devices = [
        createMockLight({ entity_id: 'light.living_room' }),
        createMockSwitch({ entity_id: 'switch.garage' }),
      ]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={devices}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      await clickHiddenButton('hide')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledTimes(2)
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledWith('light.living_room', true, false)
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledWith('switch.garage', true, false)
      })
    })

    it('should bulk unhide mixed lights and switches', async () => {
      const devices = [
        createMockLight({ entity_id: 'light.living_room' }),
        createMockSwitch({ entity_id: 'switch.garage' }),
      ]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={devices}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      await clickHiddenButton('unhide')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledTimes(2)
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledWith('light.living_room', false, false)
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledWith('switch.garage', false, false)
      })
    })
  })

  describe('Icon Assignment', () => {
    it('should bulk change icons for multiple lights', async () => {
      const lights = [
        createMockLight({ entity_id: 'light.living_room' }),
        createMockLight({ entity_id: 'light.bedroom' }),
      ]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={lights}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      // Click the icon picker field to open it
      const iconButton = screen.getByRole('button', { name: /select an icon/i })
      await act(async () => {
        fireEvent.click(iconButton)
      })

      // Find and click an icon (e.g., lightbulb)
      // Note: The IconPicker might render in a portal, so we need to search the whole document
      const lightbulbIcon = await screen.findByTitle('Lightbulb')
      await act(async () => {
        fireEvent.click(lightbulbIcon)
      })

      // The icon picker should close and the preview should update
      // Now click save
      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockUpdateEntity).toHaveBeenCalledTimes(2)
        expect(mockUpdateEntity).toHaveBeenCalledWith(
          'light.living_room',
          expect.objectContaining({ icon: 'mdi:lightbulb' })
        )
        expect(mockUpdateEntity).toHaveBeenCalledWith(
          'light.bedroom',
          expect.objectContaining({ icon: 'mdi:lightbulb' })
        )
      })

      expect(mockOnComplete).toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Room Assignment', () => {
    it('should bulk move lights to different room', async () => {
      const lights = [
        createMockLight({ entity_id: 'light.living_room' }),
        createMockLight({ entity_id: 'light.hallway' }),
      ]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={lights}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      // Click the room combobox button to open dropdown
      const buttons = screen.getAllByRole('button')
      const roomButton = buttons.find((btn) => btn.textContent?.includes('No change'))
      expect(roomButton).toBeTruthy()

      await act(async () => {
        fireEvent.click(roomButton!)
      })

      // Find and click "Bedroom" option
      const bedroomOption = await screen.findByText('Bedroom')
      await act(async () => {
        fireEvent.click(bedroomOption)
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockUpdateEntity).toHaveBeenCalledTimes(2)
        expect(mockUpdateEntity).toHaveBeenCalledWith(
          'light.living_room',
          expect.objectContaining({ area_id: 'bedroom' })
        )
        expect(mockUpdateEntity).toHaveBeenCalledWith(
          'light.hallway',
          expect.objectContaining({ area_id: 'bedroom' })
        )
      })
    })

    it('should bulk move switches to different room', async () => {
      const switches = [
        createMockSwitch({ entity_id: 'switch.garage' }),
        createMockSwitch({ entity_id: 'switch.outdoor' }),
      ]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={switches}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      const buttons = screen.getAllByRole('button')
      const roomButton = buttons.find((btn) => btn.textContent?.includes('No change'))

      await act(async () => {
        fireEvent.click(roomButton!)
      })

      const livingRoomOption = await screen.findByText('Living Room')
      await act(async () => {
        fireEvent.click(livingRoomOption)
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockUpdateEntity).toHaveBeenCalledTimes(2)
        expect(mockUpdateEntity).toHaveBeenCalledWith(
          'switch.garage',
          expect.objectContaining({ area_id: 'living_room' })
        )
        expect(mockUpdateEntity).toHaveBeenCalledWith(
          'switch.outdoor',
          expect.objectContaining({ area_id: 'living_room' })
        )
      })
    })

    it('should bulk move mixed entities to room', async () => {
      const devices = [
        createMockLight({ entity_id: 'light.living_room' }),
        createMockSwitch({ entity_id: 'switch.garage' }),
      ]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={devices}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      const buttons = screen.getAllByRole('button')
      const roomButton = buttons.find((btn) => btn.textContent?.includes('No change'))

      await act(async () => {
        fireEvent.click(roomButton!)
      })

      const bedroomOption = await screen.findByText('Bedroom')
      await act(async () => {
        fireEvent.click(bedroomOption)
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockUpdateEntity).toHaveBeenCalledTimes(2)
        expect(mockUpdateEntity).toHaveBeenCalledWith(
          'light.living_room',
          expect.objectContaining({ area_id: 'bedroom' })
        )
        expect(mockUpdateEntity).toHaveBeenCalledWith(
          'switch.garage',
          expect.objectContaining({ area_id: 'bedroom' })
        )
      })
    })

    it('should bulk move entities to "No room"', async () => {
      const devices = [
        createMockLight({ entity_id: 'light.living_room' }),
        createMockSwitch({ entity_id: 'switch.garage' }),
      ]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={devices}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      const buttons = screen.getAllByRole('button')
      const roomButton = buttons.find((btn) => btn.textContent?.includes('No change'))

      await act(async () => {
        fireEvent.click(roomButton!)
      })

      const noneOption = await screen.findByText('None')
      await act(async () => {
        fireEvent.click(noneOption)
      })

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(mockUpdateEntity).toHaveBeenCalledTimes(2)
        expect(mockUpdateEntity).toHaveBeenCalledWith(
          'light.living_room',
          expect.objectContaining({ area_id: null })
        )
        expect(mockUpdateEntity).toHaveBeenCalledWith(
          'switch.garage',
          expect.objectContaining({ area_id: null })
        )
      })
    })
  })

  describe('Combined & Edge Cases', () => {
    it('should handle combined operations (hide + room change)', async () => {
      const devices = [
        createMockLight({ entity_id: 'light.living_room' }),
        createMockSwitch({ entity_id: 'switch.garage' }),
      ]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={devices}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      // Set room
      const buttons = screen.getAllByRole('button')
      const roomButton = buttons.find((btn) => btn.textContent?.includes('No change'))
      await act(async () => {
        fireEvent.click(roomButton!)
      })
      const bedroomOption = await screen.findByText('Bedroom')
      await act(async () => {
        fireEvent.click(bedroomOption)
      })

      // Set hidden via the button group
      await clickHiddenButton('hide')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        // Should call updateEntity for room
        expect(mockUpdateEntity).toHaveBeenCalledTimes(2)
        // Should call setEntityHiddenInStuga for hidden state
        expect(mockSetEntityHiddenInStuga).toHaveBeenCalledTimes(2)
      })

      expect(mockOnComplete).toHaveBeenCalled()
    })

    it('should cancel without saving (no API calls)', async () => {
      const devices = [createMockLight({ entity_id: 'light.living_room' })]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={devices}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      // Make some changes
      await clickHiddenButton('hide')

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      // No API calls should be made
      expect(mockUpdateEntity).not.toHaveBeenCalled()
      expect(mockSetEntityHiddenInStuga).not.toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
      expect(mockOnComplete).not.toHaveBeenCalled()
    })

    it('should show error toast on API failure', async () => {
      mockSetEntityHiddenInStuga.mockRejectedValueOnce(new Error('API Error'))

      const devices = [createMockLight({ entity_id: 'light.living_room' })]

      renderWithProviders(
        <BulkEditDevicesModal
          isOpen={true}
          devices={devices}
          rooms={rooms}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      )

      await clickHiddenButton('hide')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await act(async () => {
        fireEvent.click(saveButton)
      })

      // Error toast should appear
      await waitFor(() => {
        expect(screen.getByText(/failed/i)).toBeInTheDocument()
      })

      // Should not call onComplete on error
      expect(mockOnComplete).not.toHaveBeenCalled()
    })
  })
})

describe('BulkEditRoomsModal', () => {
  const mockOnClose = vi.fn()
  const mockOnComplete = vi.fn()
  const mockOnFloorCreated = vi.fn()
  const floors = [
    createMockFloor({ floor_id: 'ground', name: 'Ground Floor' }),
    createMockFloor({ floor_id: 'first', name: 'First Floor' }),
  ]

  beforeEach(() => {
    resetAllHAMocks()
    mockOnClose.mockClear()
    mockOnComplete.mockClear()
    mockOnFloorCreated.mockClear()
  })

  it('should bulk move rooms to floor', async () => {
    const roomsToEdit = [
      createMockRoom({ id: 'living_room', areaId: 'living_room', name: 'Living Room' }),
      createMockRoom({ id: 'kitchen', areaId: 'kitchen', name: 'Kitchen' }),
    ]

    renderWithProviders(
      <BulkEditRoomsModal
        isOpen={true}
        rooms={roomsToEdit}
        floors={floors}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        onFloorCreated={mockOnFloorCreated}
      />
    )

    // Click the floor combobox button
    const buttons = screen.getAllByRole('button')
    const floorButton = buttons.find((btn) => btn.textContent?.includes('No change'))
    expect(floorButton).toBeTruthy()

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
      expect(mockUpdateArea).toHaveBeenCalledTimes(2)
      expect(mockUpdateArea).toHaveBeenCalledWith('living_room', { floor_id: 'first' })
      expect(mockUpdateArea).toHaveBeenCalledWith('kitchen', { floor_id: 'first' })
    })

    expect(mockOnComplete).toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should bulk move rooms to "None" (no floor)', async () => {
    const roomsToEdit = [
      createMockRoom({
        id: 'living_room',
        areaId: 'living_room',
        name: 'Living Room',
        floorId: 'ground',
      }),
      createMockRoom({ id: 'kitchen', areaId: 'kitchen', name: 'Kitchen', floorId: 'ground' }),
    ]

    renderWithProviders(
      <BulkEditRoomsModal
        isOpen={true}
        rooms={roomsToEdit}
        floors={floors}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        onFloorCreated={mockOnFloorCreated}
      />
    )

    const buttons = screen.getAllByRole('button')
    const floorButton = buttons.find((btn) => btn.textContent?.includes('No change'))

    await act(async () => {
      fireEvent.click(floorButton!)
    })

    const noneOption = await screen.findByText('None')
    await act(async () => {
      fireEvent.click(noneOption)
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(mockUpdateArea).toHaveBeenCalledTimes(2)
      expect(mockUpdateArea).toHaveBeenCalledWith('living_room', { floor_id: null })
      expect(mockUpdateArea).toHaveBeenCalledWith('kitchen', { floor_id: null })
    })
  })

  it('should cancel without saving', async () => {
    const roomsToEdit = [
      createMockRoom({ id: 'living_room', areaId: 'living_room', name: 'Living Room' }),
    ]

    renderWithProviders(
      <BulkEditRoomsModal
        isOpen={true}
        rooms={roomsToEdit}
        floors={floors}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        onFloorCreated={mockOnFloorCreated}
      />
    )

    // Click cancel without making any changes
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await act(async () => {
      fireEvent.click(cancelButton)
    })

    expect(mockUpdateArea).not.toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalled()
    expect(mockOnComplete).not.toHaveBeenCalled()
  })

  it('should show error toast on API failure', async () => {
    mockUpdateArea.mockRejectedValueOnce(new Error('API Error'))

    const roomsToEdit = [
      createMockRoom({ id: 'living_room', areaId: 'living_room', name: 'Living Room' }),
    ]

    renderWithProviders(
      <BulkEditRoomsModal
        isOpen={true}
        rooms={roomsToEdit}
        floors={floors}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
        onFloorCreated={mockOnFloorCreated}
      />
    )

    const buttons = screen.getAllByRole('button')
    const floorButton = buttons.find((btn) => btn.textContent?.includes('No change'))

    await act(async () => {
      fireEvent.click(floorButton!)
    })

    const firstFloorOption = await screen.findByText('First Floor')
    await act(async () => {
      fireEvent.click(firstFloorOption)
    })

    const saveButton = screen.getByRole('button', { name: /save/i })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument()
    })

    expect(mockOnComplete).not.toHaveBeenCalled()
  })
})
