import { useState, useMemo } from 'react'
import { ToggleLeft, SlidersHorizontal } from 'lucide-react'
import { clsx } from 'clsx'
import type { HAEntity } from '@/types/ha'
import type { DomainOrderMap } from '@/types/ordering'
import { MdiIcon } from '@/components/ui/MdiIcon'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox'
import { DeviceToggleButton } from '@/components/ui/DeviceToggleButton'
import { EntityBadges } from '@/components/ui/EntityBadge'
import { getEntityIcon } from '@/lib/ha-websocket'
import { useLongPress } from '@/lib/hooks/useLongPress'
import { sortEntitiesByOrder } from '@/lib/utils/entity-sort'
import { ReorderableList } from '@/components/dashboard/ReorderableList'
import { t } from '@/lib/i18n'
import type { EntityMeta } from '@/lib/hooks/useAllEntities'

function getEntityDisplayName(entity: HAEntity): string {
  return entity.attributes.friendly_name || entity.entity_id.split('.')[1]
}

interface InputsSectionProps {
  inputBooleans: HAEntity[]
  inputNumbers: HAEntity[]
  isInEditMode: boolean
  isSelected: (id: string) => boolean
  onBooleanToggle: (device: HAEntity) => void
  onNumberChange: (device: HAEntity, value: number) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  entityMeta?: Map<string, EntityMeta>
  entityOrder?: DomainOrderMap
  onReorderEntities?: (entities: HAEntity[]) => Promise<void>
  /** Selected entity IDs for multi-drag support in edit mode */
  selectedIds?: Set<string>
}

