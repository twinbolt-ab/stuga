import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useDragControls, PanInfo } from 'framer-motion'
import { useTheme } from '@/providers/ThemeProvider'
import {
  Moon,
  Sun,
  Pencil,
  X,
  Wifi,
  Layers,
  Beaker,
  ChevronDown,
  Palette,
  Settings2,
  Thermometer,
  Droplet,
  LayoutGrid,
} from 'lucide-react'
import { t } from '@/lib/i18n'
import { ConnectionSettingsModal } from '@/components/settings/ConnectionSettingsModal'
import { DomainConfigModal } from '@/components/settings/DomainConfigModal'
import { DeveloperMenuModal } from '@/components/settings/DeveloperMenuModal'
import { EditModeInfoModal } from '@/components/settings/EditModeInfoModal'
import { RoomOrderingDisableDialog } from '@/components/settings/RoomOrderingDisableDialog'
import { useDevMode } from '@/lib/hooks/useDevMode'
import { useSettings } from '@/lib/hooks/useSettings'
import { clsx } from 'clsx'

interface SettingsMenuProps {
  isOpen: boolean
  onClose: () => void
  onEnterEditMode: () => void
  onViewAllDevices?: () => void
}

export function SettingsMenu({
  isOpen,
  onClose,
  onEnterEditMode,
  onViewAllDevices,
}: SettingsMenuProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [showConnectionSettings, setShowConnectionSettings] = useState(false)
  const [showDomainConfig, setShowDomainConfig] = useState(false)
  const [showDeveloperMenu, setShowDeveloperMenu] = useState(false)
  const [showEditModeInfo, setShowEditModeInfo] = useState(false)
  const [showRoomOrderingDisable, setShowRoomOrderingDisable] = useState(false)
  const [displayOptionsOpen, setDisplayOptionsOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const { isDevMode, enableDevMode } = useDevMode()
  const {
    roomOrderingEnabled,
    setRoomOrderingEnabled,
    showTemperature,
    setShowTemperature,
    showHumidity,
    setShowHumidity,
    gridColumns,
    setGridColumns,
  } = useSettings()
  const y = useMotionValue(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()

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
      setTimeout(() => {
        setShowDevModeToast(false)
      }, 2000)
    } else {
      // Reset counter after 2s of inactivity
      devModeTimeoutRef.current = setTimeout(() => {
        setDevModeClickCount(0)
      }, 2000)
    }
  }, [devModeClickCount, isDevMode, enableDevMode])

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
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

  const startDrag = (event: React.PointerEvent) => {
    dragControls.start(event)
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

  const handleEditClick = () => {
    setShowEditModeInfo(true)
  }

  const handleEditConfirm = () => {
    setShowEditModeInfo(false)
    onClose()
    onEnterEditMode()
  }

  const handleViewAllDevices = () => {
    onClose()
    onViewAllDevices?.()
  }

  const handleThemeToggle = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  const handleRoomOrderingToggle = () => {
    if (roomOrderingEnabled) {
      // Show confirmation dialog before disabling
      setShowRoomOrderingDisable(true)
    } else {
      // Enable immediately
      setRoomOrderingEnabled(true)
    }
  }

  const handleRoomOrderingDisabled = () => {
    setShowRoomOrderingDisable(false)
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
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.8 }}
            onDragEnd={handleDragEnd}
            style={{ y }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl shadow-warm-lg"
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
              className="flex items-center justify-between px-4 pb-2 cursor-grab active:cursor-grabbing touch-none"
            >
              <h2
                className="text-lg font-semibold text-foreground cursor-default select-none"
                onClick={handleSettingsHeaderClick}
              >
                {t.settings.title}
              </h2>
              <button
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors touch-feedback"
                aria-label={t.settings.close}
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="px-2 pb-safe">
              {/* Advanced - Collapsible Section */}
              <div>
                <button
                  onClick={() => {
                    setAdvancedOpen(!advancedOpen)
                  }}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
                >
                  <div className="p-2.5 rounded-xl bg-border/50">
                    <Settings2 className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-foreground">
                      {t.settings.advanced?.title || 'Advanced'}
                    </p>
                    <p className="text-sm text-muted">
                      {t.settings.advanced?.description || 'Room ordering settings'}
                    </p>
                  </div>
                  <motion.div
                    animate={{ rotate: advancedOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-5 h-5 text-muted" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {advancedOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-4 border-l-2 border-border/50 ml-7 space-y-1">
                        {/* Room Ordering Toggle */}
                        <button
                          onClick={handleRoomOrderingToggle}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
                        >
                          <div className="p-2 rounded-lg bg-border/50">
                            <Layers className="w-4 h-4 text-foreground" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-foreground">
                              {t.settings.advanced?.roomOrdering?.title || 'Room ordering'}
                            </p>
                            <p className="text-xs text-muted">
                              {t.settings.advanced?.roomOrdering?.description ||
                                'Hold and drag to reorder rooms'}
                            </p>
                          </div>
                          <div
                            className={clsx(
                              'px-2 py-0.5 text-xs font-medium rounded-full transition-colors',
                              roomOrderingEnabled
                                ? 'bg-accent/15 text-accent'
                                : 'bg-border/50 text-muted'
                            )}
                          >
                            {roomOrderingEnabled
                              ? t.settings.advanced?.roomOrdering?.enabled || 'Enabled'
                              : t.settings.advanced?.roomOrdering?.disabled || 'Disabled'}
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Display Options - Collapsible Section */}
              <div>
                <button
                  onClick={() => {
                    setDisplayOptionsOpen(!displayOptionsOpen)
                  }}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
                >
                  <div className="p-2.5 rounded-xl bg-border/50">
                    <Palette className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-foreground">{t.settings.display.title}</p>
                    <p className="text-sm text-muted">{t.settings.display.description}</p>
                  </div>
                  <motion.div
                    animate={{ rotate: displayOptionsOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-5 h-5 text-muted" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {displayOptionsOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-4 border-l-2 border-border/50 ml-7 space-y-1">
                        {/* Theme Toggle */}
                        <button
                          onClick={handleThemeToggle}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
                        >
                          <div className="p-2 rounded-lg bg-border/50">
                            {isDark ? (
                              <Sun className="w-4 h-4 text-foreground" />
                            ) : (
                              <Moon className="w-4 h-4 text-foreground" />
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-foreground">
                              {t.settings.theme.title}
                            </p>
                            <p className="text-xs text-muted">
                              {isDark ? t.settings.theme.dark : t.settings.theme.light}
                            </p>
                          </div>
                        </button>

                        {/* Temperature Toggle */}
                        <button
                          onClick={() => setShowTemperature(!showTemperature)}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
                        >
                          <div className="p-2 rounded-lg bg-border/50">
                            <Thermometer className="w-4 h-4 text-foreground" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-foreground">
                              {t.settings.display.temperature}
                            </p>
                          </div>
                          <div
                            className={clsx(
                              'w-10 h-6 rounded-full transition-colors relative',
                              showTemperature ? 'bg-accent' : 'bg-border'
                            )}
                          >
                            <div
                              className={clsx(
                                'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                                showTemperature ? 'translate-x-5' : 'translate-x-1'
                              )}
                            />
                          </div>
                        </button>

                        {/* Humidity Toggle */}
                        <button
                          onClick={() => setShowHumidity(!showHumidity)}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
                        >
                          <div className="p-2 rounded-lg bg-border/50">
                            <Droplet className="w-4 h-4 text-foreground" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-foreground">
                              {t.settings.display.humidity}
                            </p>
                          </div>
                          <div
                            className={clsx(
                              'w-10 h-6 rounded-full transition-colors relative',
                              showHumidity ? 'bg-accent' : 'bg-border'
                            )}
                          >
                            <div
                              className={clsx(
                                'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                                showHumidity ? 'translate-x-5' : 'translate-x-1'
                              )}
                            />
                          </div>
                        </button>

                        {/* Grid Columns */}
                        <div className="flex items-center gap-3 px-3 py-3 rounded-xl">
                          <div className="p-2 rounded-lg bg-border/50">
                            <LayoutGrid className="w-4 h-4 text-foreground" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-foreground">
                              {t.settings.display.columns}
                            </p>
                          </div>
                          <div className="flex rounded-lg overflow-hidden border border-border">
                            {([1, 2, 3] as const).map((col) => (
                              <button
                                key={col}
                                onClick={() => setGridColumns(col)}
                                className={clsx(
                                  'w-8 h-7 text-sm font-medium transition-colors',
                                  gridColumns === col
                                    ? 'bg-accent text-white'
                                    : 'bg-transparent text-foreground hover:bg-border/50'
                                )}
                              >
                                {col}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Device Types */}
                        <button
                          onClick={() => {
                            setShowDomainConfig(true)
                          }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
                        >
                          <div className="p-2 rounded-lg bg-border/50">
                            <Layers className="w-4 h-4 text-foreground" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-foreground">
                              {t.settings.domains.title}
                            </p>
                            <p className="text-xs text-muted">{t.settings.domains.description}</p>
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* All Devices */}
              <button
                onClick={handleViewAllDevices}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
              >
                <div className="p-2.5 rounded-xl bg-border/50">
                  <Layers className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{t.allDevices.menuTitle}</p>
                  <p className="text-sm text-muted">{t.allDevices.menuDescription}</p>
                </div>
              </button>

              {/* Connection Settings */}
              <button
                onClick={() => {
                  setShowConnectionSettings(true)
                }}
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

              {/* Developer Menu - only shown when dev mode is active */}
              {isDevMode && (
                <button
                  onClick={() => {
                    setShowDeveloperMenu(true)
                  }}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
                >
                  <div className="p-2.5 rounded-xl bg-amber-500/20">
                    <Beaker className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-foreground">
                      {t.settings.developer?.title || 'Developer'}
                    </p>
                    <p className="text-sm text-muted">
                      {t.settings.developer?.description || 'Test with mock data'}
                    </p>
                  </div>
                </button>
              )}

              {/* Edit Mode */}
              <button
                onClick={handleEditClick}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-border/30 transition-colors touch-feedback"
              >
                <div className="p-2.5 rounded-xl bg-border/50">
                  <Pencil className="w-5 h-5 text-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{t.settings.editMode.title}</p>
                  <p className="text-sm text-muted">{t.settings.editMode.description}</p>
                </div>
              </button>

              {/* Bottom padding for safe area */}
              <div className="h-4" />
            </div>
          </motion.div>

          {/* Connection Settings Modal */}
          <ConnectionSettingsModal
            isOpen={showConnectionSettings}
            onClose={() => {
              setShowConnectionSettings(false)
            }}
          />

          {/* Domain Config Modal */}
          <DomainConfigModal
            isOpen={showDomainConfig}
            onClose={() => {
              setShowDomainConfig(false)
            }}
          />

          {/* Developer Menu Modal */}
          <DeveloperMenuModal
            isOpen={showDeveloperMenu}
            onClose={() => {
              setShowDeveloperMenu(false)
            }}
          />

          {/* Edit Mode Info Modal */}
          <EditModeInfoModal
            isOpen={showEditModeInfo}
            onClose={() => {
              setShowEditModeInfo(false)
            }}
            onConfirm={handleEditConfirm}
          />

          {/* Room Ordering Disable Dialog */}
          <RoomOrderingDisableDialog
            isOpen={showRoomOrderingDisable}
            onClose={() => {
              setShowRoomOrderingDisable(false)
            }}
            onDisabled={handleRoomOrderingDisabled}
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
