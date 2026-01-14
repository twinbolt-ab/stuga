import { Blinds, ChevronUp, ChevronDown, Square, Pencil } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { haWebSocket } from '@/lib/ha-websocket'
import { t } from '@/lib/i18n'

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
  onEdit: (device: HAEntity) => void
  onToggleSelection: (id: string) => void
}

export function CoversSection({
  covers,
  isInEditMode,
  isSelected,
  onOpen,
  onClose,
  onStop,
  onEdit,
  onToggleSelection,
}: CoversSectionProps) {
  if (covers.length === 0) return null

  return (
    <div className="mb-4">
      <SectionHeader>{t.domains.cover}</SectionHeader>
      <div className="space-y-1">
        {covers.map((cover) => {
          const coverSelected = isSelected(cover.entity_id)
          const isOpen = cover.state === 'open'
          const isClosed = cover.state === 'closed'
          const coverIcon = haWebSocket.getEntityIcon(cover.entity_id)

          if (isInEditMode) {
            return (
              <div
                key={cover.entity_id}
                className={clsx(
                  'w-full flex items-center gap-2 px-2 py-2 rounded-lg bg-border/30',
                  'ring-1 ring-accent/30',
                  coverSelected && 'ring-2 ring-accent'
                )}
              >
                <SelectionCheckbox
                  isSelected={coverSelected}
                  onToggle={() => onToggleSelection(cover.entity_id)}
                />
                <button
                  onClick={() => onEdit(cover)}
                  className="p-1 rounded-lg hover:bg-border/50 transition-colors"
                >
                  <Pencil className="w-4 h-4 text-muted" />
                </button>
                <span className="flex-1 text-sm font-medium text-foreground truncate">
                  {getEntityDisplayName(cover)}
                </span>
              </div>
            )
          }

          return (
            <div
              key={cover.entity_id}
              className={clsx(
                'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors',
                isOpen ? 'bg-accent/20' : 'bg-border/30'
              )}
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
              <span
                className={clsx(
                  'flex-1 text-sm font-medium truncate',
                  isOpen ? 'text-foreground' : 'text-muted'
                )}
              >
                {getEntityDisplayName(cover)}
              </span>

              {/* State */}
              <span className="text-xs text-muted capitalize">{cover.state}</span>

              {/* Control buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onOpen(cover)}
                  disabled={isOpen}
                  className={clsx(
                    'p-1.5 rounded-lg transition-colors touch-feedback',
                    isOpen
                      ? 'text-muted/50'
                      : 'bg-border/50 text-foreground hover:bg-accent/20'
                  )}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onStop(cover)}
                  className="p-1.5 rounded-lg bg-border/50 text-foreground hover:bg-accent/20 transition-colors touch-feedback"
                >
                  <Square className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onClose(cover)}
                  disabled={isClosed}
                  className={clsx(
                    'p-1.5 rounded-lg transition-colors touch-feedback',
                    isClosed
                      ? 'text-muted/50'
                      : 'bg-border/50 text-foreground hover:bg-accent/20'
                  )}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
