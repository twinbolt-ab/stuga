import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { RoomWithDevices, HAEntity } from '@/types/ha'
import { DeviceEditModal } from './DeviceEditModal'
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
}

export function RoomExpanded({ room, allRooms }: RoomExpandedProps) {
  const { enabledDomains } = useEnabledDomains()
  const handlers = useDeviceHandlers()

  // Get edit mode state from context
  const { isDeviceEditMode, isSelected, toggleSelection } = useEditMode()
  const isInEditMode = isDeviceEditMode

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

  const [editingDevice, setEditingDevice] = useState<HAEntity | null>(null)
  const [maxHeight, setMaxHeight] = useState<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Calculate available height based on position
  useEffect(() => {
    if (contentRef.current) {
      const calculateHeight = () => {
        const rect = contentRef.current?.getBoundingClientRect()
        if (!rect) return

        // Available height = viewport height - top of content - bottom padding (nav bar ~80px)
        const bottomPadding = 80
        const available = window.innerHeight - rect.top - bottomPadding
        setMaxHeight(Math.max(200, available)) // Minimum 200px
      }

      // Calculate after animation settles
      const timer = setTimeout(calculateHeight, 50)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDeviceEdit = (device: HAEntity) => {
    if (isInEditMode) {
      setEditingDevice(device)
    }
  }

  // Remove room name from scene name if present
  const getSceneDisplayName = useCallback(
    (scene: HAEntity) => {
      const name = getEntityDisplayName(scene)
      const nameLower = name.toLowerCase()
      const roomNameLower = room.name.toLowerCase()

      if (nameLower.startsWith(roomNameLower)) {
        return name.slice(room.name.length).trim() || name
      }
      return name
    },
    [room.name]
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

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div
        ref={contentRef}
        className="pt-3 mt-3 border-t border-border overflow-y-auto scroll-smooth pb-1 px-0.5 -mx-0.5 overscroll-contain"
        style={{
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          maxHeight: maxHeight ? `${maxHeight}px` : '60vh',
        }}
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
          onEdit={handleDeviceEdit}
          onToggleSelection={toggleSelection}
          getDisplayName={getSceneDisplayName}
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

        <SensorsDisplay
          temperatureSensors={temperatureSensors}
          humiditySensors={humiditySensors}
        />

        {/* Empty state */}
        {!hasDevices && (
          <p className="text-sm text-muted py-2">{t.rooms.noDevices}</p>
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
