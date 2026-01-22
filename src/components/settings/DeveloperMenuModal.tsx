import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, PanInfo } from 'framer-motion'
import {
  X,
  Wifi,
  Home,
  Building,
  AlertTriangle,
  XCircle,
  LogOut,
  HelpCircle,
  Building2,
} from 'lucide-react'
import { useDevMode, type MockScenario } from '@/lib/hooks/useDevMode'
import { isSetupComplete } from '@/lib/config'
import { t } from '@/lib/i18n'
import { clsx } from 'clsx'

interface DeveloperMenuModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ScenarioOption {
  id: MockScenario
  label: string
  description: string
  icon: React.ReactNode
}

const SCENARIOS: ScenarioOption[] = [
  {
    id: 'none',
    label: 'Live Data',
    description: 'Use real Home Assistant data',
    icon: <Wifi className="w-5 h-5" />,
  },
  {
    id: 'empty',
    label: 'Empty Home',
    description: 'No floors, rooms, or devices',
    icon: <XCircle className="w-5 h-5" />,
  },
  {
    id: 'minimal',
    label: 'Minimal Setup',
    description: '1 floor, 2 rooms, few devices',
    icon: <Home className="w-5 h-5" />,
  },
  {
    id: 'complex',
    label: 'Complex Home',
    description: '3 floors, 12 rooms, many devices',
    icon: <Building className="w-5 h-5" />,
  },
  {
    id: 'edge-cases',
    label: 'Edge Cases',
    description: 'Rooms without floors, orphan devices',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  {
    id: 'unassigned',
    label: 'Unassigned Devices',
    description: 'Devices with no room or floor',
    icon: <HelpCircle className="w-5 h-5" />,
  },
  {
    id: 'apartment',
    label: 'Apartment',
    description: 'Rooms and devices, no floors',
    icon: <Building2 className="w-5 h-5" />,
  },
]

export function DeveloperMenuModal({ isOpen, onClose }: DeveloperMenuModalProps) {
  const navigate = useNavigate()
  const { activeMockScenario, setMockScenario, disableDevMode } = useDevMode()
  const y = useMotionValue(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Reset y motion value and blur focused element when modal opens
  useEffect(() => {
    if (isOpen) {
      y.set(0)
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
  }, [isOpen, y])

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (sheetRef.current && 'pointerId' in event) {
      try {
        sheetRef.current.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore if pointer capture wasn't held
      }
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    } else {
      y.set(0)
    }
  }

  const handleScenarioSelect = (scenario: MockScenario) => {
    setMockScenario(scenario)
  }

  const handleExitDevMode = () => {
    disableDevMode()
    onClose()
    // If no real credentials exist, redirect to setup
    isSetupComplete()
      .then((hasCredentials) => {
        if (!hasCredentials) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate returns void but type includes Promise path
          navigate('/setup', { replace: true })
        }
      })
      .catch(() => {
        // Ignore errors - we're just checking credentials
      })
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
            onClick={onClose}
          />

          {/* Modal */}
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
            className="fixed bottom-0 left-0 right-0 z-[70] bg-card rounded-t-2xl shadow-warm-lg max-h-[90vh] overflow-y-auto"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {t.settings.developer?.title || 'Developer'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="px-4 pb-safe">
              <p className="text-sm text-muted mb-4">
                Select a mock data scenario to test different home configurations.
              </p>

              {/* Scenario buttons */}
              <div className="space-y-2">
                {SCENARIOS.map((scenario) => {
                  const isSelected = activeMockScenario === scenario.id

                  return (
                    <button
                      key={scenario.id}
                      onClick={() => {
                        handleScenarioSelect(scenario.id)
                      }}
                      className={clsx(
                        'w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors',
                        isSelected ? 'bg-accent/10 ring-2 ring-accent' : 'hover:bg-border/30'
                      )}
                    >
                      <div
                        className={clsx(
                          'p-2.5 rounded-xl',
                          isSelected ? 'bg-accent/20 text-accent' : 'bg-border/50 text-foreground'
                        )}
                      >
                        {scenario.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <p
                          className={clsx(
                            'font-medium',
                            isSelected ? 'text-accent' : 'text-foreground'
                          )}
                        >
                          {scenario.label}
                        </p>
                        <p className="text-sm text-muted">{scenario.description}</p>
                      </div>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-accent" />}
                    </button>
                  )
                })}
              </div>

              {/* Exit Dev Mode button */}
              <button
                onClick={handleExitDevMode}
                className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Exit Dev Mode</span>
              </button>

              <div className="h-8" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
