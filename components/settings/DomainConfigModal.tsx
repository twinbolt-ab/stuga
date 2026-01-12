'use client'

import { motion, AnimatePresence, useMotionValue, PanInfo } from 'framer-motion'
import { X } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useEnabledDomains } from '@/lib/hooks/useEnabledDomains'
import { ALL_CONFIGURABLE_DOMAINS, type ConfigurableDomain } from '@/types/ha'

interface DomainConfigModalProps {
  isOpen: boolean
  onClose: () => void
}

// Domain display info
const DOMAIN_INFO: Record<ConfigurableDomain, { label: string; icon: string }> = {
  light: { label: 'Lights', icon: 'lightbulb' },
  switch: { label: 'Switches', icon: 'toggle-left' },
  scene: { label: 'Scenes', icon: 'palette' },
  input_boolean: { label: 'Toggles', icon: 'check-square' },
  input_number: { label: 'Sliders', icon: 'sliders' },
  climate: { label: 'Climate', icon: 'thermometer' },
  cover: { label: 'Covers', icon: 'blinds' },
  fan: { label: 'Fans', icon: 'fan' },
  vacuum: { label: 'Vacuums', icon: 'bot' },
  media_player: { label: 'Media', icon: 'play-circle' },
}

export function DomainConfigModal({ isOpen, onClose }: DomainConfigModalProps) {
  const { enabledDomains, toggleDomain } = useEnabledDomains()
  const y = useMotionValue(0)

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    }
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Modal */}
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
            className="fixed bottom-0 left-0 right-0 z-[70] bg-card rounded-t-2xl shadow-warm-lg max-h-[80vh] overflow-y-auto"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-4">
              <h2 className="text-lg font-semibold text-foreground">{t.settings.domains.title}</h2>
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
                {t.settings.domains.description}
              </p>

              {/* Domain toggles */}
              <div className="space-y-2">
                {ALL_CONFIGURABLE_DOMAINS.map((domain) => {
                  const isEnabled = enabledDomains.includes(domain)
                  const info = DOMAIN_INFO[domain]
                  const domainLabel = t.domains?.[domain] || info.label

                  return (
                    <button
                      key={domain}
                      onClick={() => toggleDomain(domain)}
                      className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-border/30 transition-colors"
                    >
                      <div
                        className={`w-10 h-6 rounded-full transition-colors relative ${
                          isEnabled ? 'bg-accent' : 'bg-border'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            isEnabled ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </div>
                      <span className="flex-1 text-left font-medium text-foreground">
                        {domainLabel}
                      </span>
                      <span className="text-sm text-muted font-mono">
                        {domain}.*
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="h-8" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
