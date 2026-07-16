/**
 * Centralized sanitization layer for crash reporting, diagnostics, and feedback.
 *
 * PRIVACY-CRITICAL. This is the single chokepoint through which every payload
 * that may leave the device passes. It is written allowlist-first and fails
 * closed: anything not provably safe is removed, and any error during
 * sanitization collapses the value to a redaction marker rather than leaking
 * the original.
 *
 * Threat model — Threadbase handles highly sensitive developer data. The
 * following must NEVER leave the device via a sanitized payload: prompts,
 * agent conversation content, terminal output, source code, file contents,
 * repository names/paths, absolute/home paths, environment variables, API
 * keys, auth tokens/headers, pairing payloads, QR contents, streamer
 * credentials, full server URLs, query parameters, IP addresses, hostnames,
 * WebSocket payloads, request/response bodies, user-entered session names, and
 * clipboard contents.
 *
 * The sanitizer does NOT trust call sites to remember redaction — it strips by
 * default and only keeps values that survive both structural allowlisting and
 * value-pattern scrubbing.
 */

export const REDACTED = '[redacted]'
export const REDACTED_CIRCULAR = '[circular]'
export const REDACTED_TRUNCATED = '[truncated]'
export const REDACTED_DEPTH = '[depth-limit]'

/** Hard limits. Kept conservative on purpose — a smaller payload leaks less. */
export const MAX_STRING_LENGTH = 1024
export const MAX_DEPTH = 8
export const MAX_ARRAY_LENGTH = 100
export const MAX_OBJECT_KEYS = 100
/** Total serialized size ceiling for a sanitized object graph (characters). */
export const MAX_TOTAL_SERIALIZED = 16 * 1024

/**
 * Field names whose VALUE is always dropped, matched case-insensitively as a
 * substring of the key. Blocklist-of-names is a backstop layered ON TOP of the
 * allowlist — it is not the primary defense.
 */
const SECRET_KEY_PATTERNS: readonly RegExp[] = [
  /pass(word|phrase)?/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /\bkey\b/i,
  /auth(orization|entication)?/i,
  /bearer/i,
  /credential/i,
  /cookie/i,
  /session[-_]?(id|token|key)/i,
  /signature/i,
  /\bsig\b/i,
  /private/i,
  /\bpin\b/i,
  /\bdsn\b/i,
  /client[-_]?id/i,
  /device[-_]?id/i,
]

/**
 * Field names whose value is user/session content or an identifier we never
 * want to correlate on. Dropped regardless of value shape.
 */
const CONTENT_KEY_PATTERNS: readonly RegExp[] = [
  /url/i,
  /uri/i,
  /href/i,
  /\bhost(name)?\b/i,
  /\bip\b/i,
  /\baddress\b/i,
  /\bpath\b/i,
  /\bfile(name)?\b/i,
  /\bdir(ectory)?\b/i,
  /\brepo(sitory)?\b/i,
  /\bbranch\b/i,
  /\bproject\b/i,
  /\bmachine(name)?\b/i,
  /\bdevice[-_]?name\b/i,
  /prompt/i,
  /\bdraft\b/i,
  /message/i,
  /\bcontent\b/i,
  /\bbody\b/i,
  /\boutput\b/i,
  /terminal/i,
  /\bpreview\b/i,
  /\btitle\b/i,
  /\bname\b/i,
  /\blabel\b/i,
  /\bquery\b/i,
  /\bpayload\b/i,
  /\bheaders?\b/i,
  /\bemail\b/i,
  /\baccount\b/i,
  /\bcwd\b/i,
  /\benv\b/i,
  /clipboard/i,
]

/**
 * Value-shape patterns. A STRING VALUE matching any of these is redacted even
 * when its key looks innocuous — this catches secrets/PII that leak through
 * generically named fields (`value`, `data`, `text`, positional args, etc.).
 */
