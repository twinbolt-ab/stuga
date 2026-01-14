import { Sparkles } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { haWebSocket } from '@/lib/ha-websocket'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { t } from '@/lib/i18n'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface ScenesSectionProps {
  scenes: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onActivate: (scene: HAEntity) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  getDisplayName?: (scene: HAEntity) => string
}

function SceneItem({
  scene,
  isInEditMode,
  isSelected,
  onActivate,
  onToggleSelection,
  onEnterEditModeWithSelection,
  displayName,
}: {
  scene: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onActivate: (scene: HAEntity) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  displayName: (scene: HAEntity) => string
}) {
  const sceneIcon = haWebSocket.getEntityIcon(scene.entity_id)

  const longPress = useLongPress({
    duration: 500,
    disabled: isInEditMode,
    onLongPress: () => onEnterEditModeWithSelection?.(scene.entity_id),
  })

  if (isInEditMode) {
    return (
      <button
        onClick={() => onToggleSelection(scene.entity_id)}
        className={clsx(
          'px-3 py-1.5 rounded-full text-sm font-medium',
          'bg-border/50 hover:bg-accent/20 hover:text-accent',
          'transition-colors touch-feedback',
          'flex items-center gap-1.5'
        )}
      >
        <SelectionCheckbox isSelected={isSelected} />
        {sceneIcon ? (
          <MdiIcon icon={sceneIcon} className="w-3.5 h-3.5" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {displayName(scene)}
      </button>
    )
  }

  return (
    <button
      onClick={() => onActivate(scene)}
      className={clsx(
        'px-3 py-1.5 rounded-full text-sm font-medium',
        'bg-border/50 hover:bg-accent/20 hover:text-accent',
        'transition-colors touch-feedback',
        'flex items-center gap-1.5'
      )}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerUp}
    >
      {sceneIcon ? (
        <MdiIcon icon={sceneIcon} className="w-3.5 h-3.5" />
      ) : (
        <Sparkles className="w-3.5 h-3.5" />
      )}
      {displayName(scene)}
    </button>
  )
}

export function ScenesSection({
  scenes,
  isInEditMode,
  isSelected,
  onActivate,
  onToggleSelection,
  onEnterEditModeWithSelection,
  getDisplayName,
}: ScenesSectionProps) {
  if (scenes.length === 0) return null

  const displayName = getDisplayName || getEntityDisplayName

  return (
    <div className="mb-4">
      <SectionHeader>{t.devices.scenes}</SectionHeader>
      <div className="flex flex-wrap gap-2">
        {scenes.map((scene) => (
          <SceneItem
            key={scene.entity_id}
            scene={scene}
            isInEditMode={isInEditMode}
            isSelected={isSelected(scene.entity_id)}
            onActivate={onActivate}
            onToggleSelection={onToggleSelection}
            onEnterEditModeWithSelection={onEnterEditModeWithSelection}
            displayName={displayName}
          />
        ))}
      </div>
    </div>
  )
}
