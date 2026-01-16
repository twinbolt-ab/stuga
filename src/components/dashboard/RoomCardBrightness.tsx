import { motion, AnimatePresence } from 'framer-motion'

interface RoomCardBrightnessFillProps {
  brightness: number
  isDragging: boolean
  className?: string
}

export function RoomCardBrightnessFill({
  brightness,
  isDragging,
  className = 'rounded-card',
}: RoomCardBrightnessFillProps) {
  return (
    <motion.div
      className={`absolute inset-0 origin-left pointer-events-none ${className}`}
      style={{ backgroundColor: 'var(--brightness-fill)' }}
      initial={false}
      animate={{ scaleX: brightness / 100 }}
      transition={{ duration: isDragging ? 0 : 0.3 }}
    />
  )
}

interface RoomCardBrightnessOverlayProps {
  brightness: number
  showOverlay: boolean
  className?: string
}

export function RoomCardBrightnessOverlay({
  brightness,
  showOverlay,
  className = '',
}: RoomCardBrightnessOverlayProps) {
  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm z-10 pointer-events-none ${className}`}
        >
          <span className="text-4xl font-bold text-accent">{brightness}%</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
