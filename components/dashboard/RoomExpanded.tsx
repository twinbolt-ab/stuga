'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, Reorder } from 'framer-motion'
import { Thermometer, Droplets, Sparkles, GripVertical, Power, Pencil, ToggleLeft, SlidersHorizontal, Check } from 'lucide-react'
import { clsx } from 'clsx'
import type { RoomWithDevices, HAEntity } from '@/types/ha'
import { LightSlider } from './LightSlider'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { DeviceEditModal } from './DeviceEditModal'
import { useHAConnection } from '@/lib/hooks/useHAConnection'
import { useDeviceOrder } from '@/lib/hooks/useDeviceOrder'
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
        'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
        isSelected
          ? 'bg-accent border-accent text-white'
          : 'border-border bg-transparent'
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

function ToggleButton({ entity, isInEditMode, isSelected, onToggle, onEdit, onToggleSelection, fallbackIcon }: ToggleButtonProps) {
  const isOn = entity.state === 'on'
  const entityIcon = haWebSocket.getEntityIcon(entity.entity_id)

  return (
    <div
      className={clsx(
        'w-full flex items-center gap-3 px-2 py-2 rounded-lg',
        'transition-colors',
        isOn ? 'bg-accent/20' : 'bg-border/30',
        isInEditMode && 'ring-1 ring-accent/30',
        isSelected && 'ring-2 ring-accent'
      )}
    >
      {/* Selection checkbox in edit mode */}
      {isInEditMode && (
        <SelectionCheckbox isSelected={isSelected} onToggle={onToggleSelection} />
      )}
      {/* Clickable area */}
      <button
        onClick={isInEditMode ? onEdit : onToggle}
        className="flex-1 flex items-center gap-3 touch-feedback"
      >
        {/* Icon on left */}
        <div className={clsx(
          'p-2 rounded-lg transition-colors flex-shrink-0',
          isOn ? 'bg-accent/20 text-accent' : 'bg-border/50 text-muted'
        )}>
          {isInEditMode ? (
            <Pencil className="w-5 h-5" />
          ) : entityIcon ? (
            <MdiIcon icon={entityIcon} className="w-5 h-5" />
          ) : (
            fallbackIcon
          )}
        </div>
        {/* Name */}
        <span className={clsx(
          'flex-1 text-sm font-medium truncate text-left',
          isOn ? 'text-foreground' : 'text-muted'
        )}>
          {getEntityDisplayName(entity)}
        </span>
        {/* State indicator on right */}
        <span className="text-xs text-muted">
          {isOn ? 'On' : 'Off'}
        </span>
      </button>
    </div>
  )
}

interface RoomExpandedProps {
  room: RoomWithDevices
  allRooms: RoomWithDevices[]
}

