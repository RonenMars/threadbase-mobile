import { CLAUDE_CODE_PROVIDER, canonicalizeProviderName, providerLabelKey } from '@/constants/providers'
import i18n from '@/lib/i18n'
import type { InfoField } from '@/components/shared/InfoModal'
import type { ConversationDetail, Session } from '@/types/api'

/** The fields both info modals share, under one naming. Absent = not sent. */
export interface InfoSubject {
  /** Threadbase's own session id. Only a live/managed session has one. */
  sessionId?: string
  conversationId: string
  provider?: string | null
  boundConversationId?: string | null
  filePath?: string
  resumedFromConversationId?: string | null
  forkedFromConversationId?: string | null
  parentConversationId?: string | null
  sessionName?: string
  projectName?: string
  projectPath?: string
  account?: string
  messageCount?: number
  lastActivity?: string
}

const TRAILING_UUID_JSONL =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i

// The id the provider itself wrote to disk, read off the transcript file name:
// Claude `<uuid>.jsonl`, Codex `rollout-<ts>-<uuid>.jsonl`, Cursor
// `agent-transcripts/<runId>/<runId>.jsonl` (streamer session-watchers.ts
// watchForCursorTranscript). Without a file, Codex and Cursor sessions carry it
// as `boundConversationId` (their `id` is a placeholder until then), and a
// Claude session's `id` IS the JSONL uuid (streamer types.ts SessionResponse.id).
function providerOnDiskId(s: InfoSubject): string | undefined {
  const fromFile = s.filePath ? TRAILING_UUID_JSONL.exec(s.filePath)?.[1] : undefined
  if (fromFile) return fromFile
  if (s.boundConversationId) return s.boundConversationId
  const provider = canonicalizeProviderName(s.provider)
  if (provider === CLAUDE_CODE_PROVIDER) return s.sessionId ?? s.conversationId
  return undefined
}

function providerLabel(provider: string | null | undefined): string {
  const t = i18n.t
  // providerLabelKey reads a missing provider as Claude; the modal must not.
  if (!canonicalizeProviderName(provider)) return t('sessions:provider.unknown')
  switch (providerLabelKey(provider)) {
    case 'claude':
      return t('sessions:provider.claude')
    case 'codex':
      return t('sessions:provider.codex')
    case 'cursor':
      return t('sessions:provider.cursor')
  }
}

// Called during render, so a language change re-renders with fresh labels.
export function buildSharedInfoFields(s: InfoSubject): InfoField[] {
  const t = i18n.t
  // Rows are merged by value rather than by provider rule: for Claude the
  // session id, conversation id and on-disk id are one uuid and collapse to one
  // row; for Codex/Cursor the session/conversation id is a Threadbase
  // placeholder and the on-disk id differs, so they stay separate.
  const ids: { label: string; value: string | undefined }[] = [
    ...(s.sessionId != null ? [{ label: t('sessions:info.sessionId'), value: s.sessionId }] : []),
    { label: t('sessions:info.conversationId'), value: s.conversationId },
    { label: t('sessions:info.providerId'), value: providerOnDiskId(s) },
  ]
  const idFields: InfoField[] = []
  for (const { label, value } of ids) {
    if (!value) continue
    const same = idFields.find((f) => f.value === value)
    if (same) same.label = `${same.label} / ${label}`
    else idFields.push({ label, value })
  }

  return [
    ...idFields,
    { label: t('sessions:info.provider'), value: providerLabel(s.provider) },
    { label: t('sessions:info.resumedFrom'), value: s.resumedFromConversationId },
    { label: t('sessions:info.forkedFrom'), value: s.forkedFromConversationId },
    { label: t('sessions:info.parentConversation'), value: s.parentConversationId },
    { label: t('sessions:info.sessionName'), value: s.sessionName },
    { label: t('sessions:info.projectName'), value: s.projectName },
    { label: t('sessions:info.projectPath'), value: s.projectPath },
    { label: t('sessions:info.filePath'), value: s.filePath },
    { label: t('sessions:info.account'), value: s.account },
    { label: t('sessions:info.messageCount'), value: s.messageCount != null ? String(s.messageCount) : undefined },
    { label: t('sessions:info.lastActivity'), value: s.lastActivity },
  ]
}

export function sessionInfoSubject(session: Session): InfoSubject {
  return {
    sessionId: session.id,
    conversationId: session.conversationId ?? session.id,
    provider: session.provider,
    boundConversationId: session.boundConversationId,
    filePath: session.filePath,
    resumedFromConversationId: session.resumedFromConversationId,
    forkedFromConversationId: session.forkedFromConversationId,
    parentConversationId: session.parentConversationId,
    sessionName: session.sessionName,
    projectName: session.projectName,
    projectPath: session.projectPath,
    account: session.account,
    messageCount: session.messageCount,
    lastActivity: session.lastActivityAt,
  }
}

export function conversationInfoSubject(conversation: ConversationDetail): InfoSubject {
  const seam = conversation.inheritedHistory
  return {
    conversationId: conversation.id,
    provider: conversation.provider,
    filePath: conversation.filePath,
    // A Codex fork's source arrives as inherited_history.source_id on the detail
    // response, where a session carries forkedFromConversationId.
    forkedFromConversationId: seam?.kind === 'divider' ? seam.sourceId : undefined,
    parentConversationId: conversation.parentConversationId,
    sessionName: conversation.sessionName,
    projectName: conversation.projectName,
    projectPath: conversation.projectPath,
    account: conversation.account,
    messageCount: conversation.messageCount,
    lastActivity: conversation.lastActivity,
  }
}