const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  // JWT (header.payload.signature)
  /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/,
  // Bearer / auth header value
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  // Prefixed API-key / token: a known prefix followed by one or more
  // underscore/hyphen-separated segments (e.g. tb_live_9f8a…, sk-…, api_key_…).
  /\b(tb|sk|pk|rk|ak|api|key|tok|secret)(?:[-_][A-Za-z0-9]+){1,}\b/i,
  // AWS-style access key id
  /\bAKIA[0-9A-Z]{12,}\b/,
  // Long hex blob (>= 32 hex chars — hashes, raw tokens). Requires at least one
  // digit AND one letter so a run of a single repeated char (e.g. "aaaa…") is
  // left to length-truncation rather than redacted as a false-positive secret.
  /(?=[0-9a-f]{32,})(?=.*[0-9])(?=.*[a-f])[0-9a-f]{32,}/i,
  // Long high-entropy base64-ish blob: >= 40 chars of base64 alphabet that
  // mixes at least one lowercase, one uppercase, and one digit (a run of a
  // single repeated character is not a secret and is left to truncation).
  /(?=[A-Za-z0-9+/]{40,}={0,2})(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])[A-Za-z0-9+/]{40,}={0,2}/,
  // GitHub-style tokens
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/,
]

/**
 * Value-shape patterns for URLs / paths / IPs / emails. These are content, not
 * secrets, but equally must not leak. Redacted wherever they appear as a value.
 */
const CONTENT_VALUE_PATTERNS: readonly RegExp[] = [
  // Any scheme://... URL (http, https, ws, wss, file, threadbase, …)
  /\b[a-z][a-z0-9+.-]*:\/\/\S+/i,
  // Absolute POSIX path (>= 2 segments so we don't nuke "/" or "/x")
  /(^|[\s"'([{])\/(?:[\w.-]+\/)+[\w.-]*/,
  // Home-relative path
  /~\/[\w./-]+/,
  // Windows path
  /\b[A-Za-z]:\\[^\s"']+/,
  // IPv4 (with optional port)
  /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?\b/,
  // IPv6 (loose)
  /\b(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}\b/i,
  // Email
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  // Bare hostname / FQDN with no scheme (e.g. `prod.tunnel.example.com`,
  // `my-macbook.local`). Restricted to mDNS/LAN suffixes and a curated set of
  // real public TLDs so it does NOT match dotted enum tokens (`app.lifecycle`),
  // source filenames (`sanitize.ts`), or version strings (`1.0.0`). Catches
  // tunnel/LAN hostnames that appear in free-form error messages.
  /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:local|internal|lan|home|com|net|org|io|dev|sh|app|co|cloud|xyz|me|ai|gg|tv|us|uk|de|fr|tunnel)\b/i,
]

function keyMatches(key: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((re) => re.test(key))
}

/**
 * True if a string is a safe enum-like token: snake/dot/colon/hyphen-cased,
 * no whitespace, bounded length. Natural-language content (prompts, session
 * names, terminal output) always contains spaces/punctuation and fails this,
 * which is exactly why we gate free-form breadcrumb messages on it.
 */
export function isSafeEnumToken(value: string): boolean {
  return value.length > 0 && value.length <= 64 && /^[a-z0-9_.:-]+$/i.test(value)
}

/**
 * Normalize a key so word-boundary patterns match across casing conventions:
 * camelCase, PascalCase, snake_case, kebab-case, and dotted paths all collapse
 * to space-separated lowercase words. Without this, `\bname\b` would miss
 * `sessionName`, `projectPath` would miss `\bpath\b`, etc.
 */
function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase boundary
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ACRONYMWord boundary
    .replace(/[_\-.:]+/g, ' ') // separators
    .toLowerCase()
}

/** True if the key names something that must always be dropped. */
function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key)
  return (
    keyMatches(key, SECRET_KEY_PATTERNS) ||
    keyMatches(key, CONTENT_KEY_PATTERNS) ||
    keyMatches(normalized, SECRET_KEY_PATTERNS) ||
    keyMatches(normalized, CONTENT_KEY_PATTERNS)
  )
}

/** True if a string VALUE looks like a secret or PII/content regardless of key. */
export function valueLooksSensitive(value: string): boolean {
  return (
    SECRET_VALUE_PATTERNS.some((re) => re.test(value)) ||
    CONTENT_VALUE_PATTERNS.some((re) => re.test(value))
  )
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value
  return value.slice(0, MAX_STRING_LENGTH) + REDACTED_TRUNCATED
}

