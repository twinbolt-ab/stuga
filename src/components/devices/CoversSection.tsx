import { useMemo, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Blinds } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import type { DomainOrderMap } from '@/types/ordering'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { EntityBadges } from '@/components/ui/EntityBadge'
import { getEntityIcon, getCoverSettings } from '@/lib/ha-websocket'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { sortEntitiesByOrder } from '@/lib/utils/entity-sort'
import { haToUserPosition, type CoverSettings } from '@/lib/utils/cover'
import { ReorderableList } from '@/components/shared/ReorderableList'
import { haptic } from '@/lib/haptics'
import { OPTIMISTIC_DURATION, OVERLAY_HIDE_DELAY } from '@/lib/constants'
import { t } from '@/lib/i18n'
import type { EntityMeta } from '@/lib/hooks/useAllEntities'

// HA cover entity supported_features bitmask
// https://developers.home-assistant.io/docs/core/entity/cover/
const COVER_FEATURE = {
  OPEN: 1,
  CLOSE: 2,
  SET_POSITION: 4,
  STOP: 8,
} as const

function supports(cover: HAEntity, flag: number): boolean {
  const f = cover.attributes.supported_features
  return typeof f === 'number' && (f & flag) !== 0
}

const DRAG_THRESHOLD = 10
const SLIDER_PADDING = 24

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

// Whether the cover is closed in HA's view (without applying user inversion).
// `is_closed` is more reliable than `state==='closed'` or `current_position===0`
// for integrations that report position oddly (e.g. IKEA Tradfri shades, where
// `is_closed: false` can coexist with `current_position: 0`).
function isCoverClosedRaw(cover: HAEntity): boolean {
  if (typeof cover.attributes.is_closed === 'boolean') {
    return cover.attributes.is_closed
  }
  if (cover.state === 'closed') return true
  if (cover.state === 'open' || cover.state === 'opening' || cover.state === 'closing') {
    return false
  }
  return cover.attributes.current_position === 0
}

// Resolve the user-facing position and closed state from a cover, applying
// per-entity Stuga overrides (inverted, closedPrc).
function getCoverDisplay(
  cover: HAEntity,
  settings: CoverSettings
): { position: number | undefined; isClosed: boolean } {
  const rawIsClosed = isCoverClosedRaw(cover)
  const rawPos = cover.attributes.current_position
  const noOverrides = !settings.inverted && settings.closedPrc <= 0

  if (typeof rawPos !== 'number') {
    return {
      position: undefined,
      isClosed: settings.inverted ? !rawIsClosed : rawIsClosed,
    }
  }

  // Without user overrides, drop position when it contradicts is_closed —
  // the integration is reporting unreliable data (seen on IKEA shades).
  if (noOverrides) {
    if (!rawIsClosed && rawPos === 0) {
      return { position: undefined, isClosed: false }
    }
    if (rawIsClosed && rawPos === 100) {
      return { position: undefined, isClosed: true }
    }
  }

  const userPos = haToUserPosition(rawPos, settings)
  return { position: userPos, isClosed: userPos === 0 }
}

function getCoverStateLabel(cover: HAEntity, settings: CoverSettings): string {
  // When the cover is inverted in Stuga, flip the state's open/closed meaning
  // so the label matches what the user sees.
  let state = cover.state
  if (settings.inverted) {
    if (state === 'open') state = 'closed'
    else if (state === 'closed') state = 'open'
    else if (state === 'opening') state = 'closing'
    else if (state === 'closing') state = 'opening'
  }
  switch (state) {
    case 'opening':
      return t.devices.coverOpening
    case 'closing':
      return t.devices.coverClosing
    case 'open':
      return t.devices.coverOpen
    case 'closed':
      return t.devices.coverClosed
    default:
      return cover.state
  }
}

interface CoversSectionProps {
  covers: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onToggle: (cover: HAEntity) => void
  onPosition?: (cover: HAEntity, position: number) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  entityMeta?: Map<string, EntityMeta>
  entityOrder?: DomainOrderMap
  onReorderEntities?: (entities: HAEntity[]) => Promise<void>
  /** Selected entity IDs for multi-drag support in edit mode */
  selectedIds?: Set<string>
}

