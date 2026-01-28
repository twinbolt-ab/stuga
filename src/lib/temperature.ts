import { getTemperatureUnit as getHATemperatureUnit } from '@/lib/ha-websocket'

export type TemperatureUnit = 'celsius' | 'fahrenheit'

/**
 * Gets the temperature unit from Home Assistant config.
 * Falls back to Celsius if not connected or config not loaded.
 */
export function getTemperatureUnit(): TemperatureUnit {
  const haUnit = getHATemperatureUnit()
  return haUnit === '°F' ? 'fahrenheit' : 'celsius'
}

/**
 * Converts Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32
}

/**
 * Converts Fahrenheit to Celsius
 */
export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9
}

/**
 * Formats a temperature value for display.
 * Assumes input is in Celsius (Home Assistant default for metric).
 * If HA is configured for imperial, values are already in Fahrenheit.
 *
 * @param value - Temperature value from Home Assistant
 * @param options - Formatting options
 * @returns Formatted temperature string with unit symbol
 */
export function formatTemperature(
  value: number,
  options: {
    decimals?: number
    showUnit?: boolean
  } = {}
): string {
  const { decimals = 1, showUnit = true } = options
  const unit = getTemperatureUnit()
  const formatted = value.toFixed(decimals)

  if (!showUnit) {
    return formatted
  }

  return unit === 'fahrenheit' ? `${formatted}°F` : `${formatted}°C`
}

/**
 * Formats a temperature with just the degree symbol (no C/F).
 * Useful for compact displays where the unit is implied.
 */
export function formatTemperatureCompact(
  value: number,
  options: { decimals?: number } = {}
): string {
  const { decimals = 1 } = options
  return `${value.toFixed(decimals)}°`
}