/**
 * Scrub a raw string value: redact entirely if it looks sensitive, otherwise
 * truncate to the length cap. Used for free-form strings whose key is unknown
 * or generic.
 */
export function scrubString(value: string): string {
  if (valueLooksSensitive(value)) return REDACTED
  return truncateString(value)
}

type Primitive = string | number | boolean | null

function isPlainPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

/**
 * Recursively sanitize an arbitrary value into a plain, safe, serializable
 * structure. Removes sensitive keys, scrubs sensitive string values, caps
 * depth/breadth/length, and breaks cycles. Never throws — on any internal
 * error it returns REDACTED for that node.
 */
function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  try {
    if (value === undefined) return undefined
    if (isPlainPrimitive(value)) {
      if (typeof value === 'string') return scrubString(value)
      if (typeof value === 'number' && !Number.isFinite(value)) return null
      return value
    }

    // Non-plain primitives (bigint, symbol, function) are never safe to emit.
    const t = typeof value
    if (t === 'bigint' || t === 'symbol' || t === 'function') return REDACTED

    if (depth >= MAX_DEPTH) return REDACTED_DEPTH

    if (value instanceof Date) {
      // Coarse ISO date only (no time) to avoid precise-timestamp correlation.
      return value.toISOString().slice(0, 10)
    }

    if (value instanceof Error) {
      return sanitizeValue(normalizeError(value), depth + 1, seen)
    }

    if (Array.isArray(value)) {
      if (seen.has(value)) return REDACTED_CIRCULAR
      seen.add(value)
      const out: unknown[] = []
      for (let i = 0; i < value.length && i < MAX_ARRAY_LENGTH; i++) {
        const s = sanitizeValue(value[i], depth + 1, seen)
        if (s !== undefined) out.push(s)
      }
      seen.delete(value)
      if (value.length > MAX_ARRAY_LENGTH) out.push(REDACTED_TRUNCATED)
      return out
    }

    if (typeof value === 'object') {
      if (seen.has(value)) return REDACTED_CIRCULAR
      seen.add(value)
      const src = value as Record<string, unknown>
      const out: Record<string, unknown> = {}
      let keyCount = 0
      for (const key of Object.keys(src)) {
        if (keyCount >= MAX_OBJECT_KEYS) {
          out['…'] = REDACTED_TRUNCATED
          break
        }
        keyCount++
        if (isSensitiveKey(key)) {
          out[key] = REDACTED
          continue
        }
        const s = sanitizeValue(src[key], depth + 1, seen)
        if (s !== undefined) out[key] = s
      }
      seen.delete(value)
      return out
    }

    return REDACTED
  } catch {
    // Fail closed: never surface the original value on error.
    return REDACTED
  }
}

/**
 * Public entry point: sanitize an arbitrary value into a safe, serializable
 * structure with a total-size ceiling. Guaranteed not to throw and never to
 * return the original object graph.
 */
export function sanitize(value: unknown): unknown {
  let result: unknown
  try {
    result = sanitizeValue(value, 0, new WeakSet<object>())
  } catch {
    return REDACTED
  }
  return enforceTotalSize(result)
}

/**
 * Enforce a total serialized-size ceiling. If the sanitized graph is still too
 * large after per-field caps, collapse it to a safe marker rather than sending
 * an oversized payload.
 */
function enforceTotalSize(value: unknown): unknown {
  // `undefined` is a valid sanitized result (a dropped value) — pass through.
  if (value === undefined) return undefined
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) return REDACTED
    if (serialized.length <= MAX_TOTAL_SERIALIZED) return value
    return { _truncated: true, note: REDACTED_TRUNCATED }
  } catch {
    // Serialization itself failed (e.g. a value we could not tame) — fail closed.
    return REDACTED
  }
}

export interface NormalizedError {
  name: string
  message: string
  stack?: string
}

/**
 * Normalize an unknown thrown value into a safe {name, message, stack}. The
 * message is scrubbed for secrets/URLs/paths; the stack is passed through the
 * dedicated stack scrubber. Handles non-Error throws, nulls, and circular
 * error causes.
 */
