import { useMemo, useCallback } from 'react'
import { Layers, EyeOff, Home } from 'lucide-react'
import { clsx } from 'clsx'
import { useAllEntities, type FilterType } from '@/lib/hooks/useAllEntities'
import { useEditMode } from '@/lib/contexts/EditModeContext'
import { useDeviceHandlers } from '@/lib/hooks/useDeviceHandlers'
import { SearchInput } from '@/components/ui/SearchInput'
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

export function AllDevicesView() {
  const {
    entitiesByDomain,
    entityMeta,
    totalCount,
    filteredCount,
    hiddenCount,
    noRoomCount,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
  } = useAllEntities()
  const handlers = useDeviceHandlers()

  // Get edit mode state from context
  const { isAllDevicesEditMode, isSelected, toggleSelection, enterAllDevicesEdit } = useEditMode()
  const isInEditMode = isAllDevicesEditMode

  // Enter edit mode and select the device (for long-press)
  const handleEnterEditModeWithSelection = useCallback(
    (deviceId: string) => {
      enterAllDevicesEdit(deviceId)
    },
    [enterAllDevicesEdit]
  )

  // Get entities by domain
  const lights = useMemo(() => entitiesByDomain.get('light') || [], [entitiesByDomain])
  const switches = useMemo(() => entitiesByDomain.get('switch') || [], [entitiesByDomain])
  const scenes = useMemo(() => entitiesByDomain.get('scene') || [], [entitiesByDomain])
  const inputBooleans = useMemo(
    () => entitiesByDomain.get('input_boolean') || [],
    [entitiesByDomain]
  )
  const inputNumbers = useMemo(() => entitiesByDomain.get('input_number') || [], [entitiesByDomain])
  const climates = useMemo(() => entitiesByDomain.get('climate') || [], [entitiesByDomain])
  const covers = useMemo(() => entitiesByDomain.get('cover') || [], [entitiesByDomain])
  const fans = useMemo(() => entitiesByDomain.get('fan') || [], [entitiesByDomain])

  const isEmpty =
    lights.length === 0 &&
    switches.length === 0 &&
    scenes.length === 0 &&
    inputBooleans.length === 0 &&
    inputNumbers.length === 0 &&
    climates.length === 0 &&
    covers.length === 0 &&
    fans.length === 0

  // Build subtitle text
  const subtitleParts: string[] = []
  subtitleParts.push(`${totalCount} ${totalCount === 1 ? 'device' : 'devices'}`)
  if (activeFilter !== 'all') {
    subtitleParts.push(`${filteredCount} shown`)
  }
  const subtitle = subtitleParts.join(' · ')

  // Filter button config
  const filters: { id: FilterType; label: string; count: number; icon: typeof EyeOff }[] = [
    { id: 'hidden', label: t.allDevices.filterHidden, count: hiddenCount, icon: EyeOff },
    { id: 'no-room', label: t.allDevices.filterNoRoom, count: noRoomCount, icon: Home },
  ]

  return (
    <div className="space-y-4">
      {/* Sticky header with search and filters */}
      <div className="sticky -top-4 z-10 -mx-4 px-4 pt-4 pb-3 bg-background/95 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-xl bg-accent/10">
            <Layers className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t.allDevices.title}</h2>
            <p className="text-sm text-muted">{subtitle}</p>
          </div>
        </div>

        {/* Search */}
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t.allDevices.searchPlaceholder}
        />

        {/* Filter buttons */}
        <div className="flex gap-2 mt-3">
          {filters.map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveFilter(activeFilter === id ? 'all' : id)
              }}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                activeFilter === id
                  ? 'bg-accent text-white'
                  : 'bg-border/50 text-muted hover:text-foreground hover:bg-border'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={clsx(
                    'ml-0.5 px-1.5 py-0.5 text-xs rounded-full',
                    activeFilter === id ? 'bg-white/20' : 'bg-border'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="card p-8 text-center">
          <p className="text-muted">
            {searchQuery || activeFilter !== 'all' ? t.allDevices.noResults : t.allDevices.empty}
          </p>
        </div>
      )}

      <ScenesSection
        scenes={scenes}
        entityMeta={entityMeta}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onActivate={handlers.handleSceneActivate}
        onToggleSelection={toggleSelection}
        onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
      />

      <LightsSection
        lights={lights}
        entityMeta={entityMeta}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onToggleSelection={toggleSelection}
        onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
        singleColumn
      />

      <SwitchesSection
        switches={switches}
        entityMeta={entityMeta}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onToggle={handlers.handleSwitchToggle}
        onToggleSelection={toggleSelection}
        onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
      />

      <InputsSection
        inputBooleans={inputBooleans}
        inputNumbers={inputNumbers}
        entityMeta={entityMeta}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onBooleanToggle={handlers.handleInputBooleanToggle}
        onNumberChange={handlers.handleInputNumberChange}
        onToggleSelection={toggleSelection}
        onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
      />

      <ClimateSection
        climates={climates}
        entityMeta={entityMeta}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onToggle={handlers.handleClimateToggle}
        onToggleSelection={toggleSelection}
        onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
      />

      <CoversSection
        covers={covers}
        entityMeta={entityMeta}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onOpen={handlers.handleCoverOpen}
        onClose={handlers.handleCoverClose}
        onStop={handlers.handleCoverStop}
        onToggleSelection={toggleSelection}
        onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
      />

      <FansSection
        fans={fans}
        entityMeta={entityMeta}
        isInEditMode={isInEditMode}
        isSelected={isSelected}
        onToggle={handlers.handleFanToggle}
        onToggleSelection={toggleSelection}
        onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
      />
    </div>
  )
}
