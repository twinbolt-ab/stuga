import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initStorage } from './lib/storage'
import { initMetadataService } from './lib/metadata'
import { initCrashlytics, logError } from './lib/crashlytics'
import { initPerformance } from './lib/performance'
import App from './App'
import './index.css'

// Disable right-click context menu globally (mobile-first app)
document.addEventListener('contextmenu', (e) => e.preventDefault())

// Global error handlers for Crashlytics
window.addEventListener('error', (event) => {
  if (event.error instanceof Error) {
    void logError(event.error, 'uncaught')
  } else {
    void logError(new Error(event.message || 'Unknown error'), 'uncaught')
  }
})

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason instanceof Error
    ? event.reason
    : new Error(String(event.reason) || 'Unhandled promise rejection')
  void logError(error, 'unhandled-promise')
})

async function bootstrap() {
  try {
    // Initialize Firebase (Crashlytics first to catch any init errors)
    await initCrashlytics()
    await initPerformance()

    await initStorage()
    initMetadataService()

    const root = document.getElementById('root')
    if (!root) throw new Error('Root element not found')

    createRoot(root).render(
      <StrictMode>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
      </StrictMode>
    )
  } catch (error) {
    console.error('[Bootstrap] Failed to initialize:', error)
    if (error instanceof Error) {
      void logError(error, 'bootstrap')
    }
    const root = document.getElementById('root')
    if (root) {
      root.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;text-align:center;padding:20px;background:#FAFAF9;">
          <div>
            <h1 style="margin-bottom:16px;color:#1A1A1A;">Failed to start</h1>
            <p style="color:#6B6B6B;margin-bottom:16px;">The app couldn't initialize properly.</p>
            <button onclick="location.reload()" style="padding:12px 24px;background:#C4A77D;color:white;border:none;border-radius:12px;font-size:16px;cursor:pointer;">
              Reload
            </button>
          </div>
        </div>
      `
    }
  }
}

void bootstrap()