export function RoomExpanded({ room, allRooms }: RoomExpandedProps) {
  const { callService } = useHAConnection()
  const { sortDevicesByOrder, reorderDevices } = useDeviceOrder()

  // Get edit mode state from context
  const {
    isDeviceEditMode,
    isSelected,
    toggleSelection,
  } = useEditMode()

  // This room is in device edit mode
  const isInEditMode = isDeviceEditMode

  // Filter and sort devices by type and order
  const lights = useMemo(
    () => sortDevicesByOrder(room.devices.filter((d) => d.entity_id.startsWith('light.'))),
    [room.devices, sortDevicesByOrder]
  )
  const switches = useMemo(
    () => room.devices.filter((d) => d.entity_id.startsWith('switch.')),
    [room.devices]
  )
  const scenes = useMemo(
    () => room.devices.filter((d) => d.entity_id.startsWith('scene.')),
    [room.devices]
  )
  const inputBooleans = useMemo(
    () => room.devices.filter((d) => d.entity_id.startsWith('input_boolean.')),
    [room.devices]
  )
  const inputNumbers = useMemo(
    () => room.devices.filter((d) => d.entity_id.startsWith('input_number.')),
    [room.devices]
  )

  const [orderedLights, setOrderedLights] = useState<HAEntity[]>(lights)
  const [editingDevice, setEditingDevice] = useState<HAEntity | null>(null)

  // Sync orderedLights when lights change or reorder mode changes
  useEffect(() => {
    setOrderedLights(lights)
  }, [lights, isInEditMode])

  const handleDeviceEdit = (device: HAEntity) => {
    if (isInEditMode) {
      setEditingDevice(device)
    }
  }

  // Save order when reorder mode exits
  const handleReorder = useCallback(async (newOrder: HAEntity[]) => {
    setOrderedLights(newOrder)

    // Find which item moved and save
    const originalOrder = lights.map((l, i) => ({ entity_id: l.entity_id, index: i }))
    for (let i = 0; i < newOrder.length; i++) {
      const original = originalOrder.find(o => o.entity_id === newOrder[i].entity_id)
      if (original && original.index !== i) {
        await reorderDevices(lights, original.index, i)
        break
      }
    }
  }, [lights, reorderDevices])

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

  // Remove room name from scene name if present
  const getSceneDisplayName = (scene: HAEntity) => {
    const name = getEntityDisplayName(scene)
    const nameLower = name.toLowerCase()
    const roomNameLower = room.name.toLowerCase()

    if (nameLower.startsWith(roomNameLower)) {
      return name.slice(room.name.length).trim() || name
    }
    return name
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div
        className="pt-3 mt-3 border-t border-border max-h-[60vh] overflow-y-auto scroll-smooth pb-1 px-0.5 -mx-0.5 overscroll-contain"
        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
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
                    {isInEditMode && (
                      <SelectionCheckbox
                        isSelected={sceneSelected}
                        onToggle={() => toggleSelection(scene.entity_id)}
                      />
                    )}
                    <button
                      onClick={() => isInEditMode ? handleDeviceEdit(scene) : handleSceneActivate(scene)}
                      className="flex items-center gap-1.5 touch-feedback"
                    >
                      {isInEditMode ? (
                        <Pencil className="w-3.5 h-3.5" />
                      ) : sceneIcon ? (
                        <MdiIcon icon={sceneIcon} className="w-3.5 h-3.5" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {getSceneDisplayName(scene)}
                    </button>
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
            {isInEditMode ? (
              <Reorder.Group
                axis="y"
                values={orderedLights}
                onReorder={handleReorder}
                className="space-y-1"
              >
                {orderedLights.map((light) => {
                  const lightSelected = isSelected(light.entity_id)
                  return (
                    <Reorder.Item
                      key={light.entity_id}
                      value={light}
                      className={clsx(
                        'flex items-center gap-2 cursor-grab active:cursor-grabbing bg-card rounded-lg pl-2 ring-1 ring-accent/30',
                        lightSelected && 'ring-2 ring-accent'
                      )}
                      whileDrag={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    >
                      <SelectionCheckbox
                        isSelected={lightSelected}
                        onToggle={() => toggleSelection(light.entity_id)}
                      />
                      <GripVertical className="w-4 h-4 text-muted flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <LightSlider light={light} disabled />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeviceEdit(light)
                        }}
                        className="p-2 mr-1 rounded-lg hover:bg-border/50 transition-colors"
                      >
                        <Pencil className="w-4 h-4 text-muted" />
                      </button>
                    </Reorder.Item>
                  )
                })}
              </Reorder.Group>
            ) : (
              <div className="space-y-1">
                {lights.map((light) => (
                  <LightSlider key={light.entity_id} light={light} />
                ))}
              </div>
            )}
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
                const value = parseFloat(input.state) || 0
                const min = typeof input.attributes.min === 'number' ? input.attributes.min : 0
                const max = typeof input.attributes.max === 'number' ? input.attributes.max : 100
                const step = typeof input.attributes.step === 'number' ? input.attributes.step : 1
                const unit = typeof input.attributes.unit_of_measurement === 'string' ? input.attributes.unit_of_measurement : ''
                const inputIcon = haWebSocket.getEntityIcon(input.entity_id)
                const inputSelected = isSelected(input.entity_id)
                return (
                  <div
                    key={input.entity_id}
                    className={clsx(
                      'px-2 py-2 rounded-lg bg-border/30',
                      isInEditMode && 'ring-1 ring-accent/30',
                      inputSelected && 'ring-2 ring-accent'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Selection checkbox in multi-select mode */}
                      {isInEditMode && (
                        <SelectionCheckbox
                          isSelected={inputSelected}
                          onToggle={() => toggleSelection(input.entity_id)}
                        />
                      )}
                      {/* Icon on left */}
                      <div
                        className="p-2 rounded-lg bg-border/50 text-muted flex-shrink-0 cursor-pointer"
                        onClick={isInEditMode ? () => handleDeviceEdit(input) : undefined}
                      >
                        {isInEditMode ? (
                          <Pencil className="w-5 h-5" />
                        ) : inputIcon ? (
                          <MdiIcon icon={inputIcon} className="w-5 h-5" />
                        ) : (
                          <SlidersHorizontal className="w-5 h-5" />
                        )}
                      </div>
                      {/* Name and slider */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {getEntityDisplayName(input)}
                          </span>
                          <span className="text-xs text-muted tabular-nums ml-2">
                            {value}{unit}
                          </span>
                        </div>
                        {!isInEditMode && (
                          <input
                            type="range"
                            min={min}
                            max={max}
                            step={step}
                            value={value}
                            onChange={(e) => handleInputNumberChange(input, parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer accent-accent"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Sensors */}
        {(room.temperature !== undefined || room.humidity !== undefined) && (
          <div className="flex items-center gap-4 text-sm text-muted pt-2">
            {room.temperature !== undefined && (
              <span className="flex items-center gap-1.5">
                <Thermometer className="w-4 h-4" />
                {room.temperature.toFixed(1)}°C
              </span>
            )}
            {room.humidity !== undefined && (
              <span className="flex items-center gap-1.5">
                <Droplets className="w-4 h-4" />
                {room.humidity}%
              </span>
            )}
          </div>
        )}

        {/* Empty state */}
        {lights.length === 0 && switches.length === 0 && scenes.length === 0 && inputBooleans.length === 0 && inputNumbers.length === 0 && (
          <p className="text-sm text-muted py-2">
            {t.rooms.noDevices}
          </p>
        )}
      </div>

      <DeviceEditModal
        device={editingDevice}
        rooms={allRooms}
        onClose={() => setEditingDevice(null)}
      />
    </motion.div>
  )
}
