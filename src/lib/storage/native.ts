import { Preferences } from '@capacitor/preferences'
import type { StorageAdapter } from './index'
import { logError } from '../crashlytics'

export class NativeStorage implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key })
      return value
    } catch (error) {
      void logError(
        error instanceof Error ? error : new Error(String(error)),
        `native-storage-get:${key}`
      )
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({ key, value })
    } catch (error) {
      void logError(
        error instanceof Error ? error : new Error(String(error)),
        `native-storage-set:${key}`
      )
      throw error
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await Preferences.remove({ key })
    } catch (error) {
      void logError(
        error instanceof Error ? error : new Error(String(error)),
        `native-storage-remove:${key}`
      )
      throw error
    }
  }
}
