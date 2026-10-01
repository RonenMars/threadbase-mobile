# Terminal scrollback from the transcript

Status: in progress on `feat/terminal-transcript-scrollback` — steps 1–5 of the work plan landed; the Maestro flow (step 6) is open.
Date: 2026-09-25, updated 2026-09-27.

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

If there is no `conversationId` (no transcript yet, or a provider whose history is not indexed, such as Cursor without `cursorRoots`), the grid is all there is.

A clear no longer wipes it (landed 2026-09-27, `fix/terminal-keep-history-across-clears` here and `fix/replay-history-across-screen-clears` in tb-streamer):

- `VirtualTerminal` moves the grid's rows into a kept-history list before a `2J`/`3J` erases them.
  `getLines()` returns that history then the screen; `getFrameLines()` returns the screen alone.
  The history sits outside `grid`, so row addressing, which derives its origin from `grid.length`, is unchanged.
- The streamer's render terminal does the same (`ClearArchive` in `src/pty-shared.ts`), so a replay after a reconnect, or to a device that was not watching, carries the history too.
  `terminal_replay.archivedLineCount` marks where it ends; the client seeds it as history rather than feeding it as screen.
- The transcript join reads `frameLines`, never `lines`, so kept history can never reach the live region and repeat what the transcript shows.

What a clear still costs: history older than the caps (4000 rows on the streamer, 10 000 on the client), and a provider that reprints its whole history after a clear would show it twice (Claude Code 2.1.42 does not).

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

1. Done — `lib/splitTerminalView.ts` (`splitTerminalView`, `hasReplyInTranscript`, `resolveTurnFold`) and `__tests__/unit/lib/splitTerminalView.test.ts`. Fixtures are synthetic until the captures above exist.
2. Done — `hooks/useTerminalTranscript.ts` merges `useConversation` + `useConversationStream` with `mergeLiveMessages`; `SessionHistoryFeed` is removed.
3. Done — `TerminalOutput` renders one FlashList over transcript rows, a `live` divider and PTY rows; `TerminalView` keeps a one-line header (count + search, which opens the conversation screen's search).
4. Done — `components/terminal/TranscriptRow.tsx` + story.
5. Done — the fold lives in `useTerminalTranscript`; `Session.statusSource` is now read on the client.
6. Open — a Maestro flow using `e2e/mock-server.js`: a long turn with a scripted `2J 3J H` in the middle must keep the earlier turns visible.

Streamer: no change is required.
Additive, landed with the fallback fix: `terminal_replay.archivedLineCount` separates kept history from the current frame. A `clearEpoch` on `terminal_output` turned out unnecessary: the client parses the clear itself.
Also record in `docs/plans/2026-08-12-viewport-relative-cursor-positioning.md` that the `2J`/`3J` frequency is now verified, which is the question that doc left open.

## Out of scope

- Changing how Claude Code renders.
- Making the live region pixel-identical to a desktop terminal. It shows the rendered grid, as today.
- Search within the live region. Search stays on the transcript, which has everything once the turn folds.
