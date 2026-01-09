import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hem',
  description: 'Smart home dashboard',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Hem',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF9' },
    { media: '(prefers-color-scheme: dark)', color: '#0D0D0C' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <body className="min-h-screen">
        <Providers>
          <main className="min-h-screen pb-20">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