function InputNumberItem({
  input,
  isInEditMode,
  isSelected,
  onNumberChange,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
  isReorderSelected = false,
}: {
  input: HAEntity
  isInEditMode: boolean
  isSelected: boolean
  onNumberChange: (device: HAEntity, value: number) => void
  onToggleSelection: (id: string) => void
  onEnterEditModeWithSelection?: (deviceId: string) => void
  entityMeta?: EntityMeta
  isReorderSelected?: boolean
}) {
  const entityValue = parseFloat(input.state) || 0
  const min = typeof input.attributes.min === 'number' ? input.attributes.min : 0
  const max = typeof input.attributes.max === 'number' ? input.attributes.max : 100
  const step = typeof input.attributes.step === 'number' ? input.attributes.step : 1
  const unit =
    typeof input.attributes.unit_of_measurement === 'string'
      ? input.attributes.unit_of_measurement
      : ''
  const inputIcon = getEntityIcon(input.entity_id)

  // Use local state while dragging to prevent flickering from HA state updates
  const [localOverride, setLocalOverride] = useState<number | null>(null)
  const localValue = localOverride ?? entityValue

  const longPress = useLongPress({
    duration: 500,
    disabled: isInEditMode,
    onLongPress: () => onEnterEditModeWithSelection?.(input.entity_id),
  })

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    setLocalOverride(newValue)
  }

  const handleSliderEnd = () => {
    // Only call onNumberChange when drag ends
    if (localValue !== entityValue) {
      onNumberChange(input, localValue)
    }
    setLocalOverride(null)
  }

  if (isInEditMode) {
    return (
      <button
        data-entity-id={input.entity_id}
        onClick={() => {
          onToggleSelection(input.entity_id)
        }}
        className={clsx(
          'w-full px-2 py-2 rounded-lg bg-border/30 touch-feedback transition-all',
          isSelected && 'ring-2 ring-inset ring-accent'
        )}
      >
        <div className="flex items-center gap-2">
          <SelectionCheckbox isSelected={isSelected} />
          <div className="p-2 rounded-lg bg-border/50 text-muted flex-shrink-0">
            {inputIcon ? (
              <MdiIcon icon={inputIcon} className="w-5 h-5" />
            ) : (
              <SlidersHorizontal className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium text-foreground truncate text-left">
              {getEntityDisplayName(input)}
            </span>
            {entityMeta && (
              <EntityBadges
                isHiddenInStuga={entityMeta.isHiddenInStuga}
                isHiddenInHA={entityMeta.isHiddenInHA}
                hasRoom={entityMeta.hasRoom}
                className="flex-shrink-0"
              />
            )}
          </div>
          {entityMeta?.roomName && (
            <span className="text-sm text-muted truncate w-20 text-right">
              {entityMeta.roomName}
            </span>
          )}
        </div>
      </button>
    )
  }

  return (
    <div
      data-entity-id={input.entity_id}
      className={clsx(
        'px-2 py-2 rounded-lg bg-border/30 transition-all',
        isReorderSelected && 'ring-2 ring-accent ring-offset-1 ring-offset-bg-primary'
      )}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerUp}
    >
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-border/50 text-muted flex-shrink-0">
          {inputIcon ? (
            <MdiIcon icon={inputIcon} className="w-5 h-5" />
          ) : (
            <SlidersHorizontal className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-medium text-foreground truncate">
                {getEntityDisplayName(input)}
              </span>
              {entityMeta && (
                <EntityBadges
                  isHiddenInStuga={entityMeta.isHiddenInStuga}
                  isHiddenInHA={entityMeta.isHiddenInHA}
                  hasRoom={entityMeta.hasRoom}
                  className="flex-shrink-0"
                />
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {entityMeta?.roomName && (
                <span className="text-sm text-muted truncate w-20 text-right">
                  {entityMeta.roomName}
                </span>
              )}
              <span className="text-xs text-muted tabular-nums w-12 text-right">
                {localValue}
                {unit}
              </span>
            </div>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={localValue}
            onChange={handleSliderChange}
            onPointerUp={handleSliderEnd}
            onTouchEnd={handleSliderEnd}
            className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer accent-accent"
          />
        </div>
      </div>
    </div>
  )
}

export function InputsSection({
  inputBooleans,
  inputNumbers,
  isInEditMode,
  isSelected,
  onBooleanToggle,
  onNumberChange,
  onToggleSelection,
  onEnterEditModeWithSelection,
  entityMeta,
  entityOrder,
  onReorderEntities,
  selectedIds,
}: InputsSectionProps) {
  // Combine and sort all inputs by order only if entityOrder is provided
  const sortedInputs = useMemo(() => {
    const allInputs = [...inputBooleans, ...inputNumbers]
    if (!entityOrder || Object.keys(entityOrder).length === 0) {
      return allInputs
    }
    return sortEntitiesByOrder(allInputs, entityOrder)
  }, [inputBooleans, inputNumbers, entityOrder])

  if (inputBooleans.length === 0 && inputNumbers.length === 0) return null

  const handleReorder = (reorderedInputs: HAEntity[]) => {
    void onReorderEntities?.(reorderedInputs)
  }

  const renderInput = (input: HAEntity, editMode: boolean, isReorderSelected = false) => {
    if (input.entity_id.startsWith('input_boolean.')) {
      return (
        <DeviceToggleButton
          key={input.entity_id}
          entity={input}
          isInEditMode={editMode}
          isSelected={isSelected(input.entity_id)}
          onToggle={() => {
            onBooleanToggle(input)
          }}
          onToggleSelection={() => {
            onToggleSelection(input.entity_id)
          }}
          onEnterEditModeWithSelection={() => onEnterEditModeWithSelection?.(input.entity_id)}
          fallbackIcon={<ToggleLeft className="w-5 h-5" />}
          entityMeta={entityMeta?.get(input.entity_id)}
          isReorderSelected={isReorderSelected}
        />
      )
    } else {
      return (
        <InputNumberItem
          key={input.entity_id}
          input={input}
          isInEditMode={editMode}
          isSelected={isSelected(input.entity_id)}
          onNumberChange={onNumberChange}
          onToggleSelection={onToggleSelection}
          onEnterEditModeWithSelection={onEnterEditModeWithSelection}
          entityMeta={entityMeta?.get(input.entity_id)}
          isReorderSelected={isReorderSelected}
        />
      )
    }
  }

  return (
    <div className="mb-4">
      <SectionHeader>{t.devices.inputs}</SectionHeader>
      {isInEditMode ? (
        // Edit mode: use ReorderableList for drag-to-reorder + tap-to-select
        <ReorderableList
          items={sortedInputs}
          getKey={(input) => input.entity_id}
          onReorder={handleReorder}
          layout="vertical"
          selectedKeys={selectedIds}
          onItemTap={onToggleSelection}
          renderItem={(input, _index, _isDragging, isReorderSelected) =>
            renderInput(input, true, isReorderSelected)
          }
        />
      ) : (
        // Normal mode: static list with long-press to enter edit mode
        <div className="space-y-1">{sortedInputs.map((input) => renderInput(input, false))}</div>
      )}
    </div>
  )
}
