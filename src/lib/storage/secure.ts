import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'
import type { StorageAdapter } from './index'
import { logError } from '../crashlytics'

/**
 * Secure storage adapter using iOS Keychain / Android KeyStore.
 * Use this for sensitive data like OAuth tokens.
 */
export class SecureStorage implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      const result = await SecureStoragePlugin.get({ key })
      return result.value
    } catch (error) {
      // Key doesn't exist is expected, but other errors should be logged
      // SecureStoragePlugin throws when key doesn't exist, so we check the message
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('not found') && !errorMessage.includes('does not exist')) {
        void logError(
          error instanceof Error ? error : new Error(errorMessage),
          `secure-storage-get:${key}`
        )
      }
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStoragePlugin.set({ key, value })
    } catch (error) {
      void logError(
        error instanceof Error ? error : new Error(String(error)),
        `secure-storage-set:${key}`
      )
      throw error
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStoragePlugin.remove({ key })
    } catch (error) {
      // Key might not exist, but log unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('not found') && !errorMessage.includes('does not exist')) {
        void logError(
          error instanceof Error ? error : new Error(errorMessage),
          `secure-storage-remove:${key}`
        )
      }
    }
  }
}
