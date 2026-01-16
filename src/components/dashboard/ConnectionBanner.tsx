import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { t } from '@/lib/i18n'

interface ConnectionBannerProps {
  isConnected: boolean
  hasReceivedData: boolean
}

export function ConnectionBanner({ isConnected, hasReceivedData }: ConnectionBannerProps) {
  // Only show banner if disconnected AND we haven't received any data yet
  // If we have data, we're clearly connected even if state says otherwise
  const showBanner = !isConnected && !hasReceivedData

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 left-0 right-0 z-50 bg-[var(--warning)] backdrop-blur-sm text-[#1A1A1A] pt-safe"
        >
          <div className="flex items-center justify-center gap-2 text-sm font-medium px-4 py-2">
            <WifiOff className="w-4 h-4" />
            <span>{t.connection.reconnecting}</span>
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ...
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
