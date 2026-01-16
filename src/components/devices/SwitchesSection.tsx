import { Power } from 'lucide-react'
import type { HAEntity } from '@/types/ha'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { DeviceToggleButton } from '@/components/ui/DeviceToggleButton'
import { t } from '@/lib/i18n'
import type { EntityMeta } from '@/lib/hooks/useAllEntities'

interface SwitchesSectionProps {
  switches: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onToggle: (device: HAEntity) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  entityMeta?: Map<string, EntityMeta>
}

export function SwitchesSection({
  switches,
  isInEditMode,
  isSelected,
  onToggle,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
}: SwitchesSectionProps) {
  if (switches.length === 0) return null

  return (
    <div className="mb-4">
      <SectionHeader>{t.devices.switches}</SectionHeader>
      <div className="space-y-1">
        {switches.map((sw) => (
          <DeviceToggleButton
            key={sw.entity_id}
            entity={sw}
            isInEditMode={isInEditMode}
            isSelected={isSelected(sw.entity_id)}
            onToggle={() => {
              onToggle(sw)
            }}
            onToggleSelection={() => {
              onToggleSelection(sw.entity_id)
            }}
            onEnterEditModeWithSelection={() => onEnterEditModeWithSelection?.(sw.entity_id)}
            fallbackIcon={<Power className="w-5 h-5" />}
            entityMeta={entityMeta?.get(sw.entity_id)}
          />
        ))}
      </div>
    </div>
  )
}
