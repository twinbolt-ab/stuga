import { Capacitor } from '@capacitor/core'
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics'

const isNative = Capacitor.isNativePlatform()

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
