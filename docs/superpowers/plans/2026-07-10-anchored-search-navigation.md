# Anchored Search Navigation - Mobile + Streamer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repos:** Mobile work happens in `/Users/ronenmars/Desktop/dev/ai-tools/tb-mobile`. Streamer work happens in `/Users/ronenmars/Desktop/dev/ai-tools/tb-streamer`. All paths below are relative to the named repo for that task.

**Goal:** When a user opens a conversation from an active search result, load a bounded message window around the matched message, scroll directly to that message, and highlight the search keyword in that message.

**Non-goal:** Do not load every older page until the target appears. A match 100,000 messages from the first message must be reachable with one anchored detail request, not thousands of sequential mobile pagination calls.

**Architecture:** `tb-streamer` resolves the search hit to a stable `message_index` and serves an anchored conversation page around that index. `tb-mobile` carries the active search query through navigation, requests the anchored page, renders that bounded window, scrolls to the target row inside the window, and highlights the matched keyword only in the target message. Normal conversation navigation keeps the current tail-first behavior.

**Tech Stack:** React Native + Expo, TypeScript, FlashList, @tanstack/react-query, Jest in mobile; Node.js + TypeScript, Hono, Vitest in streamer; existing `/api/search` and `/api/conversations/:id` contracts.

## Current State

- Mobile search navigation currently passes only `id` and `server` to conversation detail.
- `useConversation` loads the latest page first with `msg_limit=80`, then paginates older messages with `before_index`.
- Mobile derives stable row ids from backend `message_index` as `${conversationId}-${index}`.
- Streamer `/api/search` returns conversation metadata but does not expose the matched message.
- Streamer `/api/conversations/:id` already emits `message_index` and has a bounded paged reader via `msg_limit` and `before_index`.

## Target API Shape

Add an anchored conversation detail mode to streamer:

```http
GET /api/conversations/:id?msg_limit=120&anchor_index=100000&anchor_context=60
```

Response remains the existing detail shape, with additive pagination fields:

```ts
{
  meta: { ... },
  messages: RawMessage[],
  message_pagination: {
    total: number
    from_index: number
    before_index: number
    has_more_older: boolean
    next_before_index: number | null
    has_more_newer: boolean
    next_after_index: number | null
    anchor_index?: number
  }
}
```

Add a target resolver:

```http
GET /api/conversations/:id/search-target?q=<query>
```

Response:

```ts
{
  query: string
  message_index: number
  uuid?: string | null
  snippet: string
}
```

If the search result was metadata-only and no message body contains the query, return `404` with a stable error code such as `search_target_not_found`. Mobile should then open the normal tail view with no highlight.

## Important Behavior

- Search target matching is body-only: message text first, then relevant text-like content blocks if needed. Project path/title/branch matches should not pretend to have a scroll target.
- `message_index` is the source of truth for anchoring and highlighting. UUID is optional metadata only.
- Anchored pages are bounded. For a 100,000th message, the backend should return a nearby window such as `99940..100059`, not require mobile to fetch pages from the tail.
- When opened from search, initial bottom auto-scroll must be disabled. The first automatic scroll should be to the anchor row.
- Highlight only the target message by default. Highlighting every loaded occurrence can be added later, but it is not required for this feature.

## Streamer Tasks

### Task 1: Add search target resolver

**Repo:** `tb-streamer`

**Files:**
- Modify: `src/server.ts`
- Modify: `src/api/routes/conversations.routes.ts`
- Modify: `src/api/types/api-deps.ts`
- Test: `__tests__/conversation-search-target.test.ts`

- [ ] Add `GET /api/conversations/:id/search-target`.
- [ ] Reuse `findConversationByUuid(id)` so stale single-file refresh behavior stays consistent with detail loading.
- [ ] Implement a pure helper that finds the first message whose searchable body text includes the query case-insensitively.
- [ ] Return `{ query, message_index, uuid, snippet }` on match.
- [ ] Return `404 { code: "search_target_not_found" }` on metadata-only/no body match.
- [ ] Add Vitest coverage for body match, case-insensitive match, metadata-only no-match, and missing conversation.

### Task 2: Add anchored page parameters

**Repo:** `tb-streamer`

**Files:**
- Modify: `src/server.ts`
- Test: `__tests__/conversation-anchored-page.test.ts`

- [ ] Accept `anchor_index` on `GET /api/conversations/:id`.
- [ ] Clamp `anchor_index` to `[0, total - 1]`.
- [ ] Compute a bounded window around the anchor. Default `msg_limit=120`; default context is centered, with edge clamping near the first or last message.
- [ ] Return `message_pagination.anchor_index`, `has_more_newer`, and `next_after_index` in anchored responses.
- [ ] Preserve current tail-first behavior when `anchor_index` is absent.
- [ ] Preserve current older-page behavior when `before_index` is present.
- [ ] Ensure ETag behavior does not incorrectly return `304` for anchored pages unless the cached anchored page is known to match the request. The simplest safe rule: only first tail page participates in `If-None-Match`; anchored pages always return `200`.
- [ ] Add tests for an anchor in the middle, near the beginning, near the end, out-of-range low, and out-of-range high.

### Task 3: Optional newer-page pagination

**Repo:** `tb-streamer`

**Files:**
- Modify: `src/server.ts`
- Test: extend `__tests__/conversation-anchored-page.test.ts`

- [ ] Add `after_index` support only if mobile needs scrolling newer beyond the anchored window in v1.
- [ ] If implemented, return `[after_index, after_index + msg_limit)` and matching `has_more_newer` metadata.
- [ ] Keep `before_index` unchanged for older pagination.

