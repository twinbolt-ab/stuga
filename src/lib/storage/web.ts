import type { StorageAdapter } from './index'

export class WebStorage implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key)
  }

  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value)
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key)
  }

  async keys(): Promise<string[]> {
    return Object.keys(localStorage)
  }
}