export function normalizeError(err: unknown): NormalizedError {
  try {
    if (err instanceof Error) {
      return {
        name: typeof err.name === 'string' ? truncateString(err.name) : 'Error',
        message: scrubString(err.message ?? ''),
        stack: err.stack ? scrubStack(err.stack) : undefined,
      }
    }
    if (typeof err === 'string') {
      return { name: 'Error', message: scrubString(err) }
    }
    if (err && typeof err === 'object') {
      const rec = err as Record<string, unknown>
      const message =
        typeof rec.message === 'string' ? scrubString(rec.message) : REDACTED
      const name = typeof rec.name === 'string' ? truncateString(rec.name) : 'Error'
      const stack = typeof rec.stack === 'string' ? scrubStack(rec.stack) : undefined
      return { name, message, stack }
    }
    return { name: 'Error', message: REDACTED }
  } catch {
    return { name: 'Error', message: REDACTED }
  }
}

/**
 * Scrub a stack trace. Stack frames legitimately need to survive for Sentry to
 * symbolicate, but they can embed absolute file paths, home dirs, and query
 * strings. We redact URL/path/secret substrings line-by-line while keeping the
 * frame structure (function names, bundle offsets) intact, and cap the length.
 */
export function scrubStack(stack: string): string {
  try {
    const lines = stack.split('\n').slice(0, 60)
    const scrubbed = lines.map((line) => {
      let out = line
      for (const re of SECRET_VALUE_PATTERNS) {
        out = out.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), REDACTED)
      }
      // Redact scheme URLs and home paths but preserve bundle-relative frames.
      out = out.replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, REDACTED)
      out = out.replace(/~\/[\w./-]+/g, REDACTED)
      out = out.replace(/\b[A-Za-z]:\\[^\s"')]+/g, REDACTED)
      // Redact absolute filesystem paths, but keep a trailing basename so the
      // frame still names the file (basename is app source, not user data).
      out = out.replace(/(?:\/[\w.-]+){2,}\/([\w.-]+)/g, `${REDACTED}/$1`)
      return out
    })
    return truncateString(scrubbed.join('\n'))
  } catch {
    return REDACTED
  }
}

/* -------------------------------------------------------------------------- */
/* Sentry event / breadcrumb sanitization (allowlist layer)                   */
/* -------------------------------------------------------------------------- */

/**
 * Minimal structural view of a Sentry event. We deliberately do not import the
 * SDK's `Event` type here so the sanitizer stays SDK-version-independent and
 * unit-testable without the native module. Only fields we explicitly allowlist
 * are read; every other field on the incoming event is discarded.
 */
export interface SentryLikeEvent {
  [key: string]: unknown
}

export interface SentryLikeBreadcrumb {
  [key: string]: unknown
}

/**
 * Top-level Sentry event keys that are structurally safe to KEEP (their values
 * are still recursively re-sanitized). Everything not in this set — `request`,
 * `server_name`, `user` (beyond a safe id), `extra`, `modules`, `contexts`
 * beyond the allowlisted sub-keys, etc. — is dropped entirely.
 */
const EVENT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  'event_id',
  'timestamp',
  'platform',
  'level',
  'logger',
  'environment',
  'release',
  'dist',
  'sdk',
  'tags',
  'fingerprint',
  'exception',
  'breadcrumbs',
  'contexts',
  'user',
])

/** Only these `contexts.*` blocks survive, and only their safe sub-fields. */
const CONTEXT_APP_KEYS: ReadonlySet<string> = new Set([
  'app_version',
  'app_build',
  'app_identifier',
  'app_start_time',
])
const CONTEXT_OS_KEYS: ReadonlySet<string> = new Set(['name', 'version'])
const CONTEXT_DEVICE_SAFE_KEYS: ReadonlySet<string> = new Set([
  'simulator',
  'arch',
])
const CONTEXT_RUNTIME_KEYS: ReadonlySet<string> = new Set(['name', 'version'])

