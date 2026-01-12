'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, PanInfo } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Moon, Sun, Pencil, X, Wifi, Layers, Package, Eye, EyeOff } from 'lucide-react'
import { t } from '@/lib/i18n'
import { ConnectionSettingsModal } from '@/components/settings/ConnectionSettingsModal'
import { DomainConfigModal } from '@/components/settings/DomainConfigModal'
import { useEnabledDomains } from '@/lib/hooks/useEnabledDomains'
import { isHAAddon } from '@/lib/config'

interface SettingsMenuProps {
  isOpen: boolean
  onClose: () => void
  onEnterEditMode: () => void
  onViewUncategorized?: () => void
}

export function SettingsMenu({
  isOpen,
  onClose,
  onEnterEditMode,
  onViewUncategorized,
}: SettingsMenuProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [showConnectionSettings, setShowConnectionSettings] = useState(false)
  const [showDomainConfig, setShowDomainConfig] = useState(false)
  const { showHiddenItems, setShowHiddenItems } = useEnabledDomains()
  const y = useMotionValue(0)

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    }
  }

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

  const handleEdit = () => {
    onClose()
    onEnterEditMode()
  }

  const handleViewUncategorized = () => {
    onClose()
    onViewUncategorized?.()
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
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            style={{ y }}
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

              {/* Device Types */}
              <button
                onClick={() => setShowDomainConfig(true)}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
              >
                <div className="p-2.5 rounded-xl bg-border/50">
                  <Layers className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{t.settings.domains.title}</p>
                  <p className="text-sm text-muted">{t.settings.domains.description}</p>
                </div>
              </button>

              {/* Show Hidden Items */}
              <button
                onClick={() => setShowHiddenItems(!showHiddenItems)}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
              >
                <div className="p-2.5 rounded-xl bg-border/50">
                  {showHiddenItems ? (
                    <Eye className="w-5 h-5 text-foreground" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-foreground" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{t.settings.showHidden.title}</p>
                  <p className="text-sm text-muted">{t.settings.showHidden.description}</p>
                </div>
                {/* Toggle indicator */}
                <div className={`w-10 h-6 rounded-full transition-colors ${showHiddenItems ? 'bg-accent' : 'bg-border'}`}>
                  <div className={`w-5 h-5 mt-0.5 rounded-full bg-white shadow transition-transform ${showHiddenItems ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`} />
                </div>
              </button>

              {/* Uncategorized Items */}
              <button
                onClick={handleViewUncategorized}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
              >
                <div className="p-2.5 rounded-xl bg-border/50">
                  <Package className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{t.uncategorized.menuTitle}</p>
                  <p className="text-sm text-muted">{t.uncategorized.menuDescription}</p>
                </div>
              </button>

              {/* Connection Settings - hidden in add-on mode */}
              {!isHAAddon() && (
                <button
                  onClick={() => setShowConnectionSettings(true)}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
                >
                  <div className="p-2.5 rounded-xl bg-border/50">
                    <Wifi className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-foreground">{t.settings.connection.title}</p>
                    <p className="text-sm text-muted">{t.settings.connection.description}</p>
                  </div>
                </button>
              )}

              {/* Edit Mode - prominent at bottom */}
              <button
                onClick={handleEdit}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 mt-2 rounded-xl bg-accent hover:bg-accent-hover transition-colors touch-feedback"
              >
                <Pencil className="w-5 h-5 text-white" />
                <p className="font-medium text-white">{t.settings.editMode.title}</p>
              </button>

              {/* Bottom padding for safe area */}
              <div className="h-4" />
            </div>
          </motion.div>

          {/* Connection Settings Modal */}
          <ConnectionSettingsModal
            isOpen={showConnectionSettings}
            onClose={() => setShowConnectionSettings(false)}
          />

          {/* Domain Config Modal */}
          <DomainConfigModal
            isOpen={showDomainConfig}
            onClose={() => setShowDomainConfig(false)}
          />
        </>
      )}
    </AnimatePresence>
  )
}
