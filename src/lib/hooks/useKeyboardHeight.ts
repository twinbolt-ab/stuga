import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

/**
 * Returns the current on-screen keyboard height in CSS pixels (0 when hidden).
 *
 * On native (iOS/Android), uses the Capacitor Keyboard plugin events because
 * `Keyboard.resize: 'none'` in capacitor.config.ts prevents `visualViewport`
 * from reflecting the keyboard.
 *
 * On web, falls back to the visualViewport API.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const showHandle = Keyboard.addListener('keyboardWillShow', (info) => {
        setHeight(info.keyboardHeight)
      })
      const hideHandle = Keyboard.addListener('keyboardWillHide', () => {
        setHeight(0)
      })
      return () => {
        void showHandle.then((h) => h.remove())
        void hideHandle.then((h) => h.remove())
      }
    }

    if (!window.visualViewport) return
    const viewport = window.visualViewport
    const handleResize = () => {
      setHeight(Math.max(0, window.innerHeight - viewport.height))
    }
    viewport.addEventListener('resize', handleResize)
    viewport.addEventListener('scroll', handleResize)
    handleResize()
    return () => {
      viewport.removeEventListener('resize', handleResize)
      viewport.removeEventListener('scroll', handleResize)
    }
  }, [])

  return height
}
