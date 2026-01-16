import { useTheme } from '@/providers/ThemeProvider'
import { Moon, Sun } from 'lucide-react'
import { useIsClient } from '@/lib/hooks/useIsClient'

export function ThemeToggle() {
  const { theme: _theme, setTheme, resolvedTheme } = useTheme()
  const isClient = useIsClient()

  if (!isClient) {
    return (
      <button className="p-2 rounded-button opacity-0" aria-label="Toggle theme">
        <Sun className="w-5 h-5" />
      </button>
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => {
        setTheme(isDark ? 'light' : 'dark')
      }}
      className="p-2 rounded-button transition-colors hover:bg-border/50 touch-feedback"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      {isDark ? <Sun className="w-5 h-5 text-muted" /> : <Moon className="w-5 h-5 text-muted" />}
    </button>
  )
}
