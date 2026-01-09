'use client'

import { useState } from 'react'
import { Settings, WifiOff } from 'lucide-react'
import { SettingsMenu } from './SettingsMenu'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { t } from '@/lib/i18n'
import type { HAFloor } from '@/types/ha'

interface BottomNavProps {
  isConnected: boolean
  onEnterReorderMode: () => void
  floors: HAFloor[]
  selectedFloorId: string | null
  onSelectFloor: (floorId: string | null) => void
  hasUnassignedRooms: boolean
}

export function BottomNav({
  isConnected,
  onEnterReorderMode,
  floors,
  selectedFloorId,
  onSelectFloor,
  hasUnassignedRooms,
}: BottomNavProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Build tabs: floors + optional "Other" + Settings
  const floorTabs = floors.map((floor) => ({
    id: floor.floor_id,
    label: floor.name,
    icon: floor.icon,
  }))

  if (hasUnassignedRooms) {
    floorTabs.push({
      id: '__other__',
      label: t.floors.other,
      icon: undefined,
    })
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-md border-t border-border pb-safe">
        <div className="flex items-center py-2 overflow-x-auto">
          {/* Floor tabs */}
          {floorTabs.map((tab) => {
            const isActive = selectedFloorId === tab.id || (tab.id === '__other__' && selectedFloorId === null)
            return (
              <button
                key={tab.id}
                onClick={() => onSelectFloor(tab.id === '__other__' ? null : tab.id)}
                className={`flex flex-col items-center gap-1 px-4 py-2 min-w-[72px] flex-shrink-0 transition-colors touch-feedback ${
                  isActive ? 'text-accent' : 'text-muted hover:text-foreground'
                }`}
              >
                {tab.icon ? (
                  <MdiIcon icon={tab.icon} className="w-6 h-6" />
                ) : (
                  <div className="w-6 h-6 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-current" />
                  </div>
                )}
                <span className="text-xs font-medium truncate max-w-[64px]">{tab.label}</span>
              </button>
            )
          })}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Settings button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex flex-col items-center gap-1 px-4 py-2 text-muted hover:text-foreground transition-colors touch-feedback relative flex-shrink-0"
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs font-medium">{t.nav.settings}</span>
            {/* Connection indicator */}
            {!isConnected && (
              <WifiOff className="w-3 h-3 text-warning absolute top-1 right-2" />
            )}
          </button>
        </div>
      </nav>

      <SettingsMenu
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onEnterReorderMode={onEnterReorderMode}
      />
    </>
  )
}

// Keep old name as alias for compatibility
export { BottomNav as Header }
