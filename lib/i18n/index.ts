import en from './en.json'

export const t = en

// Helper for interpolation: t.devices.lightsOn with {count: 2} -> "2 on"
export function interpolate(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`))
}
