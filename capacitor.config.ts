import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.twinbolt.stuga',
  appName: 'Stuga',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0D0D0C',
    // Prevent keyboard from resizing the webview
    scrollEnabled: false,
  },
  android: {
    backgroundColor: '#0D0D0C',
    overScrollMode: 'never',
  },
  plugins: {
    Preferences: {
      // No special config needed
    },
    Keyboard: {
      // Prevent keyboard from resizing/scrolling the viewport
      resize: 'none',
      resizeOnFullScreen: false,
    },
  },
}

export default config
