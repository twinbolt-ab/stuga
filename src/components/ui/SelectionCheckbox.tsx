import { Check } from 'lucide-react'
import { clsx } from 'clsx'

interface SelectionCheckboxProps {
  isSelected: boolean
}

export function SelectionCheckbox({ isSelected }: SelectionCheckboxProps) {
  return (
    <div
      className={clsx(
        'w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors border',
        isSelected
          ? 'bg-accent text-white border-accent'
          : 'bg-background border-border'
      )}
    >
      {isSelected && <Check className="w-3 h-3" />}
    </div>
  )
}
