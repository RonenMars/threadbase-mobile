# Structured `AskUserQuestion` path — design

**Date:** 2026-06-19
**Status:** Approved design (pre-implementation)
**Repos:** tb-streamer (detection + answer translation), tb-mobile (rendering + answer UI). tb-scanner: **not involved** (see Rejected alternatives).
**Reference:** `docs/research/2026-06-19-askuserquestion-structure.md` (the verified `AskUserQuestion` structure).

## Problem

Claude Code asks interactive multiple-choice questions via the structured `AskUserQuestion` tool (`tool_use` block, `input.questions[]`). tb-mobile currently has **no structured handling** — it scrapes inquirer-style **PTY text** with `utils/parseQuestionBlock.ts` (consumed by `components/terminal/TerminalOutput.tsx` and `components/conversation/ThinkingBubble.tsx`, rendered by `components/terminal/QuestionCard.tsx`) and replies with **relative arrow keystrokes** (`\x1b[B`/`\x1b[A` × delta + `\r`) to `POST /api/sessions/{id}/input {keys}`.

That approach has real defects:
- **Stale-`selectedIndex` race:** the arrow delta is computed from a scraped cursor position that can be out-of-date on the next PTY frame or a fast double-tap → wrong option submitted.
- **Lossy:** loses `header`, per-option `description`, `multiSelect`, `preview`, and multi-question calls — the PTY text only yields a flat label list.
- **Brittle parsing:** rigid 2-space indent rule, Format-2 "question = closest line above ❯" false-positives on box-drawing/blank headers, and a weaker `stripAnsi` in `ThinkingBubble` than in `parseQuestionBlock`.

## Goal / success criteria

- When Claude Code emits an `AskUserQuestion`, tb-mobile renders a **native form from structured data** (header, question, options with descriptions, multiSelect) — not scraped text.
- Selecting an answer reliably lands on the **correct option** in the real session, with **no index race**.
- The option-index math lives in **exactly one place** (the streamer), is a **pure, unit-tested function**, and is **live-verified** against a real Claude Code prompt before being trusted.
- Back-compatible: older mobile builds and the raw terminal view keep working.

## Architecture & data flow

```
Claude Code (PTY spawned by streamer)
  └─ writes JSONL line: message.content[] has tool_use{ id, name:"AskUserQuestion", input.questions[] }
       ▼
tb-streamer  ConversationWatcher (chokidar) → readNewLines → onNewLines  [server.ts ~208–223]
  ① JSON.parse each line; find tool_use blocks with name === "AskUserQuestion"
  ② record pending question for session (toolUseId + questions, option order preserved)
  ③ broadcast NEW ws message { type:"question", sessionId, toolUseId, questions }
     (still broadcasts conversation_event / conversation_events for back-compat)
       ▼
tb-mobile  useActiveQuestion (new hook) subscribes to ws "question" / "question_cancelled"
  ④ holds active question keyed by toolUseId; clears on cancel/answer
       ▼
QuestionCard (structured mode) renders header/question/options{label,description,preview?}/multiSelect
  ⑤ user selects → answers = { [questionText]: label }   (v1: single-select)
       ▼
POST /api/sessions/{id}/answer  { toolUseId, answers }
       ▼
tb-streamer  answer handler
  ⑥ verify toolUseId === session's pending question (else reject; no keystrokes)
  ⑦ answersToKeystrokes(questions, answers) → exact byte string
  ⑧ write to PTY via existing sendKeys/writeSubmit; clear pending state
       ▼
Claude Code receives the selection as if typed in the terminal
```

**Core principle — the streamer owns the translation.** It detected the question, so it holds the authoritative option order and converts labels→keystrokes. Mobile never computes arrow counts. The inquirer cursor starts at index 0 (known, not scraped), so the stale-`selectedIndex` race is designed out.

## Contracts & types

### WS message `question` (streamer → mobile)

```ts
interface QuestionWsMessage {
  type: 'question'
  sessionId: string
  toolUseId: string          // tool_use block id; answer correlation key
  questions: AskQuestion[]    // 1–4
}
interface AskQuestion {
  question: string
  header: string              // ≤12 chars
  multiSelect: boolean        // normalized: absent → false
  options: AskOption[]        // 2–4
}
interface AskOption { label: string; description: string; preview?: string }
```

### WS message `question_cancelled` (streamer → mobile)

