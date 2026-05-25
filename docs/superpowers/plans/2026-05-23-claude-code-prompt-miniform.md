# Plan — Sync mode: JSONL-sourced bubbles + native prompt forms

**Status:** queued (stub — flesh out when picked up)
**Created:** 2026-05-23
**Expanded:** 2026-05-25
**Touches:** `tb-mobile` + `tb-streamer` (new JSONL-tailer + WS event contract)

## Problem

Two problems collapse into one solution.

1. **Interactive prompts are hard to answer on a phone.** Claude Code (the CLI) emits interactive prompts inline in its TTY output — numbered selection lists, single-choice questions, multi-select checkboxes. Today these render in the mobile app as raw scrollback text inside the PTY view; the user has to scroll to find the question and type the matching number/letter into the input. It's awkward, error-prone (mis-typed numbers), and visually mixes the prompt with surrounding tool output.

2. **Parsing the PTY byte stream is fragile.** Whitespace and ANSI variations break detection across Claude Code versions. Anything we want to extract structurally — prompts, messages, tool calls — is unreliable when we start from terminal bytes.

Claude Code already writes a structured, append-only JSONL session file at `~/.claude/projects/<project>/<session>.jsonl`. Using that as the source of truth lets us render bubbles + structured forms without ever parsing the terminal stream.

## Goal

Add a per-session **Sync mode** toggle. When sync mode is on:

- Bubbles render from the JSONL session file (not the PTY stream).
- Each JSONL record renders as a typed bubble:
  - `MessageBubble` for user / assistant text
  - `ToolCard` / `ThinkingCard` (existing) for tool_use / thinking blocks
  - **`PromptForm`** (new) for detected interactive prompts — radio for single-choice, checkboxes for multi-select, "Submit" button
- Bubbles render **incrementally** as JSONL records land mid-turn (JSONL is append-only).
- Layout-refresh + autoscroll-to-bottom are **debounced (~120ms trailing)** so partial writes don't cause the list to jump.

PTY mode stays the default and is **unchanged**.

## Architecture

```
Claude Code → ~/.claude/projects/<proj>/<sess>.jsonl  (append-only NDJSON)
                       ↓ fs.watch / chokidar + line parser
                  tb-streamer
                       ↓ WS: jsonl.message / jsonl.tool_use / jsonl.tool_result / jsonl.prompt
                  tb-mobile (sync mode on)
                       ↓
       SyncModeMessageList → MessageBubble / ToolCard / PromptForm
                       ↑
              useDebouncedAutoscroll (120ms trailing)
```

## Streamer-side (`tb-streamer`)

- **New JSONL tailer module.** Subscribes to a session's `.jsonl` file via `fs.watch` (or `chokidar` if cross-platform robustness matters). Parses each appended NDJSON line into a typed record.
- **New WS event types:**
  - `jsonl.message` — `{ role: 'user' | 'assistant', content, messageId }`
  - `jsonl.tool_use` — `{ tool, input, toolUseId }`
  - `jsonl.tool_result` — `{ toolUseId, output, isError }`
  - `jsonl.prompt` — `{ promptId, shape: 'single' | 'multi', options: [{ id, label }], question? }`
- **Prompt detection** runs against the **structured assistant message content**, not PTY bytes. Far more reliable than the regex approach the original stub proposed.
- **stdin-injection endpoint** accepts `{ promptId, answer }` and translates to whatever keystrokes Claude Code's TUI expects (number + Enter for single-choice; multi-select TBD — see open questions).
- **Session-file correlation:** the streamer needs to know which `.jsonl` corresponds to which streamer session. Likely PID + cwd, but the exact correlation needs validation against Claude Code's actual session-file naming.

## Mobile-side (`tb-mobile`)

### Components

- **`SessionRenderModeToggle`** — header chip in the session-detail screen. "Stream" ↔ "Sync". Persists per session.
- **`SyncModeMessageList`** — FlashList of bubbles fed by the `jsonl.*` WS events. Sibling to (not replacement of) the existing `ChatScrollback`. Mounted only when the session is in sync mode.
- **`PromptForm`** — `components/session/PromptForm.tsx`. Renders a radio list (single) or checkbox list (multi) + Submit. Calls `submitPrompt(promptId, answer)` which posts back through the existing WS / sibling REST.
- **`useDebouncedAutoscroll(targetRef, deps, 120)`** — small hook that coalesces layout-change + scroll-to-bottom into one trailing-edge update per debounce window. Prevents mid-turn jumpiness.

### State

- **Session-detail Zustand slice additions:**
  - `renderMode: 'stream' | 'sync'` (per session, persisted)
  - `activePrompt: { promptId, shape, options, sourceMessageId } | null` (populated by the `jsonl.prompt` WS handler; cleared on submit/dismiss)
  - `jsonlMessages: JsonlRecord[]` (sync-mode message buffer)

### Wiring

