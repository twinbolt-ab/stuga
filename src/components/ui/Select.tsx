import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
}

export function Select({ value, onChange, options, placeholder }: SelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        className="w-full appearance-none bg-background border border-border rounded-xl px-4 py-3 pr-10 text-foreground focus:outline-none focus:border-accent transition-colors"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
    </div>
  )
}
