'use client'

import { useState } from 'react'
import { Settings, WifiOff } from 'lucide-react'
import { SettingsMenu } from './SettingsMenu'
import { t } from '@/lib/i18n'

interface HeaderProps {
  isConnected: boolean
  onEnterReorderMode: () => void
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return t.greeting.night
  if (hour < 12) return t.greeting.morning
  if (hour < 18) return t.greeting.afternoon
  if (hour < 22) return t.greeting.evening
  return t.greeting.night
}

export function Header({ isConnected, onEnterReorderMode }: HeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const greeting = getGreeting()

  return (
    <>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">{greeting}</h1>
              {!isConnected && (
                <p className="text-sm text-muted flex items-center gap-1.5">
                  <WifiOff className="w-3.5 h-3.5 text-amber" />
                  <span>{t.connection.connecting}</span>
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-button transition-colors hover:bg-border/50 touch-feedback"
            aria-label="Inställningar"
          >
            <Settings className="w-5 h-5 text-muted" />
          </button>
        </div>
      </header>

      <SettingsMenu
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onEnterReorderMode={onEnterReorderMode}
      />
    </>
  )
}
