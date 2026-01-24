import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Trash2 } from 'lucide-react'
import { MdiIcon } from './MdiIcon'
import { searchIcons, getIconDisplayName } from '@/lib/icons'
import { t } from '@/lib/i18n'

interface IconPickerProps {
  isOpen: boolean
  value: string
  onChange: (icon: string) => void
  onClose: () => void
}

export function IconPicker({ isOpen, value, onChange, onClose }: IconPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIcon, setSelectedIcon] = useState(value)

  // Reset selected icon when value changes
  useEffect(() => {
    setSelectedIcon(value)
  }, [value])

  // Reset search when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
    }
  }, [isOpen])

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    return searchIcons(searchQuery)
  }, [searchQuery])

  const handleSelect = useCallback(
    (icon: string) => {
      setSelectedIcon(icon)
      onChange(icon)
      onClose()
    },
    [onChange, onClose]
  )

  const handleClear = useCallback(() => {
    setSelectedIcon('')
    onChange('')
    onClose()
  }, [onChange, onClose])

  // Close on escape and lock body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] bg-card flex flex-col"
        >
          {/* Header - fixed at top */}
          <div className="flex-shrink-0 pt-safe relative z-10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">{t.iconPicker.title}</h2>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors touch-feedback"
                aria-label={t.settings.close}
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.iconPicker.search}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Clear button */}
            {value && (
              <div className="px-4 py-2 border-b border-border">
                <button
                  onClick={handleClear}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {t.iconPicker.clear}
                </button>
              </div>
            )}
          </div>

          {/* Icon grid - scrollable, keyboard covers bottom naturally */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-safe">
            {filteredIcons.length === 0 ? (
              <div className="py-8 text-center text-muted">{t.iconPicker.noResults}</div>
            ) : (
              <div className="grid grid-cols-5 gap-2 py-4">
                {filteredIcons.map((icon) => {
                  const isSelected = icon === selectedIcon
                  return (
                    <button
                      key={icon}
                      onClick={() => handleSelect(icon)}
                      className={`aspect-square flex flex-col items-center justify-center p-2 rounded-xl transition-colors touch-feedback ${
                        isSelected
                          ? 'bg-accent/20 text-accent ring-2 ring-accent'
                          : 'bg-background hover:bg-border/50 text-foreground'
                      }`}
                      title={getIconDisplayName(icon)}
                    >
                      <MdiIcon icon={icon} className="w-6 h-6" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
