# Anchored Search — Functional Runbook

How search-to-conversation anchoring works end-to-end, the invariants that keep it honest, and how to figure out which layer broke when it misbehaves.

Covers the mobile side (`feat/anchored-search-navigation`) and its streamer counterpart (tb-streamer `anchored-search` worktree). Structure borrowed from a prior chat-search postmortem runbook — every arrow in the diagram below is a place the feature can break.

---

## 0. Mental model

```
USER SEARCHES "last" IN THE CONVERSATION LIST, TAPS A RESULT
        │
        ▼
navigation carries ?search=last            lib/conversationHref.ts
        │
        ▼
app/conversation/[id].tsx
        │
        │ QUERY /api/conversations/:id/search-target   body { q: "last" }
        │   (HTTP QUERY, RFC 10008 — resolver is skipped entirely when
        │    ?anchor_index= is already in the params)
        ▼
tb-streamer  src/services/conversations/findSearchTarget.ts
        │   case-insensitive literal substring over message text;
        │   falls back to thinking/tool payloads when no text matches.
        │   → { message_index, match_indexes[] (last 1000, ASC),
        │       total_matches (uncapped), snippet, uuid }
        │   404 (search_target_not_found, or route-missing on an older
        │   streamer) → mobile opens the plain tail view, no highlight.
        ▼
anchorIndex = last entry of match_indexes (tail-most match)
fetchAnchor  ← keyed to the match_indexes array identity; only
               out-of-window steps advance it (re-fetch gate)
        │
        │ GET /messages?anchor_index=N…  (one anchored window request —
        │    never tail-then-backfill)           hooks/useConversations.ts
        ▼
FlashList renders the window
        │
        ├─ handleContentSizeChange storm: re-pin to anchor on every content
        │  growth until 150ms of quiet (settle) — 500ms hard cap lifts the
        │  skeleton regardless; one-shot retry 250ms after settle
        │
        ├─ the anchor row renders → MessageItem sets testID
        │  "search-anchor-message", passes matchAnchor down
        │
        ├─ MessageBubble TextContent: HighlightText onTextLayout →
        │  lineYForChar(charIndex) → measureLayout against the row →
        │  reports the keyword's y INSIDE the row up to the screen
        │  (matchLayoutRef; min-merge across text parts, keyed by
        │  messageIndex)
        │
        ▼
scrollToAnchor()                        app/conversation/[id].tsx
        │   measured:   scrollToIndex({ viewPosition: 0,
        │               viewOffset: matchY - listHeight / 3 })
        │               → keyword lands a third down the viewport
        │   unmeasured: scrollToIndex({ viewPosition: 0.45 })  (row-centered
        │               fallback — also the terminal state for matches inside
        │               code blocks, which never report)
        │
        │   NOTE: FlashList v2 ADDS viewOffset to the target offset —
        │   opposite sign to RN FlatList. It clamps overshoot itself.
        ▼
prev/next stepping (goToMatch)
        │   in-window:  rough animated scrollToIndex(0.45) + pending flag;
        │               when the newly-highlighted row reports its keyword y,
        │               a one-shot 300ms timer (anchorRetryRef) re-aims
        │               precisely. Deferred because concurrent FlashList
        │               scrollToIndex loops race each other.
        │   out-of-window: advance fetchAnchor → fresh anchored fetch → the
        │               whole settle sequence reruns for the new window.
        ▼
user drags → handleScrollBeginDrag kills every pending auto-scroll
```

---

## 1. Invariants

