import type { DiffHunk, DiffLine, Message, MessageContent } from '@/types/api'

export type ReviewFileKind = 'edited' | 'written' | 'diff' | 'unknown'

export interface ReviewFile {
  path: string
  kind: ReviewFileKind
  hunks: DiffHunk[]
  added: number
  removed: number
  incompleteReasons: string[]
  oversized: boolean
  sourceToolNames: string[]
}

export interface ReviewSummary {
  files: ReviewFile[]
  totalAdded: number
  totalRemoved: number
  incomplete: boolean
  hasOversized: boolean
}

const EDIT_TOOLS = new Set(['Edit', 'edit', 'MultiEdit', 'multiedit'])
const WRITE_TOOLS = new Set(['Write', 'write', 'NotebookEdit', 'NotebookEditCell'])
const LARGE_FILE_LINE_CAP = 400
const LARGE_REVIEW_FILE_CAP = 80

function asString(value: string | number | boolean | null | undefined | object): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readInputString(input: Record<string, string | number | boolean | null | object | undefined>, key: string): string | null {
  return asString(input[key])
}

type MultiEditRow = {
  old_string?: string
  new_string?: string
}


function countHunkChanges(hunks: DiffHunk[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'addition') added++
      else if (line.type === 'deletion') removed++
    }
  }
  return { added, removed }
}

function linesFromText(text: string, type: DiffLine['type']): DiffLine[] {
  if (text.length === 0) return []
  return text.split('\n').map((content) => ({ type, content }))
}

/** Build a single hunk from old/new string pairs (Edit tool). */
export function hunkFromEdit(oldString: string, newString: string): DiffHunk {
  const deletions = linesFromText(oldString, 'deletion')
  const additions = linesFromText(newString, 'addition')
  return {
    oldStart: 1,
    oldLines: Math.max(1, deletions.length),
    newStart: 1,
    newLines: Math.max(1, additions.length),
    lines: [...deletions, ...additions],
  }
}

/** Treat a full Write payload as all-additions. */
export function hunkFromWrite(content: string): DiffHunk {
  const additions = linesFromText(content, 'addition')
  return {
    oldStart: 0,
    oldLines: 0,
    newStart: 1,
    newLines: Math.max(1, additions.length),
    lines: additions,
  }
}

function pushFile(
  map: Map<string, ReviewFile>,
  path: string,
  kind: ReviewFileKind,
  hunks: DiffHunk[],
  toolName: string,
  incompleteReasons: string[] = [],
): void {
  const existing = map.get(path)
  const mergedHunks = existing ? [...existing.hunks, ...hunks] : hunks
  const { added, removed } = countHunkChanges(mergedHunks)
  const totalLines = mergedHunks.reduce((n, h) => n + h.lines.length, 0)
  const oversized = totalLines > LARGE_FILE_LINE_CAP
  const reasons = [
    ...(existing?.incompleteReasons ?? []),
    ...incompleteReasons,
  ]
  if (oversized && !reasons.includes('oversized')) reasons.push('oversized')

  map.set(path, {
    path,
    kind: existing?.kind === 'written' || kind === 'written' ? 'written' : kind,
    hunks: oversized
      ? mergedHunks.map((h) => ({
          ...h,
          lines: h.lines.slice(0, LARGE_FILE_LINE_CAP),
        }))
      : mergedHunks,
    added,
    removed,
    incompleteReasons: Array.from(new Set(reasons)),
    oversized,
    sourceToolNames: Array.from(new Set([...(existing?.sourceToolNames ?? []), toolName])),
  })
}

function ingestToolUse(map: Map<string, ReviewFile>, block: Extract<MessageContent, { type: 'tool_use' }>): void {
  const name = block.name
  const input = block.input as Record<string, string | number | boolean | null | object | undefined>

  if (EDIT_TOOLS.has(name)) {
    const path = readInputString(input, 'file_path') ?? readInputString(input, 'path')
    if (!path) return

    if (name === 'MultiEdit' || name === 'multiedit') {
      const editsRaw = input.edits
      const edits = Array.isArray(editsRaw) ? (editsRaw as MultiEditRow[]) : []
      if (edits.length === 0) {
        pushFile(map, path, 'edited', [], name, ['missing_edit_payload'])
        return
      }
      for (const edit of edits) {
        const oldString = asString(edit?.old_string) ?? ''
        const newString = asString(edit?.new_string) ?? ''
        if (!oldString && !newString) continue
        pushFile(map, path, 'edited', [hunkFromEdit(oldString, newString)], name)
      }
      return
    }

    const oldString = readInputString(input, 'old_string') ?? ''
    const newString = readInputString(input, 'new_string') ?? ''
    if (!oldString && !newString) {
      pushFile(map, path, 'edited', [], name, ['missing_edit_payload'])
      return
    }
    pushFile(map, path, 'edited', [hunkFromEdit(oldString, newString)], name)
    return
  }

  if (WRITE_TOOLS.has(name)) {
    const path = readInputString(input, 'file_path') ?? readInputString(input, 'path')
    const content = readInputString(input, 'content') ?? readInputString(input, 'new_string') ?? ''
    if (!path) return
    if (!content) {
      pushFile(map, path, 'written', [], name, ['missing_write_payload'])
      return
    }
    pushFile(map, path, 'written', [hunkFromWrite(content)], name)
  }
}

/**
 * Build a read-only review surface from conversation messages.
 * Uses Edit/Write tool payloads and structured diff blocks only —
 * not a full git status (no streamer git API).
 */
export function buildReviewFromMessages(messages: Message[]): ReviewSummary {
  const map = new Map<string, ReviewFile>()

  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'diff') {
        pushFile(map, block.filename, 'diff', block.hunks, 'diff')
        continue
      }
      if (block.type === 'tool_use') {
        ingestToolUse(map, block)
      }
    }
  }

  let files = Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path))
  const truncatedList = files.length > LARGE_REVIEW_FILE_CAP
  if (truncatedList) {
    files = files.slice(0, LARGE_REVIEW_FILE_CAP)
  }

  const totalAdded = files.reduce((n, f) => n + f.added, 0)
  const totalRemoved = files.reduce((n, f) => n + f.removed, 0)
  const incomplete =
    truncatedList ||
    files.some((f) => f.incompleteReasons.length > 0) ||
    files.length === 0
  const hasOversized = files.some((f) => f.oversized)

  return { files, totalAdded, totalRemoved, incomplete, hasOversized }
}

export function formatReviewNote(summary: ReviewSummary, selectedPath?: string): string {
  const lines = [
    'Mobile review note (conversation-derived, may be incomplete vs git status):',
    `Files: ${summary.files.length} · +${summary.totalAdded} / −${summary.totalRemoved}`,
  ]
  if (selectedPath) lines.push(`Focus: ${selectedPath}`)
  for (const file of summary.files.slice(0, 20)) {
    lines.push(`- ${file.path} (+${file.added}/−${file.removed}) [${file.kind}]`)
  }
  if (summary.files.length > 20) lines.push(`…and ${summary.files.length - 20} more`)
  return lines.join('\n')
}
