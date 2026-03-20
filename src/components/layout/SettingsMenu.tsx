import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/providers/ThemeProvider'
import {
  Moon,
  Sun,
  Pencil,
  X,
  Wifi,
  Layers,
  Beaker,
  Palette,
  Settings2,
  Thermometer,
  Droplet,
  LayoutGrid,
  Copy,
  Check,
  Hash,
  EyeOff,
  GripVertical,
  Sparkles,
  Star,
  MessageSquare,
} from 'lucide-react'
import { t } from '@/lib/i18n'
import { openExternalUrl } from '@/lib/browser'
import { ConnectionSettingsModal } from '@/components/settings/ConnectionSettingsModal'
import { DomainConfigModal } from '@/components/settings/DomainConfigModal'
import { DeveloperMenuModal } from '@/components/settings/DeveloperMenuModal'
import { EditModeInfoModal } from '@/components/settings/EditModeInfoModal'
import { AlsoHideInHADialog } from '@/components/settings/AlsoHideInHADialog'
import {
  EnableCustomOrderDialog,
  DisableCustomOrderDialog,
} from '@/components/settings/CustomOrderDialogs'
import { NewsModal } from '@/components/settings/NewsModal'
import { RateAppModal } from '@/components/settings/RateAppModal'
import { Capacitor } from '@capacitor/core'
import { hasRecentNews, getLatestEntry } from '@/lib/changelog'
import { getStorage } from '@/lib/storage'
import { STORAGE_KEYS } from '@/lib/constants'
import { useDevMode } from '@/lib/hooks/useDevMode'
import { useSettings } from '@/lib/hooks/useSettings'
import { useSettingsMenuState } from '@/lib/hooks/useSettingsMenuState'
import { useSwipeRightToClose } from '@/lib/hooks/useSwipeRightToClose'
import { useDevModeActivation } from '@/lib/hooks/useDevModeActivation'
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard'
import { getDebugId } from '@/lib/crashlytics'
import { logSettingChange } from '@/lib/analytics'
import {
  MenuItem,
  SubMenuItem,
  StatusBadge,
  ToggleSwitch,
  CollapsibleSection,
  ColumnSelector,
} from './settings-menu'

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
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { isDevMode } = useDevMode()
  const {
    showTemperature,
    setShowTemperature,
    showHumidity,
    setShowHumidity,
    gridColumns,
    setGridColumns,
    alsoHideInHA,
    setAlsoHideInHA,
    customOrderEnabled,
    setCustomOrderEnabled,
  } = useSettings()

  const menuState = useSettingsMenuState()
  const swipeHandlers = useSwipeRightToClose({ onClose })
  const devModeActivation = useDevModeActivation()
  const { copied: debugIdCopied, copy: copyDebugId } = useCopyToClipboard()

  const [debugId, setDebugId] = useState<string | null>(null)
  const [rateAppDismissed, setRateAppDismissed] = useState(true) // Start hidden until checked
  const [customOrderLoading, setCustomOrderLoading] = useState(false)
  const isNative = Capacitor.isNativePlatform()

  // Load debug ID when advanced section opens
  useEffect(() => {
    if (menuState.advancedOpen && !debugId) {
      void getDebugId().then(setDebugId)
    }
  }, [menuState.advancedOpen, debugId])

  // Check if rate app has been dismissed (only on native)
  useEffect(() => {
    if (!isNative) return

    const checkRateAppDismissed = async () => {
      try {
        const storage = getStorage()
        const dismissed = await storage.getItem(STORAGE_KEYS.RATE_APP_DISMISSED)
        setRateAppDismissed(dismissed === 'true')
      } catch {
        setRateAppDismissed(false)
      }
    }
    void checkRateAppDismissed()
  }, [isNative])

  // Blur focused element when modal opens
  useEffect(() => {
    if (isOpen && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, [isOpen])

  // Close on escape key and manage body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const handleEditClick = () => {
    menuState.openModal('editModeInfo')
  }

  const handleEditConfirm = () => {
    menuState.closeModal('editModeInfo')
    onClose()
    onEnterEditMode()
  }

  const handleViewAllDevices = () => {
    onClose()
    onViewAllDevices?.()
  }

  const handleThemeToggle = () => {
    const newTheme = isDark ? 'light' : 'dark'
    setTheme(newTheme)
    void logSettingChange('theme', newTheme)
  }

  const handleAlsoHideInHAToggle = () => {
    menuState.openAlsoHideInHADialog(alsoHideInHA ? 'disable' : 'enable')
  }

  const handleAlsoHideInHAConfirmed = () => {
    setAlsoHideInHA(menuState.alsoHideInHAVariant === 'enable')
    menuState.closeAlsoHideInHADialog()
  }

  const handleCustomOrderToggle = () => {
    if (customOrderEnabled) {
      // Show confirmation dialog before disabling (will delete order data)
      menuState.openModal('disableCustomOrder')
    } else {
      // Show confirmation dialog before enabling (explains stuga- labels)
      menuState.openModal('enableCustomOrder')
    }
  }

  const handleCustomOrderEnabled = async () => {
    setCustomOrderLoading(true)
    try {
      await setCustomOrderEnabled(true)
      menuState.closeModal('enableCustomOrder')
    } finally {
      setCustomOrderLoading(false)
    }
  }

  const handleCustomOrderDisabled = async () => {
    setCustomOrderLoading(true)
    try {
      await setCustomOrderEnabled(false)
      menuState.closeModal('disableCustomOrder')
    } finally {
      setCustomOrderLoading(false)
    }
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

          {/* Side Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            onTouchStart={swipeHandlers.onTouchStart}
            onTouchMove={swipeHandlers.onTouchMove}
            onTouchEnd={swipeHandlers.onTouchEnd}
            className="fixed inset-0 z-50 bg-background"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 pt-safe"
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
            >
              <h2
                className="text-lg font-semibold text-foreground cursor-default select-none"
                onClick={devModeActivation.handleClick}
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
            <div
              className="px-2 pb-safe overflow-y-auto"
              style={{ height: 'calc(100% - 60px - env(safe-area-inset-top, 0px))' }}
            >
              {/* What's New - only shown when there's recent news */}
              {hasRecentNews(30) && (
                <MenuItem
                  icon={<Sparkles className="w-5 h-5 text-amber-500" />}
                  iconBgClass="bg-amber-500/10"
                  title={t.news?.menuTitle || "What's new"}
                  description={(getLatestEntry()?.summary?.slice(0, 60) ?? '') + '...'}
                  onClick={() => menuState.openModal('news')}
                />
              )}

              {/* Rate App - only shown on native and when not dismissed */}
              {isNative && !rateAppDismissed && (
                <MenuItem
                  icon={<Star className="w-5 h-5 text-accent" />}
                  iconBgClass="bg-accent/10"
                  title={t.rateApp?.title || 'Rate the app'}
                  description={t.rateApp?.description || 'It would mean a lot'}
                  onClick={() => menuState.openModal('rateApp')}
                />
              )}

              {/* Advanced Section */}
              <CollapsibleSection
                icon={<Settings2 className="w-5 h-5 text-foreground" />}
                title={t.settings.advanced?.title || 'Advanced'}
                description={t.settings.advanced?.description || 'Sync and debug info'}
                isOpen={menuState.advancedOpen}
                onToggle={menuState.toggleAdvanced}
              >
                {/* Custom Order Toggle */}
                <SubMenuItem
                  icon={<GripVertical className="w-4 h-4 text-foreground" />}
                  title={t.settings.advanced?.customOrder?.title || 'Custom room & device order'}
                  description={
                    t.settings.advanced?.customOrder?.description ||
                    'Reorder rooms and devices by dragging'
                  }
                  onClick={handleCustomOrderToggle}
                  rightElement={<ToggleSwitch checked={customOrderEnabled} />}
                />

                {/* Also Hide in HA Toggle */}
                <SubMenuItem
                  icon={<EyeOff className="w-4 h-4 text-foreground" />}
                  title={t.settings.alsoHideInHA?.title || 'Also hide in Home Assistant'}
                  description={
                    t.settings.alsoHideInHA?.description || 'Hidden devices are also hidden in HA'
                  }
                  onClick={handleAlsoHideInHAToggle}
                  rightElement={
                    <StatusBadge
                      enabled={alsoHideInHA}
                      enabledLabel={t.settings.alsoHideInHA?.enabled || 'Enabled'}
                      disabledLabel={t.settings.alsoHideInHA?.disabled || 'Disabled'}
                    />
                  }
                />

                {/* Debug ID */}
                <SubMenuItem
                  icon={<Hash className="w-4 h-4 text-foreground" />}
                  title={t.settings.advanced?.debugId?.title || 'Debug ID'}
                  description={debugId || '...'}
                  rightElement={
                    <button
                      onClick={() => debugId && copyDebugId(debugId)}
                      className="p-2 rounded-lg bg-border/50 hover:bg-border transition-colors"
                      aria-label="Copy debug ID"
                    >
                      {debugIdCopied ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted" />
                      )}
                    </button>
                  }
                />
              </CollapsibleSection>

              {/* Display Options Section */}
              <CollapsibleSection
                icon={<Palette className="w-5 h-5 text-foreground" />}
                title={t.settings.display.title}
                description={t.settings.display.description}
                isOpen={menuState.displayOptionsOpen}
                onToggle={menuState.toggleDisplayOptions}
              >
                {/* Theme Toggle */}
                <SubMenuItem
                  icon={
                    isDark ? (
                      <Sun className="w-4 h-4 text-foreground" />
                    ) : (
                      <Moon className="w-4 h-4 text-foreground" />
                    )
                  }
                  title={t.settings.theme.title}
                  description={isDark ? t.settings.theme.dark : t.settings.theme.light}
                  onClick={handleThemeToggle}
                />

                {/* Temperature Toggle */}
                <SubMenuItem
                  icon={<Thermometer className="w-4 h-4 text-foreground" />}
                  title={t.settings.display.temperature}
                  onClick={() => setShowTemperature(!showTemperature)}
                  rightElement={<ToggleSwitch checked={showTemperature} />}
                />

                {/* Humidity Toggle */}
                <SubMenuItem
                  icon={<Droplet className="w-4 h-4 text-foreground" />}
                  title={t.settings.display.humidity}
                  onClick={() => setShowHumidity(!showHumidity)}
                  rightElement={<ToggleSwitch checked={showHumidity} />}
                />

                {/* Grid Columns */}
                <SubMenuItem
                  icon={<LayoutGrid className="w-4 h-4 text-foreground" />}
                  title={t.settings.display.columns}
                  rightElement={<ColumnSelector value={gridColumns} onChange={setGridColumns} />}
                />

                {/* Device Types */}
                <SubMenuItem
                  icon={<Layers className="w-4 h-4 text-foreground" />}
                  title={t.settings.domains.title}
                  description={t.settings.domains.description}
                  onClick={() => menuState.openModal('domainConfig')}
                />
              </CollapsibleSection>

              {/* All Devices */}
              <MenuItem
                icon={<Layers className="w-5 h-5 text-foreground" />}
                title={t.allDevices.menuTitle}
                description={t.allDevices.menuDescription}
                onClick={handleViewAllDevices}
              />

              {/* Connection Settings */}
              <MenuItem
                icon={<Wifi className="w-5 h-5 text-foreground" />}
                title={t.settings.connection.title}
                description={t.settings.connection.description}
                onClick={() => menuState.openModal('connectionSettings')}
              />

              {/* Feedback */}
              <MenuItem
                icon={<MessageSquare className="w-5 h-5 text-foreground" />}
                title={t.feedback.title}
                description={t.feedback.description}
                onClick={() =>
                  void openExternalUrl('https://github.com/twinbolt-ab/stuga/discussions')
                }
              />

              {/* Developer Menu - only shown when dev mode is active */}
              {isDevMode && (
                <>
                  <MenuItem
                    icon={<Beaker className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                    iconBgClass="bg-amber-500/20"
                    title={t.settings.developer?.title || 'Developer'}
                    description={t.settings.developer?.description || 'Test with mock data'}
                    onClick={() => menuState.openModal('developerMenu')}
                  />
                  <MenuItem
                    icon={<GripVertical className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                    iconBgClass="bg-amber-500/20"
                    title="Drag Test"
                    description="Debug drag behavior on mobile"
                    onClick={() => {
                      onClose()
                      void navigate('/drag-test')
                    }}
                  />
                </>
              )}

              {/* Edit Mode */}
              <MenuItem
                icon={<Pencil className="w-5 h-5 text-foreground" />}
                title={t.settings.editMode.title}
                description={t.settings.editMode.description}
                onClick={handleEditClick}
              />

              {/* Bottom padding for safe area */}
              <div className="h-4" />
            </div>
          </motion.div>

          {/* Modals */}
          <NewsModal
            isOpen={menuState.isModalOpen('news')}
            onClose={() => menuState.closeModal('news')}
          />

          <RateAppModal
            isOpen={menuState.isModalOpen('rateApp')}
            onClose={() => menuState.closeModal('rateApp')}
            onDismissed={() => {
              menuState.closeModal('rateApp')
              setRateAppDismissed(true)
            }}
          />

          <ConnectionSettingsModal
            isOpen={menuState.isModalOpen('connectionSettings')}
            onClose={() => menuState.closeModal('connectionSettings')}
          />

          <DomainConfigModal
            isOpen={menuState.isModalOpen('domainConfig')}
            onClose={() => menuState.closeModal('domainConfig')}
          />

          <DeveloperMenuModal
            isOpen={menuState.isModalOpen('developerMenu')}
            onClose={() => menuState.closeModal('developerMenu')}
          />

          <EditModeInfoModal
            isOpen={menuState.isModalOpen('editModeInfo')}
            onClose={() => menuState.closeModal('editModeInfo')}
            onConfirm={handleEditConfirm}
          />

          <EnableCustomOrderDialog
            isOpen={menuState.isModalOpen('enableCustomOrder')}
            onClose={() => !customOrderLoading && menuState.closeModal('enableCustomOrder')}
            onConfirm={handleCustomOrderEnabled}
            isLoading={customOrderLoading}
          />

          <DisableCustomOrderDialog
            isOpen={menuState.isModalOpen('disableCustomOrder')}
            onClose={() => !customOrderLoading && menuState.closeModal('disableCustomOrder')}
            onConfirm={handleCustomOrderDisabled}
            isLoading={customOrderLoading}
          />

          {menuState.alsoHideInHAVariant && (
            <AlsoHideInHADialog
              isOpen={true}
              onClose={menuState.closeAlsoHideInHADialog}
              onConfirm={handleAlsoHideInHAConfirmed}
              variant={menuState.alsoHideInHAVariant}
            />
          )}

          {/* Dev Mode Activation Toast */}
          <AnimatePresence>
            {devModeActivation.showToast && (
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
