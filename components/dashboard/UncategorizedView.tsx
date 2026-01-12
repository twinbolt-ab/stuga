'use client'

import { useState, useMemo } from 'react'
import {
  Sparkles,
  Power,
  Pencil,
  ToggleLeft,
  SlidersHorizontal,
  Check,
  Fan,
  Blinds,
  ChevronUp,
  ChevronDown,
  Square,
  Thermometer,
  Package,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity, RoomWithDevices } from '@/types/ha'
import { LightSlider } from './LightSlider'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { DeviceEditModal } from './DeviceEditModal'
import { useHAConnection } from '@/lib/hooks/useHAConnection'
import { useUncategorizedEntities } from '@/lib/hooks/useUncategorizedEntities'
import { useEditMode } from '@/lib/contexts/EditModeContext'
import { haWebSocket } from '@/lib/ha-websocket'
import { t } from '@/lib/i18n'

// Helper to get display name from entity
function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

// Reusable section header
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
      {children}
    </h4>
  )
}

// Selection checkbox for devices
interface SelectionCheckboxProps {
  isSelected: boolean
  onToggle: () => void
}

function SelectionCheckbox({ isSelected, onToggle }: SelectionCheckboxProps) {
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

// Reusable toggle button for switches and input_booleans
interface ToggleButtonProps {
  entity: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onToggle: () => void
  onEdit: () => void
  onToggleSelection: () => void
  fallbackIcon: React.ReactNode
}

function ToggleButton({
  entity,
  isInEditMode,
  isSelected,
  onToggle,
  onEdit,
  onToggleSelection,
  fallbackIcon,
}: ToggleButtonProps) {
  const isOn = entity.state === 'on'
  const entityIcon = haWebSocket.getEntityIcon(entity.entity_id)

  return (
    <div
      className={clsx(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg',
        'transition-colors',
        isOn ? 'bg-accent/20' : 'bg-border/30',
        isInEditMode && 'ring-1 ring-accent/30',
        isSelected && 'ring-2 ring-accent'
      )}
    >
      {/* Edit mode controls: checkbox, pencil */}
      {isInEditMode && (
        <>
          <SelectionCheckbox isSelected={isSelected} onToggle={onToggleSelection} />
          <button
            onClick={onEdit}
            className="p-1 rounded-lg hover:bg-border/50 transition-colors"
          >
            <Pencil className="w-4 h-4 text-muted" />
          </button>
        </>
      )}
      {/* Clickable area */}
      <button
        onClick={isInEditMode ? undefined : onToggle}
        disabled={isInEditMode}
        className={clsx('flex-1 flex items-center gap-3', !isInEditMode && 'touch-feedback')}
      >
        {/* Icon on left */}
        {!isInEditMode && (
          <div
            className={clsx(
              'p-2 rounded-lg transition-colors flex-shrink-0',
              isOn ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
            )}
          >
            {entityIcon ? <MdiIcon icon={entityIcon} className="w-5 h-5" /> : fallbackIcon}
          </div>
        )}
        {/* Name */}
        <span
          className={clsx(
            'flex-1 text-sm font-medium truncate text-left',
            isOn ? 'text-foreground' : 'text-muted'
          )}
        >
          {getEntityDisplayName(entity)}
        </span>
        {/* State indicator on right */}
        <span className="text-xs text-muted">{isOn ? 'On' : 'Off'}</span>
      </button>
    </div>
  )
}

interface UncategorizedViewProps {
  allRooms: RoomWithDevices[]
}

export function UncategorizedView({ allRooms }: UncategorizedViewProps) {
  const { callService } = useHAConnection()
  const { uncategorizedByDomain, totalCount } = useUncategorizedEntities()

  // Get edit mode state from context
  const { isUncategorizedEditMode, isSelected, toggleSelection } = useEditMode()
  const isInEditMode = isUncategorizedEditMode

  const [editingDevice, setEditingDevice] = useState<HAEntity | null>(null)

  // Get entities by domain
  const lights = useMemo(() => uncategorizedByDomain.get('light') || [], [uncategorizedByDomain])
  const switches = useMemo(() => uncategorizedByDomain.get('switch') || [], [uncategorizedByDomain])
  const scenes = useMemo(() => uncategorizedByDomain.get('scene') || [], [uncategorizedByDomain])
  const inputBooleans = useMemo(
    () => uncategorizedByDomain.get('input_boolean') || [],
    [uncategorizedByDomain]
  )
  const inputNumbers = useMemo(
    () => uncategorizedByDomain.get('input_number') || [],
    [uncategorizedByDomain]
  )
  const climates = useMemo(() => uncategorizedByDomain.get('climate') || [], [uncategorizedByDomain])
  const covers = useMemo(() => uncategorizedByDomain.get('cover') || [], [uncategorizedByDomain])
  const fans = useMemo(() => uncategorizedByDomain.get('fan') || [], [uncategorizedByDomain])

  const handleDeviceEdit = (device: HAEntity) => {
    if (isInEditMode) {
      setEditingDevice(device)
    }
  }

  const handleSceneActivate = (scene: HAEntity) => {
    callService('scene', 'turn_on', { entity_id: scene.entity_id })
  }

  const handleSwitchToggle = (sw: HAEntity) => {
    const service = sw.state === 'on' ? 'turn_off' : 'turn_on'
    callService('switch', service, { entity_id: sw.entity_id })
  }

  const handleInputBooleanToggle = (input: HAEntity) => {
    const service = input.state === 'on' ? 'turn_off' : 'turn_on'
    callService('input_boolean', service, { entity_id: input.entity_id })
  }

  const handleInputNumberChange = (input: HAEntity, value: number) => {
    callService('input_number', 'set_value', { entity_id: input.entity_id, value })
  }

  const handleClimateToggle = (climate: HAEntity) => {
    const service = climate.state === 'off' ? 'turn_on' : 'turn_off'
    callService('climate', service, { entity_id: climate.entity_id })
  }

  const handleCoverOpen = (cover: HAEntity) => {
    callService('cover', 'open_cover', { entity_id: cover.entity_id })
  }

  const handleCoverClose = (cover: HAEntity) => {
    callService('cover', 'close_cover', { entity_id: cover.entity_id })
  }

  const handleCoverStop = (cover: HAEntity) => {
    callService('cover', 'stop_cover', { entity_id: cover.entity_id })
  }

  const handleFanToggle = (fan: HAEntity) => {
    const service = fan.state === 'on' ? 'turn_off' : 'turn_on'
    callService('fan', service, { entity_id: fan.entity_id })
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
          <h2 className="text-lg font-semibold text-foreground">{t.uncategorized.title}</h2>
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

      {/* Scenes */}
      {scenes.length > 0 && (
        <div className="mb-4">
          <SectionHeader>{t.devices.scenes}</SectionHeader>
          <div className="flex flex-wrap gap-2">
            {scenes.map((scene) => {
              const sceneIcon = haWebSocket.getEntityIcon(scene.entity_id)
              const sceneSelected = isSelected(scene.entity_id)
              return (
                <div
                  key={scene.entity_id}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-sm font-medium',
                    'bg-border/50 hover:bg-accent/20 hover:text-accent',
                    'transition-colors',
                    'flex items-center gap-1.5',
                    isInEditMode && 'ring-1 ring-accent/30',
                    sceneSelected && 'ring-2 ring-accent'
                  )}
                >
                  {isInEditMode ? (
                    <>
                      <SelectionCheckbox
                        isSelected={sceneSelected}
                        onToggle={() => toggleSelection(scene.entity_id)}
                      />
                      <button onClick={() => handleDeviceEdit(scene)} className="touch-feedback">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <span>{getEntityDisplayName(scene)}</span>
                    </>
                  ) : (
                    <button
                      onClick={() => handleSceneActivate(scene)}
                      className="flex items-center gap-1.5 touch-feedback"
                    >
                      {sceneIcon ? (
                        <MdiIcon icon={sceneIcon} className="w-3.5 h-3.5" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {getEntityDisplayName(scene)}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lights */}
      {lights.length > 0 && (
        <div className="mb-4">
          <SectionHeader>{t.devices.lights}</SectionHeader>
          <div className="space-y-1">
            {lights.map((light) => {
              const lightSelected = isSelected(light.entity_id)
              return (
                <div
                  key={light.entity_id}
                  className={clsx(
                    isInEditMode && 'flex items-center gap-2 bg-card rounded-lg pl-2 pr-1 ring-1 ring-accent/30',
                    lightSelected && 'ring-2 ring-accent'
                  )}
                >
                  {isInEditMode && (
                    <>
                      <SelectionCheckbox
                        isSelected={lightSelected}
                        onToggle={() => toggleSelection(light.entity_id)}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeviceEdit(light)
                        }}
                        className="p-1 rounded-lg hover:bg-border/50 transition-colors"
                      >
                        <Pencil className="w-4 h-4 text-muted" />
                      </button>
                    </>
                  )}
                  <div className={clsx(isInEditMode ? 'flex-1 min-w-0' : '')}>
                    <LightSlider light={light} disabled={isInEditMode} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Switches */}
      {switches.length > 0 && (
        <div className="mb-4">
          <SectionHeader>{t.devices.switches}</SectionHeader>
          <div className="space-y-1">
            {switches.map((sw) => (
              <ToggleButton
                key={sw.entity_id}
                entity={sw}
                isInEditMode={isInEditMode}
                isSelected={isSelected(sw.entity_id)}
                onToggle={() => handleSwitchToggle(sw)}
                onEdit={() => handleDeviceEdit(sw)}
                onToggleSelection={() => toggleSelection(sw.entity_id)}
                fallbackIcon={<Power className="w-5 h-5" />}
              />
            ))}
          </div>
        </div>
      )}

      {/* Input Booleans & Numbers */}
      {(inputBooleans.length > 0 || inputNumbers.length > 0) && (
        <div className="mb-4">
          <SectionHeader>{t.devices.inputs}</SectionHeader>
          <div className="space-y-1">
            {/* Input Booleans (toggles) */}
            {inputBooleans.map((input) => (
              <ToggleButton
                key={input.entity_id}
                entity={input}
                isInEditMode={isInEditMode}
                isSelected={isSelected(input.entity_id)}
                onToggle={() => handleInputBooleanToggle(input)}
                onEdit={() => handleDeviceEdit(input)}
                onToggleSelection={() => toggleSelection(input.entity_id)}
                fallbackIcon={<ToggleLeft className="w-5 h-5" />}
              />
            ))}

            {/* Input Numbers (sliders) */}
            {inputNumbers.map((input) => {
              const inputSelected = isSelected(input.entity_id)
              const value = parseFloat(input.state) || 0
              const min = typeof input.attributes.min === 'number' ? input.attributes.min : 0
              const max = typeof input.attributes.max === 'number' ? input.attributes.max : 100
              const step = typeof input.attributes.step === 'number' ? input.attributes.step : 1
              const unit =
                typeof input.attributes.unit_of_measurement === 'string'
                  ? input.attributes.unit_of_measurement
                  : ''
              const inputIcon = haWebSocket.getEntityIcon(input.entity_id)

              if (isInEditMode) {
                return (
                  <div
                    key={input.entity_id}
                    className={clsx(
                      'px-2 py-2 rounded-lg bg-border/30',
                      'ring-1 ring-accent/30',
                      inputSelected && 'ring-2 ring-accent'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <SelectionCheckbox
                        isSelected={inputSelected}
                        onToggle={() => toggleSelection(input.entity_id)}
                      />
                      <button
                        onClick={() => handleDeviceEdit(input)}
                        className="p-1 rounded-lg hover:bg-border/50 transition-colors"
                      >
                        <Pencil className="w-4 h-4 text-muted" />
                      </button>
                      <span className="flex-1 text-sm font-medium text-foreground truncate">
                        {getEntityDisplayName(input)}
                      </span>
                    </div>
                  </div>
                )
              }

              return (
                <div key={input.entity_id} className="px-2 py-2 rounded-lg bg-border/30">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-border/50 text-muted flex-shrink-0">
                      {inputIcon ? (
                        <MdiIcon icon={inputIcon} className="w-5 h-5" />
                      ) : (
                        <SlidersHorizontal className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground truncate">
                          {getEntityDisplayName(input)}
                        </span>
                        <span className="text-xs text-muted tabular-nums ml-2">
                          {value}
                          {unit}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => handleInputNumberChange(input, parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer accent-accent"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Climate */}
      {climates.length > 0 && (
        <div className="mb-4">
          <SectionHeader>{t.domains.climate}</SectionHeader>
          <div className="space-y-2">
            {climates.map((climate) => {
              const currentTemp = climate.attributes.current_temperature as number | undefined
              const targetTemp = climate.attributes.temperature as number | undefined
              const hvacMode = climate.state
              const isOff = hvacMode === 'off'
              const climateIcon = haWebSocket.getEntityIcon(climate.entity_id)
              const climateSelected = isSelected(climate.entity_id)

              if (isInEditMode) {
                return (
                  <div
                    key={climate.entity_id}
                    className={clsx(
                      'px-3 py-3 rounded-xl bg-border/30',
                      'ring-1 ring-accent/30',
                      climateSelected && 'ring-2 ring-accent'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <SelectionCheckbox
                        isSelected={climateSelected}
                        onToggle={() => toggleSelection(climate.entity_id)}
                      />
                      <button
                        onClick={() => handleDeviceEdit(climate)}
                        className="p-1 rounded-lg hover:bg-border/50 transition-colors"
                      >
                        <Pencil className="w-4 h-4 text-muted" />
                      </button>
                      <span className="flex-1 text-sm font-medium text-foreground truncate">
                        {getEntityDisplayName(climate)}
                      </span>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={climate.entity_id}
                  className={clsx(
                    'px-3 py-3 rounded-xl transition-colors',
                    isOff ? 'bg-border/30' : 'bg-accent/10'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div
                      className={clsx(
                        'p-2 rounded-lg transition-colors flex-shrink-0',
                        isOff ? 'bg-border/50 text-muted' : 'bg-accent/20 text-accent'
                      )}
                    >
                      {climateIcon ? (
                        <MdiIcon icon={climateIcon} className="w-5 h-5" />
                      ) : (
                        <Thermometer className="w-5 h-5" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {getEntityDisplayName(climate)}
                        </span>
                        {!isOff && (
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                              hvacMode === 'heat' && 'bg-orange-500/20 text-orange-500',
                              hvacMode === 'cool' && 'bg-blue-500/20 text-blue-500',
                              hvacMode === 'heat_cool' && 'bg-purple-500/20 text-purple-500',
                              hvacMode === 'auto' && 'bg-green-500/20 text-green-500',
                              !['heat', 'cool', 'heat_cool', 'auto'].includes(hvacMode) &&
                                'bg-accent/20 text-accent'
                            )}
                          >
                            {hvacMode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted">
                        {currentTemp !== undefined && <span>Current: {currentTemp}°</span>}
                        {targetTemp !== undefined && !isOff && <span>Target: {targetTemp}°</span>}
                      </div>
                    </div>

                    {/* Power toggle */}
                    <button
                      onClick={() => handleClimateToggle(climate)}
                      className={clsx(
                        'p-2 rounded-lg transition-colors touch-feedback',
                        isOff ? 'bg-border/50 text-muted' : 'bg-accent text-white'
                      )}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Covers */}
      {covers.length > 0 && (
        <div className="mb-4">
          <SectionHeader>{t.domains.cover}</SectionHeader>
          <div className="space-y-1">
            {covers.map((cover) => {
              const isOpen = cover.state === 'open'
              const isClosed = cover.state === 'closed'
              const coverIcon = haWebSocket.getEntityIcon(cover.entity_id)
              const coverSelected = isSelected(cover.entity_id)

              if (isInEditMode) {
                return (
                  <div
                    key={cover.entity_id}
                    className={clsx(
                      'w-full flex items-center gap-2 px-2 py-2 rounded-lg bg-border/30',
                      'ring-1 ring-accent/30',
                      coverSelected && 'ring-2 ring-accent'
                    )}
                  >
                    <SelectionCheckbox
                      isSelected={coverSelected}
                      onToggle={() => toggleSelection(cover.entity_id)}
                    />
                    <button
                      onClick={() => handleDeviceEdit(cover)}
                      className="p-1 rounded-lg hover:bg-border/50 transition-colors"
                    >
                      <Pencil className="w-4 h-4 text-muted" />
                    </button>
                    <span className="flex-1 text-sm font-medium text-foreground truncate">
                      {getEntityDisplayName(cover)}
                    </span>
                  </div>
                )
              }

              return (
                <div
                  key={cover.entity_id}
                  className={clsx(
                    'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors',
                    isOpen ? 'bg-accent/20' : 'bg-border/30'
                  )}
                >
                  {/* Icon */}
                  <div
                    className={clsx(
                      'p-2 rounded-lg transition-colors flex-shrink-0',
                      isOpen ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
                    )}
                  >
                    {coverIcon ? (
                      <MdiIcon icon={coverIcon} className="w-5 h-5" />
                    ) : (
                      <Blinds className="w-5 h-5" />
                    )}
                  </div>

                  {/* Name */}
                  <span
                    className={clsx(
                      'flex-1 text-sm font-medium truncate',
                      isOpen ? 'text-foreground' : 'text-muted'
                    )}
                  >
                    {getEntityDisplayName(cover)}
                  </span>

                  {/* State */}
                  <span className="text-xs text-muted capitalize">{cover.state}</span>

                  {/* Control buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCoverOpen(cover)}
                      disabled={isOpen}
                      className={clsx(
                        'p-1.5 rounded-lg transition-colors touch-feedback',
                        isOpen
                          ? 'text-muted/50'
                          : 'bg-border/50 text-foreground hover:bg-accent/20'
                      )}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCoverStop(cover)}
                      className="p-1.5 rounded-lg bg-border/50 text-foreground hover:bg-accent/20 transition-colors touch-feedback"
                    >
                      <Square className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleCoverClose(cover)}
                      disabled={isClosed}
                      className={clsx(
                        'p-1.5 rounded-lg transition-colors touch-feedback',
                        isClosed
                          ? 'text-muted/50'
                          : 'bg-border/50 text-foreground hover:bg-accent/20'
                      )}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Fans */}
      {fans.length > 0 && (
        <div className="mb-4">
          <SectionHeader>{t.domains.fan}</SectionHeader>
          <div className="space-y-1">
            {fans.map((fan) => {
              const isOn = fan.state === 'on'
              const percentage = fan.attributes.percentage as number | undefined
              const fanIcon = haWebSocket.getEntityIcon(fan.entity_id)
              const fanSelected = isSelected(fan.entity_id)

              if (isInEditMode) {
                return (
                  <ToggleButton
                    key={fan.entity_id}
                    entity={fan}
                    isInEditMode={isInEditMode}
                    isSelected={fanSelected}
                    onToggle={() => handleFanToggle(fan)}
                    onEdit={() => handleDeviceEdit(fan)}
                    onToggleSelection={() => toggleSelection(fan.entity_id)}
                    fallbackIcon={<Fan className="w-5 h-5" />}
                  />
                )
              }

              return (
                <div
                  key={fan.entity_id}
                  className={clsx(
                    'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors',
                    isOn ? 'bg-accent/20' : 'bg-border/30'
                  )}
                >
                  {/* Icon */}
                  <div
                    className={clsx(
                      'p-2 rounded-lg transition-colors flex-shrink-0',
                      isOn ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
                    )}
                  >
                    {fanIcon ? <MdiIcon icon={fanIcon} className="w-5 h-5" /> : <Fan className="w-5 h-5" />}
                  </div>

                  {/* Clickable area */}
                  <button
                    onClick={() => handleFanToggle(fan)}
                    className="flex-1 flex items-center gap-3 touch-feedback"
                  >
                    {/* Name */}
                    <span
                      className={clsx(
                        'flex-1 text-sm font-medium truncate text-left',
                        isOn ? 'text-foreground' : 'text-muted'
                      )}
                    >
                      {getEntityDisplayName(fan)}
                    </span>

                    {/* Speed indicator */}
                    {isOn && percentage !== undefined && (
                      <span className="text-xs text-accent font-medium">{percentage}%</span>
                    )}

                    {/* State indicator */}
                    <span className="text-xs text-muted">{isOn ? 'On' : 'Off'}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <DeviceEditModal device={editingDevice} rooms={allRooms} onClose={() => setEditingDevice(null)} />
    </div>
  )
}
