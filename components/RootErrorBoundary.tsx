import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
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
 * `error` is optional: when present (a real catch), a "Report this crash"
 * button is shown. It works EVEN WHEN standing crash reporting is off — this
 * is a single, explicit, user-initiated action (see reportOneShot), the same
 * category as the Help & Feedback flow, which is likewise independent of the
 * consent toggle. It never reads or changes the persisted setting itself;
 * only the follow-up upsell (accepted or declined) does that.
 */
export function RootErrorBoundaryFallback({
  onReload,
  error,
}: {
  onReload: () => void
  error?: Error
}) {
  const [reportState, setReportState] = useState<ReportState>('idle')
  const crashReportingEnabled = useSettingsStore((s) => s.crashReportingEnabled)
  const upsellDismissed = useSettingsStore((s) => s.crashReportingUpsellDismissed)
  const setCrashReportingEnabled = useSettingsStore((s) => s.setCrashReportingEnabled)
  const setCrashReportingUpsellDismissed = useSettingsStore((s) => s.setCrashReportingUpsellDismissed)

  const showUpsell = () => {
    Alert.alert(
      i18n.t('common:errorBoundary.upsell.title'),
      i18n.t('common:errorBoundary.upsell.message'),
      [
        {
          text: i18n.t('common:errorBoundary.upsell.notNow'),
          style: 'cancel',
          onPress: () => setCrashReportingUpsellDismissed(true),
        },
        {
          text: i18n.t('common:errorBoundary.upsell.enable'),
          onPress: () => setCrashReportingEnabled(true),
        },
      ],
    )
  }

  const handleReport = async () => {
    if (!error || reportState === 'sending') return
    setReportState('sending')
    const eventId = await reportOneShot(error, { tag: 'render_error_boundary_manual' })
    setReportState(eventId ? 'sent' : 'failed')
    // Only offer the upsell after a successful one-shot send, when standing
    // reporting is currently off and the user hasn't already said "not now".
    if (eventId && !crashReportingEnabled && !upsellDismissed) {
      showUpsell()
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
      {error ? (
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
 * `captureHandledError` is a no-op when the user has not opted into crash
 * reporting, so this boundary never transmits anything without consent.
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
})
