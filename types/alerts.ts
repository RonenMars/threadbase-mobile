import type { ReactNode } from 'react'

export const TOAST_DEFAULT_TIMEOUT_MS = 5000

export type AlertLevel = 'critical' | 'error' | 'warning' | 'info'

export const ALERT_LEVEL_RANK: Record<AlertLevel, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
}

export type AlertCause =
  | `server:${string}`
  | `query:${string}`
  | `host-pressure:${string}`
  | `cache:${string}`
  | `session:${string}`
  | 'servers:summary'

export const CAUSE_SERVERS_SUMMARY: AlertCause = 'servers:summary'

export function serverCause(id: string): AlertCause {
  return `server:${id}`
}

export function queryCause(category: string): AlertCause {
  return `query:${category}`
}

export function hostPressureCause(id: string): AlertCause {
  return `host-pressure:${id}`
}

export function cacheCause(id: string): AlertCause {
  return `cache:${id}`
}

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
  cause: AlertCause
  level: AlertLevel
  title: string
  message: string
  details?: string
  /** Milliseconds. Honoured for `info` only; other levels ignore it. `null` stays until dismissed. Info defaults to 5000 when omitted. */
  timeout?: number | null
  /** Server error code or `HTTP <status>`, when one is known. */
  code?: string
  /** The raw, unparaphrased error text from the failing request. */
  rawMessage?: string
  /** When true, StatusRow shows Retry. 404s and similar set this false. */
  retryable?: boolean
  /** Whether this row's retry is currently in flight. */
  retrying?: boolean
  hideCloseButton?: boolean
  onPress?: () => void
  onClose?: () => void
  icon?: ReactNode
  testID?: string
} & AlertButton

export type AlertEntry = AlertSpec & {
  id: string
  raisedAt: number
}

export function alertFingerprint(spec: Pick<AlertSpec, 'level' | 'title' | 'message' | 'details'>): string {
  return `${spec.level}\0${spec.title}\0${spec.message}\0${spec.details ?? ''}`
}

export function announceKey(spec: Pick<AlertSpec, 'cause' | 'level'>): string {
  return `${spec.cause}\0${spec.level}`
}
