import { useMemo, useCallback, useRef, useState, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import type { RoomWithDevices, HAEntity } from '@/types/ha'
import { useEditMode } from '@/lib/contexts/EditModeContext'
import { useEnabledDomains } from '@/lib/hooks/useEnabledDomains'
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
  SensorsDisplay,
} from '@/components/devices'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface RoomExpandedProps {
  room: RoomWithDevices
  allRooms: RoomWithDevices[]
  isExpanded: boolean
}

export function RoomExpanded({ room, allRooms, isExpanded }: RoomExpandedProps) {
  const { enabledDomains } = useEnabledDomains()
  const handlers = useDeviceHandlers()
  const contentRef = useRef<HTMLDivElement>(null)
  const [measuredHeight, setMeasuredHeight] = useState(0)

  // Get edit mode state from context
  const { isDeviceEditMode, isSelected, toggleSelection, enterDeviceEdit } = useEditMode()
  const isInEditMode = isDeviceEditMode

  // Enter device edit mode and select the device
  const handleEnterEditModeWithSelection = useCallback((deviceId: string) => {
    enterDeviceEdit(room.id, deviceId)
  }, [enterDeviceEdit, room.id])

  // Filter devices by type (only show enabled domains)
  const lights = useMemo(
    () =>
      enabledDomains.includes('light')
        ? room.devices.filter((d) => d.entity_id.startsWith('light.'))
        : [],
    [room.devices, enabledDomains]
  )
  const switches = useMemo(
    () =>
      enabledDomains.includes('switch')
        ? room.devices.filter((d) => d.entity_id.startsWith('switch.'))
        : [],
    [room.devices, enabledDomains]
  )
  const scenes = useMemo(
    () =>
      enabledDomains.includes('scene')
        ? room.devices.filter((d) => d.entity_id.startsWith('scene.'))
        : [],
    [room.devices, enabledDomains]
  )
  const inputBooleans = useMemo(
    () =>
      enabledDomains.includes('input_boolean')
        ? room.devices.filter((d) => d.entity_id.startsWith('input_boolean.'))
        : [],
    [room.devices, enabledDomains]
  )
  const inputNumbers = useMemo(
    () =>
      enabledDomains.includes('input_number')
        ? room.devices.filter((d) => d.entity_id.startsWith('input_number.'))
        : [],
    [room.devices, enabledDomains]
  )
  const climates = useMemo(
    () =>
      enabledDomains.includes('climate')
        ? room.devices.filter((d) => d.entity_id.startsWith('climate.'))
        : [],
    [room.devices, enabledDomains]
  )
  const covers = useMemo(
    () =>
      enabledDomains.includes('cover')
        ? room.devices.filter((d) => d.entity_id.startsWith('cover.'))
        : [],
    [room.devices, enabledDomains]
  )
  const fans = useMemo(
    () =>
      enabledDomains.includes('fan')
        ? room.devices.filter((d) => d.entity_id.startsWith('fan.'))
        : [],
    [room.devices, enabledDomains]
  )

  // Temperature and humidity sensors for display
  const temperatureSensors = useMemo(
    () =>
      room.devices
        .filter(
          (d) =>
            d.entity_id.startsWith('sensor.') &&
            d.attributes.device_class === 'temperature'
        )
        .filter((d) => !isNaN(parseFloat(d.state))),
    [room.devices]
  )
  const humiditySensors = useMemo(
    () =>
      room.devices
        .filter(
          (d) =>
            d.entity_id.startsWith('sensor.') &&
            d.attributes.device_class === 'humidity'
        )
        .filter((d) => !isNaN(parseFloat(d.state))),
    [room.devices]
  )



  const hasDevices =
    lights.length > 0 ||
    switches.length > 0 ||
    scenes.length > 0 ||
    inputBooleans.length > 0 ||
    inputNumbers.length > 0 ||
    climates.length > 0 ||
    covers.length > 0 ||
    fans.length > 0

  // Measure content height whenever it might change
  useLayoutEffect(() => {
    if (contentRef.current) {
      setMeasuredHeight(contentRef.current.scrollHeight)
    }
  }, [lights, switches, scenes, inputBooleans, inputNumbers, climates, covers, fans, hasDevices])

  return (
    <div
      style={{
        height: isExpanded ? measuredHeight : 0,
        overflow: 'hidden',
        transition: `height 0.2s cubic-bezier(0.25, 0.1, 0.25, 1) ${isExpanded ? '0.12s' : '0s'}`,
      }}
    >
      <motion.div
        ref={contentRef}
        initial={false}
        animate={{ opacity: isExpanded ? 1 : 0 }}
        transition={{
          duration: 0.15,
          ease: isExpanded ? 'easeOut' : 'easeIn',
          delay: isExpanded ? 0.12 : 0,
        }}
        className="pt-3 mt-3 border-t border-border pb-1 px-0.5 -mx-0.5"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <ScenesSection
          scenes={scenes}
          isInEditMode={isInEditMode}
          isSelected={isSelected}
          onActivate={handlers.handleSceneActivate}
          onToggleSelection={toggleSelection}
          onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
          getDisplayName={getEntityDisplayName}
        />

        <LightsSection
          lights={lights}
          isInEditMode={isInEditMode}
          isSelected={isSelected}
          onToggleSelection={toggleSelection}
          onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
        />

        <SwitchesSection
          switches={switches}
          isInEditMode={isInEditMode}
          isSelected={isSelected}
          onToggle={handlers.handleSwitchToggle}
          onToggleSelection={toggleSelection}
          onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
        />

        <InputsSection
          inputBooleans={inputBooleans}
          inputNumbers={inputNumbers}
          isInEditMode={isInEditMode}
          isSelected={isSelected}
          onBooleanToggle={handlers.handleInputBooleanToggle}
          onNumberChange={handlers.handleInputNumberChange}
          onToggleSelection={toggleSelection}
          onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
        />

        <ClimateSection
          climates={climates}
          isInEditMode={isInEditMode}
          isSelected={isSelected}
          onToggle={handlers.handleClimateToggle}
          onToggleSelection={toggleSelection}
          onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
        />

        <CoversSection
          covers={covers}
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
          isInEditMode={isInEditMode}
          isSelected={isSelected}
          onToggle={handlers.handleFanToggle}
          onToggleSelection={toggleSelection}
          onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
        />

        <SensorsDisplay
          temperatureSensors={temperatureSensors}
          humiditySensors={humiditySensors}
          isInEditMode={isInEditMode}
          isSelected={isSelected}
          onToggleSelection={toggleSelection}
          onEnterEditModeWithSelection={handleEnterEditModeWithSelection}
        />

        {/* Empty state */}
        {!hasDevices && (
          <p className="text-sm text-muted py-2">{t.rooms.noDevices}</p>
        )}
      </motion.div>
    </div>
  )
}
