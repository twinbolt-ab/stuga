import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useMotionValue, animate, useDragControls, PanInfo } from 'framer-motion'
import {
  X,
  WifiOff,
  ShieldOff,
  ServerOff,
  AlertTriangle,
  RefreshCw,
  Settings,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { t } from '@/lib/i18n'
import { haptic } from '@/lib/haptics'
import { useIsClient } from '@/lib/hooks/useIsClient'
import { EditModal } from '@/components/ui/EditModal'
import type { DiagnosticResult, ConnectionErrorType } from '@/lib/connection-diagnostics'
import { copyErrorReport, GITHUB_ISSUES_URL } from '@/lib/crashlytics'

const DRAG_CLOSE_THRESHOLD = 150

interface ConnectionErrorModalProps {
  isOpen: boolean
  onClose: () => void
  onRetry: () => void
  onOpenSettings: () => void
  diagnostic: DiagnosticResult | null
}

const ERROR_CONFIG: Record<ConnectionErrorType, { icon: typeof WifiOff; color: string }> = {
  network: { icon: WifiOff, color: 'text-red-500' },
  'ssl-error': { icon: ShieldOff, color: 'text-red-500' },
  'ssl-hostname-mismatch': { icon: ShieldOff, color: 'text-amber-500' },
  'dns-resolution': { icon: WifiOff, color: 'text-red-500' },
  'websocket-blocked': { icon: ShieldOff, color: 'text-amber-500' },
  auth: { icon: ShieldOff, color: 'text-red-500' },
  'server-down': { icon: ServerOff, color: 'text-red-500' },
  unknown: { icon: AlertTriangle, color: 'text-amber-500' },
}

function getErrorTitle(errorType: ConnectionErrorType): string {
  const titles: Record<ConnectionErrorType, string> = {
    network: t.connectionError.errorNetwork,
    'ssl-error': t.connectionError.errorSsl,
    'ssl-hostname-mismatch': t.connectionError.errorSslHostname,
    'dns-resolution': t.connectionError.errorDns,
    'websocket-blocked': t.connectionError.errorWebsocket,
    auth: t.connectionError.errorAuth,
    'server-down': t.connectionError.errorServerDown,
    unknown: t.connectionError.errorUnknown,
  }
  return titles[errorType]
}

function getTroubleshootingText(errorType: ConnectionErrorType): string {
  const tips: Record<ConnectionErrorType, string> = {
    network: t.connectionError.troubleshootNetwork,
    'ssl-error': t.connectionError.troubleshootSsl,
    'ssl-hostname-mismatch': t.connectionError.troubleshootSslHostname,
    'dns-resolution': t.connectionError.troubleshootDns,
    'websocket-blocked': t.connectionError.troubleshootWebsocket,
    auth: t.connectionError.troubleshootAuth,
    'server-down': t.connectionError.troubleshootServerDown,
    unknown: t.connectionError.troubleshootUnknown,
  }
  return tips[errorType]
}

// Detailed troubleshooting steps for each error type
function getTroubleshootingSteps(errorType: ConnectionErrorType): string[] {
  const steps: Record<ConnectionErrorType, string[]> = {
    network: [
      'Check that your device is connected to the internet or local network',
      'Verify the Home Assistant URL is correct (e.g., http://homeassistant.local:8123)',
      'Make sure Home Assistant is running and accessible',
      "If using a local address, ensure you're on the same network as Home Assistant",
      'Try accessing the URL directly in a web browser to verify it works',
    ],
    'ssl-error': [
      'The SSL/TLS certificate could not be verified',
      'If using a self-signed certificate, try accessing the URL in a browser first and accept the certificate warning',
      'Check if your certificate has expired and needs renewal',
      "If using Let's Encrypt, verify the certificate is properly configured",
      'Try using HTTP instead of HTTPS if your server supports it',
    ],
    'ssl-hostname-mismatch': [
      'The SSL certificate doesn\'t match the server address you\'re connecting to',
      'If you\'re using DNS rebinding (router maps your domain to a local IP), your phone may be using a different DNS server',
      'On Android: Go to Settings → Network & Internet → Private DNS and set it to "Off" to use your router\'s DNS',
      'On Samsung: Settings → Connections → More → Private DNS → Off',
      'Alternatively, try connecting via the local IP address with HTTP instead',
      'If using Nabu Casa or similar, ensure you\'re using the correct external URL',
    ],
    'dns-resolution': [
      'The hostname could not be resolved to an IP address',
      'Check that you typed the address correctly',
      'If using a local hostname (like homeassistant.local), ensure mDNS is working on your network',
      'Try using the IP address directly instead of the hostname',
      'Check your internet connection',
      'If using custom DNS, verify it can resolve the hostname',
    ],
    'websocket-blocked': [
      'WebSocket connections are being blocked by your network or a proxy',
      "If you're on a corporate or public WiFi, try using mobile data instead",
      'Check if you have a VPN running that might block WebSocket connections',
      'If using a reverse proxy (like nginx), ensure WebSocket upgrade is enabled',
      'Add these lines to your nginx config:\n  proxy_http_version 1.1;\n  proxy_set_header Upgrade $http_upgrade;\n  proxy_set_header Connection "upgrade";',
      'If using Cloudflare, ensure WebSockets are enabled in your dashboard',
    ],
    auth: [
      'Your access token may have expired or is invalid',
      'Go to Home Assistant → Profile → Security → Long-Lived Access Tokens',
      'Create a new token and try connecting again',
      'Make sure you copied the entire token without any extra spaces',
    ],
    'server-down': [
      'Home Assistant appears to be offline or not responding',
      'Check if Home Assistant is running on your server',
      'Try restarting Home Assistant from the command line or web interface',
      'Check the Home Assistant logs for any errors',
      'Verify the port number is correct (default is 8123)',
    ],
    unknown: [
      'An unexpected error occurred during connection',
      'Try the connection again - it may be a temporary issue',
      'Check the Home Assistant logs for more details',
      'Restart Home Assistant and try again',
      'If the problem persists, check the Home Assistant community forums',
    ],
  }
  return steps[errorType]
}

// Troubleshooting help content (rendered inside EditModal)
function TroubleshootingHelpContent({
  errorType,
  diagnostic,
}: {
  errorType: ConnectionErrorType
  diagnostic: DiagnosticResult | null
}) {
  const steps = getTroubleshootingSteps(errorType)
  const [copied, setCopied] = useState(false)

  const handleCopyReport = async () => {
    const success = await copyErrorReport({
      errorType,
      diagnostics: diagnostic
        ? {
            httpsReachable: diagnostic.httpsReachable,
            websocketReachable: diagnostic.websocketReachable,
            authValid: diagnostic.authValid,
          }
        : undefined,
    })
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenIssues = () => {
    window.open(GITHUB_ISSUES_URL, '_blank')
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{getTroubleshootingText(errorType)}</p>

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Things to try:</p>
        <ul className="space-y-3">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-sm">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-xs font-medium flex items-center justify-center">
                {index + 1}
              </span>
              <span className="text-foreground/90 whitespace-pre-wrap">{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Report Error Section */}
      <div className="pt-4 border-t border-border space-y-3">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">
          {t.connectionError.stillHavingIssues || 'Still having issues?'}
        </p>
        <p className="text-sm text-muted">
          {t.connectionError.autoReported ||
            'Error details are sent automatically. For follow-up, report on GitHub with your debug ID.'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleCopyReport}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-muted/20 text-foreground text-sm font-medium transition-colors hover:bg-muted/30 touch-feedback"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-success" />
                {t.connectionError.copied || 'Copied!'}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {t.connectionError.copyDetails || 'Copy details'}
              </>
            )}
          </button>
          <button
            onClick={handleOpenIssues}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-accent text-white text-sm font-medium transition-colors hover:bg-accent-hover touch-feedback"
          >
            <ExternalLink className="w-4 h-4" />
            {t.connectionError.reportIssue || 'Report issue'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConnectionErrorModal({
  isOpen,
  onClose,
  onRetry,
  onOpenSettings,
  diagnostic,
}: ConnectionErrorModalProps) {
  const isClient = useIsClient()
  const y = useMotionValue(isOpen ? 0 : 1000)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()
  const [showHelp, setShowHelp] = useState(false)

  const errorType = diagnostic?.errorType ?? 'unknown'
  const { icon: Icon, color } = ERROR_CONFIG[errorType]

  // Animate modal in/out based on isOpen
  useEffect(() => {
    if (isOpen) {
      animate(y, 0, { type: 'spring', damping: 30, stiffness: 400 })
      haptic.light()
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    } else {
      animate(y, 1000, { type: 'spring', damping: 30, stiffness: 400 })
    }
  }, [isOpen, y])

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    if (info.offset.y > DRAG_CLOSE_THRESHOLD || info.velocity.y > 500) {
      onClose()
    } else {
      animate(y, 0, { type: 'spring', damping: 30, stiffness: 400 })
    }
  }

  const startDrag = (event: React.PointerEvent) => {
    dragControls.start(event)
  }

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isClient) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
        onClick={isOpen ? onClose : undefined}
      />

      {/* Bottom Sheet */}
      <motion.div
        ref={sheetRef}
        initial={false}
        drag={isOpen ? 'y' : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.1, bottom: 0.8 }}
        onDragEnd={handleDragEnd}
        style={{
          y,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        className="fixed bottom-0 left-0 right-0 z-[100] bg-card rounded-t-2xl shadow-warm-lg flex flex-col max-h-[90vh]"
      >
        {/* Handle bar - drag area */}
        <div
          onPointerDown={startDrag}
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
        >
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header - also draggable */}
        <div
          onPointerDown={startDrag}
          className="flex items-center justify-between px-4 pb-4 border-b border-border cursor-grab active:cursor-grabbing touch-none"
        >
          <h2 className="text-lg font-semibold text-foreground">{t.connectionError.title}</h2>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-border/50 transition-colors touch-feedback"
            aria-label={t.settings.close}
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 pb-safe">
          {/* Error Icon and Title */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className={`p-4 rounded-full bg-muted/20 mb-4 ${color}`}>
              <Icon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">{getErrorTitle(errorType)}</h3>
            <p className="text-sm text-muted leading-relaxed max-w-sm">
              {getTroubleshootingText(errorType)}
            </p>
            {/* Troubleshooting button */}
            <button
              onClick={() => setShowHelp(true)}
              className="mt-3 text-sm text-muted hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Troubleshooting
            </button>
          </div>

          {/* Diagnostic Details */}
          {diagnostic && (
            <div className="bg-muted/10 rounded-xl p-4 mb-6">
              <h4 className="text-sm font-medium text-foreground mb-3">
                {t.connectionError.diagnosticDetails}
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">{t.connectionError.httpsStatus}</span>
                  <span className={diagnostic.httpsReachable ? 'text-green-500' : 'text-red-500'}>
                    {diagnostic.httpsReachable
                      ? t.connectionError.statusOk
                      : t.connectionError.statusFailed}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t.connectionError.websocketStatus}</span>
                  <span
                    className={diagnostic.websocketReachable ? 'text-green-500' : 'text-red-500'}
                  >
                    {diagnostic.websocketReachable
                      ? t.connectionError.statusOk
                      : t.connectionError.statusFailed}
                  </span>
                </div>
                {diagnostic.websocketReachable && (
                  <div className="flex justify-between">
                    <span className="text-muted">{t.connectionError.authStatus}</span>
                    <span className={diagnostic.authValid ? 'text-green-500' : 'text-red-500'}>
                      {diagnostic.authValid
                        ? t.connectionError.statusOk
                        : t.connectionError.statusFailed}
                    </span>
                  </div>
                )}
                {/* Show error details if available */}
                {diagnostic.errorDetails && (
                  <div className="pt-2 mt-2 border-t border-border/50">
                    <span className="text-muted block mb-1">
                      {t.connectionError.errorDetailsLabel}
                    </span>
                    <code className="text-xs text-foreground/70 bg-background/50 px-2 py-1 rounded block break-all">
                      {diagnostic.errorCode && `[${diagnostic.errorCode}] `}
                      {diagnostic.errorDetails}
                    </code>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onOpenSettings}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-muted/20 text-foreground font-medium transition-colors hover:bg-muted/30 touch-feedback"
            >
              <Settings className="w-4 h-4" />
              {t.connectionError.openSettings}
            </button>
            <button
              onClick={onRetry}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-white font-medium transition-colors hover:bg-accent-hover touch-feedback"
            >
              <RefreshCw className="w-4 h-4" />
              {t.connectionError.retry}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Troubleshooting Help Modal */}
      <EditModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Troubleshooting Help"
      >
        <TroubleshootingHelpContent errorType={errorType} diagnostic={diagnostic} />
      </EditModal>
    </>,
    document.body
  )
}
