import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React, { useEffect } from 'react'
import { EditModeProvider, useEditMode } from '@/lib/contexts/EditModeContext'
import { ToastProvider } from '@/providers/ToastProvider'
import { DeviceToggleButton } from '@/components/ui/DeviceToggleButton'
import type { HAEntity } from '@/types/ha'

/**
 * These tests verify the selection interaction flow in AllDevicesView.
 *
 * Key behaviors tested:
 * 1. Entering edit mode with initial selection (simulates long-press)
 * 2. Clicking devices in edit mode toggles their selection
 * 3. Multiple devices can be selected
 * 4. Selection state is correctly reflected in UI
 */

function createMockDevice(id: string, name: string, state = 'off'): HAEntity {
  return {
    entity_id: id,
    state,
    attributes: { friendly_name: name },
    last_changed: '2024-01-01T00:00:00Z',
    last_updated: '2024-01-01T00:00:00Z',
  }
}

// Test harness that mimics AllDevicesView's selection behavior
function DeviceSelectionTestHarness({
  devices,
  initialSelection,
  autoEnterEditMode = false,
}: {
  devices: HAEntity[]
  initialSelection?: string
  autoEnterEditMode?: boolean
}) {
  const {
    isAllDevicesEditMode,
    isSelected,
    toggleSelection,
    enterAllDevicesEdit,
    exitEditMode,
    selectedCount,
    selectedIds,
  } = useEditMode()

  // Simulate long-press entering edit mode with selection
  useEffect(() => {
    if (autoEnterEditMode && initialSelection) {
      enterAllDevicesEdit(initialSelection)
    } else if (autoEnterEditMode) {
      enterAllDevicesEdit()
    }
  }, [autoEnterEditMode, initialSelection, enterAllDevicesEdit])

  return (
    <div>
      <div data-testid="mode">{isAllDevicesEditMode ? 'edit' : 'normal'}</div>
      <div data-testid="count">{selectedCount}</div>
      <div data-testid="selected-ids">{Array.from(selectedIds).join(',')}</div>

      {isAllDevicesEditMode && (
        <button data-testid="done-button" onClick={exitEditMode}>
          Done
        </button>
      )}

      <div data-testid="device-list">
        {devices.map((device) => (
          <DeviceToggleButton
            key={device.entity_id}
            entity={device}
            isInEditMode={isAllDevicesEditMode}
            isSelected={isSelected(device.entity_id)}
            onToggle={() => {}}
            onToggleSelection={() => {
              toggleSelection(device.entity_id)
            }}
            onEnterEditModeWithSelection={() => {
              enterAllDevicesEdit(device.entity_id)
            }}
            fallbackIcon={<span>icon</span>}
          />
        ))}
      </div>
    </div>
  )
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <EditModeProvider>{children}</EditModeProvider>
    </ToastProvider>
  )
}

