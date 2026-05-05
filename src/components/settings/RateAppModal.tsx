import { useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useDragControls, PanInfo } from 'framer-motion'
import { X, Star } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { t } from '@/lib/i18n'
import { openExternalUrl } from '@/lib/browser'
import { getStorage } from '@/lib/storage'
import { STORAGE_KEYS } from '@/lib/constants'
import { logRateAppAction } from '@/lib/analytics'

interface RateAppModalProps {
  isOpen: boolean
  onClose: () => void
  onDismissed: () => void
}

const APP_STORE_URL =
  'https://apps.apple.com/app/stuga-for-home-assistant/id6758661035?action=write-review'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.twinbolt.stuga&reviewId=0'

export function RateAppModal({ isOpen, onClose, onDismissed }: RateAppModalProps) {
  const y = useMotionValue(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()

  useEffect(() => {
    if (isOpen) {
      y.set(0)
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      void logRateAppAction('shown')
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

  const handleRate = async () => {
    void logRateAppAction('rated')

    // Open appropriate store based on platform
    const platform = Capacitor.getPlatform()
    const url = platform === 'ios' ? APP_STORE_URL : PLAY_STORE_URL

    await openExternalUrl(url)
    onClose()
  }

  const handleLater = () => {
    void logRateAppAction('dismissed')
    onClose()
  }

  const handleDismiss = async () => {
    void logRateAppAction('dismissed')

    // Mark as permanently dismissed
    try {
      const storage = getStorage()
      await storage.setItem(STORAGE_KEYS.RATE_APP_DISMISSED, 'true')
    } catch {
      // Ignore storage errors
    }

    onDismissed()
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
            onClick={handleLater}
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
              <h2 className="text-lg font-semibold text-foreground">
                {t.rateApp?.prompt || 'Enjoying Stuga?'}
              </h2>
              <button
                onClick={handleLater}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="px-4 pb-safe">
              {/* Star icon */}
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-2xl bg-accent/10">
                  <Star className="w-10 h-10 text-accent" fill="currentColor" />
                </div>
              </div>

              {/* Description */}
              <p className="text-center text-muted mb-6">
                {t.rateApp?.promptDescription ||
                  'If you have a moment, a review on the app store would help others discover Stuga.'}
              </p>

              {/* Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleRate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
                >
                  {t.rateApp?.rate || 'Rate Stuga'}
                </button>

                <button
                  onClick={handleLater}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-border/50 hover:bg-border text-foreground font-medium transition-colors"
                >
                  {t.rateApp?.later || 'Maybe later'}
                </button>

                <button
                  onClick={handleDismiss}
                  className="w-full py-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  {t.rateApp?.dismissed || "Don't ask again"}
                </button>
              </div>

              <div className="h-4" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
