# Item 3 — WS resume-by-seq (live message indexing + delta etag)

**Date:** 2026-07-13
**Status:** Design approved.
**Follows:** [persistent cache + cursor delta sync](2026-07-12-persistent-cache-delta-sync-design.md) (items 1, 2, 4, 5 — shipped on `feat/persistent-cache-delta-sync`, PR #306). This is the Item 3 follow-up, stacked on that branch.
**Server contract (verified live):** streamer **1.28.1+e8232bf** = guard rails (#199) + offset index (#202) + provider hotfixes (#205/#206). Verified against real traffic, not the declared schema — the **emission is the contract**.

## 1. Acceptance bar

Live WS messages carry a real server `message_index` when the streamer supplies one, so the render-time overlay orders correctly and future deltas dedupe cleanly. The delta path detects a conversation file changing **mid-drain** (via the after_index `etag`) and **strips the mismatched hop's page and stops — without discarding the cache** — so the page read across the change never stays merged, and the next trigger completes the drain. Neither change touches the durable cursor's advance rule: **the cursor only ever advances by merging real cached after_index pages** (never from an indexed live overlay message).

## 2. Verified server contract (emission, not schema)

- **`conversation_events` (plural) WS frame** (`src/types.ts:133`): `{ type: "conversation_events"; sessionId: string; lines: string[]; seqs?: (number | null)[] }`. `seqs` is **positional** — `seqs[i]` is the `message_index` of `lines[i]`, or **`null`** for a non-message line (summary/sidecar). The field is **absent** when the offset index assigned nothing.
- The old singular **`conversation_event`** (no seq) is **still broadcast alongside**, plural FIRST then the per-line singulars (`src/server.ts:402-412`).
- **seqs are claude-code-only.** #205/#206 exclude non-claude providers from the offset index, so **codex live sessions never carry seqs**. Absent seqs are a normal state, not an error — never gate behavior on "seqs must exist."
- **`message_pagination.etag`** is emitted on the after_index delta path only (`src/server.ts:2034`: `if (usedAfterIndex) messagePagination.etag = etag`; `before_index` takes precedence). The declared JSON schema omits it — reading the schema and concluding "no etag" is wrong; the emit site is the contract.
- **The etag is a whole-conversation token**, not a prefix token: `computeConversationEtag({ filePath, messageCount, timestamp })` folds in the indexed message count (deliberately, for #202's grown-file fix). **It therefore changes on every append.** This is the load-bearing fact for §5 — a whole-conversation etag cannot validate cursor *continuity*; it can only detect that a file changed between two reads.

## 3. Consume both frames, dedupe (decision)

`useConversationStream` subscribes to `conversation_events` **in addition to** `conversation_event` — it never drops the singular subscription. tb-mobile connects to user-run streamers of arbitrary age; a plural-only subscription would leave the live overlay **completely empty** against any pre-#202 server (no plural frames arrive at all), not merely index-less.

Mechanics:
- Parse each plural entry with `seq = seqs?.[i] ?? null`; set the message's `messageIndex` when `seq` is a number, leave it `undefined` otherwise.
- Dedupe by uuid through the **existing** `seenIds` set (shared across both subscriptions). The server broadcasts the plural frame first, so on modern servers the seq-carrying copy wins the `seenIds` race and the trailing singulars dedupe away.
- If a singular copy wins the race (or the server is old, or the session is codex), the message simply has no `messageIndex` → arrival-order fallback. Degraded, never wrong, never empty.

## 4. Live message ordering — no LiveConversationView change

Task 9's merge (§3.4) sorts **historical** messages by `messageIndex`; `newLive` is appended in **arrival order**. The tiered comparison does **not** inter-sort live-vs-live — feeding real indexes onto live messages does **not** make the merge re-sort them. This is correct as-is because **WS delivery is in-order TCP from a single sequential writer**, so arrival order already equals index order for the live tail. No `LiveConversationView` change is needed.

(Optional future tightening, explicitly out of scope: sort `newLive` by index when every entry carries one. Not required — arrival order is already correct under the in-order-delivery guarantee.)

**Cursor rule (unchanged, load-bearing):** an indexed live message must **never** advance the derived cursor. The cursor advances only when a real after_index page enters the durable cache. If the cursor were allowed to jump to a live-seen seq, the messages between cache-end and that seq would never enter the durable cache — a **permanent gap** every future delta would silently skip. The delta always resumes from the cached cursor; a later-refetched overlay message just dedupes by uuid. (This is the persistence-boundary invariant §3.4 introduced, written for exactly this PR.)

## 5. Delta etag — within-drain: stop, never discard

**The etag cannot distinguish benign append from rewrite at any timescale.** It folds in message count and timestamp (§2), so it moves on *every* append — including non-message lines (turn_duration fires every turn, sidecar records). So it must **never** be a discard trigger.

**What we do NOT do (both rejected):**
- *Cross-drain discard:* store the etag across drains, discard when the next drain's etag differs. Fires on every append (the normal growth path) → "always refetch the tail," destroying the acceptance bar.
- *Mid-drain discard:* discard the cache when a later hop's etag differs from the drain's first. This has the SAME defect at drain timescale: walk the flagship live-resume case — user foregrounds a conversation with a >80-message backlog while the session is actively streaming (~1 line/sec); the drain takes 2–3 hops hundreds of ms apart; any append between hops moves the etag → `resetQueries` discards the whole 7-day cache exactly when resuming a live conversation with a backlog. That IS the acceptance-bar scenario. Rejected.

**What we do (strip-then-break, never discard):** the drain loop (§3.2/§3.3 of the base design) issues several sequential `fetchPreviousPage()` hops for one trigger. Capture the `etag` from the **first response of a drain** (drain-local variable). On each subsequent hop of the **same drain**, if the returned `etag` differs from the captured one, **strip the just-prepended mismatched page and break** — the mismatched hop is the one read *across* the file change, the exact page the check exists to keep out, so it must not stay merged. Removing it uses the same `setQueryData` surgery as the empty-husk strip (§3.2 of the base design — machinery that already exists): drop `pages[0]`/`pageParams[0]`, then exit the drain loop. Hop-1 (and any pre-mismatch hops) stay merged. **No `resetQueries`, no cache discard.**

Why this is safe in both cases:
- **Benign append (the common case):** append-only growth preserves the prefix (the same Kafka-log insight the scanner fix is built on), so every already-merged page is valid. The stripped page's data simply arrives on the **next trigger's** drain instead; the cursor is untouched in between (it never advanced past the stripped page), so no gap. A false strip costs one hop's worth of re-fetch on the next trigger — nothing else.
- **Rewrite (the rare case):** stripping the mismatched page means the hop-2 page read *across* the file change never enters the cache. The next drain's `total <= cursor` gate (unchanged from Task 6) catches the shrink cases.

What the etag buys is exactly one thing — **never merge two hops read across a file change** — and it delivers that precisely: the offending page is stripped, not merged-then-orphaned. The false-positive outcome is a one-hop re-fetch on the next trigger, not a cache wipe.

- The captured etag is **drain-local**, never stored across drains.
- **Across drains, `total <= cursor` remains the only validity gate** (unchanged from Task 6). No etag comparison spans drains.
- If a hop carries no `etag` (old server / non-after_index), the within-drain check is inert — nothing to compare, drain proceeds normally.
- **Residual gap (accepted, documented, unchanged from the prior draft):** a file rewritten with `>= total` messages *between* two drains is caught by neither gate. Rare; the streamer's own file-identity check (fileIdentity in #202) drops its index and re-scans in that case, so the next delta returns fresh data. Accepted — the alternative (a prefix-etag) is not emitted by the server.

**Type change:** add additive optional `etag?: string` to `ConversationMessagePagination`. Read on after_index responses only.

## 6. Files touched

- **`services/ws-client.ts`** — add the `conversation_events` union member to `WSMessage`.
- **`hooks/useConversationStream.ts`** — add the plural-frame subscription; extend `parseLineToMessage(line, seq?)` to set `messageIndex` from a numeric seq; both subscriptions share `seenIds`.
- **`hooks/useConversations.ts`** — add `etag?: string` to `ConversationMessagePagination`; add the drain-local **strip-then-break** etag check inside the Task 6 drain loop (the ONLY change to the Task 6 effect: on a mid-drain etag change, strip the mismatched hop via the existing empty-husk `setQueryData` surgery, then `break` — never `resetQueries`).
- **No change** to `components/conversation/LiveConversationView.tsx` (§4).

**Two plan-level details (implement in the plan, not re-spec'd here):**
1. The plural `conversation_events` handler needs the **same `sessionId` filter** as the singular handler — one line, easy to omit.
2. Both handlers `JSON.parse` every line (plural first, singular dedupes *after* parsing). This double-parse is **accepted cost** — do NOT "optimize" it by dropping the singular subscription; that subscription is the old-server/codex fallback (§3) and removing it re-introduces the empty-overlay failure mode.

## 7. Testing

Unit (mock-driven):
- **(a)** plural frame with `seqs` → live messages get `messageIndex` from `seqs[i]`; a `null` entry → that message has no `messageIndex`.
- **(b)** plural-wins-race → the seq-carrying copy is kept, the trailing singular (same uuid) dedupes away via `seenIds`.
- **(c)** old-server / singular-only → messages have no `messageIndex`, overlay is non-empty (arrival-order fallback).
- **(d)** codex / absent `seqs` field → live messages have no `messageIndex`, no error.
- **(e) [pins strip-then-break, never discard]** mid-drain etag change → the drain's 2nd hop returns a different `etag` than its 1st → **hop-1 data stays merged, the mismatched 2nd-hop page is stripped from the cache (assert `pages.length` is back to its post-hop-1 count — this is the assertion that distinguishes strip-then-break from merge-then-break; without it the test passes under both and pins nothing), ZERO `resetQueries` calls**, cursor sits at the hop-1 merged position; a subsequent trigger (past the 5s guard) resumes and completes the drain.
- **(f) [pins never-discard-across-drains]** two consecutive drains whose `etag`s differ because messages were appended between them → **merge proceeds, NO discard, NO tail refetch** — the cursor advances by the normal `total`-gated merge. This is the test that would have caught the rejected cross-drain design.

Together (e) and (f) pin both failure modes: (e) never-discard-on-change (within a drain), (f) never-discard-across-drains.

E2E against the live 1.28.1 streamer (at the end): real `seqs` arriving on `conversation_events`, seq→`messageIndex` mapping, plural-wins-race, and `etag` present on after_index deltas.

## 8. Out of scope / constraints

- Stacks on `feat/persistent-cache-delta-sync` (#306). Merge #306 first, then re-point this PR's base to `main`. Rebase the stack if #306's review requests changes.
- No change to the Task 6 trigger/drain *mechanism* — only the within-drain etag signal is added to it, per the base design's note that Item 3 "doesn't need to touch it again" beyond feeding the merge and validity check.
- Additive, back-compatible: every new field is optional; old servers and codex sessions degrade to today's behavior.
