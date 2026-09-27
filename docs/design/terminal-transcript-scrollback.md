# Terminal scrollback from the transcript

Status: proposed, not started.
Date: 2026-09-25.

## Problem

The Terminal view keeps no output older than about one screen while an agent turn is running.
It also disagrees with the "History · N messages" panel above it, usually by missing messages.

### Root cause (verified 2026-09-25)

Claude Code's renderer (checked in v2.1.42) has a full-reset path.
It writes `ESC[2J ESC[3J ESC[H` (clear the screen, clear the scrollback, move the cursor home) and then repaints only the current frame.
It resets for two reasons, `"resize"` and `"offscreen"`.
The offscreen reset happens whenever the live frame is taller than the 40-row viewport and a row that has scrolled above it changes.
A long turn does that all the time: elapsed-time counters, the spinner, and growing "Ran N shell commands" groups all trigger it.

Both of our terminal models follow the clear:

- The streamer's headless xterm (`tb-streamer src/pty-shared.ts`, scrollback 1000) is the source of `terminal_replay`.
  Reproduced with `@xterm/headless` 6: 150 rows of history, then the clear sequence and a 10-row frame, leaves 10 rows.
- The mobile `VirtualTerminal` (`services/virtual-terminal.ts:308-312`) replaces the whole grid with `[[]]` on either `2J` or `3J`.

Two things make it worse:

- On every WebSocket reconnect, `hooks/useTerminalStream.ts:316-319` resets `historyFedRef`.
  The next `terminal_replay` then replaces whatever the phone had kept with the server's copy, which only covers what came after the clear.
- The History panel (`components/terminal/SessionHistoryFeed.tsx:79`) is a `useConversation` snapshot.
  Nothing live feeds it, so it falls behind the Terminal while a turn runs.

Even without the clears, the Terminal could never match History.
The TUI collapses tool runs ("Ran 2 shell commands"), truncates tool output, and hides content behind `ctrl+o`.
The chrome filter and `getLines()` also drop empty rows and border rows.
The JSONL transcript has every item; the screen was never going to show them all.

## Decision

Build the Terminal view's scrollback from the conversation transcript.
Use the PTY only for the part of the current turn that the transcript does not have yet.

This makes these fixes unnecessary for any session with a transcript:

- Keeping scrollback through `2J`/`3J` in the mobile `VirtualTerminal`.
- Removing `ESC[3J` or snapshotting on the streamer, and the 1000-row replay cap.

