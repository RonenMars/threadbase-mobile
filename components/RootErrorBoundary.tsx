import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import * as Updates from 'expo-updates'
import i18n from '@/lib/i18n'
import { captureHandledError, reportOneShot } from '@/services/sentry'
import { useSettingsStore } from '@/stores/settings'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

type ReportState = 'idle' | 'sending' | 'sent' | 'failed'

/**
 * The recovery screen shown when the boundary catches an error. Factored out
 * as a function component so it can be reused verbatim for a non-throwing
 * visual preview (e.g. a dev demo button), without duplicating the markup.
 *
 * `error` is optional: when present (a real catch) and standing Anonymous
 * Diagnostics consent is OFF, a "Report this crash" button and an unchecked
 * "Automatically send future crash reports and diagnostics" checkbox are
 * shown (spec §8). Reporting works independent of consent — a single,
 * explicit, user-initiated action (see reportOneShot) — but checking the box
 * only takes effect as part of that same Report action, never from the
 * checkbox tap alone: leaving the screen with it checked but never
 * submitting leaves standing consent untouched.
 *
 * When consent is already ON, the qualifying error was already reported
 * automatically (via `captureHandledError` in `componentDidCatch`), so no
 * checkbox or report button is shown — avoiding a duplicate report.
 */
export function RootErrorBoundaryFallback({
  onReload,
  error,
}: {
  onReload: () => void
  error?: Error
}) {
  const [reportState, setReportState] = useState<ReportState>('idle')
  const [enableFutureReports, setEnableFutureReports] = useState(false)
  const anonymousDiagnosticsEnabled = useSettingsStore((s) => s.anonymousDiagnosticsEnabled)
  const setAnonymousDiagnosticsEnabled = useSettingsStore((s) => s.setAnonymousDiagnosticsEnabled)

  const handleReport = async () => {
    if (!error || reportState === 'sending') return
    setReportState('sending')
    const eventId = await reportOneShot(error, { tag: 'render_error_boundary_manual' })
    setReportState(eventId ? 'sent' : 'failed')
    // The checkbox only takes effect here, bundled with a successful send —
    // never from checking it alone (spec §8).
    if (eventId && enableFutureReports) {
      setAnonymousDiagnosticsEnabled(true)
    }
  }

  const reportLabel =
    reportState === 'sending'
      ? i18n.t('common:errorBoundary.reportSending')
      : reportState === 'sent'
        ? i18n.t('common:errorBoundary.reportSent')
        : reportState === 'failed'
          ? i18n.t('common:errorBoundary.reportFailed')
          : i18n.t('common:errorBoundary.report')

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{i18n.t('common:errorBoundary.title')}</Text>
      <Text style={styles.message}>{i18n.t('common:errorBoundary.message')}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={onReload}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('common:errorBoundary.reload')}
        testID="error-boundary-reload"
      >
        <Text style={styles.buttonText}>{i18n.t('common:errorBoundary.reload')}</Text>
      </TouchableOpacity>
      {error && !anonymousDiagnosticsEnabled ? (
        <>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setEnableFutureReports((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: enableFutureReports }}
            accessibilityLabel={i18n.t('common:errorBoundary.diagnosticsCheckbox')}
            testID="error-boundary-diagnostics-checkbox"
          >
            <View style={[styles.checkbox, enableFutureReports && styles.checkboxChecked]} />
            <Text style={styles.checkboxLabel}>{i18n.t('common:errorBoundary.diagnosticsCheckbox')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.reportButton, reportState === 'sent' && styles.reportButtonSent]}
            onPress={handleReport}
            disabled={reportState === 'sending' || reportState === 'sent'}
            accessibilityRole="button"
            accessibilityLabel={reportLabel}
            testID="error-boundary-report"
          >
            <Text style={styles.buttonText}>{reportLabel}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  )
}

/**
 * Root error boundary. Catches otherwise-fatal render errors, forwards them to
 * the (opt-in, sanitized) crash-reporting service, and shows a minimal recovery
 * screen instead of a white/crashed app.
 *
 * The fallback is intentionally self-contained: it does not depend on the theme
 * context or any hook (a class boundary can't use hooks, and the error may have
 * originated inside a provider). Colors match the app's dark canvas and are
 * legible in both schemes. All strings are localized via the i18n singleton.
 *
 * `captureHandledError` is gated on standing Anonymous Diagnostics consent
 * (see services/sentry.ts beforeSend), so this boundary never transmits
 * anything passively without consent.
 */
export class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    // Forwarded to Sentry only if the user opted in; the error is normalized and
    // scrubbed inside captureHandledError before any transmission. The manual
    // "Report this crash" button (see RootErrorBoundaryFallback) is a SEPARATE
    // path that works even when this automatic capture was skipped because
    // reporting is off.
    captureHandledError(error, { tag: 'render_error_boundary' })
  }

  handleReload = () => {
    // Attempt a JS reload; if unavailable (dev/Expo Go) just clear the boundary
    // so a re-render can recover.
    Updates.reloadAsync().catch(() => {
      this.setState({ hasError: false, error: null })
    })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return <RootErrorBoundaryFallback onReload={this.handleReload} error={this.state.error ?? undefined} />
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: { color: '#e6edf3', fontSize: 20, fontWeight: '600', textAlign: 'center' },
  message: { color: '#8b949e', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  button: {
    marginTop: 12,
    backgroundColor: '#238636',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  reportButton: {
    marginTop: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  reportButtonSent: {
    borderColor: '#238636',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    minHeight: 44,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#30363d',
  },
  checkboxChecked: {
    backgroundColor: '#238636',
    borderColor: '#238636',
  },
  checkboxLabel: { color: '#e6edf3', fontSize: 14, flexShrink: 1 },
})
