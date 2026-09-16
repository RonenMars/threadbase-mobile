import { resolveDisplayTitle, type DisplayTitle } from '@/lib/displayTitle'
import { sessionKey, type NameOrigin } from '@/stores/sessionNames'
import type { MultiConversation, MultiSession } from '@/types/api'

export interface StoredName {
  name?: string
  origin?: NameOrigin
}

/** Reads from the store's maps, so a list that selects them re-renders on rename. */
export function storedNameFor(
  names: Record<string, string>,
  origins: Record<string, NameOrigin>,
  serverId: string,
  sessionId: string,
): StoredName {
  const key = sessionKey(serverId, sessionId)
  return { name: names[key], origin: origins[key] }
}

export function basename(path: string | null | undefined): string | undefined {
  return path?.split('/').filter(Boolean).pop()
}

/**
 * Auto slugs saved before the pipeline existed (`does-the-currently-r`) are
 * lossy, so they are dropped and the server's own first line speaks instead.
 * Every other stored name is shown as typed: a manual rename, or a name merged
 * from the server, which carries no origin and may be a rename made elsewhere.
 */
const LEGACY_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

function split(stored: StoredName): { customName?: string } {
  if (!stored.name) return {}
  if (stored.origin !== 'manual' && stored.name.length <= 20 && LEGACY_SLUG.test(stored.name)) return {}
  return { customName: stored.name }
}

/** `intent` is a title the user or assistant wrote; the other two are the quiet rungs of the ladder. */
export type TitleRung = 'intent' | 'command' | 'untitled'

export interface RowTitle {
  title: string
  rung: TitleRung
}

function rungOf(source: DisplayTitle['source']): TitleRung {
  return source === 'command' || source === 'untitled' ? source : 'intent'
}

export function resolveSessionRowTitle(
  session: Pick<MultiSession, 'sessionName' | 'projectName' | 'projectPath' | 'branch'>,
  stored: StoredName,
): RowTitle {
  const { customName } = split(stored)
  const { title, source } = resolveDisplayTitle({
    customName,
    firstMessage: session.sessionName,
    projectName: session.projectName || basename(session.projectPath),
    branch: session.branch,
  })
  return { title: title || session.projectName || session.projectPath, rung: rungOf(source) }
}

function conversationFirstMessage(
  conv: Pick<MultiConversation, 'sessionName' | 'firstMessage'>,
): string | undefined {
  const named = conv.sessionName
  const first = conv.firstMessage?.text
  // The streamer slices session_name at 80 chars; the list still has the full first turn.
  if (named && first && first.startsWith(named)) return first
  return named ?? first
}

export function resolveConversationRowTitle(
  conv: Pick<MultiConversation, 'title' | 'sessionName' | 'branch' | 'firstMessage' | 'lastMessage'> & {
    projectPath?: string | null
  },
  stored: StoredName,
): RowTitle {
  const { customName } = split(stored)
  const firstMessage = conversationFirstMessage(conv)
  const last = conv.lastMessage?.text
  const laterUserMessages =
    last && last !== firstMessage && last !== conv.sessionName && last !== conv.firstMessage?.text
      ? [last]
      : undefined
  const { title, source } = resolveDisplayTitle({
    customName,
    firstMessage,
    laterUserMessages,
    projectName: basename(conv.projectPath),
    branch: conv.branch,
  })
  return { title: title || conv.title, rung: rungOf(source) }
}

export function sessionRowTitle(
  session: Pick<MultiSession, 'sessionName' | 'projectName' | 'projectPath' | 'branch'>,
  stored: StoredName,
): string {
  return resolveSessionRowTitle(session, stored).title
}

export function conversationRowTitle(
  conv: Pick<MultiConversation, 'title' | 'sessionName' | 'branch' | 'firstMessage' | 'lastMessage'> & {
    projectPath?: string | null
  },
  stored: StoredName,
): string {
  return resolveConversationRowTitle(conv, stored).title
}
