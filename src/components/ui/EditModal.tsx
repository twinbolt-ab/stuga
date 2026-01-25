import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, useMotionValue, animate, useDragControls, PanInfo } from 'framer-motion'
import { X } from 'lucide-react'
import { t } from '@/lib/i18n'
import { haptic } from '@/lib/haptics'
import { useIsClient } from '@/lib/hooks/useIsClient'

const DRAG_CLOSE_THRESHOLD = 150

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function EditModal({ isOpen, onClose, title, children }: EditModalProps) {
  const isClient = useIsClient()
  const y = useMotionValue(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()

  // Reset y when opening
  useEffect(() => {
    if (isOpen) {
      y.set(0)
      haptic.light()
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
  }, [isOpen, y])

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    if (info.offset.y > DRAG_CLOSE_THRESHOLD || info.velocity.y > 500) {
      onClose()
    } else {
      animate(y, 0, { type: 'spring', damping: 30, stiffness: 400 })
    }
  }

  const startDrag = (event: React.PointerEvent) => {
    dragControls.start(event, { snapToCursor: false })
  }

  // Track if we're currently dragging from content
  const isDraggingFromContent = useRef(false)

  // Handle content area drag - only allow when scrolled to top
  const handleContentPointerDown = (event: React.PointerEvent) => {
    const content = contentRef.current
    if (content && content.scrollTop <= 0) {
      // At top of scroll, allow drag to close
      // We need to prevent default to stop native scroll from fighting with drag
      isDraggingFromContent.current = true
      dragControls.start(event, { snapToCursor: false })
    }
    // Otherwise, let native scroll handle it
  }

  // Prevent touchmove when dragging from content to stop scroll interference
  useEffect(() => {
    const content = contentRef.current
    if (!content || !isOpen) return

    const handleTouchMove = (e: TouchEvent) => {
      if (isDraggingFromContent.current && content.scrollTop <= 0) {
        e.preventDefault()
      }
    }

    const handleTouchEnd = () => {
      isDraggingFromContent.current = false
    }

    content.addEventListener('touchmove', handleTouchMove, { passive: false })
    content.addEventListener('touchend', handleTouchEnd)
    content.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      content.removeEventListener('touchmove', handleTouchMove)
      content.removeEventListener('touchend', handleTouchEnd)
      content.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [isOpen])

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

  if (!isClient) return null

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
        initial={{ y: '100%' }}
        animate={{ y: isOpen ? 0 : '100%' }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        drag={isOpen ? 'y' : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.1, bottom: 0.6 }}
        onDragEnd={handleDragEnd}
        style={{
          y,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        className="fixed bottom-0 left-0 right-0 z-[100] bg-card rounded-t-2xl shadow-warm-lg flex flex-col max-h-[90vh]"
      >
        {/* Handle bar - always draggable */}
        <div
          onPointerDown={startDrag}
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
        >
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header - always draggable */}
        <div
          onPointerDown={startDrag}
          className="flex items-center justify-between px-4 pb-4 border-b border-border cursor-grab active:cursor-grabbing touch-none"
        >
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors touch-feedback"
            aria-label={t.settings.close}
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Content - scrollable, draggable when at top */}
        <div
          ref={contentRef}
          onPointerDown={handleContentPointerDown}
          className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-safe"
        >
          {children}
        </div>
      </motion.div>
    </>,
    document.body
  )
}
