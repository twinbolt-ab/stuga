import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { haptic } from '@/lib/haptics'

export interface ToastProps {
  id: string
  message: string
  onDismiss: (id: string) => void
}

export function Toast({ id, message, onDismiss }: ToastProps) {
  // Haptic feedback when toast appears
  useEffect(() => {
    haptic.warning()
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--warning)]/30 rounded-xl px-4 py-3 shadow-warm-lg"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--warning)]/10 flex items-center justify-center">
        <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
      </div>
      <p className="flex-1 text-sm text-[var(--text-primary)]">{message}</p>
      <button
        onClick={() => {
          onDismiss(id)
        }}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-[var(--border)] transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-[var(--text-secondary)]" />
      </button>
    </motion.div>
  )
}

export interface ToastContainerProps {
  toasts: { id: string; message: string }[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast id={toast.id} message={toast.message} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
