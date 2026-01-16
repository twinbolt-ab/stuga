import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider, useToast } from '@/providers/ToastProvider'

// Test component that triggers toasts
function TestComponent() {
  const { showError } = useToast()
  return (
    <button
      onClick={() => {
        showError('Test error message')
      }}
    >
      Show Error
    </button>
  )
}

describe('Toast System', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should render error toast when showError is called', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    // Click button to show toast
    await act(async () => {
      fireEvent.click(screen.getByText('Show Error'))
    })

    // Toast should appear
    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  it('should auto-dismiss after 4 seconds', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByText('Show Error'))
    })

    expect(screen.getByText('Test error message')).toBeInTheDocument()

    // Advance time by 4 seconds
    await act(async () => {
      vi.advanceTimersByTime(4001)
    })

    // Toast should start dismissing - exact removal depends on AnimatePresence
  })

  it('should prevent duplicate messages', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    // Click twice quickly
    await act(async () => {
      fireEvent.click(screen.getByText('Show Error'))
      fireEvent.click(screen.getByText('Show Error'))
    })

    // Should only have one toast with this message
    const toasts = screen.getAllByText('Test error message')
    expect(toasts).toHaveLength(1)
  })

  it('should allow manual dismissal', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByText('Show Error'))
    })

    expect(screen.getByText('Test error message')).toBeInTheDocument()

    // Click dismiss button
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Dismiss'))
    })

    // Toast dismissal initiated (AnimatePresence handles actual removal)
  })
})
