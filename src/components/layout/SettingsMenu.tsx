import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, PanInfo } from 'framer-motion'
import { useTheme } from '@/providers/ThemeProvider'
import { Moon, Sun, Pencil, X, Wifi, Layers, Package, Eye, EyeOff, Sparkles, Beaker } from 'lucide-react'
import { t } from '@/lib/i18n'
import { ConnectionSettingsModal } from '@/components/settings/ConnectionSettingsModal'
import { DomainConfigModal } from '@/components/settings/DomainConfigModal'
import { DeveloperMenuModal } from '@/components/settings/DeveloperMenuModal'
import { useEnabledDomains } from '@/lib/hooks/useEnabledDomains'
import { useSettings, type ShowScenesOption } from '@/lib/hooks/useSettings'
import { useDevMode } from '@/lib/hooks/useDevMode'
import { isHAAddon } from '@/lib/config'
import { clsx } from 'clsx'

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
  const [showDeveloperMenu, setShowDeveloperMenu] = useState(false)
  const { showHiddenItems, setShowHiddenItems } = useEnabledDomains()
  const { showScenes, setShowScenes } = useSettings()
  const { isDevMode, enableDevMode } = useDevMode()
  const y = useMotionValue(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Dev mode activation via click counter
  const [devModeClickCount, setDevModeClickCount] = useState(0)
  const [showDevModeToast, setShowDevModeToast] = useState(false)
  const devModeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSettingsHeaderClick = useCallback(() => {
    if (isDevMode) return // Already in dev mode

    if (devModeTimeoutRef.current) {
      clearTimeout(devModeTimeoutRef.current)
    }

    const newCount = devModeClickCount + 1
    setDevModeClickCount(newCount)

    if (newCount >= 10) {
      enableDevMode()
      setDevModeClickCount(0)
      setShowDevModeToast(true)
      setTimeout(() => setShowDevModeToast(false), 2000)
    } else {
      // Reset counter after 2s of inactivity
      devModeTimeoutRef.current = setTimeout(() => {
        setDevModeClickCount(0)
      }, 2000)
    }
  }, [devModeClickCount, isDevMode, enableDevMode])

  const showScenesOptions: ShowScenesOption[] = ['auto', 'on', 'off']

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

    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    } else {
      // Reset y if not closing
      y.set(0)
    }
  }

  // Reset y motion value and blur focused element when modal state changes
  useEffect(() => {
    if (isOpen) {
      y.set(0)
      // Blur the button that opened the menu to prevent stuck focus/hover state
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
  }, [isOpen, y])

  // Close on escape key and manage body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden'
    } else {
      // Immediately restore scroll when closing (don't wait for cleanup)
      document.body.style.overflow = ''
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
            initial={{ opacity: 0, pointerEvents: 'none' as const }}
            animate={{ opacity: 1, pointerEvents: 'auto' as const }}
            exit={{ opacity: 0, pointerEvents: 'none' as const }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%', pointerEvents: 'none' as const }}
            animate={{ y: 0, pointerEvents: 'auto' as const }}
            exit={{ y: '100%', pointerEvents: 'none' as const }}
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
              <h2
                className="text-lg font-semibold text-foreground cursor-default select-none"
                onClick={handleSettingsHeaderClick}
              >
                {t.settings.title}
              </h2>
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

              {/* Show Scenes */}
              <div className="w-full flex items-center gap-4 px-4 py-4 rounded-xl">
                <div className="p-2.5 rounded-xl bg-border/50">
                  <Sparkles className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{t.settings.showScenes.title}</p>
                  <p className="text-sm text-muted">{t.settings.showScenes.description}</p>
                </div>
                {/* 3-option segmented control */}
                <div className="flex bg-border/50 rounded-lg p-0.5">
                  {showScenesOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => setShowScenes(option)}
                      className={clsx(
                        'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                        showScenes === option
                          ? 'bg-accent text-white'
                          : 'text-muted hover:text-foreground'
                      )}
                    >
                      {t.settings.showScenes[option]}
                    </button>
                  ))}
                </div>
              </div>

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

              {/* Developer Menu - only shown when dev mode is active */}
              {isDevMode && (
                <button
                  onClick={() => setShowDeveloperMenu(true)}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
                >
                  <div className="p-2.5 rounded-xl bg-amber-500/20">
                    <Beaker className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-foreground">{t.settings.developer?.title || 'Developer'}</p>
                    <p className="text-sm text-muted">{t.settings.developer?.description || 'Test with mock data'}</p>
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

          {/* Developer Menu Modal */}
          <DeveloperMenuModal
            isOpen={showDeveloperMenu}
            onClose={() => setShowDeveloperMenu(false)}
          />

          {/* Dev Mode Activation Toast */}
          <AnimatePresence>
            {showDevModeToast && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-amber-500 text-white rounded-full text-sm font-medium shadow-lg"
              >
                Dev mode enabled
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  )
}
