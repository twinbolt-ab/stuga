import { useEffect, useState, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, useMotionValue, animate, PanInfo } from 'framer-motion'
import { X } from 'lucide-react'
import { t } from '@/lib/i18n'

const DRAG_CLOSE_THRESHOLD = 150

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** When true, modal auto-sizes to content instead of using fixed height */
  compact?: boolean
}

export function EditModal({ isOpen, onClose, title, children, compact = false }: EditModalProps) {
  const [mounted, setMounted] = useState(false)
  const y = useMotionValue(isOpen ? 0 : 1000)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Only render portal on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Animate modal in/out based on isOpen
  useEffect(() => {
    if (isOpen) {
      // Animate in
      animate(y, 0, { type: 'spring', damping: 30, stiffness: 400 })
      // Blur the button that opened the modal to prevent stuck focus/hover state
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    } else {
      // Animate out
      animate(y, 1000, { type: 'spring', damping: 30, stiffness: 400 })
    }
  }, [isOpen, y])

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Release any pointer capture to prevent blocking subsequent touches
    if (sheetRef.current && 'pointerId' in event) {
      try {
        sheetRef.current.releasePointerCapture((event as PointerEvent).pointerId)
      } catch {
        // Ignore if pointer capture wasn't held
      }
    }

    // Blur any focused element to reset touch state
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    if (info.offset.y > DRAG_CLOSE_THRESHOLD || info.velocity.y > 500) {
      onClose()
    } else {
      // Reset y if not closing
      animate(y, 0, { type: 'spring', damping: 30, stiffness: 400 })
    }
  }

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!mounted) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
        onClick={isOpen ? onClose : undefined}
      />

      {/* Bottom Sheet */}
      <motion.div
        ref={sheetRef}
        initial={false}
        drag={isOpen ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.1, bottom: 0.5 }}
        onDragEnd={handleDragEnd}
        style={{
          y,
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
        className={`fixed bottom-0 left-0 right-0 z-[100] bg-card rounded-t-2xl shadow-warm-lg flex flex-col touch-none ${
          compact ? 'max-h-[90vh]' : 'h-[90vh]'
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors touch-feedback"
            aria-label={t.settings.close}
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe">
          {children}
        </div>
      </motion.div>
    </>,
    document.body
  )
}
