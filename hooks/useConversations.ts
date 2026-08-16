import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { AppState } from 'react-native'
import { createApiForServer } from '@/services/api-client'
import { getServerWarmupState } from '@/services/server-warmup'
import { getEtag, setEtag, deleteEtag } from '@/services/etag-store'
import { QUERY_GC_TIME, SEVEN_DAYS } from '@/services/query-client'
import { wsManager } from '@/services/ws-client'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import type { Conversation, ConversationDetail, ConversationFilter, ConversationPage, DiffHunk, Message, MessageContent, MultiConversation, TurnDuration, UnavailableReason } from '@/types/api'
import { mark as traceMark, count as traceCount } from '@/lib/openTrace'
import type { ConversationPageParam } from '@/hooks/conversationCursor'
import {
  deriveCursor,
  isEmptyFirstPage,
  stripFirstPage,
  shouldContinueDrain,
  isCursorValid,
  canTrigger,
  stampTrigger,
  etagOf,
} from '@/hooks/conversationCursor'
import { isCodexInjectedContext } from '@/lib/codexInjectedContext'

// The Go server returns snake_case SessionMeta objects in a plain array.
// This adapter normalises them into the ConversationPage shape the app expects.
interface RawSessionMeta {
  id: string
  profile_id?: string
  project_name?: string
  session_name?: string
  project_path?: string
  last_updated_at?: string
  message_count?: number
  preview?: string
  git_branch?: string
  tool_names?: string[]
}

function toEpochMs(iso: string | undefined): number {
  return iso ? new Date(iso).getTime() : 0
}

function sortByLastMessageDesc(a: MultiConversation, b: MultiConversation): number {
  const ta = toEpochMs(a.lastMessage?.timestamp ?? a.lastActivity)
  const tb = toEpochMs(b.lastMessage?.timestamp ?? b.lastActivity)
  return tb - ta
}

