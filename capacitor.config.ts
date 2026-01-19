import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.twinbolt.stuga',
  appName: 'Stuga',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0D0D0C',
  },
  android: {
    backgroundColor: '#0D0D0C',
    overScrollMode: 'never',
  },
  plugins: {
    Preferences: {
      // No special config needed
    },
  },
}

export default config
