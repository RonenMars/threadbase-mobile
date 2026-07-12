import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import * as Updates from 'expo-updates'
import i18n from '@/lib/i18n'
import { captureHandledError } from '@/services/sentry'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
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
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    // Forwarded to Sentry only if the user opted in; the error is normalized and
    // scrubbed inside captureHandledError before any transmission.
    captureHandledError(error, { tag: 'render_error_boundary' })
  }

  handleReload = () => {
    // Attempt a JS reload; if unavailable (dev/Expo Go) just clear the boundary
    // so a re-render can recover.
    Updates.reloadAsync().catch(() => {
      this.setState({ hasError: false })
    })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{i18n.t('common:errorBoundary.title')}</Text>
        <Text style={styles.message}>{i18n.t('common:errorBoundary.message')}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={this.handleReload}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('common:errorBoundary.reload')}
          testID="error-boundary-reload"
        >
          <Text style={styles.buttonText}>{i18n.t('common:errorBoundary.reload')}</Text>
        </TouchableOpacity>
      </View>
    )
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
})
