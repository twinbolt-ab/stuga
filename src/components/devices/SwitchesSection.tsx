import { Power } from 'lucide-react'
import type { HAEntity } from '@/types/ha'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { DeviceToggleButton } from '@/components/ui/DeviceToggleButton'
import { t } from '@/lib/i18n'

interface SwitchesSectionProps {
  switches: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onToggle: (device: HAEntity) => void
  onEdit: (device: HAEntity) => void
  onToggleSelection: (id: string) => void
}

export function SwitchesSection({
  switches,
  isInEditMode,
  isSelected,
  onToggle,
  onEdit,
  onToggleSelection,
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
            onToggle={() => onToggle(sw)}
            onEdit={() => onEdit(sw)}
            onToggleSelection={() => onToggleSelection(sw.entity_id)}
            fallbackIcon={<Power className="w-5 h-5" />}
          />
        ))}
      </div>
    </div>
  )
}
