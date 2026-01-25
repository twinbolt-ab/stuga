import { Capacitor } from '@capacitor/core'
import { FirebasePerformance } from '@capacitor-firebase/performance'

const isNative = Capacitor.isNativePlatform()

export async function initPerformance(): Promise<void> {
  if (!isNative) {
    console.log('[Performance] Skipping init on web')
    return
  }

  try {
    await FirebasePerformance.setEnabled({ enabled: true })
    console.log('[Performance] Initialized successfully')
  } catch (error) {
    console.error('[Performance] Failed to initialize:', error)
  }
}

// Start a custom trace for measuring specific operations
export async function startTrace(traceName: string): Promise<void> {
  if (!isNative) return

  try {
    await FirebasePerformance.startTrace({ traceName })
  } catch (e) {
    console.error(`[Performance] Failed to start trace ${traceName}:`, e)
  }
}

// Stop a custom trace
export async function stopTrace(traceName: string): Promise<void> {
  if (!isNative) return

  try {
    await FirebasePerformance.stopTrace({ traceName })
  } catch (e) {
    console.error(`[Performance] Failed to stop trace ${traceName}:`, e)
  }
}

// Add a metric to an active trace
export async function putMetric(traceName: string, metricName: string, num: number): Promise<void> {
  if (!isNative) return

  try {
    await FirebasePerformance.putMetric({ traceName, metricName, num })
  } catch (e) {
    console.error(`[Performance] Failed to put metric:`, e)
  }
}

// Increment a metric on an active trace
export async function incrementMetric(traceName: string, metricName: string, incrementBy = 1): Promise<void> {
  if (!isNative) return

  try {
    await FirebasePerformance.incrementMetric({ traceName, metricName, incrementBy })
  } catch (e) {
    console.error(`[Performance] Failed to increment metric:`, e)
  }
}

// Add an attribute to an active trace
export async function putAttribute(traceName: string, attribute: string, value: string): Promise<void> {
  if (!isNative) return

  try {
    await FirebasePerformance.putAttribute({ traceName, attribute, value })
  } catch (e) {
    console.error(`[Performance] Failed to put attribute:`, e)
  }
}

// Helper for timing async operations
export async function traceAsync<T>(traceName: string, fn: () => Promise<T>): Promise<T> {
  if (!isNative) {
    return fn()
  }

  await startTrace(traceName)
  try {
    const result = await fn()
    await stopTrace(traceName)
    return result
  } catch (error) {
    await putAttribute(traceName, 'error', 'true')
    await stopTrace(traceName)
    throw error
  }
}
