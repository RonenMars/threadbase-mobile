/**
 * Types for the in-app Help & Feedback experience. Kept intentionally small and
 * allowlisted — the diagnostics payload here is a strict, safe subset (Phase 3
 * expands the full diagnostics generator). Nothing in these types may hold
 * prompts, terminal output, paths, URLs, credentials, or session content.
 */

export type FeedbackCategory = 'bug' | 'feature' | 'general'

/**
 * The exact, allowlisted technical metadata that may be attached to a feedback
 * submission when the user opts into "Include technical diagnostics". Every
 * field is a build constant or a derived generic enum — see
 * `services/safe-metadata.ts`. This is the shape shown in the diagnostics
 * preview so the user sees precisely what will be sent.
 */
export interface FeedbackDiagnostics {
  appVersion: string
  buildNumber: string
  platform: string
  osVersion: string
  jsEngine: string
  environment: string
  expoRuntimeVersion?: string
  easUpdateId?: string
  easChannel?: string
  /** Generic connection category — never a URL or hostname. */
  connectionMode: 'local' | 'remote' | 'unknown'
  /** Count only — never server URLs, names, or ids. */
  serverCount: number
  /** Whether crash reporting is currently enabled (context for the report). */
  crashReportingEnabled: boolean
}

/** A screenshot the user explicitly attached (already compressed + EXIF-stripped). */
export interface FeedbackAttachment {
  uri: string
  mimeType: string
  /** Approximate byte size after compression, for the size cap. */
  sizeBytes: number
}

/**
 * A complete feedback report assembled by the UI and handed to a
 * FeedbackTransport. `description` and `email` are user-authored content the
 * user has explicitly chosen to submit; `diagnostics` is present only when the
 * user opted in.
 */
export interface FeedbackReport {
  /** Client-generated report id (also used for duplicate-submit prevention). */
  reportId: string
  category: FeedbackCategory
  description: string
  /** Optional reply email entered by the user. */
  email?: string
  /** Present only when the user enabled "Include technical diagnostics". */
  diagnostics?: FeedbackDiagnostics
  /** Present only when the user explicitly attached a screenshot. */
  attachment?: FeedbackAttachment
}

export type FeedbackTransportKind = 'sentry' | 'email' | 'copy'

export interface FeedbackSubmitResult {
  ok: boolean
  /** Which transport actually handled the submission. */
  via: FeedbackTransportKind
  /** Server- or client-assigned report identifier. */
  reportId: string
  /** Associated Sentry event id, when submitted via Sentry. */
  sentryEventId?: string
}
