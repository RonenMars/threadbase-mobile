/**
 * Streamer provider health contract (C2) — mirrors
 * `src/services/providers/providerHealth.ts` + capabilities.ts.
 */

import { CLAUDE_CODE_PROVIDER, CODEX_CLI_PROVIDER, type ProviderName } from '@/constants/providers'

export type FreshSessionIdMode = 'explicit' | 'late-bound'
export type ResumeMode = 'native' | 'unsupported'
export type SystemPromptMode = 'flag' | 'positional' | 'unsupported'

export interface ProviderCapabilities {
  freshSessionId: FreshSessionIdMode
  resume: ResumeMode
  systemPrompt: SystemPromptMode
  structuredQuestions: boolean
  permissionGates: boolean
  liveControl: boolean
}

export interface VerifiedAgainst {
  min?: string
  max?: string
  captured: string[]
}

export type ProviderWarningCode =
  | 'provider_not_found'
  | 'version_undetectable'
  | 'version_unverified'

export interface ProviderWarning {
  code: ProviderWarningCode
  message: string
}

export interface ProviderHealth {
  name: ProviderName
  available: boolean
  version: string | null
  verifiedAgainst: VerifiedAgainst
  capabilities: ProviderCapabilities
  warnings: ProviderWarning[]
}

export interface ProvidersResponse {
  providers: ProviderHealth[]
}

/** Generic-terminal fallback when the streamer does not list a provider. */
export const GENERIC_TERMINAL_CAPABILITIES: ProviderCapabilities = {
  freshSessionId: 'late-bound',
  resume: 'unsupported',
  systemPrompt: 'unsupported',
  structuredQuestions: false,
  permissionGates: false,
  liveControl: true,
}

const FRESH: ReadonlySet<string> = new Set(['explicit', 'late-bound'])
const RESUME: ReadonlySet<string> = new Set(['native', 'unsupported'])
const SYSTEM: ReadonlySet<string> = new Set(['flag', 'positional', 'unsupported'])
const WARN: ReadonlySet<string> = new Set([
  'provider_not_found',
  'version_undetectable',
  'version_unverified',
])
const NAMES: ReadonlySet<string> = new Set([CLAUDE_CODE_PROVIDER, CODEX_CLI_PROVIDER])

function isRecord(value: object): value is Record<string, string | number | boolean | null | object | object[]> {
  return !Array.isArray(value)
}

function parseCapabilities(raw: object): ProviderCapabilities | null {
  if (!isRecord(raw)) return null
  const {
    freshSessionId,
    resume,
    systemPrompt,
    structuredQuestions,
    permissionGates,
    liveControl,
  } = raw
  if (typeof freshSessionId !== 'string' || !FRESH.has(freshSessionId)) return null
  if (typeof resume !== 'string' || !RESUME.has(resume)) return null
  if (typeof systemPrompt !== 'string' || !SYSTEM.has(systemPrompt)) return null
  if (typeof structuredQuestions !== 'boolean') return null
  if (typeof permissionGates !== 'boolean') return null
  if (typeof liveControl !== 'boolean') return null
  return {
    freshSessionId: freshSessionId as FreshSessionIdMode,
    resume: resume as ResumeMode,
    systemPrompt: systemPrompt as SystemPromptMode,
    structuredQuestions,
    permissionGates,
    liveControl,
  }
}

function parseVerified(raw: object): VerifiedAgainst | null {
  if (!isRecord(raw)) return null
  const capturedRaw = raw.captured
  if (!Array.isArray(capturedRaw)) return null
  const captured = capturedRaw.filter((v): v is string => typeof v === 'string')
  const out: VerifiedAgainst = { captured }
  if (typeof raw.min === 'string') out.min = raw.min
  if (typeof raw.max === 'string') out.max = raw.max
  return out
}

function parseWarning(raw: object): ProviderWarning | null {
  if (!isRecord(raw)) return null
  if (typeof raw.code !== 'string' || !WARN.has(raw.code)) return null
  if (typeof raw.message !== 'string') return null
  return { code: raw.code as ProviderWarningCode, message: raw.message }
}

function parseProvider(raw: object): ProviderHealth | null {
  if (!isRecord(raw)) return null
  if (typeof raw.name !== 'string' || !NAMES.has(raw.name)) return null
  if (typeof raw.available !== 'boolean') return null
  if (!(raw.version === null || typeof raw.version === 'string')) return null
  if (!raw.verifiedAgainst || typeof raw.verifiedAgainst !== 'object' || Array.isArray(raw.verifiedAgainst)) {
    return null
  }
  if (!raw.capabilities || typeof raw.capabilities !== 'object' || Array.isArray(raw.capabilities)) {
    return null
  }
  const verifiedAgainst = parseVerified(raw.verifiedAgainst)
  const capabilities = parseCapabilities(raw.capabilities)
  if (!verifiedAgainst || !capabilities) return null
  const warningsRaw = Array.isArray(raw.warnings) ? raw.warnings : []
  const warnings: ProviderWarning[] = []
  for (const w of warningsRaw) {
    if (!w || typeof w !== 'object') continue
    const parsed = parseWarning(w)
    if (parsed) warnings.push(parsed)
  }
  return {
    name: raw.name as ProviderName,
    available: raw.available,
    version: raw.version,
    verifiedAgainst,
    capabilities,
    warnings,
  }
}

export function parseProvidersResponse(body: object): ProvidersResponse | null {
  if (!isRecord(body)) return null
  if (!Array.isArray(body.providers)) return null
  const providers: ProviderHealth[] = []
  for (const item of body.providers) {
    if (!item || typeof item !== 'object') continue
    const parsed = parseProvider(item)
    if (parsed) providers.push(parsed)
  }
  return { providers }
}

export function findProviderHealth(
  list: ProviderHealth[] | undefined,
  name: ProviderName,
): ProviderHealth | undefined {
  return list?.find((p) => p.name === name)
}