function CoverItem({
  cover,
  isInEditMode,
  isSelected,
  onToggle,
  onPosition,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
  isReorderSelected = false,
}: {
  cover: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onToggle: (cover: HAEntity) => void
  onPosition?: (cover: HAEntity, position: number) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  entityMeta?: EntityMeta
  isReorderSelected?: boolean
}) {
  const settings = getCoverSettings(cover.entity_id)
  const { position: haPosition, isClosed } = getCoverDisplay(cover, settings)
  const rawState = cover.state
  // When inverted, flip motion direction so optimistic 'opening' from HA reads
  // as 'closing' for the user (and vice versa).
  const isMoving = rawState === 'opening' || rawState === 'closing'
  const isActive = !isClosed
  const coverIcon = getEntityIcon(cover.entity_id)

  const supportsPosition = supports(cover, COVER_FEATURE.SET_POSITION)
  const canSlide = supportsPosition && !!onPosition && !isInEditMode

  // Slider drag state — only used when canSlide
  const [localPosition, setLocalPosition] = useState(haPosition ?? 0)
  const [isDragging, setIsDragging] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [useOptimisticValue, setUseOptimisticValue] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const isDraggingRef = useRef(false)
  const didDragRef = useRef(false)
  const optimisticTimerRef = useRef<NodeJS.Timeout | null>(null)
  const capturedElementRef = useRef<HTMLElement | null>(null)
  const capturedPointerIdRef = useRef<number | null>(null)

  const longPress = useLongPress({
    duration: 500,
    disabled: isInEditMode,
    onLongPress: () => onEnterEditModeWithSelection?.(cover.entity_id),
  })

  const calculatePosition = (clientX: number) => {
    const screenWidth = window.innerWidth
    const effectiveWidth = screenWidth - SLIDER_PADDING * 2
    const relativeX = clientX - SLIDER_PADDING
    return Math.round(Math.max(0, Math.min(100, (relativeX / effectiveWidth) * 100)))
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    longPress.onPointerDown(e)
    if (!canSlide) return
    didDragRef.current = false
    const start = isDragging || useOptimisticValue ? localPosition : (haPosition ?? 0)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    setLocalPosition(start)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    longPress.onPointerMove(e)
    if (!canSlide || !dragStartRef.current) return

    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y

    if (!isDraggingRef.current) {
      if (Math.abs(deltaY) > DRAG_THRESHOLD) {
        dragStartRef.current = null
        return
      }
      if (Math.abs(deltaX) > DRAG_THRESHOLD) {
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          dragStartRef.current = null
          return
        }
        isDraggingRef.current = true
        didDragRef.current = true
        setIsDragging(true)
        setShowOverlay(true)
        const element = e.currentTarget as HTMLElement
        element.setPointerCapture(e.pointerId)
        capturedElementRef.current = element
        capturedPointerIdRef.current = e.pointerId
        setLocalPosition(calculatePosition(e.clientX))
      }
    } else {
      setLocalPosition(calculatePosition(e.clientX))
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    longPress.onPointerUp()
    if (!canSlide) return

    if (isDraggingRef.current) {
      const finalPosition = calculatePosition(e.clientX)
      setLocalPosition(finalPosition)
      onPosition?.(cover, finalPosition)

      if (capturedElementRef.current && capturedPointerIdRef.current !== null) {
        capturedElementRef.current.releasePointerCapture(capturedPointerIdRef.current)
        capturedElementRef.current = null
        capturedPointerIdRef.current = null
      }

      setUseOptimisticValue(true)
      if (optimisticTimerRef.current) clearTimeout(optimisticTimerRef.current)
      optimisticTimerRef.current = setTimeout(() => {
        setUseOptimisticValue(false)
        optimisticTimerRef.current = null
      }, OPTIMISTIC_DURATION)

      setTimeout(() => setShowOverlay(false), OVERLAY_HIDE_DELAY)
      haptic.light()
    }

    isDraggingRef.current = false
    setIsDragging(false)
    dragStartRef.current = null
  }

  useEffect(() => {
    return () => {
      if (optimisticTimerRef.current) clearTimeout(optimisticTimerRef.current)
    }
  }, [])

  if (isInEditMode) {
    return (
      <button
        data-entity-id={cover.entity_id}
        onClick={() => {
          onToggleSelection(cover.entity_id)
        }}
        className={clsx(
          'w-full flex items-center gap-2 px-2 py-2 rounded-lg',
          'transition-all touch-feedback',
          isActive ? 'bg-accent/20' : 'bg-border/30',
          isSelected && 'ring-2 ring-inset ring-accent'
        )}
      >
        <SelectionCheckbox isSelected={isSelected} />
        <div
          className={clsx(
            'p-2 rounded-lg transition-colors flex-shrink-0',
            isActive ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
          )}
        >
          {coverIcon ? (
            <MdiIcon icon={coverIcon} className="w-5 h-5" />
          ) : (
            <Blinds className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span
            className={clsx(
              'text-sm font-medium truncate text-left',
              isActive ? 'text-foreground' : 'text-muted'
            )}
          >
            {getEntityDisplayName(cover)}
          </span>
          {entityMeta && (
            <EntityBadges
              isHiddenInStuga={entityMeta.isHiddenInStuga}
              isHiddenInHA={entityMeta.isHiddenInHA}
              hasRoom={entityMeta.hasRoom}
              className="flex-shrink-0"
            />
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {entityMeta?.roomName && (
            <span className="text-sm text-muted truncate w-20 text-right">
              {entityMeta.roomName}
            </span>
          )}
          <span className="text-xs text-muted w-16 text-right">
            {getCoverStateLabel(cover, settings)}
          </span>
        </div>
      </button>
    )
  }

  // Display position: prefer local while dragging or in optimistic window, otherwise HA value.
  const displayPosition = isDragging || useOptimisticValue ? localPosition : haPosition
  const showFill = isActive || (isDragging && (displayPosition ?? 0) > 0)
  const fillScale = typeof displayPosition === 'number' ? displayPosition / 100 : isActive ? 1 : 0

  const handleTap = () => {
    if (didDragRef.current) return
    haptic.light()
    onToggle(cover)
  }

  return (
    <div
      data-entity-id={cover.entity_id}
      className={clsx(
        'relative w-full flex items-center gap-2 px-2 py-2 rounded-lg overflow-hidden',
        'transition-all',
        isActive ? 'bg-accent/20' : 'bg-border/30',
        isReorderSelected && 'ring-2 ring-accent ring-offset-1 ring-offset-bg-primary'
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleTap}
      style={canSlide ? { touchAction: 'pan-y' } : undefined}
    >
      {showFill && (
        <motion.div
          className="absolute inset-0 origin-left pointer-events-none"
          style={{ backgroundColor: 'var(--brightness-fill)' }}
          initial={false}
          animate={{ scaleX: fillScale }}
          transition={{ duration: isDragging ? 0 : 0.3 }}
        />
      )}

      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm z-10 pointer-events-none"
          >
            <span className="text-2xl font-bold text-accent">{displayPosition ?? 0}%</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-0 flex-1 flex items-center gap-3 pointer-events-none">
        <div
          className={clsx(
            'p-2 rounded-lg transition-colors flex-shrink-0',
            isActive ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted',
            isMoving && 'animate-pulse'
          )}
        >
          {coverIcon ? (
            <MdiIcon icon={coverIcon} className="w-5 h-5" />
          ) : (
            <Blinds className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span
            className={clsx(
              'text-sm font-medium truncate text-left',
              isActive ? 'text-foreground' : 'text-muted'
            )}
          >
            {getEntityDisplayName(cover)}
          </span>
          {entityMeta && (
            <EntityBadges
              isHiddenInStuga={entityMeta.isHiddenInStuga}
              isHiddenInHA={entityMeta.isHiddenInHA}
              hasRoom={entityMeta.hasRoom}
              className="flex-shrink-0"
            />
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {entityMeta?.roomName && (
            <span className="text-sm text-muted truncate w-20 text-right">
              {entityMeta.roomName}
            </span>
          )}
          {isActive &&
            typeof displayPosition === 'number' &&
            displayPosition > 0 &&
            displayPosition < 100 && (
              <span className="text-xs text-accent font-medium w-8 text-right">
                {displayPosition}%
              </span>
            )}
          <span className="text-xs text-muted w-16 text-right">
            {getCoverStateLabel(cover, settings)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function CoversSection({
  covers,
  isInEditMode,
  isSelected,
  onToggle,
  onPosition,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
  entityOrder,
  onReorderEntities,
  selectedIds,
}: CoversSectionProps) {
  const sortedCovers = useMemo(() => {
    if (!entityOrder || Object.keys(entityOrder).length === 0) {
      return covers
    }
    return sortEntitiesByOrder(covers, entityOrder)
  }, [covers, entityOrder])

  if (covers.length === 0) return null

  const handleReorder = (reorderedCovers: HAEntity[]) => {
    void onReorderEntities?.(reorderedCovers)
  }

  return (
    <div className="mb-4">
      <SectionHeader>{t.domains.cover}</SectionHeader>
      {isInEditMode ? (
        <ReorderableList
          items={sortedCovers}
          getKey={(cover) => cover.entity_id}
          onReorder={handleReorder}
          layout="vertical"
          selectedKeys={selectedIds}
          onItemTap={onToggleSelection}
          renderItem={(cover, _index, _isDragging, isReorderSelected) => (
            <CoverItem
              key={cover.entity_id}
              cover={cover}
              isInEditMode={true}
              isSelected={isSelected(cover.entity_id)}
              onToggle={onToggle}
              onPosition={onPosition}
              onToggleSelection={onToggleSelection}
              onEnterEditModeWithSelection={onEnterEditModeWithSelection}
              entityMeta={entityMeta?.get(cover.entity_id)}
              isReorderSelected={isReorderSelected}
            />
          )}
        />
      ) : (
        <div className="space-y-1">
          {sortedCovers.map((cover) => (
            <CoverItem
              key={cover.entity_id}
              cover={cover}
              isInEditMode={false}
              isSelected={isSelected(cover.entity_id)}
              onToggle={onToggle}
              onPosition={onPosition}
              onToggleSelection={onToggleSelection}
              onEnterEditModeWithSelection={onEnterEditModeWithSelection}
              entityMeta={entityMeta?.get(cover.entity_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
