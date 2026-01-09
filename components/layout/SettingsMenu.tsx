'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Moon, Sun, GripVertical, X } from 'lucide-react'
import { t } from '@/lib/i18n'

interface SettingsMenuProps {
  isOpen: boolean
  onClose: () => void
  onEnterReorderMode: () => void
}

export function SettingsMenu({
  isOpen,
  onClose,
  onEnterReorderMode,
}: SettingsMenuProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const handleReorder = () => {
    onClose()
    onEnterReorderMode()
  }

  const handleThemeToggle = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl shadow-warm-lg"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2">
              <h2 className="text-lg font-semibold text-foreground">{t.settings.title}</h2>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors touch-feedback"
                aria-label={t.settings.close}
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="px-2 pb-safe">
              {/* Theme Toggle */}
              <button
                onClick={handleThemeToggle}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
              >
                <div className="p-2.5 rounded-xl bg-border/50">
                  {isDark ? (
                    <Sun className="w-5 h-5 text-foreground" />
                  ) : (
                    <Moon className="w-5 h-5 text-foreground" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{t.settings.theme.title}</p>
                  <p className="text-sm text-muted">
                    {isDark ? t.settings.theme.dark : t.settings.theme.light}
                  </p>
                </div>
              </button>

              {/* Reorder Rooms */}
              <button
                onClick={handleReorder}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
              >
                <div className="p-2.5 rounded-xl bg-border/50">
                  <GripVertical className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{t.settings.reorder.title}</p>
                  <p className="text-sm text-muted">{t.settings.reorder.description}</p>
                </div>
              </button>

              {/* Bottom padding for safe area */}
              <div className="h-4" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
