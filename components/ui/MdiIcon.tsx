'use client'

import { Icon } from '@iconify/react'

interface MdiIconProps {
  icon: string
  className?: string
}

/**
 * Renders a Material Design Icon from Home Assistant's icon format.
 * HA icons are in format "mdi:icon-name", which maps to "mdi:icon-name" in Iconify.
 */
export function MdiIcon({ icon, className }: MdiIconProps) {
  // HA format is "mdi:icon-name", Iconify uses the same format
  return <Icon icon={icon} className={className} />
}
