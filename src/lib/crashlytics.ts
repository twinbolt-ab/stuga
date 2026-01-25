import { Capacitor } from '@capacitor/core'
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics'
import { getStorage } from './storage'
import { STORAGE_KEYS } from './constants'

const isNative = Capacitor.isNativePlatform()

// In-memory cache for debug ID
let cachedDebugId: string | null = null

export async function initCrashlytics(): Promise<void> {
  if (!isNative) {
    console.log('[Crashlytics] Skipping init on web')
    return
  }

  try {
    // Enable crash collection
    await FirebaseCrashlytics.setEnabled({ enabled: true })
    console.log('[Crashlytics] Initialized successfully')
  } catch (error) {
    console.error('[Crashlytics] Failed to initialize:', error)
  }
}

export async function logError(error: Error, context?: string): Promise<void> {
  if (!isNative) {
    console.error(`[Error${context ? ` - ${context}` : ''}]`, error)
    return
  }

  try {
    // Log custom key for context
    if (context) {
      await FirebaseCrashlytics.setCustomKey({ key: 'context', value: context, type: 'string' })
    }

    // Parse stack trace into StackFrame array
    const stackFrames = parseStackTrace(error.stack)

    // Record the exception
    await FirebaseCrashlytics.recordException({
      message: error.message,
      stacktrace: stackFrames.length > 0 ? stackFrames : undefined,
    })
  } catch (e) {
    console.error('[Crashlytics] Failed to log error:', e)
  }
}

function parseStackTrace(stack?: string): Array<{ lineNumber?: number; fileName?: string; functionName?: string }> {
  if (!stack) return []

  const lines = stack.split('\n')
  const frames: Array<{ lineNumber?: number; fileName?: string; functionName?: string }> = []

  for (const line of lines) {
    // Match patterns like "at functionName (fileName:lineNumber:columnNumber)"
    const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):\d+\)/) ||
                  line.match(/at\s+(.+?):(\d+):\d+/) ||
                  line.match(/(.+?)@(.+?):(\d+):\d+/)

    if (match) {
      frames.push({
        functionName: match[1]?.trim(),
        fileName: match[2]?.trim(),
        lineNumber: match[3] ? parseInt(match[3], 10) : undefined,
      })
    }
  }

  return frames
}

export async function log(message: string): Promise<void> {
  if (!isNative) {
    console.log(`[Crashlytics] ${message}`)
    return
  }

  try {
    await FirebaseCrashlytics.log({ message })
  } catch (e) {
    console.error('[Crashlytics] Failed to log message:', e)
  }
}

export async function setUserId(userId: string): Promise<void> {
  if (!isNative) return

  try {
    await FirebaseCrashlytics.setUserId({ userId })
  } catch (e) {
    console.error('[Crashlytics] Failed to set user ID:', e)
  }
}

export async function setCustomKey(key: string, value: string | number | boolean): Promise<void> {
  if (!isNative) return

  try {
    await FirebaseCrashlytics.setCustomKey({
      key,
      value: String(value),
      type: typeof value === 'number' ? 'long' : typeof value === 'boolean' ? 'boolean' : 'string',
    })
  } catch (e) {
    console.error('[Crashlytics] Failed to set custom key:', e)
  }
}

// Force a test crash (only use for testing!)
export async function testCrash(): Promise<void> {
  if (!isNative) {
    console.warn('[Crashlytics] Test crash only works on native platforms')
    return
  }

  await FirebaseCrashlytics.crash({ message: 'Test crash from Stuga app' })
}

// Set user context for better crash analysis
export async function setUserContext(params: {
  platform: 'web' | 'ios' | 'android'
  connectionType: 'local' | 'cloud'
  authMethod: 'oauth' | 'token'
  entityCount?: number
  areaCount?: number
  floorCount?: number
}): Promise<void> {
  if (!isNative) {
    console.log('[Crashlytics] User context:', params)
    return
  }

  try {
    await Promise.all([
      setCustomKey('platform', params.platform),
      setCustomKey('connection_type', params.connectionType),
      setCustomKey('auth_method', params.authMethod),
      params.entityCount !== undefined && setCustomKey('entity_count', params.entityCount),
      params.areaCount !== undefined && setCustomKey('area_count', params.areaCount),
      params.floorCount !== undefined && setCustomKey('floor_count', params.floorCount),
    ])
  } catch (e) {
    console.error('[Crashlytics] Failed to set user context:', e)
  }
}

// Helper to determine if URL is local or cloud
export function getConnectionType(url: string): 'local' | 'cloud' {
  try {
    const hostname = new URL(url).hostname
    // Local patterns: IP addresses, .local domains, localhost
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.2') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
    ) {
      return 'local'
    }
    return 'cloud'
  } catch {
    return 'cloud'
  }
}

// Generate a random 8-character debug ID
function generateDebugId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed ambiguous chars: I, O, 0, 1
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

// Get or create the debug ID (stored in regular storage to survive reinstalls on some platforms)
export async function getDebugId(): Promise<string> {
  // Return cached value if available
  if (cachedDebugId) {
    return cachedDebugId
  }

  const storage = getStorage()
  let debugId = await storage.getItem(STORAGE_KEYS.DEBUG_ID)

  if (!debugId) {
    debugId = generateDebugId()
    await storage.setItem(STORAGE_KEYS.DEBUG_ID, debugId)
  }

  cachedDebugId = debugId
  return debugId
}

// Initialize debug ID and set it in Crashlytics
export async function initDebugId(): Promise<string> {
  const debugId = await getDebugId()
  await setUserId(debugId)
  return debugId
}

// Format error report for sharing
export interface ErrorReportInfo {
  errorType?: string
  errorMessage?: string
  diagnostics?: {
    httpsReachable?: boolean
    websocketReachable?: boolean
    authValid?: boolean
  }
  stack?: string
}

export async function formatErrorReport(info: ErrorReportInfo): Promise<string> {
  const debugId = await getDebugId()
  const platform = Capacitor.getPlatform()
  const appVersion = import.meta.env.VITE_APP_VERSION || 'unknown'

  let report = `**Debug ID:** ${debugId}\n`
  report += `**Platform:** ${platform}\n`
  report += `**App Version:** ${appVersion}\n`

  if (info.errorType) {
    report += `**Error Type:** ${info.errorType}\n`
  }

  if (info.errorMessage) {
    report += `**Error:** ${info.errorMessage}\n`
  }

  if (info.diagnostics) {
    report += `\n**Diagnostics:**\n`
    report += `- HTTPS Reachable: ${info.diagnostics.httpsReachable ? 'Yes' : 'No'}\n`
    report += `- WebSocket Reachable: ${info.diagnostics.websocketReachable ? 'Yes' : 'No'}\n`
    report += `- Auth Valid: ${info.diagnostics.authValid ? 'Yes' : 'No'}\n`
  }

  if (info.stack) {
    report += `\n**Stack Trace:**\n\`\`\`\n${info.stack.slice(0, 500)}\n\`\`\`\n`
  }

  return report
}

export async function copyErrorReport(info: ErrorReportInfo): Promise<boolean> {
  try {
    const report = await formatErrorReport(info)
    await navigator.clipboard.writeText(report)
    return true
  } catch {
    // Fallback for older browsers
    try {
      const report = await formatErrorReport(info)
      const textArea = document.createElement('textarea')
      textArea.value = report
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    } catch {
      return false
    }
  }
}

export const GITHUB_ISSUES_URL = 'https://github.com/twinbolt/stuga/issues/new'
