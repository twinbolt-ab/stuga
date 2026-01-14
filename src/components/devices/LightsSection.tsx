import { Pencil } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import { LightSlider } from '@/components/dashboard/LightSlider'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { t } from '@/lib/i18n'

interface LightsSectionProps {
  lights: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onEdit: (device: HAEntity) => void
  onToggleSelection: (id: string) => void
  compact?: boolean
}

export function LightsSection({
  lights,
  isInEditMode,
  isSelected,
  onEdit,
  onToggleSelection,
  compact = false,
}: LightsSectionProps) {
  if (lights.length === 0) return null

  // Use two columns for lights when there are more than 6 (unless explicitly set)
  const useTwoColumn = compact || lights.length > 6

  return (
    <div className="mb-4">
      <SectionHeader>{t.devices.lights}</SectionHeader>
      <div
        className={clsx(
          useTwoColumn ? 'grid grid-cols-2 gap-x-2 gap-y-1' : 'space-y-1'
        )}
      >
        {lights.map((light) => {
          const lightSelected = isSelected(light.entity_id)
          return (
            <div
              key={light.entity_id}
              className={clsx(
                isInEditMode &&
                  'flex items-center gap-2 bg-card rounded-lg pl-2 pr-1 ring-1 ring-accent/30',
                lightSelected && 'ring-2 ring-accent'
              )}
            >
              {isInEditMode && (
                <>
                  <SelectionCheckbox
                    isSelected={lightSelected}
                    onToggle={() => onToggleSelection(light.entity_id)}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(light)
                    }}
                    className="p-1 rounded-lg hover:bg-border/50 transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-muted" />
                  </button>
                </>
              )}
              <div className={clsx(isInEditMode ? 'flex-1 min-w-0' : '')}>
                <LightSlider
                  light={light}
                  disabled={isInEditMode}
                  compact={useTwoColumn}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