| Invariant | Where enforced / tested |
|---|---|
| Exactly one row carries `search-anchor-message` at any time | `MessageItem` sets it only for `messageIndex === anchorIndex`; asserted before/after stepping in `conversation-search-anchor.test.tsx` |
| Counter numerator and denominator walk the same list (`match_indexes`) | `matchTotalLabel` in `[id].tsx` — shows `N+` when the streamer's uncapped `total_matches` exceeds the capped navigable list |
| Counting is per-message, not per-occurrence | streamer counts matching messages; test "counts matches per message, not per occurrence" documents it |
| Needle pipeline is identical on both sides | streamer: `trim` + `toLowerCase().includes` (literal); mobile: `highlight.trim()` + HighlightText defaults (case-insensitive, autoEscape). Change one → change both |
| Stepping inside the loaded window never re-fetches (and never re-gates the skeleton) | `fetchAnchor` keyed to `match_indexes` identity; regression test "does not re-fetch when stepping to a match already in the loaded window" |
| A resolver 404 degrades to the plain tail view, never blocks navigation | `targetQuery` with `retry: false`; test "falls back to the tail view…" |
| No search param → resolver never called | test "does not call the resolver when no search param is present" |

---

## 2. Symptom → layer

Find the symptom, run the check, narrow the layer.

### 2.1 — "Opens at the tail, no highlight"

Working as designed if the streamer predates the endpoint or nothing matched — but verify which:

1. Network: did `QUERY …/search-target` fire? No → `searchQuery` empty or `anchor_index` param present (resolver is skipped). Check the navigation URL built in `lib/conversationHref.ts`.
2. It fired and got 404 → check `code`: `search_target_not_found` (query genuinely absent from message bodies — remember the list-search may have matched project path/title, which the target resolver does not search) vs route-404 (older streamer).
3. It returned 200 → check the shape. If `match_indexes` is missing/renamed, mobile silently degrades to tail (`matchIndexes` undefined → `isAnchored` false). This silent-on-drift behavior is deliberate; a shape change on the streamer must be mirrored in `SearchTargetResponse` in `[id].tsx`.

### 2.2 — "Lands on the right message but the keyword is off-screen"

The keyword-aiming pipeline broke; the fallback (row-centered 0.45) is what you're seeing.

1. Is the match inside a fenced code block? Code is never highlighted → never measured → row-centering is the terminal state. Known ceiling, not a bug.
2. Check the report chain: `MessageItem` builds `matchAnchor` only when `highlight && onMatchLayout && messageIndex != null`. A message missing `messageIndex` kills it.
3. `onTextLayout` fired but `measureLayout` didn't call back → row ref detached (recycled mid-measure). The next report re-arms.
4. `listHeightRef` is 0 → the wrapper `onLayout` never fired; measured path is skipped entirely.
5. `matchLayoutRef` key mismatch: reports are keyed by `messageIndex` and consumed only when it equals the *current* `anchorIndex` — a stale report from the previous anchor is ignored by design.

### 2.3 — "Lands correctly, then jumps"

1. During initial load this is the settle storm working as intended (re-pin on every content growth until 150ms quiet). It should stop after settle + one 250ms retry.
2. Jumps *after* the user dragged → a pending auto-scroll survived. `handleScrollBeginDrag` must clear `initialScrollSettleRef`, `anchorRetryRef`, and `pendingMatchScrollRef`; the 300ms nudge timer additionally checks `userHasScrolled`.
3. Two scrolls visibly fighting → someone reintroduced an inline corrective scroll. FlashList runs each `scrollToIndex` as a multi-step loop; corrective scrolls must be sequenced through the timer, never fired while another loop is in flight.

### 2.4 — "Endless skeleton"

The d90f09e bug class. The skeleton lifts on `onContentSizeChange` settling — an anchored re-fetch that produces a byte-identical window never fires it again.

1. Check `fetchAnchor`: did something re-key it on an *in-window* step? Only out-of-window steps may advance it.
2. Check the reset effect deps (`[id, fetchAnchorIndex]`) — anything added there re-gates the skeleton on every change.
3. The 500ms `firstLayoutCapRef` is the last-resort backstop; if even that didn't lift it, the effect never ran (conversation identity churn).

### 2.5 — "Counter looks wrong"

1. `X of N+` → not a bug: more than 1000 messages matched; the denominator counts the navigable (capped) list.
2. Occurrences vs messages confusion → counting is per-message everywhere (a message containing the term three times is one match). If product wants per-occurrence stepping, that's the one-more-highlight `states`/`measureMatch` work — see §5.
3. Numerator stuck → `matchPosOverride` is keyed to the `match_indexes` array identity; a re-resolved search (new array) resets it to the tail-most match by design.

