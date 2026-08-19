import type { ReactNode } from 'react'

export const TOAST_DEFAULT_TIMEOUT_MS = 5000

export type AlertLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical' | 'custom'

export type AlertButtonVariant = 'primary' | 'secondary' | 'destructive'

type AlertButton =
  | { buttonText?: undefined; buttonAction?: undefined; buttonVariant?: undefined }
  | { buttonText: string; buttonAction: () => void; buttonVariant?: AlertButtonVariant }

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
} & AlertButton

export function alertFingerprint(spec: Pick<AlertSpec, 'level' | 'title' | 'message' | 'details'>): string {
  return `${spec.level}\0${spec.title}\0${spec.message}\0${spec.details ?? ''}`
}
