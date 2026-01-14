import { Sparkles, Pencil } from 'lucide-react'
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

interface ScenesSectionProps {
  scenes: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onActivate: (scene: HAEntity) => void
  onEdit: (scene: HAEntity) => void
  onToggleSelection: (id: string) => void
  getDisplayName?: (scene: HAEntity) => string
}

export function ScenesSection({
  scenes,
  isInEditMode,
  isSelected,
  onActivate,
  onEdit,
  onToggleSelection,
  getDisplayName,
}: ScenesSectionProps) {
  if (scenes.length === 0) return null

  const displayName = getDisplayName || getEntityDisplayName

  return (
    <div className="mb-4">
      <SectionHeader>{t.devices.scenes}</SectionHeader>
      <div className="flex flex-wrap gap-2">
        {scenes.map((scene) => {
          const sceneIcon = haWebSocket.getEntityIcon(scene.entity_id)
          const sceneSelected = isSelected(scene.entity_id)
          return (
            <div
              key={scene.entity_id}
              className={clsx(
                'px-3 py-1.5 rounded-full text-sm font-medium',
                'bg-border/50 hover:bg-accent/20 hover:text-accent',
                'transition-colors',
                'flex items-center gap-1.5',
                isInEditMode && 'ring-1 ring-accent/30',
                sceneSelected && 'ring-2 ring-accent'
              )}
            >
              {isInEditMode ? (
                <>
                  <SelectionCheckbox
                    isSelected={sceneSelected}
                    onToggle={() => onToggleSelection(scene.entity_id)}
                  />
                  <button
                    onClick={() => onEdit(scene)}
                    className="touch-feedback"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <span>{displayName(scene)}</span>
                </>
              ) : (
                <button
                  onClick={() => onActivate(scene)}
                  className="flex items-center gap-1.5 touch-feedback"
                >
                  {sceneIcon ? (
                    <MdiIcon icon={sceneIcon} className="w-3.5 h-3.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {displayName(scene)}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