This task is optional for v1 if the first implementation only needs to land on and inspect the found message.

## Mobile Tasks

### Task 4: Carry search context through navigation

**Repo:** `tb-mobile`

**Files:**
- Modify: `types/api.ts`
- Modify: `hooks/useConversations.ts`
- Modify: `components/sessions/hub/ProjectHubList.tsx`
- Modify: `components/sessions/tree/TreeSessionsList.tsx`
- Modify: `app/index.tsx`
- Modify: `app/project/[id].tsx`
- Tests: focused unit/component tests for route generation where existing tests allow it

- [ ] Add optional search-target fields to `Conversation` or a dedicated search-result type: `searchTargetMessageIndex?: number`, `searchSnippet?: string`.
- [ ] Update `useConversationSearch` to preserve additive backend fields from `/api/search` if streamer starts returning them later.
- [ ] When pressing a conversation from an active search state, append `search=<query>` to the conversation URL.
- [ ] If a target index is already present on the search item, append `anchor_index=<index>` too.
- [ ] Leave normal non-search navigation unchanged.

### Task 5: Add anchored conversation query support

**Repo:** `tb-mobile`

**Files:**
- Modify: `hooks/useConversations.ts`
- Test: `__tests__/unit/hooks/useConversations.test.tsx`

- [ ] Extend `useConversation(serverId, id, opts?)` with optional `{ anchorIndex?: number }`.
- [ ] When `anchorIndex` is present, request `/api/conversations/:id?msg_limit=120&anchor_index=<index>` for the first page.
- [ ] Include `anchorIndex` in the React Query key so anchored and tail views do not share incompatible first pages.
- [ ] Preserve current tail-first query key and ETag logic when no anchor is present.
- [ ] Preserve `message_index` as `message.messageIndex` while keeping the existing `id` derivation unchanged.
- [ ] Expose pagination metadata needed by the screen: `fromIndex`, `anchorIndex`, `hasMoreOlder`, and optionally `hasMoreNewer`.

### Task 6: Resolve target and render anchored detail

**Repo:** `tb-mobile`

**Files:**
- Modify: `app/conversation/[id].tsx`
- Test: `__tests__/integration/conversation-search-anchor.test.tsx`

- [ ] Read `search` and optional `anchor_index` from `useLocalSearchParams`.
- [ ] If `search` exists but `anchor_index` does not, call `/api/conversations/:id/search-target?q=<search>` before loading the anchored page.
- [ ] If target resolution returns `404 search_target_not_found`, fall back to normal tail loading and do not highlight.
- [ ] If a target index exists, pass it to `useConversation`.
- [ ] Disable initial bottom auto-scroll while `anchorIndex` is active.
- [ ] After the anchored page renders, find the local array index where `message.messageIndex === anchorIndex`.
- [ ] Call `FlashList.scrollToIndex({ index, animated: false, viewPosition: 0.45 })`.
- [ ] Guard the anchor scroll with a ref so content-size changes and rerenders do not repeatedly jump the user.
- [ ] If `scrollToIndex` fails because FlashList has not measured enough yet, retry once after layout settles.

### Task 7: Highlight the matched keyword

**Repo:** `tb-mobile`

**Files:**
- Modify: `components/conversation/MessageItem.tsx`
- Modify: `components/conversation/MessageBubble.tsx`
- Test: `__tests__/unit/components/conversation/MessageBubble.test.tsx` or nearest existing test location

- [ ] Thread `highlightQuery?: string` and `highlightMessageIndex?: number` into `MessageItem`.
- [ ] Pass highlight props only when the row's `messageIndex` equals the target index.
- [ ] Add a small text splitter for case-insensitive substring highlighting.
- [ ] Apply highlight inside normal text blocks only.
- [ ] Do not highlight code tokens, tool cards, thinking cards, or diff viewers in v1.
- [ ] Ensure user and assistant bubble colors remain readable with the highlight background.

## UX Rules

- Normal conversation opens at the latest messages exactly as today.
- Search-origin conversation opens centered around the matched message.
- If no body target is resolvable, open normally rather than blocking navigation.
- The progress bar can show anchored window loading, but it should not imply that all messages are being loaded.
- The bottom scroll button should still scroll to the newest loaded message/window bottom. A later enhancement can add "jump to latest" if users need it.

## Verification Plan

- [ ] Streamer: `npm run test -- __tests__/conversation-search-target.test.ts`
- [ ] Streamer: `npm run test -- __tests__/conversation-anchored-page.test.ts`
- [ ] Mobile: `npx jest __tests__/unit/hooks/useConversations.test.tsx`
- [ ] Mobile: run the new conversation anchor integration/component test.
- [ ] Manual: create or fixture a long conversation where the query appears far from the tail, open it from search, and verify only one anchored detail request is needed before the message renders.
- [ ] Manual: search for a project-path-only term, tap the result, and verify the conversation opens normally without a misleading highlight.

## Rollout Order

1. Streamer target resolver and anchored page support.
2. Mobile query/types support for anchored first page.
3. Mobile search navigation and anchor scroll.
4. Mobile target-message keyword highlight.

This order keeps old mobile clients compatible because streamer changes are additive, and mobile can fall back to normal detail loading when connected to an older streamer.

## Open Questions

- Should `/api/search` also include `searchTargetMessageIndex` directly to avoid a second mobile request on tap? This is a useful optimization but not required for correctness.
- Should v1 support scrolling newer past the anchored window, or is "land on the hit and inspect nearby context" enough?
- Should highlight match one full search phrase only, or tokenize multi-word queries and highlight each token?