```ts
interface QuestionCancelledWsMessage { type: 'question_cancelled'; sessionId: string; toolUseId: string }
```
Emitted when the pending prompt resolves another way: 60s timeout, answered from the terminal directly, or answered by another client. Mobile dismisses the card.

### Endpoint `POST /api/sessions/{id}/answer`

```ts
// request
{ toolUseId: string, answers: Record<string /* question text */, string | string[]> }
// value = chosen label; string[] for multiSelect; raw user text for "Other"
// response
{ ok: true } | { ok: false, reason: 'no_pending_question' | 'tool_use_mismatch' | 'unknown_option' }
```
Separate from `/input` so the keystroke path is untouched and stale/duplicate answers are rejectable by `toolUseId`.

### Mobile `QuestionBlock` (widened, dual-source)

```ts
interface QuestionBlock {
  source: 'structured' | 'pty'
  toolUseId?: string                // structured only
  questions: QuestionItem[]         // structured: 1–4; pty: single Q wrapped as one item
  selectedIndex?: number            // pty only (the ❯ cursor)
  questionLineIndex?: number        // pty only
}
interface QuestionItem {
  question: string
  header?: string                   // structured only
  multiSelect: boolean              // pty → always false
  options: QuestionOption[]
}
interface QuestionOption { label: string; description?: string; preview?: string }
```
`parseQuestionBlock` returns `{ source:'pty', … }`; the structured event maps to `{ source:'structured', … }`. One shape feeds `QuestionCard`.

## Answer → keystroke translation (streamer)

Pure function `answersToKeystrokes(questions: AskQuestion[], answers): string`, extracted for unit testing (no PTY needed). Inquirer cursor starts at **index 0**; `↓`=`\x1b[B`, `↑`=`\x1b[A`, Enter=`\r`, Space=`' '`.

**Single-select (v1):**
```
target = options.findIndex(o => o.label === answers[questionText])
if target < 0 → treat as free-text (see Other) or, if not intended, return unknown_option
keys = '\x1b[B'.repeat(target) + '\r'      // down-only from known index 0
```

**Multi-question (≤4):** Claude Code presents questions in sequence. Replay each question's `↓×n + Enter` block in order, waiting for the next prompt to render (reuse the existing ~16ms settle delay in `writeSubmit`) before the next block.

**multiSelect (v2):** Space toggles, Enter confirms. Sort chosen indices ascending; walk cursor downward, `Space` at each chosen index; final `Enter`. Exact sequence pinned by tests.

**"Other" / free text (v2):** value matches no `option.label` → select the free-text affordance, then type via the existing **bracketed-paste** path (`\x1b[200~`+text+`\x1b[201~`+ delayed `\r`, already in `buildPasteBytes`/`writeSubmit`).

**Safety:**
- Unknown label (not intended free-text) → `unknown_option`, send nothing.
- `toolUseId` ≠ pending → `no_pending_question`/`tool_use_mismatch`, send nothing.
- After a successful write, clear the session's pending-question state.

## Mobile rendering & fallback

- **`ThinkingBubble`** (live-chat view): when an active structured question exists for the session, render `QuestionCard` in **structured mode** and drop the `parseQuestionBlock(lines.slice(-30))` scrape for that case. If no structured event is present (older streamer), fall back to the existing PTY scrape.
- **`TerminalOutput`** (raw terminal view): keep the PTY scrape — it has no conversation stream. It benefits from the parser fixes below.
- **`QuestionCard`** grows to render: `header` (chip), per-option `description` (secondary line), `preview` (monospace block when present), and a disabled/loading state after submit until `question_cancelled` or the next conversation event arrives. v1 renders single-select radios; multiSelect checkboxes land with v2.
- Answer submit calls the new `/answer` endpoint (via a `useAnswerQuestion` mutation in `useSessionActions`), not `sendKeys`.

## `parseQuestionBlock` fixes (PTY fallback hardening — independent of the structured path)

