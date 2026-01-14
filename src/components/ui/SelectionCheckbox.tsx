import { Check } from 'lucide-react'
import { clsx } from 'clsx'

interface SelectionCheckboxProps {
  isSelected: boolean
  onToggle: () => void
}

export function SelectionCheckbox({ isSelected, onToggle }: SelectionCheckboxProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={clsx(
        'w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
        isSelected
          ? 'bg-accent text-white'
          : 'bg-accent/20 ring-1 ring-inset ring-accent/40'
      )}
    >
      {isSelected && <Check className="w-3 h-3" />}
    </button>
  )
}
