import { useState } from 'react'
import { Home, ChevronRight } from 'lucide-react'
import { MdiIcon } from './MdiIcon'
import { IconPicker } from './IconPicker'
import { t } from '@/lib/i18n'
import { getIconDisplayName } from '@/lib/icons'

interface IconPickerFieldProps {
  value: string
  onChange: (icon: string) => void
}

export function IconPickerField({ value, onChange }: IconPickerFieldProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsPickerOpen(true)
        }}
        className="w-full flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl text-foreground hover:bg-border/30 transition-colors text-left"
      >
        {/* Icon preview */}
        <div className="w-10 h-10 flex items-center justify-center bg-card border border-border rounded-lg flex-shrink-0">
          {value ? (
            <MdiIcon icon={value} className="w-5 h-5 text-foreground" />
          ) : (
            <Home className="w-5 h-5 text-muted" />
          )}
        </div>

        {/* Label */}
        <span className="flex-1 truncate">
          {value ? getIconDisplayName(value) : t.iconPicker.selectIcon}
        </span>

        {/* Chevron */}
        <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
      </button>

      <IconPicker
        isOpen={isPickerOpen}
        value={value}
        onChange={onChange}
        onClose={() => {
          setIsPickerOpen(false)
        }}
      />
    </>
  )
}
