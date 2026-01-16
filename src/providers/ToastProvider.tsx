import { createContext, useContext, useCallback, useState, useRef } from 'react'
import { ToastContainer } from '@/components/ui/Toast'

interface ToastContextValue {
  showError: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

interface ToastItem {
  id: string
  message: string
}

const TOAST_DURATION = 4000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const toastIdRef = useRef(0)

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showError = useCallback(
    (message: string) => {
      // Prevent duplicate messages
      setToasts((prev) => {
        if (prev.some((t) => t.message === message)) {
          return prev
        }

        const id = `toast-${++toastIdRef.current}`

        // Auto-dismiss after duration
        setTimeout(() => {
          dismissToast(id)
        }, TOAST_DURATION)

        return [...prev, { id, message }]
      })
    },
    [dismissToast]
  )

  return (
    <ToastContext.Provider value={{ showError }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
