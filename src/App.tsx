import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './providers/ThemeProvider'
import { ToastProvider } from './providers/ToastProvider'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { useDeepLinks } from './lib/hooks/useDeepLinks'
import Home from './routes/Home'
import Setup from './routes/Setup'
import AuthCallback from './routes/AuthCallback'

function App() {
  // Handle deep links on native platforms
  useDeepLinks()

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <main className="min-h-screen min-h-[100dvh] bg-background">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
