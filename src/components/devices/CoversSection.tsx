import { Blinds, ChevronUp, ChevronDown, Square } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { EntityBadges } from '@/components/ui/EntityBadge'
import { getEntityIcon } from '@/lib/ha-websocket'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { t } from '@/lib/i18n'
import type { EntityMeta } from '@/lib/hooks/useAllEntities'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface CoversSectionProps {
  covers: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onOpen: (device: HAEntity) => void
  onClose: (device: HAEntity) => void
  onStop: (device: HAEntity) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  entityMeta?: Map<string, EntityMeta>
}

function CoverItem({
  cover,
  isInEditMode,
  isSelected,
  onOpen,
  onClose,
  onStop,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
}: {
  cover: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onOpen: (device: HAEntity) => void
  onClose: (device: HAEntity) => void
  onStop: (device: HAEntity) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  entityMeta?: EntityMeta
}) {
  const isOpen = cover.state === 'open'
  const isClosed = cover.state === 'closed'
  const coverIcon = getEntityIcon(cover.entity_id)

  const longPress = useLongPress({
    duration: 500,
    disabled: isInEditMode,
    onLongPress: () => onEnterEditModeWithSelection?.(cover.entity_id),
  })

  if (isInEditMode) {
    return (
      <button
        onClick={() => {
          onToggleSelection(cover.entity_id)
        }}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg bg-border/30 touch-feedback"
      >
        <SelectionCheckbox isSelected={isSelected} />
        <div
          className={clsx(
            'p-2 rounded-lg transition-colors flex-shrink-0',
            isOpen ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
          )}
        >
          {coverIcon ? (
            <MdiIcon icon={coverIcon} className="w-5 h-5" />
          ) : (
            <Blinds className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-foreground truncate text-left">
            {getEntityDisplayName(cover)}
          </span>
          {entityMeta && (
            <EntityBadges
              isHidden={entityMeta.isHidden}
              hasRoom={entityMeta.hasRoom}
              className="flex-shrink-0"
            />
          )}
        </div>
      </button>
    )
  }

  return (
    <div
      className={clsx(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors',
        isOpen ? 'bg-accent/20' : 'bg-border/30'
      )}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerUp}
    >
      {/* Icon */}
      <div
        className={clsx(
          'p-2 rounded-lg transition-colors flex-shrink-0',
          isOpen ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
        )}
      >
        {coverIcon ? (
          <MdiIcon icon={coverIcon} className="w-5 h-5" />
        ) : (
          <Blinds className="w-5 h-5" />
        )}
      </div>

      {/* Name */}
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        <span
          className={clsx(
            'text-sm font-medium truncate',
            isOpen ? 'text-foreground' : 'text-muted'
          )}
        >
          {getEntityDisplayName(cover)}
        </span>
        {entityMeta && (
          <EntityBadges
            isHidden={entityMeta.isHidden}
            hasRoom={entityMeta.hasRoom}
            className="flex-shrink-0"
          />
        )}
      </div>

      {/* State */}
      <span className="text-xs text-muted capitalize flex-shrink-0">{cover.state}</span>

      {/* Control buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            onOpen(cover)
          }}
          disabled={isOpen}
          className={clsx(
            'p-1.5 rounded-lg transition-colors touch-feedback',
            isOpen ? 'text-muted/50' : 'bg-border/50 text-foreground hover:bg-accent/20'
          )}
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            onStop(cover)
          }}
          className="p-1.5 rounded-lg bg-border/50 text-foreground hover:bg-accent/20 transition-colors touch-feedback"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={() => {
            onClose(cover)
          }}
          disabled={isClosed}
          className={clsx(
            'p-1.5 rounded-lg transition-colors touch-feedback',
            isClosed ? 'text-muted/50' : 'bg-border/50 text-foreground hover:bg-accent/20'
          )}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function CoversSection({
  covers,
  isInEditMode,
  isSelected,
  onOpen,
  onClose,
  onStop,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
}: CoversSectionProps) {
  if (covers.length === 0) return null

  return (
    <div className="mb-4">
      <SectionHeader>{t.domains.cover}</SectionHeader>
      <div className="space-y-1">
        {covers.map((cover) => (
          <CoverItem
            key={cover.entity_id}
            cover={cover}
            isInEditMode={isInEditMode}
            isSelected={isSelected(cover.entity_id)}
            onOpen={onOpen}
            onClose={onClose}
            onStop={onStop}
            onToggleSelection={onToggleSelection}
            onEnterEditModeWithSelection={onEnterEditModeWithSelection}
            entityMeta={entityMeta?.get(cover.entity_id)}
          />
        ))}
      </div>
    </div>
  )
}
