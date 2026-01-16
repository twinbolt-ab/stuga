import type { HAFloor } from '@/types/ha'
import { MdiIcon } from '@/components/ui/MdiIcon'

interface FloorHeadingProps {
  floor: HAFloor | null
  label?: string
}

export function FloorHeading({ floor, label }: FloorHeadingProps) {
  const name = label || floor?.name || ''

  return (
    <div className="col-span-2 flex items-center gap-2 pt-4 pb-1 first:pt-0">
      {floor?.icon && <MdiIcon icon={floor.icon} className="w-4 h-4 text-muted" />}
      <h2 className="text-xs font-medium text-muted uppercase tracking-wide">{name}</h2>
    </div>
  )
}