### 2.6 — "Stepping re-fetches every time"

`loadedRowIndex` lookup failed: `conversation.messages.findIndex(m => m.messageIndex === nextIndex)` returned -1 for a message that *is* loaded → `messageIndex` missing or drifting from the server's `message_index`. Check the adapter in `hooks/useConversations.ts`.

---

## 3. Test rig

| Layer | Where |
|---|---|
| Anchored navigation integration (resolver, fallback, window re-fetch gating, anchor-row invariant, counter semantics) | `__tests__/integration/conversation-search-anchor.test.tsx` — path-keyed mock responders distinguish tail vs anchored vs QUERY requests |
| Keyword line mapping (one-more-highlight `onMatchesLayout`) + highlight rendering | `__tests__/integration/components/MessageBubble.test.tsx` |
| Tool-card force-open + body highlight on match | `__tests__/integration/components/ToolCard.test.tsx` |
| End-to-end on simulator | `e2e/06_search_anchor.yaml` against `e2e/mock-server.js` (fixtures: `conv-search-anchor.json`, `conv-search-target.json`, `search-results.json`); runs in `npm run test:e2e:mock` |
| Streamer resolver | tb-streamer worktree — `findSearchTarget` unit tests |

What jest *cannot* see: the real scroll geometry (the FlashList mock's scroll methods are no-ops) and `onTextLayout`/`measureLayout` (never fire under jest). The viewOffset math and the measure-then-re-aim behavior are only verifiable on device/simulator — that's what the e2e flow and manual checks are for.

---

## 4. Acceptance criteria

Functional:

- Tapping a search result opens the conversation anchored, keyword highlighted, keyword visible in the upper third of the viewport (not merely "the right message somewhere on screen").
- The counter opens at the tail-most match (`N of N`); prev walks older, next newer, both wrap.
- Stepping to an in-window match moves the highlight + counter with no network request and no skeleton.
- Stepping to an out-of-window match fetches one anchored window and lands the same way the initial open does.
- A match inside a code block lands row-centered (no highlight inside code) — acceptable, documented.
- Clearing search (X) drops the nav bar and highlight without re-fetching.
- Search against an older streamer (no endpoint) opens the plain tail view — no error surface.

Correctness:

- Exactly one `search-anchor-message` row at all times.
- Counter numerator/denominator both derive from `match_indexes`; `N+` denominator iff `total_matches > match_indexes.length`.
- A user drag at any point during the landing sequence cancels every subsequent programmatic scroll.

Quality gate: `npx tsc --noEmit`, `npx eslint`, full jest suite, and `npm run test:e2e:mock` green.

---

## 5. Known ceilings & deliberate behaviors

- **Per-message navigation.** Occurrence-level stepping *within* a message needs per-occurrence active styling + measurement — planned via one-more-highlight's `states` API + `onMatchesLayout`/`measureMatch` (feature request drafted). When that lands, port the prior-art regression: *initial* render must mark an active occurrence without requiring a first step.
- **`match_indexes` cap (1000, streamer `MAX_MATCH_INDEXES`).** Only the last 1000 matching messages are navigable; the UI shows `N+`. Pagination of the match list is the upgrade path if anyone ever hits this.
- **Tool matches** force the tool card open, highlight the keyword in its body, and aim the scroll at it (`ToolCard` receives `highlight` + `matchAnchor`, reports keyword-y via `onMatchesLayout` → `measureLayout` like `TextContent`). The report arrives after the force-open lays the body out, so the screen's late-report retry (`handleMatchLayout` min-y + 300ms `anchorRetryRef`) re-aims once measured. Thinking cards and fenced code blocks still render no highlight and land row-centered.
- **`lineYForChar` is line-granular.** The scroll aims at the match's rendered line, not the glyph — RN exposes no substring measurement.
- **jest can't verify scroll geometry** — see §3. Any change to `scrollToAnchor` math or the measure/re-aim chain needs a simulator pass.
