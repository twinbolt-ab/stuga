import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lightbulb } from 'lucide-react'
import { getStorage } from '@/lib/storage'
import { STORAGE_KEYS } from '@/lib/constants'
import { t } from '@/lib/i18n'

type HintType = 'structure' | 'floors'

interface DismissableHintProps {
  show: boolean
  storageKey: string
  message: string
}

function DismissableHint({ show, storageKey, message }: DismissableHintProps) {
  const [isDismissed, setIsDismissed] = useState(true) // Start hidden until we check storage
  const [isLoading, setIsLoading] = useState(true)

  // Check if hint was previously dismissed
  useEffect(() => {
    const checkDismissed = async () => {
      try {
        const storage = getStorage()
        const dismissed = await storage.getItem(storageKey)
        setIsDismissed(dismissed === 'true')
      } catch {
        setIsDismissed(false)
      }
      setIsLoading(false)
    }
    checkDismissed()
  }, [storageKey])

  const handleDismiss = async () => {
    setIsDismissed(true)
    try {
      const storage = getStorage()
      await storage.setItem(storageKey, 'true')
    } catch {
      // Ignore storage errors
    }
  }

  const isVisible = show && !isDismissed && !isLoading

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="mx-4 mb-4"
        >
          <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/10 border border-accent/20">
            <div className="p-1.5 rounded-lg bg-accent/20 text-accent flex-shrink-0">
              <Lightbulb className="w-4 h-4" />
            </div>
            <p className="text-sm text-muted flex-1 pt-0.5">{message}</p>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-border/50 transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface StructureHintProps {
  type: HintType
  show: boolean
}

export function StructureHint({ type, show }: StructureHintProps) {
  const config = {
    structure: {
      storageKey: STORAGE_KEYS.STRUCTURE_HINT_DISMISSED,
      message: t.hints.structureEmpty,
    },
    floors: {
      storageKey: STORAGE_KEYS.FLOORS_HINT_DISMISSED,
      message: t.hints.noFloors,
    },
  }

  const { storageKey, message } = config[type]

  return <DismissableHint show={show} storageKey={storageKey} message={message} />
}
