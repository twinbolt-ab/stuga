/**
 * Type declarations for Capacitor runtime detection.
 * Used to check if running in a native (iOS/Android) context.
 */
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform: () => boolean
    }
  }
}

export {}
