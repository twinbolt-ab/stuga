export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

let adapter: StorageAdapter | null = null
let secureAdapter: StorageAdapter | null = null

export async function initStorage(): Promise<void> {
  // Check if running in Capacitor native app
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
    const { NativeStorage } = await import('./native')
    const { SecureStorage } = await import('./secure')
    adapter = new NativeStorage()
    secureAdapter = new SecureStorage()
  } else {
    const { WebStorage } = await import('./web')
    adapter = new WebStorage()
    // On web, use regular storage (no secure alternative)
    secureAdapter = adapter
  }
}

export function getStorage(): StorageAdapter {
  if (!adapter) {
    throw new Error('Storage not initialized. Call initStorage() first.')
  }
  return adapter
}

/**
 * Get secure storage for sensitive data (OAuth tokens, etc.)
 * On native: uses iOS Keychain / Android KeyStore
 * On web: falls back to localStorage (no secure alternative)
 */
export function getSecureStorage(): StorageAdapter {
  if (!secureAdapter) {
    throw new Error('Storage not initialized. Call initStorage() first.')
  }
  return secureAdapter
}

export function isStorageInitialized(): boolean {
  return adapter !== null
}
