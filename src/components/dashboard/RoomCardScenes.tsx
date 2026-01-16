import { useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { getEntityIcon } from '@/lib/ha-websocket'

interface RoomCardScenesProps {
  scenes: HAEntity[]
  isInEditMode: boolean
  onSceneActivate: (scene: HAEntity, e: React.MouseEvent) => void
}

export function RoomCardScenes({ scenes, isInEditMode, onSceneActivate }: RoomCardScenesProps) {
  const getSceneDisplayName = useCallback((scene: HAEntity) => {
    return scene.attributes.friendly_name || scene.entity_id.split('.')[1]
  }, [])

  if (scenes.length === 0) {
    // Empty placeholder to maintain consistent height
    return <div className="flex gap-1.5 mb-1 min-h-[32px] items-center justify-center" />
  }

  return (
    <div
      className={clsx(
        'flex gap-1.5 mb-1 min-h-[32px] items-center justify-center',
        isInEditMode && 'pointer-events-none'
      )}
    >
      {scenes.slice(0, 4).map((scene) => {
        const sceneIcon = getEntityIcon(scene.entity_id)
        return (
          <button
            key={scene.entity_id}
            onClick={(e) => {
              onSceneActivate(scene, e)
            }}
            className="p-1.5 rounded-lg bg-border/50 hover:bg-accent/20 hover:text-accent transition-colors text-muted touch-feedback"
            title={getSceneDisplayName(scene)}
          >
            {sceneIcon ? (
              <MdiIcon icon={sceneIcon} className="w-5 h-5" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </button>
        )
      })}
    </div>
  )
}
