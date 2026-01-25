import { useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useDragControls, PanInfo } from 'framer-motion'
import { X, Hand, Move, CloudUpload, CheckSquare } from 'lucide-react'
import { t } from '@/lib/i18n'

interface EditModeInfoModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function EditModeInfoModal({ isOpen, onClose, onConfirm }: EditModeInfoModalProps) {
  const y = useMotionValue(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()

  // Reset y motion value when modal opens
  useEffect(() => {
    if (isOpen) {
      y.set(0)
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
  }, [isOpen, y])

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    } else {
      y.set(0)
    }
  }

  const startDrag = (event: React.PointerEvent) => {
    dragControls.start(event)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0, pointerEvents: 'none' as const }}
            animate={{ opacity: 1, pointerEvents: 'auto' as const }}
            exit={{ opacity: 0, pointerEvents: 'none' as const }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%', pointerEvents: 'none' as const }}
            animate={{ y: 0, pointerEvents: 'auto' as const }}
            exit={{ y: '100%', pointerEvents: 'none' as const }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.8 }}
            onDragEnd={handleDragEnd}
            style={{ y }}
            className="fixed bottom-0 left-0 right-0 z-[70] bg-card rounded-t-2xl shadow-warm-lg"
          >
            {/* Handle bar - drag area */}
            <div
              onPointerDown={startDrag}
              className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
            >
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Header - also draggable */}
            <div
              onPointerDown={startDrag}
              className="flex items-center justify-between px-4 pb-4 cursor-grab active:cursor-grabbing touch-none"
            >
              <h2 className="text-lg font-semibold text-foreground">{t.editMode.infoTitle}</h2>
              <button
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="px-4 pb-safe">
              {/* Info items */}
              <div className="space-y-4">
                {/* Hold to edit */}
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-accent/10">
                    <Hand className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-foreground">{t.editMode.infoHoldToEdit}</p>
                  </div>
                </div>

                {/* Hold to move */}
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-accent/10">
                    <Move className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-foreground">{t.editMode.infoHoldToMove}</p>
                  </div>
                </div>

                {/* Select multiple */}
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-accent/10">
                    <CheckSquare className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-foreground">{t.editMode.infoSelectMultiple}</p>
                  </div>
                </div>

                {/* Saves directly */}
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-success/10">
                    <CloudUpload className="w-5 h-5 text-success" />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-foreground">{t.editMode.infoSavesDirectly}</p>
                  </div>
                </div>
              </div>

              {/* Confirm button */}
              <button
                onClick={onConfirm}
                className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
              >
                {t.editMode.gotIt}
              </button>

              <div className="h-4" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
