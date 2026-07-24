/**
 * Streamer backup/restore contract (C9 / U11).
 * Metadata only — conversations live in provider history on disk.
 */

export interface BackupManifest {
  formatVersion: number
  createdAt: string
  streamerVersion: string
  sourceHost: string
  includesSecrets: boolean
  counts: { projects: number }
}

export interface BackupProject {
  id: string
  path: string
  name: string | null
  createdAt: string
  updatedAt: string
}

export interface BackupArchive {
  manifest: BackupManifest
  projects: BackupProject[]
}

export interface RestorePathMapRule {
  from: string
  to: string
}

export interface RestorePlan {
  create: BackupProject[]
  update: BackupProject[]
  conflict: { incoming: BackupProject; existingId: string }[]
}

export interface RestoreSummary {
  create: number
  update: number
  conflict: number
}

export interface RestoreDryRunResponse {
  applied: false
  summary: RestoreSummary
  plan: RestorePlan
}

export interface RestoreAppliedResponse {
  applied: true
  summary: RestoreSummary
  appliedCount: number
}

export type RestoreResponse = RestoreDryRunResponse | RestoreAppliedResponse

function isRecord(value: object): value is Record<string, string | number | boolean | null | object | object[]> {
  return !Array.isArray(value)
}

function parseProject(raw: object): BackupProject | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string') return null
  if (typeof raw.path !== 'string') return null
  if (!(raw.name === null || typeof raw.name === 'string')) return null
  if (typeof raw.createdAt !== 'string') return null
  if (typeof raw.updatedAt !== 'string') return null
  return {
    id: raw.id,
    path: raw.path,
    name: raw.name,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

function parseManifest(raw: object): BackupManifest | null {
  if (!isRecord(raw)) return null
  if (typeof raw.formatVersion !== 'number') return null
  if (typeof raw.createdAt !== 'string') return null
  if (typeof raw.streamerVersion !== 'string') return null
  if (typeof raw.sourceHost !== 'string') return null
  if (typeof raw.includesSecrets !== 'boolean') return null
  if (!raw.counts || typeof raw.counts !== 'object' || Array.isArray(raw.counts)) return null
  const counts = raw.counts as Record<string, unknown>
  if (typeof counts.projects !== 'number') return null
  return {
    formatVersion: raw.formatVersion,
    createdAt: raw.createdAt,
    streamerVersion: raw.streamerVersion,
    sourceHost: raw.sourceHost,
    includesSecrets: raw.includesSecrets,
    counts: { projects: counts.projects },
  }
}

export function parseBackupArchive(body: object): BackupArchive | null {
  if (!isRecord(body)) return null
  if (!body.manifest || typeof body.manifest !== 'object' || Array.isArray(body.manifest)) return null
  if (!Array.isArray(body.projects)) return null
  const manifest = parseManifest(body.manifest)
  if (!manifest) return null
  const projects: BackupProject[] = []
  for (const item of body.projects) {
    if (!item || typeof item !== 'object') return null
    const parsed = parseProject(item)
    if (!parsed) return null
    projects.push(parsed)
  }
  return { manifest, projects }
}

function parsePlan(raw: object): RestorePlan | null {
  if (!isRecord(raw)) return null
  if (!Array.isArray(raw.create) || !Array.isArray(raw.update) || !Array.isArray(raw.conflict)) {
    return null
  }
  const create: BackupProject[] = []
  for (const item of raw.create) {
    if (!item || typeof item !== 'object') return null
    const p = parseProject(item)
    if (!p) return null
    create.push(p)
  }
  const update: BackupProject[] = []
  for (const item of raw.update) {
    if (!item || typeof item !== 'object') return null
    const p = parseProject(item)
    if (!p) return null
    update.push(p)
  }
  const conflict: RestorePlan['conflict'] = []
  for (const item of raw.conflict) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const row = item as Record<string, unknown>
    if (!row.incoming || typeof row.incoming !== 'object' || Array.isArray(row.incoming)) return null
    if (typeof row.existingId !== 'string') return null
    const incoming = parseProject(row.incoming)
    if (!incoming) return null
    conflict.push({ incoming, existingId: row.existingId })
  }
  return { create, update, conflict }
}

function parseSummary(raw: object): RestoreSummary | null {
  if (!isRecord(raw)) return null
  if (typeof raw.create !== 'number') return null
  if (typeof raw.update !== 'number') return null
  if (typeof raw.conflict !== 'number') return null
  return { create: raw.create, update: raw.update, conflict: raw.conflict }
}

export function parseRestoreResponse(body: object): RestoreResponse | null {
  if (!isRecord(body)) return null
  if (!body.summary || typeof body.summary !== 'object' || Array.isArray(body.summary)) return null
  const summary = parseSummary(body.summary)
  if (!summary) return null

  if (body.applied === false) {
    if (!body.plan || typeof body.plan !== 'object' || Array.isArray(body.plan)) return null
    const plan = parsePlan(body.plan)
    if (!plan) return null
    return { applied: false, summary, plan }
  }

  if (body.applied === true) {
    if (typeof body.appliedCount !== 'number') return null
    return { applied: true, summary, appliedCount: body.appliedCount }
  }

  return null
}

export function parseRestoreConflictBody(body: object): {
  summary: RestoreSummary
  plan: RestorePlan
  message: string
} | null {
  if (!isRecord(body)) return null
  if (body.code !== 'RESTORE_CONFLICT') return null
  if (!body.summary || typeof body.summary !== 'object' || Array.isArray(body.summary)) return null
  if (!body.plan || typeof body.plan !== 'object' || Array.isArray(body.plan)) return null
  const summary = parseSummary(body.summary)
  const plan = parsePlan(body.plan)
  if (!summary || !plan) return null
  const message = typeof body.error === 'string' ? body.error : 'Restore has unresolved conflicts'
  return { summary, plan, message }
}

export function archiveToShareText(archive: BackupArchive): string {
  return JSON.stringify(archive, null, 2)
}
