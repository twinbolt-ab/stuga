import { AnimatePresence, motion } from 'framer-motion'

interface FloorToastProps {
  floorName: string | null
  show: boolean
}

export function FloorToast({ floorName, show }: FloorToastProps) {
  return (
    <AnimatePresence>
      {show && floorName && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute top-12 left-0 right-0 flex justify-center z-50 pointer-events-none"
        >
          <div className="bg-card/95 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-warm-lg">
            <span className="text-sm font-medium text-foreground">{floorName}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