These fix the scraper that remains the fallback / terminal-view transport:
1. **Indent rule:** accept 2–3 leading spaces for unselected options (`/^ {2,3}(\S.*)$/`), still rejecting ≥4 (tool output). Real multi-digit/aligned lists indent to 3.
2. **Format-2 header false-positive:** when deriving "question = line above ❯", also reject lines that are box-drawing/border-only or empty-bracket headers, not just the `Enter to select|↑|↓|Esc` footer.
3. **Unify `stripAnsi`:** `ThinkingBubble` uses a weaker regex than `parseQuestionBlock` (misses OSC without BEL and `\x1b\\` terminators). Export and reuse `parseQuestionBlock`'s `stripAnsi` (or a shared `utils/stripAnsi.ts`) in both.
4. **Adapt output to the new `QuestionBlock` shape** (`source:'pty'`, single-item `questions[]`).

## Removed defect: the arrow-delta race

The structured path eliminates the stale-`selectedIndex` race entirely — the index math moves to the streamer off a known start index. The mobile `handleOptionSelect` arrow-delta code in `ThinkingBubble` and `TerminalOutput` is **removed for the structured case** (structured answers go through `/answer`). The PTY-fallback path, if kept, sends a single absolute sequence derived from the freshly-parsed block at tap time (no cross-render delta).

## Testing / verification

**Unit (streamer) — the critical tests:** `answersToKeystrokes` exact-byte assertions:
- `options[0]` → `"\r"`; `options[2]` of 4 → `"\x1b[B\x1b[B\r"`.
- multi-question → concatenated blocks in order (v1).
- (v2) multiSelect [0,2] → pinned toggle sequence; "Other" → bracketed-paste bytes.
- unknown label → `unknown_option`; stale `toolUseId` → rejection, zero bytes written.

**Unit (streamer) — detection:** given a JSONL line with an `AskUserQuestion` tool_use, `onNewLines` emits one `question` message with the right `toolUseId` + normalized `questions` (multiSelect default false); given a `deferred_tools_delta` line, it emits **nothing** (regression guard against the rejected scanner signal).

**Unit (mobile):** `parseQuestionBlock` new cases (3-space indent, border header rejection, shared stripAnsi). `QuestionCard` structured mode (header/description/preview render; submit calls `/answer` with `{toolUseId, answers}`; disabled after submit). Existing tests adapted to the widened `QuestionBlock`.

**Live verification gate (required before trusting the translator):** drive a real Claude Code `AskUserQuestion` prompt through a real PTY; capture bytes; confirm `↓×n + Enter` lands on the intended option for single-select. Confirm (for v2) cursor-start-at-0, Space-toggle/Enter, and "Other" reachability. **Do not ship v1 until single-select is live-verified.**

## Phasing

- **v1 (single-select, ~98% of real questions):** streamer detection + `question`/`question_cancelled` events; `/answer` endpoint; `answersToKeystrokes` single-select + multi-question; mobile structured `QuestionCard` + `useActiveQuestion` + `/answer` mutation; PTY-fallback parser fixes. Live-verify single-select. Ship.
- **v2:** multiSelect (Space/Enter) and "Other"/free-text (bracketed-paste) in the translator + checkbox/free-text UI in `QuestionCard`. Contracts already accommodate both (no rework).

## Assumptions (to confirm during implementation)

1. Inquirer cursor starts at **index 0** when an `AskUserQuestion` prompt renders (matches the scraper's default and standard inquirer; verify live).
2. multiSelect = **Space-toggle / Enter-confirm**; "Other" reachable past the last option (v2; verify live).
3. tb-streamer's JSONL watcher sees the `tool_use` line in time to broadcast before the user would act (it already tails live and broadcasts per line, so yes — confirm no batching delay).

## Rejected alternatives

- **Detect in tb-scanner via `attachment.deferred_tools_delta.addedNames`.** Rejected: that signal is the harness announcing the tool *schema became available* (a ~250-name registration manifest) — **no questions, no options** (verified: 5 such lines in the corpus, `has_questions_field:false`), present in ~every session. The real question is the `tool_use{name:"AskUserQuestion", input.questions[]}` block (verified: 955 real calls / 166 files), which flows through the streamer's live JSONL tail. tb-scanner is a metadata/search indexer (readline, no live push) — wrong layer for a live interactive prompt.
- **Mobile-only detection in `useConversationStream`.** Workable (it already parses `tool_use` blocks) but forces every client to reimplement detection and gives desktop/CLI nothing; and the answer would still need a structured translation path. Rejected in favor of the streamer seam, which is the single shared point.
- **Mobile keeps sending raw keystrokes from option index.** Rejected: re-introduces the index race and forces mobile to encode inquirer navigation; multiSelect/"Other" are awkward as blind keystrokes.
```