describe('Device Selection Flow', () => {
  const devices = [
    createMockDevice('switch.garage', 'Garage Switch', 'off'),
    createMockDevice('switch.kitchen', 'Kitchen Switch', 'on'),
    createMockDevice('light.bedroom', 'Bedroom Light', 'off'),
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should start in normal mode with no selection', () => {
      render(
        <TestWrapper>
          <DeviceSelectionTestHarness devices={devices} />
        </TestWrapper>
      )

      expect(screen.getByTestId('mode')).toHaveTextContent('normal')
      expect(screen.getByTestId('count')).toHaveTextContent('0')
    })
  })

  describe('entering edit mode with initial selection (long-press simulation)', () => {
    it('should enter edit mode and select the long-pressed device', async () => {
      render(
        <TestWrapper>
          <DeviceSelectionTestHarness
            devices={devices}
            initialSelection="switch.garage"
            autoEnterEditMode
          />
        </TestWrapper>
      )

      // Should be in edit mode with 1 device selected
      expect(screen.getByTestId('mode')).toHaveTextContent('edit')
      expect(screen.getByTestId('count')).toHaveTextContent('1')
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('switch.garage')
    })

    it('should enter edit mode without selection when no initial selection', async () => {
      render(
        <TestWrapper>
          <DeviceSelectionTestHarness devices={devices} autoEnterEditMode />
        </TestWrapper>
      )

      expect(screen.getByTestId('mode')).toHaveTextContent('edit')
      expect(screen.getByTestId('count')).toHaveTextContent('0')
    })
  })

  describe('clicking devices in edit mode', () => {
    it('should add device to selection when clicking unselected device', async () => {
      render(
        <TestWrapper>
          <DeviceSelectionTestHarness
            devices={devices}
            initialSelection="switch.garage"
            autoEnterEditMode
          />
        </TestWrapper>
      )

      // Initial: garage is selected
      expect(screen.getByTestId('count')).toHaveTextContent('1')

      // Click kitchen switch to add to selection
      const kitchenButton = screen.getByText('Kitchen Switch').closest('button')
      await act(async () => {
        fireEvent.click(kitchenButton!)
      })

      // Should now have 2 selected
      expect(screen.getByTestId('count')).toHaveTextContent('2')
      const selectedIds = screen.getByTestId('selected-ids').textContent
      expect(selectedIds).toContain('switch.garage')
      expect(selectedIds).toContain('switch.kitchen')
    })

    it('should exit edit mode when last device is deselected', async () => {
      render(
        <TestWrapper>
          <DeviceSelectionTestHarness
            devices={devices}
            initialSelection="switch.garage"
            autoEnterEditMode
          />
        </TestWrapper>
      )

      // Initial: garage is selected, in edit mode
      expect(screen.getByTestId('mode')).toHaveTextContent('edit')
      expect(screen.getByTestId('count')).toHaveTextContent('1')

      // Click garage switch to deselect (last item)
      const garageButton = screen.getByText('Garage Switch').closest('button')
      await act(async () => {
        fireEvent.click(garageButton!)
      })

      // Should exit edit mode when selection becomes empty
      expect(screen.getByTestId('mode')).toHaveTextContent('normal')
      expect(screen.getByTestId('count')).toHaveTextContent('0')
    })

    it('should allow selecting all devices', async () => {
      render(
        <TestWrapper>
          <DeviceSelectionTestHarness
            devices={devices}
            initialSelection="switch.garage"
            autoEnterEditMode
          />
        </TestWrapper>
      )

      // Click remaining devices
      const kitchenButton = screen.getByText('Kitchen Switch').closest('button')
      const bedroomButton = screen.getByText('Bedroom Light').closest('button')

      await act(async () => {
        fireEvent.click(kitchenButton!)
      })
      await act(async () => {
        fireEvent.click(bedroomButton!)
      })

      expect(screen.getByTestId('count')).toHaveTextContent('3')
    })

    it('should stay in edit mode when clicking devices (not exit)', async () => {
      render(
        <TestWrapper>
          <DeviceSelectionTestHarness
            devices={devices}
            initialSelection="switch.garage"
            autoEnterEditMode
          />
        </TestWrapper>
      )

      // Click multiple devices
      const kitchenButton = screen.getByText('Kitchen Switch').closest('button')
      await act(async () => {
        fireEvent.click(kitchenButton!)
      })

      // Should still be in edit mode
      expect(screen.getByTestId('mode')).toHaveTextContent('edit')

      // Click again
      await act(async () => {
        fireEvent.click(kitchenButton!)
      })

      // Should still be in edit mode
      expect(screen.getByTestId('mode')).toHaveTextContent('edit')
    })
  })

  describe('exiting edit mode', () => {
    it('should exit edit mode and clear selection when clicking Done', async () => {
      render(
        <TestWrapper>
          <DeviceSelectionTestHarness
            devices={devices}
            initialSelection="switch.garage"
            autoEnterEditMode
          />
        </TestWrapper>
      )

      // Add another selection
      const kitchenButton = screen.getByText('Kitchen Switch').closest('button')
      await act(async () => {
        fireEvent.click(kitchenButton!)
      })
      expect(screen.getByTestId('count')).toHaveTextContent('2')

      // Click Done
      const doneButton = screen.getByTestId('done-button')
      await act(async () => {
        fireEvent.click(doneButton)
      })

      // Should be back in normal mode with no selection
      expect(screen.getByTestId('mode')).toHaveTextContent('normal')
      expect(screen.getByTestId('count')).toHaveTextContent('0')
    })
  })
})

describe('DeviceToggleButton in edit mode', () => {
  const device = createMockDevice('switch.test', 'Test Switch', 'on')

  it('should render with checkbox when in edit mode', () => {
    const toggleSelection = vi.fn()

    render(
      <ToastProvider>
        <DeviceToggleButton
          entity={device}
          isInEditMode={true}
          isSelected={false}
          onToggle={() => {}}
          onToggleSelection={toggleSelection}
          onEnterEditModeWithSelection={() => {}}
          fallbackIcon={<span>icon</span>}
        />
      </ToastProvider>
    )

    // Should be a button (clickable for selection)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()

    // Click should trigger selection toggle
    fireEvent.click(button)
    expect(toggleSelection).toHaveBeenCalled()
  })

  it('should show selected state correctly', () => {
    render(
      <ToastProvider>
        <DeviceToggleButton
          entity={device}
          isInEditMode={true}
          isSelected={true}
          onToggle={() => {}}
          onToggleSelection={() => {}}
          onEnterEditModeWithSelection={() => {}}
          fallbackIcon={<span>icon</span>}
        />
      </ToastProvider>
    )

    // The checkbox inside should show selected state (has Check icon)
    const checkIcon = document.querySelector('.lucide-check')
    expect(checkIcon).toBeInTheDocument()
  })

  it('should not show check icon when not selected', () => {
    render(
      <ToastProvider>
        <DeviceToggleButton
          entity={device}
          isInEditMode={true}
          isSelected={false}
          onToggle={() => {}}
          onToggleSelection={() => {}}
          onEnterEditModeWithSelection={() => {}}
          fallbackIcon={<span>icon</span>}
        />
      </ToastProvider>
    )

    // No check icon when not selected
    const checkIcon = document.querySelector('.lucide-check')
    expect(checkIcon).not.toBeInTheDocument()
  })
})
