import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import i18n from '@/lib/i18n'
import { captureHandledError } from '@/services/sentry'
import { font, spacing } from '@/constants/theme'

interface Props {
  children: ReactNode
  /** Optional raw text to show when the child tree throws. */
  rawFallback?: string
  /** Sentry tag so crashes are attributable to the containment site. */
  tag?: string
  onRetry?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Row/list-scoped error boundary. Isolates a bad message/line render so the
 * rest of the session screen stays interactive.
 */
export class RenderErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    try {
      captureHandledError(error, {
        tag: this.props.tag ?? 'render_error_boundary',
      })
    } catch {
      // Sentry must never break containment.
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.hasError) {
      const preview = (this.props.rawFallback ?? this.state.error?.message ?? '').trim()
      return (
        <View style={styles.box} testID="render-error-fallback">
          <Text style={styles.title}>{i18n.t('common:renderError.title')}</Text>
          <Text style={styles.body}>{i18n.t('common:renderError.message')}</Text>
          {preview ? (
            <Text style={styles.raw} numberOfLines={6} selectable>
              {preview}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={this.handleRetry}
            style={styles.retry}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>{i18n.t('common:button.retry')}</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    backgroundColor: '#161b22',
    gap: spacing.xs,
  },
  title: { color: '#e6edf3', fontSize: font.sm, fontWeight: '600' },
  body: { color: '#8b949e', fontSize: font.xs },
  raw: {
    color: '#8b949e',
    fontSize: font.xs,
    fontFamily: 'monospace',
    marginTop: spacing.xs,
  },
  retry: { alignSelf: 'flex-start', marginTop: spacing.xs, paddingVertical: 4 },
  retryText: { color: '#58a6ff', fontSize: font.sm, fontWeight: '500' },
})
