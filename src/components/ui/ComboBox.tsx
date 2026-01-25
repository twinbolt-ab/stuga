import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useMotionValue, useDragControls, animate, PanInfo } from 'framer-motion'
import { ChevronDown, Plus, Loader2, X, Search } from 'lucide-react'
import { logger } from '@/lib/logger'
import { t } from '@/lib/i18n'

const DRAG_CLOSE_THRESHOLD = 150

interface ComboBoxOption {
  value: string
  label: string
}

interface ComboBoxProps {
  value: string
  onChange: (value: string) => void
  options: ComboBoxOption[]
  placeholder?: string
  onCreate?: (name: string) => Promise<string>
  createLabel?: string
}

export function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  onCreate,
  createLabel = 'Create',
}: ComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(240)
  // Track just-created item to display before options update
  const [createdItem, setCreatedItem] = useState<{ value: string; label: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const mobileSheetRef = useRef<HTMLDivElement>(null)
  const mobileY = useMotionValue(0)
  const mobileDragControls = useDragControls()

  // Detect touch device for full-screen picker
  const isTouchDevice =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

  // Get display label for current value (check created item first, then options)
  const selectedOption = options.find((opt) => opt.value === value)
  const displayValue =
    selectedOption?.label || (createdItem?.value === value ? createdItem.label : '')

  // Filter options based on input
  const filteredOptions = inputValue
    ? options.filter((opt) => opt.label.toLowerCase().includes(inputValue.toLowerCase()))
    : options

  // Check if input exactly matches an existing option
  const exactMatch = options.some((opt) => opt.label.toLowerCase() === inputValue.toLowerCase())

  // Show create option when there's input and no exact match
  const showCreateOption = onCreate && inputValue.trim() && !exactMatch

  // Handle click outside to close (desktop only)
  useEffect(() => {
    if (isTouchDevice) return

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setInputValue('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, isTouchDevice])

  // Focus input when dropdown opens (desktop only)
  useEffect(() => {
    if (isOpen && inputRef.current && !isTouchDevice) {
      inputRef.current.focus()
    }
  }, [isOpen, isTouchDevice])

  // Calculate dropdown max height based on available space (desktop only)
  useEffect(() => {
    if (isTouchDevice || !isOpen || !containerRef.current) return

    const calculateMaxHeight = () => {
      const rect = containerRef.current!.getBoundingClientRect()
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const availableBelow = viewportHeight - rect.bottom - 16
      const maxHeight = Math.min(Math.max(availableBelow - 50, 144), 300)
      setDropdownMaxHeight(maxHeight)
    }

    calculateMaxHeight()

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', calculateMaxHeight)
      return () => window.visualViewport?.removeEventListener('resize', calculateMaxHeight)
    }
  }, [isOpen, isTouchDevice])

  // Lock body scroll when full-screen picker is open
  useEffect(() => {
    if (isTouchDevice && isOpen) {
      document.body.style.overflow = 'hidden'
      // Reset drag position when opening
      mobileY.set(0)
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen, isTouchDevice, mobileY])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setInputValue('')
    setCreateError(null)
  }, [])

  const handleMobileDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > DRAG_CLOSE_THRESHOLD || info.velocity.y > 500) {
        handleClose()
      } else {
        // Reset y if not closing
        animate(mobileY, 0, { type: 'spring', damping: 30, stiffness: 400 })
      }
    },
    [handleClose, mobileY]
  )

  const startMobileDrag = useCallback(
    (event: React.PointerEvent) => {
      mobileDragControls.start(event)
    },
    [mobileDragControls]
  )

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue)
      handleClose()
    },
    [onChange, handleClose]
  )

  const handleCreate = useCallback(async () => {
    if (!onCreate || !inputValue.trim() || isCreating) return

    const name = inputValue.trim()
    setIsCreating(true)
    setCreateError(null)
    try {
      const newId = await onCreate(name)
      setCreatedItem({ value: newId, label: name })
      onChange(newId)
      handleClose()
    } catch (error) {
      logger.error('ComboBox', 'Failed to create:', error)
      setCreateError(error instanceof Error ? error.message : 'Failed to create')
    } finally {
      setIsCreating(false)
    }
  }, [onCreate, inputValue, isCreating, onChange, handleClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (showCreateOption) {
          void handleCreate()
        } else if (filteredOptions.length === 1) {
          handleSelect(filteredOptions[0].value)
        }
      } else if (e.key === 'Escape') {
        handleClose()
      }
    },
    [showCreateOption, handleCreate, filteredOptions, handleSelect, handleClose]
  )

  // Shared options list content
  const optionsList = (
    <>
      {/* Create new option */}
      {showCreateOption && (
        <button
          type="button"
          onClick={handleCreate}
          disabled={isCreating}
          className="w-full flex items-center gap-2 px-4 py-3 text-left text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span>
            {createLabel} &ldquo;{inputValue.trim()}&rdquo;
          </span>
        </button>
      )}

      {/* Existing options */}
      {filteredOptions.length > 0
        ? filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full px-4 py-3 text-left transition-colors ${
                option.value === value
                  ? 'bg-accent/10 text-accent'
                  : 'text-foreground hover:bg-border/30'
              }`}
            >
              {option.label}
            </button>
          ))
        : !showCreateOption && <div className="px-4 py-3 text-muted text-sm">No options found</div>}
    </>
  )

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger / Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isCreating}
        className="w-full flex items-center justify-between bg-background border border-border rounded-xl px-4 py-3 text-left text-foreground focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
      >
        <span className={displayValue ? 'text-foreground' : 'text-muted'}>
          {displayValue || placeholder || 'Select...'}
        </span>
        {isCreating ? (
          <Loader2 className="w-5 h-5 text-muted animate-spin" />
        ) : (
          <ChevronDown
            className={`w-5 h-5 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {/* Desktop: Dropdown positioned below trigger */}
      {!isTouchDevice && isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-warm-lg overflow-hidden"
        >
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                setCreateError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type to search or create..."
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors text-sm"
            />
            {createError && <p className="text-red-500 text-xs mt-1">{createError}</p>}
          </div>

          {/* Options list */}
          <div
            className="overflow-y-auto touch-auto"
            style={{ maxHeight: dropdownMaxHeight }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {optionsList}
          </div>
        </div>
      )}

      {/* Mobile: Full-screen picker */}
      {isTouchDevice &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={mobileSheetRef}
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                drag="y"
                dragControls={mobileDragControls}
                dragListener={false}
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0.1, bottom: 0.8 }}
                onDragEnd={handleMobileDragEnd}
                style={{ y: mobileY }}
                className="fixed inset-0 z-[200] bg-card flex flex-col"
              >
                {/* Handle bar - drag area */}
                <div
                  onPointerDown={startMobileDrag}
                  className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
                >
                  <div className="w-10 h-1 bg-border rounded-full" />
                </div>

                {/* Header - also draggable */}
                <div className="flex-shrink-0 pt-safe">
                  <div
                    onPointerDown={startMobileDrag}
                    className="flex items-center justify-between px-4 py-3 border-b border-border cursor-grab active:cursor-grabbing touch-none"
                  >
                    <h2 className="text-lg font-semibold text-foreground">
                      {placeholder || 'Select'}
                    </h2>
                    <button
                      onClick={handleClose}
                      onPointerDown={(e) => e.stopPropagation()}
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
                        value={inputValue}
                        onChange={(e) => {
                          setInputValue(e.target.value)
                          setCreateError(null)
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Type to search..."
                        className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted focus:border-accent transition-colors"
                      />
                    </div>
                    {createError && <p className="text-red-500 text-xs mt-2">{createError}</p>}
                  </div>
                </div>

                {/* Options list - scrollable, with touch-auto to allow scrolling */}
                <div className="overflow-y-auto touch-auto" style={{ maxHeight: '60vh' }}>
                  {optionsList}
                </div>

                {/* Empty drag zone below options - swipe down here to close */}
                <div className="flex-1 pb-safe" />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}