function sanitizeExceptionValue(exc: unknown): unknown {
  if (!exc || typeof exc !== 'object') return undefined
  const rec = exc as Record<string, unknown>
  const out: Record<string, unknown> = {}
  if (typeof rec.type === 'string') out.type = truncateString(rec.type)
  if (typeof rec.value === 'string') out.value = scrubString(rec.value)
  if (typeof rec.module === 'string') out.module = scrubString(rec.module)
  // Keep stacktrace frames but scrub each frame's paths/vars.
  const st = rec.stacktrace as { frames?: unknown[] } | undefined
  if (st && Array.isArray(st.frames)) {
    out.stacktrace = { frames: st.frames.slice(-60).map(sanitizeStackFrame) }
  }
  return out
}

function sanitizeStackFrame(frame: unknown): unknown {
  if (!frame || typeof frame !== 'object') return {}
  const f = frame as Record<string, unknown>
  const out: Record<string, unknown> = {}
  // function name and module are app symbols — keep, scrubbed.
  if (typeof f.function === 'string') out.function = scrubString(f.function)
  if (typeof f.module === 'string') out.module = scrubString(f.module)
  // filename may be an absolute path — reduce to basename via scrubbing.
  if (typeof f.filename === 'string') out.filename = scrubString(f.filename)
  if (typeof f.abs_path === 'string') out.abs_path = scrubString(f.abs_path)
  if (typeof f.lineno === 'number') out.lineno = f.lineno
  if (typeof f.colno === 'number') out.colno = f.colno
  if (typeof f.in_app === 'boolean') out.in_app = f.in_app
  if (typeof f.platform === 'string') out.platform = truncateString(f.platform)
  // Explicitly DROP `vars` (local variables can contain secrets/user content)
  // and `pre_context`/`context_line`/`post_context` (source code).
  return out
}

function sanitizeContexts(contexts: unknown): Record<string, unknown> | undefined {
  if (!contexts || typeof contexts !== 'object') return undefined
  const src = contexts as Record<string, unknown>
  const out: Record<string, unknown> = {}

  const pick = (block: unknown, allowed: ReadonlySet<string>): Record<string, unknown> | undefined => {
    if (!block || typeof block !== 'object') return undefined
    const b = block as Record<string, unknown>
    const o: Record<string, unknown> = {}
    for (const k of Object.keys(b)) {
      if (allowed.has(k)) {
        const v = sanitizeValue(b[k], 0, new WeakSet<object>())
        if (v !== undefined) o[k] = v
      }
    }
    return Object.keys(o).length ? o : undefined
  }

  const app = pick(src.app, CONTEXT_APP_KEYS)
  if (app) out.app = app
  const os = pick(src.os, CONTEXT_OS_KEYS)
  if (os) out.os = os
  const device = pick(src.device, CONTEXT_DEVICE_SAFE_KEYS)
  if (device) out.device = device
  const runtime = pick(src.runtime, CONTEXT_RUNTIME_KEYS)
  if (runtime) out.runtime = runtime

  return Object.keys(out).length ? out : undefined
}

/**
 * `user` may only ever carry an anonymous, non-network id we minted for issue
 * grouping. Strip email, username, ip_address, and every other field.
 */
function sanitizeUser(user: unknown): { id: string } | undefined {
  if (!user || typeof user !== 'object') return undefined
  const id = (user as Record<string, unknown>).id
  if (typeof id === 'string' && id.length > 0 && id.length <= 64 && !valueLooksSensitive(id)) {
    return { id }
  }
  return undefined
}