// Paginated fetches across servers can yield the same conversation twice when
// rows reorder between the count and a page fetch (last_updated_at moves the
// row across an offset boundary). Drop later duplicates so FlatList keys stay unique.
function dedupeByServerAndId(items: MultiConversation[]): MultiConversation[] {
  const seen = new Set<string>()
  const out: MultiConversation[] = []
  for (const item of items) {
    const key = `${item.serverId}::${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function adaptPage(raw: RawSessionMeta[] | ConversationPage, offset: number, limit: number): ConversationPage {
  // Server may return ConversationPage directly (camelCase) or RawSessionMeta[] (snake_case array)
  if (!Array.isArray(raw)) {
    return raw as ConversationPage
  }
  const conversations: Conversation[] = raw.filter((s): s is RawSessionMeta => s != null).map((s) => ({
    id: s.id,
    title: s.session_name?.trim() || s.project_name || 'Conversation',
    sessionName: s.session_name,
    projectPath: s.project_path ?? '',
    branch: s.git_branch,
    messageCount: s.message_count ?? 0,
    lastActivity: s.last_updated_at ?? '',
  }))
  return {
    conversations,
    hasMore: raw.length === limit,
    offset,
    total: offset + raw.length,
  }
}

/** Multi-conversation page with serverId on each entry. */
export interface MultiConversationPage {
  conversations: MultiConversation[]
  hasMore: boolean
}

/** Increment (e.g. pull-to-refresh) to bust the streamer conversation cache on the first page. */
export function useConversations(
  filter?: ConversationFilter,
  refreshEpoch = 0,
  opts?: { enabled?: boolean },
) {
  const limit = 50
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)

  const recordSuccess = useServerFetchStatusStore((s) => s.recordSuccess)
  const recordFailure = useServerFetchStatusStore((s) => s.recordFailure)
  const recordWarmingUp = useServerFetchStatusStore((s) => s.recordWarmingUp)

  return useInfiniteQuery({
    queryKey: ['conversations', filter, refreshEpoch, ...displayedServerIds],
    queryFn: async ({ pageParam = 0, signal }): Promise<MultiConversationPage> => {
      // Bug 32: use allSettled so one unreachable server doesn't blank the Hub.
      // Rejected results update the per-server fetch-status store, which the
      // header dot + ServerStatusModal read to surface partial failure.
      const settled = await Promise.allSettled(
        displayedServerIds.map(async (serverId) => {
          const api = createApiForServer(serverId)
          const params = new URLSearchParams()
          if (filter?.projectPath) params.set('project', filter.projectPath)
          if (filter?.dateFrom) params.set('dateFrom', filter.dateFrom)
          if (filter?.dateTo) params.set('dateTo', filter.dateTo)
          if (filter?.profileId) params.set('profileId', filter.profileId)
          if (filter?.provider) params.set('provider', filter.provider)
          params.set('limit', String(limit))
          params.set('offset', String(pageParam))
          if (pageParam === 0 && refreshEpoch > 0) {
            params.set('refresh', '1')
          }
          const raw = await api.get<RawSessionMeta[] | ConversationPage>(
            `/api/conversations?${params.toString()}`,
            { signal },
          )
          const page = adaptPage(raw, pageParam as number, limit)
          return { serverId, page }
        })
      )

      if (signal.aborted) throw new Error('aborted')

      const fulfilled: { serverId: string; page: ConversationPage }[] = []
      const failedServers: string[] = []
      settled.forEach((result, idx) => {
        const serverId = displayedServerIds[idx]
        if (result.status === 'fulfilled') {
          fulfilled.push(result.value)
          recordSuccess(serverId)
        } else {
          failedServers.push(serverId)
          const warmupState = getServerWarmupState(result.reason)
          if (warmupState) recordWarmingUp(serverId, warmupState)
          else recordFailure(serverId, result.reason)
        }
      })

      // Single-server install (or every server failed): surface as a query
      // error — Hub renders its existing error/empty state, matching the
      // pre-fix behaviour for that case.
      if (fulfilled.length === 0 && failedServers.length > 0) {
        const firstReject = settled.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        )
        throw firstReject?.reason ?? new Error('All servers failed')
      }

      // Merge conversations from all fulfilled servers, tag with serverId.
      const merged: MultiConversation[] = []
      let anyHasMore = false
      for (const { serverId, page } of fulfilled) {
        const label = servers[serverId]?.label
        for (const conv of page.conversations) {
          merged.push({ ...conv, serverId, serverLabel: label })
        }
        if (page.hasMore) anyHasMore = true
      }

      // Multi-server note: each server paginates with the same offset; ordering is best-effort
      // vs a global merge. Single-server installs get correct cursor semantics.

      // Sort by lastActivity descending
      merged.sort(sortByLastMessageDesc)

      return { conversations: dedupeByServerAndId(merged), hasMore: anyHasMore }
    },
    getNextPageParam: (last: MultiConversationPage, _allPages, lastPageParam) =>
      last.hasMore ? (lastPageParam as number) + limit : undefined,
    initialPageParam: 0,
    enabled: (opts?.enabled ?? true) && displayedServerIds.length > 0,
  })
}

// Raw shape returned by the Go server for a single conversation.
interface RawContentBlock {
  type: string
  // text
  text?: string
  // thinking
  thinking?: string
  signature?: string
  // tool_use
  id?: string
  name?: string
  input?: Record<string, unknown>
  // tool_result
  tool_use_id?: string
  content?: string
  is_error?: boolean
  // structured diff (when streamer emits it)
  filename?: string
  hunks?: DiffHunk[]
}

interface RawMessage {
  /** Stable index in the full filtered message list (for pagination + React keys). */
  message_index?: number
  uuid?: string | null
  role: string
  timestamp: string
  text: string
  tool_calls?: string[]
  content?: RawContentBlock[]
  model?: string
  has_images?: boolean
  parent_uuid?: string | null
  permission_mode?: string | null
  is_sidechain?: boolean
  is_tool_result?: boolean
  attachment?: Record<string, unknown> | null
}

export interface ConversationMessagePagination {
  total: number
  before_index: number
  from_index: number
  has_more_older: boolean
  next_before_index: number | null
  // Present only on anchored/after windows (newer streamers).
  anchor_index?: number
  has_more_newer?: boolean
  next_after_index?: number | null
  // After_index delta-validity token (streamer #202). Whole-conversation etag —
  // changes on every append, so it detects a file changing between reads, not
  // cursor continuity. Read only on after_index responses.
  etag?: string
  // Bytes spent against a `max_bytes`-bounded first-page request (see
  // useConversation's `maxBytes` option). Informational only — nothing reads
  // it to decide behaviour. Absent on servers that predate `max_bytes` and on
  // any page fetched without it.
  served_bytes?: number
}

export interface RawConversationDetail {
  meta: RawSessionMeta & {
    last_prompt?: string
    resumable?: boolean
    unavailable_reason?: UnavailableReason
    provider?: 'claude-code' | 'codex-cli'
  }
  messages: RawMessage[]
  message_pagination?: ConversationMessagePagination
  turn_durations?: TurnDuration[]
}

// Resolve a tool name from tool_use_id by looking at sibling content blocks.
function resolveToolName(toolUseId: string | undefined, blocks: RawContentBlock[] | undefined): string {
  if (!toolUseId || !blocks) return 'Tool'
  const match = blocks.find((b) => b.type === 'tool_use' && b.id === toolUseId)
  return match?.name ?? 'Tool'
}

function adaptRawMessage(m: RawMessage, convId: string, fallbackIndex: number): Message {
  const content: MessageContent[] = []

  if (m.content && m.content.length > 0) {
    for (const block of m.content) {
      if (block.type === 'thinking') {
        content.push({ type: 'thinking', thinking: block.thinking ?? '', signature: block.signature })
      } else if (block.type === 'text' && block.text) {
        content.push({ type: 'text', text: block.text })
      } else if (block.type === 'tool_use') {
        content.push({ type: 'tool_use', id: block.id, name: block.name ?? '', input: block.input ?? {} })
      } else if (block.type === 'tool_result') {
        content.push({
          type: 'tool_result',
          toolUseId: block.tool_use_id,
          toolName: resolveToolName(block.tool_use_id, m.content),
          content: block.content ?? '',
          isError: block.is_error,
        })
      } else if (block.type === 'diff' && block.filename && Array.isArray(block.hunks)) {
        content.push({ type: 'diff', filename: block.filename, hunks: block.hunks })
      }
    }
    // The server carries assistant prose in the top-level `text` field, never
    // as a text block inside `content` — merge it in or the prose is lost
    // whenever the turn also has tool/thinking blocks. Assistant-only: user
    // tool_result messages echo their result string in `text` too, and merging
    // that would render the result twice.
    if (m.role === 'assistant' && m.text && !content.some((b) => b.type === 'text' && b.text === m.text)) {
      const firstNonThinking = content.findIndex((b) => b.type !== 'thinking')
      const textBlock: MessageContent = { type: 'text', text: m.text }
      if (firstNonThinking === -1) content.push(textBlock)
      else content.splice(firstNonThinking, 0, textBlock)
    }
    // Codex REST often sends content:[] with prose only in `text`. If content
    // has blocks but no text (or is empty-after-filter), still surface user text.
    if (
      m.role === 'user' &&
      m.text &&
      !m.is_tool_result &&
      !content.some((b) => b.type === 'text')
    ) {
      content.unshift({ type: 'text', text: m.text })
    }
  } else {
    if (m.text) content.push({ type: 'text', text: m.text })
    if (m.tool_calls) {
      m.tool_calls.forEach((name) =>
        content.push({ type: 'tool_use', name, input: {} })
      )
    }
  }

  const idx = m.message_index ?? fallbackIndex
  return {
    id: `${convId}-${idx}`,
    uuid: m.uuid,
    messageIndex: idx,
    role: m.role as 'user' | 'assistant',
    content,
    timestamp: m.timestamp,
    has_images: m.has_images,
    parent_uuid: m.parent_uuid,
    permission_mode: m.permission_mode,
    is_sidechain: m.is_sidechain,
    is_tool_result: m.is_tool_result,
    attachment: m.attachment,
  }
}

// Reuse the previous render's Message object for any id whose content is
// unchanged, so a rebuilt list keeps stable references for existing rows.
// FlashList then treats a live reload as an append, not a full data swap, and
// never blank-remeasures. Content compared by JSON equality — Messages are
// plain data (no functions), so this is exact and cheap at conversation sizes.
export function reuseMessageIdentities(prev: Message[], next: Message[]): Message[] {
  if (prev.length === 0) return next
  const prevById = new Map(prev.map((m) => [m.id, m]))
  let changed = false
  const out = next.map((m) => {
    const old = prevById.get(m.id)
    if (old && old !== m && JSON.stringify(old) === JSON.stringify(m)) {
      changed = true
      return old
    }
    return m
  })
  return changed ? out : next
}

/** Pages are ordered newest-chunk first (infinite query page 0 = tail). Merge oldest → newest. */
function mergeConversationPages(pages: RawConversationDetail[]): ConversationDetail {
  if (pages.length === 0) {
    throw new Error('mergeConversationPages: empty pages')
  }
  const first = pages[0]
  const convId = first.meta.id
  // Server pages can overlap (the after_index window is inclusive of its
  // cursor, and anchored windows widen backward near the tail), so the same
  // message_index may arrive in more than one cached page. The adapted id is
  // `${convId}-${index}`, and FlashList's keyExtractor + its
  // maintainVisibleContentPosition anchor both require unique keys — duplicate
  // ids reserve phantom layout space and misplace the scroll anchor. Dedup at
  // this single choke point; first (oldest-page) occurrence wins.
  const seenIndexes = new Set<number>()
  const messages: Message[] = [...pages]
    .reverse()
    .flatMap((page) =>
      (page.messages ?? [])
        .filter((m) => !(m.role === 'user' && typeof m.text === 'string' && isCodexInjectedContext(m.text)))
        .flatMap((m, i) => {
          const idx = m.message_index ?? (page.message_pagination?.from_index ?? 0) + i
          if (seenIndexes.has(idx)) return []
          seenIndexes.add(idx)
          return [adaptRawMessage(m, convId, idx)]
        }),
    )

  return {
    id: convId,
    title: first.meta.session_name?.trim() || first.meta.project_name || 'Conversation',
    projectPath: first.meta.project_path ?? '',
    branch: first.meta.git_branch,
    messageCount: first.meta.message_count ?? messages.length,
    lastActivity: first.meta.last_updated_at ?? '',
    messages,
    lastPrompt: first.meta.last_prompt,
    turn_durations: first.turn_durations,
    resumable: first.meta.resumable,
    unavailableReason: first.meta.unavailable_reason,
    provider: first.meta.provider,
  }
}

const CONVERSATION_MESSAGE_LIMIT = 80
const CONVERSATION_ANCHORED_LIMIT = 120

export function useConversation(
  serverId: string,
  id: string,
  opts?: { anchorIndex?: number; enabled?: boolean; maxBytes?: number },
) {
  const anchorIndex = opts?.anchorIndex
  const maxBytes = opts?.maxBytes
  const api = createApiForServer(serverId)
  const queryClient = useQueryClient()
  // The tail view keeps the exact historical key (persisted caches and prefix
  // invalidations depend on it); anchored views get their own cache entry so
  // the two never share incompatible first pages. A byte-bounded ("seed")
  // request is a third variant: its first page is truncated relative to the
  // plain tail view's, so it must not share a cache entry (or an ETag) with it.
  const queryKey =
    anchorIndex != null
      ? (['conversation', serverId, id, `anchor-${anchorIndex}`] as const)
      : maxBytes != null
        ? (['conversation', serverId, id, `seed-${maxBytes}`] as const)
        : (['conversation', serverId, id] as const)
  // Anchored windows are throwaway scroll targets; the tail view is what users
  // return to, so it earns the long-lived persisted retention window.
  const conversationGcTime = anchorIndex != null ? QUERY_GC_TIME : SEVEN_DAYS
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: -1 as ConversationPageParam,
    gcTime: conversationGcTime,
    staleTime: 15_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams()

      // Newer-direction page. { after } = anchored backfill (msg_limit 120);
      // { resume } = tail delta-on-open (msg_limit 80). Both are plain fetches —
      // after_index/anchored windows always answer 200, never 304, so
      // If-None-Match would be misleading dead code.
      if (typeof pageParam === 'object') {
        const isResume = 'resume' in pageParam
        // The server window is [after_index, after_index + limit) — INCLUSIVE
        // of the cursor. { after } carries the server's own next_after_index
        // (already the first index we don't have), but { resume } is the
        // client-derived max index we DO have — so it must be bumped by one.
        // Without the +1 every delta drain re-fetches the tail message, and
        // each re-fetch appends a duplicate-id row (see mergeConversationPages)
        // that grows the list by one phantom message per poll tick.
        const cursor = isResume ? pageParam.resume + 1 : pageParam.after
        params.set('msg_limit', String(isResume ? CONVERSATION_MESSAGE_LIMIT : CONVERSATION_ANCHORED_LIMIT))
        params.set('after_index', String(cursor))
        return api.get<RawConversationDetail>(
          `/api/conversations/${encodeURIComponent(id)}?${params.toString()}`
        )
      }

      const isFirstPage = pageParam === -1

      // Anchored first page: a bounded window centered on the anchor. Bypasses
      // the ETag path entirely — it must not read or write the tail page's
      // validator.
      if (isFirstPage && anchorIndex != null) {
        params.set('msg_limit', String(CONVERSATION_ANCHORED_LIMIT))
        params.set('anchor_index', String(anchorIndex))
        return api.get<RawConversationDetail>(
          `/api/conversations/${encodeURIComponent(id)}?${params.toString()}`
        )
      }

      params.set('msg_limit', String(CONVERSATION_MESSAGE_LIMIT))
      if (!isFirstPage) {
        params.set('before_index', String(pageParam))
      } else if (maxBytes != null) {
        // Additive param (see docs/superpowers/specs/2026-08-15-session-history-byte-budget-design.md).
        // Only the first page is byte-bounded — older pages page in by
        // before_index/msg_limit like any other backward fetch.
        params.set('max_bytes', String(maxBytes))
      }
      const path = `/api/conversations/${encodeURIComponent(id)}?${params.toString()}`

      // Back-pages are immutable history — fetch normally, no conditional check.
      if (!isFirstPage) {
        return api.get<RawConversationDetail>(path)
      }

      // First page: send If-None-Match with the last known ETag (if any) and
      // use the conditional path so a 304 keeps the cached copy. Scoped by
      // maxBytes so a byte-bounded seed and the plain tail view never trade
      // each other's validator.
      const etagKey = maxBytes != null ? `${serverId}::${id}::seed-${maxBytes}` : `${serverId}::${id}`
      const knownEtag = getEtag(etagKey)
      const res = await api.getWithMeta<RawConversationDetail>(
        path,
        knownEtag ? { headers: { 'If-None-Match': knownEtag } } : undefined,
      )

      if (res.status === 304) {
        // Unchanged: reuse the previously cached first page so merge output is
        // identical. If somehow nothing is cached, fall back to a full fetch.
        const cached =
          queryClient.getQueryData<InfiniteData<RawConversationDetail, ConversationPageParam>>(queryKey)
        const cachedFirst = cached?.pages?.[0]
        if (cachedFirst) return cachedFirst
        return api.get<RawConversationDetail>(path)
      }

      // 200: remember the validator (null against a non-ETag server clears it,
      // so we simply stop sending If-None-Match — graceful degradation).
      if (res.etag) setEtag(etagKey, res.etag)
      else deleteEtag(etagKey)
      // body is non-null on a 200 from requestWithMeta.
      return res.body as RawConversationDetail
    },
    getNextPageParam: (last) => {
      const p = last.message_pagination
      if (!p?.has_more_older || p.next_before_index == null) return undefined
      return p.next_before_index
    },
    // Newer direction ("previous" in react-query terms — pages are ordered
    // newest-chunk first). Anchored/after pages resume via has_more_newer; the
    // tail view resumes via a derived { resume } cursor (see body below).
    getPreviousPageParam: (first, allPages): ConversationPageParam | undefined => {
      const p = first.message_pagination
      // Anchored/after pages carry has_more_newer — the server already told us
      // exactly where to continue, so this branch always wins when present.
      if (p?.has_more_newer && p.next_after_index != null) {
        return { after: p.next_after_index }
      }
      // Tail-view fallback: the newest cached page is plain REST/tail data with
      // no has_more_newer field. If a cursor exists, offer a { resume } param —
      // recomputed every call (never latched), so each mount/foreground/WS
      // trigger resumes from the current cursor. Anchored windows never reach
      // here. Same deriveCursor the Task 6 effect uses — one source of truth.
      if (anchorIndex != null) return undefined
      const cursor = deriveCursor(allPages)
      return cursor != null ? { resume: cursor } : undefined
    },
    enabled: Boolean(serverId && id) && (opts?.enabled ?? true),
  })

  const queryKeyHash = JSON.stringify(queryKey)
  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  })

  // Imperative handle to the delta drain below. Consumers (the read-only
  // conversation view's focus-poll interval + conversation_updated listener)
  // invoke it to run one throttled drain. Points at a no-op whenever the effect
  // is inactive (anchored window / disabled consumer), so a stale runDelta can
  // never fire after the deps flip.
  const triggerDeltaRef = useRef<() => void>(() => {})
  const triggerDelta = useCallback(() => triggerDeltaRef.current(), [])

  const triggerEnabled = opts?.enabled !== false
  useEffect(() => {
    // Reset the imperative handle first; only the active tail-view path below
    // re-points it at a live runDelta.
    triggerDeltaRef.current = () => {}
    // Delta-on-open lives only on the plain tail view; anchored windows are
    // navigation artifacts with their own bidirectional pagination, and a
    // byte-bounded seed view is a one-shot history read (the live PTY stream
    // is the "present" for that surface, not a drained/resumed conversation
    // cursor) — draining it would also target the wrong cache entry, since
    // the tailKey rebuilt below doesn't carry the maxBytes suffix. A consumer
    // that mounts with enabled: false must not trigger either — imperative
    // fetches (fetchPreviousPage) bypass react-query's `enabled` gate, so
    // without this check a disabled consumer with a warm cache would still
    // fire mount/foreground/WS deltas.
    if (!triggerEnabled || anchorIndex != null || maxBytes != null || !serverId || !id) return

    // Rebuild the tail key locally so queryKey (a fresh array each render) never
    // enters the deps array. Only the tail view reaches here, so this is always
    // the plain key.
    const tailKey = ['conversation', serverId, id] as const

    let cancelled = false

    const runDelta = async () => {
      // Re-read the ref (not a captured const) so every call — and every drain
      // iteration below — uses the latest query handle.
      const cursorAtStart = deriveCursor(queryRef.current.data?.pages)
      if (cursorAtStart == null) return // no cached history → nothing to resume from
      const now = Date.now()
      if (!canTrigger(queryKeyHash, now)) return
      stampTrigger(queryKeyHash, now) // stamp once per drain, at the start

      // Drain: sequential after_index hops until has_more_newer is false or an
      // empty page returns. First hop uses the { resume } param from
      // getPreviousPageParam (msg_limit 80); every subsequent hop hits the
      // { after } branch via the page's own has_more_newer/next_after_index and
      // therefore uses msg_limit 120 (CONVERSATION_ANCHORED_LIMIT) — intentional
      // and correct: larger continuation pages mean fewer round-trips; do not
      // "fix" it to 80.
      let cursor = cursorAtStart
      let drainEtag: string | undefined // captured from the first hop of THIS drain
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (cancelled) return
        await queryRef.current.fetchPreviousPage({ cancelRefetch: false })
        if (cancelled) return

        const data = queryClient.getQueryData<InfiniteData<RawConversationDetail, ConversationPageParam>>(tailKey)
        if (!data) return
        const firstPage = data.pages[0]

        // (1) etag gate — FIRST. The after_index delta's etag changes on every
        // append, so it can only mean "the file changed between this hop and the
        // drain's first hop." If it differs, this hop was read across the change:
        // strip it (do NOT merge a cross-read page) and stop. NEVER resetQueries —
        // a whole-conversation etag can't tell append from rewrite, so discarding
        // would wipe the 7-day cache on the normal live-streaming path. Shrink
        // detection is the next drain's total<=cursor gate below. Skip inspecting
        // this page's total/emptiness — a cross-read page's fields are meaningless.
        const hopEtag = etagOf(firstPage)
        if (drainEtag === undefined) {
          drainEtag = hopEtag // first hop: record, don't compare
        } else if (hopEtag !== undefined && hopEtag !== drainEtag) {
          queryClient.setQueryData(tailKey, stripFirstPage(data))
          return
        }

        // (2) Empty-200 husk → strip, stop draining.
        if (isEmptyFirstPage(data)) {
          queryClient.setQueryData(tailKey, stripFirstPage(data))
          return
        }

        // (3) Cursor validity: total <= cursor → truncation/rewrite. Discard +
        // refetch tail from -1.
        if (!isCursorValid(firstPage, cursor)) {
          void queryClient.resetQueries({ queryKey: tailKey })
          return
        }

        // (4) Continue?
        if (!shouldContinueDrain(firstPage)) return
        cursor = deriveCursor(data.pages) ?? cursor
      }
    }

    // Expose the drain to imperative callers (focus-poll interval,
    // conversation_updated listener). Same throttle applies — runDelta gates on
    // canTrigger internally.
    triggerDeltaRef.current = () => {
      void runDelta()
    }

    // Mount.
    void runDelta()

    // AppState foreground.
    const appStateSub = AppState.addEventListener('change', (status) => {
      if (status === 'active') void runDelta()
    })

    // WS connected transition (observer, never owner). onAnyStatusChange also
    // covers clients created after mount; filter to this server + connected.
    const unsubStatus = wsManager.onAnyStatusChange((sid, status) => {
      if (sid === serverId && status === 'connected') void runDelta()
    })

    // WS running → not-running transition, per this conversation's session.
    // prevStatus is effect-local and survives because the effect runs once per
    // mount (stable deps) — if queryKey were in the deps this would reset every
    // render and never see a running→not-running edge.
    let prevStatus: string | null = null
    const unsubSession = wsManager.getClient(serverId)?.on('session_update', (msg) => {
      // Match live session id, Claude conversationId alias, OR Codex bound
      // rollout UUID. For Codex, `id` is boundConversationId while
      // msg.session.id stays the placeholder PTY key.
      if (msg.type !== 'session_update') return
      const s = msg.session
      const matches =
        s.id === id ||
        s.conversationId === id ||
        s.boundConversationId === id
      if (!matches) return
      const prev = prevStatus
      prevStatus = s.status
      if (prev === 'running' && s.status !== 'running') void runDelta()
    })

    return () => {
      cancelled = true
      appStateSub.remove()
      unsubStatus()
      unsubSession?.()
    }
  }, [serverId, id, anchorIndex, maxBytes, queryKeyHash, queryClient, triggerEnabled])

  // Every drain rebuilds ConversationDetail from raw pages, so each Message is a
  // fresh object even when its content is byte-identical to the one already on
  // screen. Feeding FlashList a wholly new-identity array on a live reload makes
  // it drop and re-measure every cell (startRenderingFromBottom), which paints a
  // blank frame — the reload "blink". Reuse the prior object for any id whose
  // content is unchanged so existing rows keep stable references and only genuine
  // appends read as new. (See reuseMessageIdentities.test.ts.)
  //
  // The prev-messages cache is a plain render-time identity cache: it only swaps
  // equal objects for equal objects, so it can never change WHETHER this memo
  // recomputes (that is fully decided by the query.data dep) — the exact case
  // the refs-in-render lint exists to catch does not apply here.
  const prevMessagesRef = useRef<Message[]>([])
  const data = useMemo(() => {
    if (!query.data?.pages.length) return undefined
    /* eslint-disable react-hooks/purity -- measurement only; the clock reads
       never feed the returned value, so the memo stays idempotent. Whole block
       is inert unless EXPO_PUBLIC_OPEN_TRACE=1. */
    const tMerge = Date.now()
    const merged = mergeConversationPages(query.data.pages)
    const tAdapted = Date.now()
    // eslint-disable-next-line react-hooks/refs -- render-time identity cache; see note above
    merged.messages = reuseMessageIdentities(prevMessagesRef.current, merged.messages)
    // eslint-disable-next-line react-hooks/refs -- render-time identity cache; see note above
    prevMessagesRef.current = merged.messages
    const tDone = Date.now()
    traceCount('mergeMemo', tDone - tMerge)
    traceCount('adaptPages', tAdapted - tMerge)
    traceCount('reuseIds', tDone - tAdapted)
    /* eslint-enable react-hooks/purity */
    traceMark('merged', `${merged.messages.length} msgs from ${query.data.pages.length} page(s)`)
    return merged
  }, [query.data])

  const firstPage = query.data?.pages[0]
  const totalMessages = firstPage?.message_pagination?.total ?? 0
  const loadedMessages = useMemo(
    () => (query.data?.pages ?? []).reduce((sum, p) => sum + p.messages.length, 0),
    [query.data],
  )

  return {
    data,
    error: query.error,
    refetch: query.refetch,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    // Direction-named aliases: react-query's "previous" pages are the NEWER
    // windows (pages are ordered newest-chunk first).
    fetchNewerPage: query.fetchPreviousPage,
    hasNewerPage: query.hasPreviousPage,
    isFetchingNewerPage: query.isFetchingPreviousPage,
    totalMessages,
    loadedMessages,
    // Imperative delta-drain trigger (throttled) for freshness pollers.
    triggerDelta,
  }
}

export function useConversationSearch(query: string) {
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)
  const recordSuccess = useServerFetchStatusStore((s) => s.recordSuccess)
  const recordFailure = useServerFetchStatusStore((s) => s.recordFailure)

  return useQuery({
    queryKey: ['conversations', 'search', query, ...displayedServerIds],
    queryFn: async () => {
      // Bug 32: allSettled — one failing server shouldn't suppress matches
      // from healthy servers.
      const settled = await Promise.allSettled(
        displayedServerIds.map(async (serverId) => {
          const api = createApiForServer(serverId)
          const raw = await api.get<RawSessionMeta[]>(`/api/search?q=${encodeURIComponent(query)}&limit=50`)
          return { serverId, page: adaptPage(raw, 0, 50) }
        })
      )

      const merged: MultiConversation[] = []
      let anyFulfilled = false
      settled.forEach((result, idx) => {
        const serverId = displayedServerIds[idx]
        if (result.status === 'fulfilled') {
          anyFulfilled = true
          recordSuccess(serverId)
          const { page } = result.value
          const label = servers[serverId]?.label
          for (const conv of page.conversations) {
            merged.push({ ...conv, serverId, serverLabel: label })
          }
        } else {
          recordFailure(serverId, result.reason)
        }
      })

      if (!anyFulfilled && displayedServerIds.length > 0) {
        const firstReject = settled.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        )
        throw firstReject?.reason ?? new Error('All servers failed')
      }

      merged.sort(sortByLastMessageDesc)
      const deduped = dedupeByServerAndId(merged)

      return { conversations: deduped, hasMore: false, offset: 0, total: deduped.length }
    },
    enabled: query.length > 0 && displayedServerIds.length > 0,
  })
}
