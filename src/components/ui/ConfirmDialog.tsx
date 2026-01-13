import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { t } from '@/lib/i18n'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false)

  // Only render portal on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose, isLoading])

  if (!mounted) return null

  const isDestructive = variant === 'destructive'

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0, pointerEvents: 'none' as const }}
            animate={{ opacity: 1, pointerEvents: 'auto' as const }}
            exit={{ opacity: 0, pointerEvents: 'none' as const }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110]"
            onClick={() => !isLoading && onClose()}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%', pointerEvents: 'none' as const }}
            animate={{ y: 0, pointerEvents: 'auto' as const }}
            exit={{ y: '100%', pointerEvents: 'none' as const }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-[110] bg-card rounded-t-2xl shadow-warm-lg"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Content */}
            <div className="px-4 py-4 pb-safe">
              {/* Icon for destructive actions */}
              {isDestructive && (
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                </div>
              )}

              {/* Title */}
              <h2 className="text-lg font-semibold text-foreground text-center mb-2">
                {title}
              </h2>

              {/* Message */}
              <p className="text-sm text-muted text-center mb-6">
                {message}
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 rounded-xl bg-border/50 text-foreground font-medium hover:bg-border transition-colors disabled:opacity-50"
                >
                  {cancelLabel || t.common.cancel}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 ${
                    isDestructive
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-accent text-white hover:bg-accent/90'
                  }`}
                >
                  {isLoading ? t.common.loading : (confirmLabel || t.common.confirm)}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
