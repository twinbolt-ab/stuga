import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { logger } from '@/lib/logger'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('ErrorBoundary', 'Uncaught error:', error.message, errorInfo.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-primary)]">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-[var(--warning)]/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-[var(--warning)]" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                Something went wrong
              </h1>
              <p className="text-[var(--text-secondary)]">
                An unexpected error occurred. Please try again.
              </p>
            </div>

            {this.state.error && (
              <details className="text-left bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border)]">
                <summary className="text-sm text-[var(--text-secondary)] cursor-pointer">
                  Error details
                </summary>
                <pre className="mt-2 text-xs text-[var(--text-secondary)] overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-[var(--bg-card)] text-[var(--text-primary)] font-medium border border-[var(--border)] hover:bg-[var(--border)] transition-colors"
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
