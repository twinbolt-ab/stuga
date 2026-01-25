import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useDragControls, PanInfo } from 'framer-motion'
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
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const y = useMotionValue(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()

  // Reset selected icon when value changes
  useEffect(() => {
    setSelectedIcon(value)
  }, [value])

  // Reset search and motion value when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      y.set(0)
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
  }, [isOpen, y])

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

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      if (info.offset.y > 100 || info.velocity.y > 500) {
        onClose()
      } else {
        y.set(0)
      }
    },
    [onClose, y]
  )

  const startDrag = useCallback(
    (event: React.PointerEvent) => {
      dragControls.start(event)
    },
    [dragControls]
  )

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

  // Handle keyboard appearance on mobile
  useEffect(() => {
    if (!isOpen || !window.visualViewport) return

    const viewport = window.visualViewport

    const handleResize = () => {
      // Calculate how much the keyboard is pushing up the viewport
      const offset = window.innerHeight - viewport.height
      setKeyboardOffset(offset)
    }

    viewport.addEventListener('resize', handleResize)
    viewport.addEventListener('scroll', handleResize)

    return () => {
      viewport.removeEventListener('resize', handleResize)
      viewport.removeEventListener('scroll', handleResize)
      setKeyboardOffset(0)
    }
  }, [isOpen])

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
            style={{ y, bottom: keyboardOffset }}
            className="fixed left-0 right-0 z-[70] bg-card rounded-t-2xl shadow-warm-lg max-h-[85vh] flex flex-col transition-[bottom] duration-200"
          >
            {/* Handle bar - drag area */}
            <div
              onPointerDown={startDrag}
              className="flex justify-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
            >
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {/* Header - also draggable */}
            <div
              onPointerDown={startDrag}
              className="flex items-center justify-between px-4 pb-3 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
            >
              <h2 className="text-lg font-semibold text-foreground">{t.iconPicker.title}</h2>
              <button
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors touch-feedback"
                aria-label={t.settings.close}
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pb-3 flex-shrink-0">
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
              <div className="px-4 pb-2 flex-shrink-0">
                <button
                  onClick={handleClear}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {t.iconPicker.clear}
                </button>
              </div>
            )}

            {/* Icon grid - scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y px-4 pb-safe">
              {filteredIcons.length === 0 ? (
                <div className="py-8 text-center text-muted">{t.iconPicker.noResults}</div>
              ) : (
                <div className="grid grid-cols-5 gap-2 py-2">
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
        </>
      )}
    </AnimatePresence>
  )
}