```
<SessionDetailScreen>
  <SessionRenderModeToggle />                          // new — header chip

  {renderMode === 'stream' ? (
    <ChatScrollback />                                 // existing — unchanged
  ) : (
    <SyncModeMessageList                               // new
      records={jsonlMessages}
      activePrompt={activePrompt}
      onSubmitPrompt={submitPrompt}
    />
  )}

  <ChatInput />                                        // existing
</SessionDetailScreen>
```

`PromptForm` renders **inline** in `SyncModeMessageList` as a bubble at the position of the prompt record, not as a global overlay — this keeps the form anchored to its question in scrollback.

## Open design questions

These need answers before implementation:

1. **Mode coexistence.** Can a session toggle between Stream and Sync live, or is mode locked at session start? Affects whether `ChatScrollback` stays mounted in sync mode (and whether toggling forces a remount).

2. **Sync-on for an already-running session.** When sync mode turns on mid-session, do we backfill bubbles from the full JSONL or only render records appended from "now" forward? Backfill is more correct but means parsing potentially-large files on toggle.

3. **JSONL discovery.** How does the streamer correlate a `tb-streamer` session with the right `.jsonl` file? Likely PID + cwd matching, but needs validation against Claude Code's actual file naming. May require Claude Code to print its session-file path on stdout/stderr (env-flag-gated).

4. **Prompt detection details.** Does Claude Code's JSONL carry option metadata for interactive prompts as a structured field, or does the streamer still need to parse option text out of the assistant message body? Determines how robust single vs. multi-select detection can be.

5. **Multi-select submission.** Claude Code's multi-select TUI uses cursor keys + space + enter — replaying that via stdin isn't clean. Either:
   - Single-choice ships first; multi-select is render-only until upstream supports a comma-list / structured-answer mode.
   - We accept a fragile keystroke-replay path for multi-select and gate it behind a "experimental" flag.

6. **Cancel / dismiss.** What happens if the user backgrounds the app, swipes the form away, or the prompt times out streamer-side? Probably: dismiss clears `activePrompt` but the underlying Claude Code question still waits — user can fall back to typing in the chat input.

7. **JSONL → bubble identity.** What's the dedupe key? `messageId` from the JSONL record is the obvious choice, but we need to make sure FlashList's `keyExtractor` and the JSONL record IDs line up.

8. **Tool-call grouping.** Should a `tool_use` + its matching `tool_result` render as one bubble or two? Today PTY shows them as continuous output; bubbles may want to collapse them.

## Cross-repo coordination

- **`tb-streamer` lands first** (or in lockstep): tailer module + WS event types + correlation. Mobile is feature-gated on the streamer version that emits `jsonl.*` events.
- **`tb-mobile`:** subscribes to the new WS events, renders `SyncModeMessageList`, posts answers back via the existing stdin-injection endpoint. Mode toggle defaults OFF; ship sync mode behind a setting flag until single-choice prompt forms are validated end-to-end.

## Risks

- **JSONL schema drift.** Claude Code's JSONL is an internal format; upstream may rename fields or change record shapes between versions. The streamer parser needs to be defensive and emit unknown records as opaque "raw" bubbles rather than crash.
- **Backfill cost.** Long sessions may have multi-MB JSONL files. Backfilling on mode-toggle could be slow; may need a "tail from N records ago" cutoff.
- **Multi-select submission may not be cleanly possible** without upstream cooperation — see open question 5. The single-choice form can ship independently; multi-select may stay render-only.
- **Debounced autoscroll edge cases.** If the user manually scrolls up mid-turn to read earlier output, the debounced autoscroll must respect that (don't yank them back to bottom). Standard "isAtBottom" guard before autoscrolling applies.
- **Two sources of truth.** While sync mode is on, the PTY stream is still arriving server-side. We're choosing to ignore it for rendering, but if sync mode breaks for some reason (parser error, missing file), the user should be able to fall back to PTY mode without losing the session.

## Acceptance criteria (preliminary — refine when picked up)

- [ ] Per-session "Sync mode" toggle persists and survives app restart
- [ ] In sync mode, a completed turn renders as bubbles sourced from the JSONL (not PTY)
- [ ] Bubbles render incrementally as JSONL records land mid-turn
- [ ] Autoscroll-on-new-message is debounced (~120ms trailing); mid-turn writes don't cause visible jumps
- [ ] Manual scroll-up during a turn pauses autoscroll until the user returns to bottom
- [ ] Single-choice interactive prompts render as a `PromptForm` (radio) and submit correctly
- [ ] Multi-choice prompts at minimum render correctly (submit may be gated on upstream support)
- [ ] Unknown JSONL record shapes fall back to a plain "raw" bubble with no errors
- [ ] PTY mode is unchanged and remains the default
- [ ] If the streamer can't open the JSONL file, sync mode surfaces a clear error and offers a one-tap fallback to PTY mode

## Scope estimate

- **Streamer:** ~1 week — JSONL tailer + typed WS events + session-file correlation + structured-content prompt detection
- **Mobile:** ~1 week — `SyncModeMessageList` + `useDebouncedAutoscroll` + `PromptForm` + toggle chip + Zustand slice + WS handler wiring
- **Multi-select submission:** may slip to a follow-on; gated on upstream cooperation