/** Tags must be a flat map of short, safe scalar strings. */
function sanitizeTags(tags: unknown): Record<string, string> | undefined {
  if (!tags || typeof tags !== 'object') return undefined
  const src = tags as Record<string, unknown>
  const out: Record<string, string> = {}
  let count = 0
  for (const key of Object.keys(src)) {
    if (count >= 50) break
    if (isSensitiveKey(key)) continue
    const raw = src[key]
    if (raw == null) continue
    const str = typeof raw === 'string' ? raw : typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : ''
    if (!str) continue
    if (valueLooksSensitive(str)) continue
    out[key] = truncateString(str).slice(0, 200)
    count++
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Sanitize a single Sentry breadcrumb. Breadcrumbs are the highest-risk vector
 * (navigation URLs, http request metadata, console output), so we keep only a
 * generic shape: category, level, type, a scrubbed message, and a sanitized
 * `data` object. Any breadcrumb from an http/xhr/fetch/navigation source is
 * dropped outright — those inherently carry URLs/payloads.
 */
export function sanitizeBreadcrumb(
  breadcrumb: SentryLikeBreadcrumb | null | undefined,
): SentryLikeBreadcrumb | null {
  try {
    if (!breadcrumb || typeof breadcrumb !== 'object') return null
    const b = breadcrumb as Record<string, unknown>
    const category = typeof b.category === 'string' ? b.category.toLowerCase() : ''
    const type = typeof b.type === 'string' ? b.type.toLowerCase() : ''

    // Drop network / navigation / user-interaction breadcrumbs entirely — they
    // carry URLs, request/response metadata, or tapped-element text.
    const DROP = ['http', 'xhr', 'fetch', 'navigation', 'ui.click', 'ui.input', 'console']
    if (DROP.some((d) => category.includes(d) || type.includes(d))) return null

    const out: Record<string, unknown> = {}
    if (typeof b.category === 'string') out.category = truncateString(b.category).slice(0, 64)
    if (typeof b.level === 'string') out.level = truncateString(b.level).slice(0, 16)
    if (typeof b.type === 'string') out.type = truncateString(b.type).slice(0, 32)
    if (typeof b.message === 'string') {
      // Breadcrumb messages are free-form and value-pattern detection cannot
      // catch arbitrary natural-language content (a prompt, a session name).
      // So we keep a message ONLY when it looks like a safe enum token
      // (snake/dot/colon-cased, no whitespace, bounded length) — which is all
      // our own instrumentation emits. Anything else is dropped.
      if (isSafeEnumToken(b.message) && !valueLooksSensitive(b.message)) {
        out.message = b.message
      }
    }
    if (b.data && typeof b.data === 'object') {
      const data = sanitizeBreadcrumbData(b.data as Record<string, unknown>)
      if (data && Object.keys(data).length) out.data = data
    }
    return out
  } catch {
    return null
  }
}

/**
 * Sanitize a breadcrumb `data` map. Stricter than the generic sanitizer: STRING
 * values are kept only when they are safe enum tokens (no free-form prose), and
 * only shallow scalar values are allowed. This prevents a caller from smuggling
 * arbitrary text — which value-shape detection cannot catch — through a
 * breadcrumb's data under an innocuously-named key.
 */
function sanitizeBreadcrumbData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  let count = 0
  for (const key of Object.keys(data)) {
    if (count >= 20) break
    if (isSensitiveKey(key)) continue
    const v = data[key]
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v
      count++
    } else if (typeof v === 'boolean') {
      out[key] = v
      count++
    } else if (typeof v === 'string' && isSafeEnumToken(v) && !valueLooksSensitive(v)) {
      out[key] = v
      count++
    }
    // Everything else (objects, arrays, free-form strings) is dropped.
  }
  return out
}

/**
 * Sanitize a full Sentry event through the allowlist. Returns a new event with
 * only allowlisted top-level keys, each recursively re-sanitized. Returns null
 * to DROP the event when it cannot be confidently sanitized (per the "drop any
 * event that cannot be confidently sanitized" requirement).
 */
