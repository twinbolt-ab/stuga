import { useEffect, useState, useRef } from 'react'
import { Search, X } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 150,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local value when external value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounced onChange
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, debounceMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [localValue, value, onChange, debounceMs])

  const handleClear = () => {
    setLocalValue('')
    onChange('')
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      <input
        type="text"
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value)
        }}
        placeholder={placeholder}
        className="w-full bg-card border border-border rounded-xl pl-10 pr-10 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-border/50 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4 text-muted" />
        </button>
      )}
    </div>
  )
}
