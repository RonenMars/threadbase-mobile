# E2E (Maestro) Mock Suite — Remaining Work

Status of the `npm run test:e2e:mock` flow suite after the fixes in this branch.
The suite runs 11 flows against `e2e/mock-server.js` on an **iOS 17 simulator**
(Maestro 2.0.10 cannot drive iOS 26 reliably — the preflight in `e2e/check-sim.js`
rejects it).

## Passing

- `launch`
- `browse` — _regressed to a crash in the last full run; see below_
- `bug6_bottom_bar_inset`
- `codex_parity`
- `settings_qr_scanner`

## Fixed in this branch, pending a green re-run

These have had their root cause addressed but were not yet confirmed green after
the latest edits:

- `feat2_export_in_info_shelf` — deep link switched `launchApp {url}` → `openLink`;
  route assertion switched from the brittle `"Resume Session"` text (the button is
  now `▶ Resume Session` inside an `Animated.Text`) to the `conversation-bottom-bar`
  testID.
- `pty_turn_divider` — stale testIDs `terminal-output` / `message-input` replaced
  with the real composer testID `chat-message-input` (the session screen's
  `TerminalView` mounts a `ChatComposer`).
- `voice_dictation` — stale testIDs `message-input` / `message-input-mic` replaced
  with `chat-message-input` / `chat-mic-button`. **Still blocked**, see below.

## Still to do

### 1. `voice_dictation` — speech-recognition permission prerequisite

`chat-mic-button` only renders when `micGranted === true`
(`components/conversation/ChatComposer.tsx:147`). `micGranted` comes from
`ExpoSpeechRecognitionModule.getPermissionsAsync()`
(`hooks/useComposerState.ts:69`). A freshly-`erase`d simulator has **no**
speech-recognition permission, so the mic button never mounts and the flow fails.

Options:
- Grant it before the flow:
  `xcrun simctl privacy booted grant speech-recognition com.ronenmars.threadbase`
  (verify `simctl privacy` accepts the `speech-recognition` service name on this
  Xcode; fall back to `microphone` or a TCC.db seed if not). Wire this into
  `e2e/ensure-release-build.js` or a pre-flow step so the suite is self-contained.
- Or gate the mic assertions behind a `when: visible` conditional so the flow is a
  no-op when permission is absent (weaker — it would stop testing the toggle).

### 2. `feat1_tree_drill_new_session` — hub renders a flat list, not a tree

The flow expects `tree-row-/home/user/my-project` and `drill-cwd-...`, but the hub
now renders a flat "LIVE" session list by default (the flow comment's "TreeView is
the default layout" is stale). Confirm the current default `sessionsLayout` and
either (a) toggle tree view on in the flow before drilling, or (b) update the flow
to the current hub interaction. Tree testIDs still exist in
`components/sessions/tree/TreeSessionsList.tsx` (`tree-row-…`, `conversation-row-…`),
so tree view is reachable — it is just not the default.

### 3. `05_chat_flow` — no live session card / composer

Failed on `text: "hello from chat-flow e2e"` not visible. Root cause was likely the
missing WebSocket (hub showed cached, `first-session-card` / live composer path
never mounted). The mock now has a `/ws` handler (pushes `session_list` +
`cache_ready`), so re-run first. If it still fails, trace whether
`first-session-card` → `session-detail-screen` → `chat-message-input` →
`chat-send-button` all mount, and whether the mock echoes the typed input back so
the sent text renders.

### 4. `06_search_anchor` — search results not appearing

Failed on `conversation-row-conv-search-anchor` not visible after typing "wombat"
into `hub-search-input`. testIDs `header-search-btn`, `hub-search-input`
(`app/index.tsx`) and `conversation-row-<id>` all exist. Re-run with the WS fix;
if still failing, confirm the mock `/api/search` returns `conv-search-anchor` for
query "wombat" and that `/api/conversations/conv-search-anchor` + its
`search-target` route serve the fixture the flow asserts (`"2 of 2"`,
`"wombat timeout"`).

### 5. `browse` — app crash

Last full run: "App crashed or stopped while executing flow." The flow taps
`filter-sort-button` → expects `filter-sort-sheet`
(`components/servers/FilterSortSheet.tsx`). Read the newest Threadbase crash in
`~/Library/Logs/DiagnosticReports` to get the faulting frame before deciding
whether it is a flow issue or a real app bug in the filter/sort sheet.

## Environment gotchas discovered

- **iOS 26 sims are rejected** by `check-sim.js`; use iPhone 15 / iOS 17.2.
- **Only one simulator may be booted** — a second booted sim makes Maestro's
  XCUITest driver time out ("iOS driver not ready in time"). Shut down extras.
- **`simctl erase` boots to a locked lock screen**; install+launch the app to
  dismiss it before running Maestro.
- **A stuck `xcodebuild test-without-building` process** from a failed run holds
  the driver slot — `pkill -9 -f test-without-building` before retrying.
- **`ensure-release-build.js` hangs if it has to build**: a bare
  `npx expo run:ios --configuration Release` builds *and then holds Metro open*, so
  the script never returns and Maestro never starts. Pre-build the Release `.app`
  (so the fast install path fires) or make the build step non-blocking.
- **Onboarding pairing survives `clearState`** (SecureStore/Keychain persists), so a
  sim previously paired to a real streamer skips onboarding and never points at the
  mock. `simctl erase` (or uninstall) clears it.