export function sanitizeEvent(
  event: SentryLikeEvent | null | undefined,
): SentryLikeEvent | null {
  try {
    if (!event || typeof event !== 'object') return null
    const src = event as Record<string, unknown>

    // User Feedback events carry content the user AUTHORED and EXPLICITLY chose
    // to submit (their message + optional reply email). Those specific fields
    // are allowed to pass (length-capped, not shape-redacted) — but every other
    // part of the feedback event still goes through the standard allowlist.
    if (src.type === 'feedback') {
      return sanitizeFeedbackEvent(src)
    }

    const out: Record<string, unknown> = {}

    for (const key of Object.keys(src)) {
      if (!EVENT_ALLOWED_KEYS.has(key)) continue // allowlist: drop everything else
      const value = src[key]
      switch (key) {
        case 'tags': {
          const tags = sanitizeTags(value)
          if (tags) out.tags = tags
          break
        }
        case 'user': {
          const user = sanitizeUser(value)
          if (user) out.user = user
          break
        }
        case 'contexts': {
          const contexts = sanitizeContexts(value)
          if (contexts) out.contexts = contexts
          break
        }
        case 'breadcrumbs': {
          const arr = Array.isArray(value) ? value : []
          const crumbs = arr
            .slice(-30)
            .map((c) => sanitizeBreadcrumb(c as SentryLikeBreadcrumb))
            .filter((c): c is SentryLikeBreadcrumb => c !== null)
          if (crumbs.length) out.breadcrumbs = crumbs
          break
        }
        case 'exception': {
          // Sentry shape: { values: ExceptionValue[] }
          const values = (value as { values?: unknown[] } | undefined)?.values
          if (Array.isArray(values)) {
            const sanitized = values
              .map(sanitizeExceptionValue)
              .filter((v): v is Record<string, unknown> => v !== undefined)
            if (sanitized.length) out.exception = { values: sanitized }
          }
          break
        }
        case 'fingerprint': {
          if (Array.isArray(value)) {
            out.fingerprint = value
              .filter((v): v is string => typeof v === 'string')
              .map((v) => scrubString(v))
              .slice(0, 10)
          }
          break
        }
        case 'sdk':
        case 'event_id':
        case 'timestamp':
        case 'platform':
        case 'level':
        case 'logger':
        case 'environment':
        case 'release':
        case 'dist': {
          // Simple, low-risk scalars/objects — pass through the generic sanitizer.
          const v = sanitizeValue(value, 0, new WeakSet<object>())
          if (v !== undefined) out[key] = v
          break
        }
        default:
          break
      }
    }

    // An event with no exception AND no message is not useful and risks being a
    // stray auto-instrumentation event we couldn't classify — but we keep it if
    // it carries an event_id and level, since dropping real crashes is worse.
    return enforceTotalSize(out) as SentryLikeEvent
  } catch {
    // Fail closed: if we cannot sanitize, we do not send.
    return null
  }
}

/** Cap for user-authored feedback message text. */
export const MAX_FEEDBACK_MESSAGE_LENGTH = 4000

/**
 * Sanitize a Sentry User Feedback event. The user's message and reply email are
 * content they explicitly typed and chose to submit, so they pass through
 * (length-capped, not shape-redacted). All OTHER top-level keys go through the
 * standard event allowlist, and every non-feedback part of `contexts` is
 * re-sanitized. Returns null if there is no message to send.
 */
function sanitizeFeedbackEvent(src: Record<string, unknown>): SentryLikeEvent | null {
  const feedbackCtx = (src.contexts as { feedback?: Record<string, unknown> } | undefined)?.feedback
  if (!feedbackCtx || typeof feedbackCtx !== 'object') return null

  const message = typeof feedbackCtx.message === 'string' ? feedbackCtx.message : ''
  const trimmed = message.trim()
  if (!trimmed) return null

  const safeFeedback: Record<string, unknown> = {
    message: trimmed.slice(0, MAX_FEEDBACK_MESSAGE_LENGTH),
    source: 'app.feedback_form',
  }
  // Optional reply email — kept as-is (user-provided contact), length-bounded.
  const email = feedbackCtx.contact_email ?? feedbackCtx.email
  if (typeof email === 'string' && email.trim()) {
    safeFeedback.contact_email = email.trim().slice(0, 254)
  }
  if (typeof feedbackCtx.associated_event_id === 'string') {
    const id = feedbackCtx.associated_event_id
    if (/^[a-f0-9-]{8,64}$/i.test(id)) safeFeedback.associated_event_id = id
  }

  const out: Record<string, unknown> = {
    type: 'feedback',
    contexts: { feedback: safeFeedback },
  }
  // Carry through only safe scalar metadata from the standard allowlist.
  for (const key of ['event_id', 'timestamp', 'platform', 'level', 'environment', 'release', 'dist'] as const) {
    if (key in src) {
      const v = sanitizeValue(src[key], 0, new WeakSet<object>())
      if (v !== undefined) out[key] = v
    }
  }
  if (src.tags) {
    const tags = sanitizeTags(src.tags)
    if (tags) out.tags = tags
  }
  if (src.user) {
    const user = sanitizeUser(src.user)
    if (user) out.user = user
  }
  return enforceTotalSize(out) as SentryLikeEvent
}
