import type { ReactNode } from 'react'

export const TOAST_DEFAULT_TIMEOUT_MS = 5000

export type AlertLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical' | 'custom'

export type AlertButtonVariant = 'primary' | 'secondary' | 'destructive'

type AlertButton =
  | { buttonText?: undefined; buttonAction?: undefined; buttonVariant?: undefined }
  | { buttonText: string; buttonAction: () => void; buttonVariant?: AlertButtonVariant }

/** One collapsible row inside a multi-failure banner. */
export type AlertItem = {
  id: string
  title: string
  message: string
  /** Server error code or `HTTP <status>`, when one is known. */
  code?: string
  /** The raw, unparaphrased error text from the failing request. */
  rawMessage?: string
  /** Whether this row's retry is currently in flight — disables its button and shows a "Retrying…" state. */
  retrying?: boolean
  /** When set, tapping the row runs this instead of expanding it in place. */
  onPress?: () => void
} & AlertButton

export type AlertSpec = {
  level: AlertLevel
  title: string
  message: string
  details?: string
  /** Milliseconds. `null` stays until dismissed. Toasts default to 5000 when omitted. */
  timeout?: number | null
  hideCloseButton?: boolean
  onPress?: () => void
  onClose?: () => void
  accent?: string
  icon?: ReactNode
  testID?: string
  /** When set, the banner renders these as an accordion list instead of a single message. */
  items?: AlertItem[]
} & AlertButton

export function alertFingerprint(spec: Pick<AlertSpec, 'level' | 'title' | 'message' | 'details'>): string {
  return `${spec.level}\0${spec.title}\0${spec.message}\0${spec.details ?? ''}`
}
