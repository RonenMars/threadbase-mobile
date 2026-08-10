# E2E (Maestro) Mock Suite — Remaining Work

Status of the `npm run test:e2e:mock` flow suite after the fixes in this branch.
The suite runs **15 flows** against `e2e/mock-server.js`, of which 11 pass — see
[#600](https://github.com/RonenMars/threadbase-mobile/issues/600) for why a suite
that is red by default cannot gate anything.

**Environment (corrected 2026-08-10 — the original text below was written against
Maestro 2.0.10 and is no longer true).** Maestro is pinned at **2.6.1**, and
`e2e/check-sim.js:17` sets `MAX_SUPPORTED_IOS_MAJOR = 26`, so **iOS 26 is allowed**
— `launchApp: clearState: true` was verified working on an iPhone 17 / iOS 26.4
sim. The earlier "use iOS 17.2, iOS 26 is rejected" guidance is inverted; follow
`check-sim.js`, not this document, when they disagree.

## Passing

- `launch`
- `browse` — see §5 for the earlier "App crashed" misattribution; FilterSortSheet
  open is healthy when setup reaches the hub (successful Jul 12 runs + screenshot)
- `bug6_bottom_bar_inset`
- `codex_parity`
- `settings_qr_scanner`

## Fixed in this branch, pending a green re-run

These have had their root cause addressed but were not yet confirmed green after
the latest edits:

- `server_drag_reorder` — added to `test:e2e:mock`; swipe removed (Bug 18); default path asserts single-server lock-toggle gate
- `feat2_export_in_info_shelf` — deep link switched `launchApp {url}` → `openLink`;
  route assertion switched from the brittle `"Resume Session"` text (the button is
  now `▶ Resume Session` inside an `Animated.Text`) to the `conversation-bottom-bar`
  testID.
- `pty_turn_divider` — stale testIDs `terminal-output` / `message-input` replaced
  with the real composer testID `chat-message-input` (the session screen's
  `TerminalView` mounts a `ChatComposer`).
- `voice_dictation` — stale testIDs `message-input` / `message-input-mic` replaced
  with `chat-message-input` / `chat-mic-button`. **Still blocked**, see below.

## Bug 18 / `server_drag_reorder` (done)

Included in `test:e2e:mock`. Flow no longer swipes drag handles (known NestableDraggableFlatList crash).
Mock default = one paired server → asserts `server-order-toggle` hidden. Remaining risk: multi-server
edit-order path is smoke-only (toggle + screenshot); true reorder still lives in integration tests.
A full green re-run of the mock suite has not been confirmed in this change.

## Still to do

### 1. `voice_dictation` — speech-recognition permission prerequisite

**Status (2026-07-22):** `e2e/ensure-release-build.js` now grants `speech-recognition` + `microphone` via `simctl privacy` before the suite runs. Re-run to confirm green.


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

**Fixed in this branch:** default `sessionsLayout` is `classic`
(`stores/settings.ts`). The flow now opens `FilterSortSheet`, taps
`layout-option-tree`, closes via `filter-sort-close-btn`, then drills
`tree-row-/home/user/my-project`. Re-run to confirm green.

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

### 5. `browse` — "App crashed" (misattributed to FilterSortSheet)

**Diagnosis (artifact-backed):** Maestro's "App crashed or stopped while
executing flow" on browse did **not** fail at `filter-sort-button` /
`filter-sort-sheet`. Successful runs (`2026-07-12_195509`, `200450`) completed
the full tap → assert → screenshot path. Failed runs (`2026-07-12_210105`,
baseline `2026-07-16_044809`) died inside `setup.yaml` — either stuck on the
splash / evaluating `onboarding-welcome-cta`, or `hideKeyboard` failing on the
pair URL field. No `*Threadbase*` crash report appeared in
`~/Library/Logs/DiagnosticReports`; the checked-in `crash-log.txt` is a
**SpringBoard / XCTAutomationSupport** SIGSEGV (Maestro XCUITest driver), not
an app JS/native frame in FilterSortSheet.

**Mitigations in this branch:** browse.yaml uses `extendedWaitUntil` for the
sheet + asserts `fab-new-session`; FilterSortSheet adds layout/close testIDs and
aligns reset/default layout with `classic`. Remaining flake is setup /
XCUITest-driver infrastructure (see Environment gotchas), not a sheet open bug.

## Environment gotchas discovered

- ~~**iOS 26 sims are rejected** by `check-sim.js`; use iPhone 15 / iOS 17.2.~~ **No longer true** — `check-sim.js` allows iOS 26 since Maestro was pinned to 2.6.1. Set `E2E_ALLOW_UNSUPPORTED_IOS=1` only to go beyond 26.
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
