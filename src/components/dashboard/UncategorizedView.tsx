import { useState, useMemo } from 'react'
import { Package } from 'lucide-react'
import type { HAEntity, RoomWithDevices } from '@/types/ha'
import { DeviceEditModal } from './DeviceEditModal'
import { useUncategorizedEntities } from '@/lib/hooks/useUncategorizedEntities'
import { useEditMode } from '@/lib/contexts/EditModeContext'
import { useDeviceHandlers } from '@/lib/hooks/useDeviceHandlers'
import { t } from '@/lib/i18n'

import {
  ScenesSection,
  LightsSection,
  SwitchesSection,
  InputsSection,
  ClimateSection,
  CoversSection,
  FansSection,
} from '@/components/devices'

interface UncategorizedViewProps {
  allRooms: RoomWithDevices[]
}

export function UncategorizedView({ allRooms }: UncategorizedViewProps) {
  const { uncategorizedByDomain, totalCount } = useUncategorizedEntities()
  const handlers = useDeviceHandlers()

  // Get edit mode state from context
  const { isUncategorizedEditMode, isSelected, toggleSelection } = useEditMode()
  const isInEditMode = isUncategorizedEditMode

  const [editingDevice, setEditingDevice] = useState<HAEntity | null>(null)

  // Get entities by domain
  const lights = useMemo(
    () => uncategorizedByDomain.get('light') || [],
    [uncategorizedByDomain]
  )
  const switches = useMemo(
    () => uncategorizedByDomain.get('switch') || [],
    [uncategorizedByDomain]
  )
  const scenes = useMemo(
    () => uncategorizedByDomain.get('scene') || [],
    [uncategorizedByDomain]
  )
  const inputBooleans = useMemo(
    () => uncategorizedByDomain.get('input_boolean') || [],
    [uncategorizedByDomain]
  )
  const inputNumbers = useMemo(
    () => uncategorizedByDomain.get('input_number') || [],
    [uncategorizedByDomain]
  )
  const climates = useMemo(
    () => uncategorizedByDomain.get('climate') || [],
    [uncategorizedByDomain]
  )
  const covers = useMemo(
    () => uncategorizedByDomain.get('cover') || [],
    [uncategorizedByDomain]
  )
  const fans = useMemo(
    () => uncategorizedByDomain.get('fan') || [],
    [uncategorizedByDomain]
  )

  const handleDeviceEdit = (device: HAEntity) => {
    if (isInEditMode) {
      setEditingDevice(device)
    }
  }

  const isEmpty =
    lights.length === 0 &&
    switches.length === 0 &&
    scenes.length === 0 &&
    inputBooleans.length === 0 &&
    inputNumbers.length === 0 &&
    climates.length === 0 &&
    covers.length === 0 &&
    fans.length === 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-accent/10">
          <Package className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t.uncategorized.title}
          </h2>
          <p className="text-sm text-muted">
            {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="card p-8 text-center">
          <p className="text-muted">{t.uncategorized.empty}</p>
        </div>
      )}

      <ScenesSection
        scenes={scenes}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onActivate={handlers.handleSceneActivate}
        onEdit={handleDeviceEdit}
        onToggleSelection={toggleSelection}
      />

      <LightsSection
        lights={lights}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onEdit={handleDeviceEdit}
        onToggleSelection={toggleSelection}
      />

      <SwitchesSection
        switches={switches}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onToggle={handlers.handleSwitchToggle}
        onEdit={handleDeviceEdit}
        onToggleSelection={toggleSelection}
      />

      <InputsSection
        inputBooleans={inputBooleans}
        inputNumbers={inputNumbers}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onBooleanToggle={handlers.handleInputBooleanToggle}
        onNumberChange={handlers.handleInputNumberChange}
        onEdit={handleDeviceEdit}
        onToggleSelection={toggleSelection}
      />

      <ClimateSection
        climates={climates}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onToggle={handlers.handleClimateToggle}
        onEdit={handleDeviceEdit}
        onToggleSelection={toggleSelection}
      />

      <CoversSection
        covers={covers}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onOpen={handlers.handleCoverOpen}
        onClose={handlers.handleCoverClose}
        onStop={handlers.handleCoverStop}
        onEdit={handleDeviceEdit}
        onToggleSelection={toggleSelection}
      />

      <FansSection
        fans={fans}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onToggle={handlers.handleFanToggle}
        onEdit={handleDeviceEdit}
        onToggleSelection={toggleSelection}
      />

      <DeviceEditModal
        device={editingDevice}
        rooms={allRooms}
        onClose={() => setEditingDevice(null)}
      />
    </div>
  )
}