Both stay available as a small fallback for sessions with no transcript (see [Fallback](#fallback)).

## Sources

| Source | Carries | Delivery | Already consumed by |
|---|---|---|---|
| JSONL transcript, over REST | Every finished message, tool call and tool result, with `uuid`, `timestamp` and `messageIndex` | `GET /api/conversations/:id` (paged) | `useConversation`, `SessionHistoryFeed` |
| JSONL transcript, live | The same items as they are appended | WS `conversation_events` `{ lines, seqs }` (`seqs[i]` = `messageIndex`) | `useConversationStream`, `LiveConversationView` |
| Submitted prompts | What the streamer wrote to the PTY, with `ts` | `terminal_replay.userMessages`, WS `user_message` | `useTerminalStream` (`userMessageTexts`) |
| Rendered PTY | The live frame, plus anything printed since the last clear | `terminal_replay` + `terminal_output` | `useTerminalStream` → `VirtualTerminal` |
| Turn state | `running` / `waiting_input`, `statusSource: "turn-signal"` | `session_update` | `useSessionDetail` |

For Claude sessions, the streamer does not need to change.
Each source is already on the wire.
The chat view already merges the REST and live transcript: `utils/mergeLiveMessages.ts` (`mergeLiveMessages`, `dropSeenLive`) dedupes by `uuid`, then `messageIndex`, then `id`.

A convenient consequence: after a clear, both terminal models hold exactly "everything since the last clear".
That is the region the join below searches, so the clear stops being a bug and becomes a boundary.

## Layout

One scroll list replaces the History panel and the terminal pane:

```
┌──────────────────────────────────────────┐
│ transcript rows (structured, from JSONL) │  ← all older turns
│   ❯ user prompt                          │
│   ⏺ assistant text                       │
│   ⏺ Bash  npm test         ✓             │  ← one row per tool call, expandable
│ ...                                      │
│ ── live ──────────────────────────────── │  ← only while a turn is open
│ PTY rows for the current turn            │  ← VirtualTerminal lines, raw styling
└──────────────────────────────────────────┘
```

Transcript rows use terminal styling: monospace, `❯` for the user, `⏺` for the assistant, one line per tool call with its result collapsed.
The rendering can start from `MessageItem` and get its own compact variant later.
The full-screen history mode (`historyFull`) is no longer needed and is removed.

## The join rule

The only boundary both sides can see is the user prompt.
It exists in three places with no guessing:

- In `userMessages`, as ground truth with a `ts`.
- In the JSONL, as a `user` message.
- In the grid, as a `❯ <text>` row, which `userMessageTexts` already matches.

Let `P` be the prompt that opened the current turn: the latest entry in `userMessages`.

**No turn open** (`waiting_input` from a turn signal, `idle`, or no prompt yet):

- Show the transcript only. No live region.

**Turn open** (`running`, or a permission or question card is pending):

1. Find the last grid row that matches `P` in the since-last-clear region.
2. **Row found:** the live region is that row and everything below it.
   The transcript shows messages before `P`'s JSONL user message.
   The current turn's JSONL items are hidden, because the live region already shows them as the agent drew them.
3. **Row not found:** the prompt was printed before the last clear and not repainted.
   The transcript shows messages through the newest one, including this turn's finished items.
   The live region is the frame since the last clear.
   This can duplicate one item that is both finished in the JSONL and still on screen.
   That is acceptable: it is visible, bounded, and only happens mid-turn.
   Never drop an item to avoid a duplicate, because a drop is what this design exists to remove.

**Folding a finished turn:**

- Close the live region when a turn-signalled `waiting_input` arrives **and** the transcript has an assistant message newer than `P`.
- If that message has not arrived 2 s after the status change, fold anyway and refetch the conversation tail.
  This matches `TURN_DONE_SETTLE_MS` on the streamer.
- A status change that did not come from a turn signal (marker, `submit-stale`, boot timer) does not fold.
  Those are guesses, and `WaitingInputNotifier` ignores them for the same reason.

The join is a pure function, so it can be tested without React:

```ts
splitTerminalView({
  gridLines,     // VirtualTerminal.getLines(), since last clear
  prompts,       // userMessages
  messages,      // mergeLiveMessages(history, live)
  turnOpen,      // derived from session status + pending cards
}): { transcript: Message[]; live: string[]; anchor: 'prompt-row' | 'frame' | 'none' }
```

## Why this holds under the failure modes

| Event | Today | With this design |
|---|---|---|
| Offscreen/resize full reset | History above the frame is lost | Transcript is unaffected; the live region is rebuilt from the repaint |
| WS reconnect / app foreground | Replay replaces local history with the post-clear copy | Transcript reloads over REST; replay only rebuilds the live region |
| Turn output > 1040 rows | Oldest rows fall off the xterm scrollback | Only the live region is capped, and only mid-turn |
| Collapsed / truncated tool output | Never on screen | In the transcript, expandable |
| History panel falls behind | Snapshot with no live feed | The same `conversation_events` stream the chat view uses |

## Fallback

If there is no `conversationId` (no transcript yet, or a provider whose history is not indexed, such as Cursor without `cursorRoots`), render the grid as today.

In that mode the clear still wipes history.
If that matters, apply the small fix that stays out of scope here: `2J` clears only the viewport rows and `3J` is ignored, rewriting the two `virtual-terminal.test.ts` cases that assert the wipe.

`setRawMode` stays as an escape hatch: it shows the grid with no join, for debugging a join that looks wrong.

## Codex

Codex runs with `--no-alt-screen` and has its own rollout transcript.
`useConversationStream` already parses its lines (`parseCodexLineToMessage`).
The same join applies: the prompt anchor is the same `userMessages` entry.
Check that Codex's frame still shows the submitted prompt before relying on step 2; otherwise it runs in the "row not found" branch, which is still correct.

## Verify before building

These are assumptions the join depends on.
Each one takes one capture.
`GET /api/sessions/:id/output` returns the raw ring buffer as a verbatim capture.

1. **The prompt row after a reset.** During a long turn, is `❯ <prompt>` part of the frame Claude repaints after `clearTerminal`?
   If it never is, step 2 never fires, the "row not found" branch becomes the only path, and the design stays correct but duplicates more.
2. **JSONL flush granularity.** Confirm that Claude writes an assistant text block only once it is finished, not token by token.
   The live region exists to cover exactly that gap.
3. **Clear frequency.** Count `ESC[3J` per turn in a real capture, so the fallback's priority rests on data.

## Work plan

Mobile:

1. `lib/splitTerminalView.ts` and its unit tests, with fixtures taken from real captures (see above).
2. Feed `useConversationStream` + `mergeLiveMessages` into the terminal screen instead of the `SessionHistoryFeed` snapshot.
3. A single list in `TerminalView`: transcript rows, then the live divider, then `TerminalOutput` rows. Remove `historyFull`.
4. A compact terminal-styled transcript row, with a story (required for new components).
5. Fold logic keyed on the turn signal, with the 2 s fallback.
6. A Maestro flow using `e2e/mock-server.js`: a long turn with a scripted `2J 3J H` in the middle must keep the earlier turns visible.

Streamer: no change is required.
Optional and additive: stamp `terminal_output` with a `clearEpoch` counter so the client can tell "since last clear" without parsing escapes.
Also record in `docs/plans/2026-08-12-viewport-relative-cursor-positioning.md` that the `2J`/`3J` frequency is now verified, which is the question that doc left open.

## Out of scope

- Changing how Claude Code renders.
- Making the live region pixel-identical to a desktop terminal. It shows the rendered grid, as today.
- Search within the live region. Search stays on the transcript, which has everything once the turn folds.
