# Roadmap — Planned Features

Forward-looking feature work for Threadbase Mobile. Open bugs live in [BACKLOG.md](./BACKLOG.md).

This doc tracks **planned features**: new capabilities, UX changes, or feature-flag work.
Once a feature ships, move it to [FEATURES.md](./FEATURES.md#completed-roadmap-and-backlog-items) as a one-line entry; if only part of it shipped, the unfinished part goes to [BACKLOG.md](./BACKLOG.md#leftovers-from-partly-shipped-features).
The full original entry stays in git history.
Historical implementation plans for shipped features are archived under [`superpowers/plans/archive/`](./superpowers/plans/archive/).

Earlier-stage, not-yet-prioritized ideas live in [IDEAS.md](./IDEAS.md). When an idea is ready to commit to, promote it into this file as a numbered Feature.

New discrete tasks also land under [`roadmap/`](./roadmap/index.md) (one file per task, indexed there) — preferred layout for freshly filed work going forward.

---

## Status overview

| Feature | Status |
|---|---|
| Feature 7 — Workspace tagging across sessions / conversations / projects | Planned (orchestration) — [#617](https://github.com/RonenMars/threadbase-mobile/issues/617) |
| Feature 8 — Saved views: persisted filter + sort + tag combos as named tabs | Planned (orchestration) — [#617](https://github.com/RonenMars/threadbase-mobile/issues/617) |
| Feature 9 — Side-by-side session split view | Planned (orchestration) — [#617](https://github.com/RonenMars/threadbase-mobile/issues/617) |
| Feature 10 — Cross-server prompt templates / snippets library | Planned (orchestration) — [#617](https://github.com/RonenMars/threadbase-mobile/issues/617) |
| Feature 11 — Workspace sync across devices via streamer | Planned (orchestration, depends on 7/8/10) — [#617](https://github.com/RonenMars/threadbase-mobile/issues/617) |
| Feature 15 — Scheduled prompts ("send tomorrow at 9am") | Planned (async-collab) — [#617](https://github.com/RonenMars/threadbase-mobile/issues/617) |
| Feature 16 — Sync mode: JSONL-sourced bubbles + native prompt forms | Planned (mobile-native, cross-repo) — [#623](https://github.com/RonenMars/threadbase-mobile/issues/623). |
| Feature 19 — Queue-while-thinking: recolor send button as "add to queue" during a turn, auto-send when idle | Planned — [#615](https://github.com/RonenMars/threadbase-mobile/issues/615). The queue exists (`components/queue/`); the composer affordance does not |
| Feature 23 — Onboarding: optional server-name slide before the QR scan | Planned — [#614](https://github.com/RonenMars/threadbase-mobile/issues/614) |
| Feature 27 — Adopt EAS precompiled community libs for iOS build time | Planned — [#616](https://github.com/RonenMars/threadbase-mobile/issues/616) |
| Feature 28 — Audit manual `useMemo`/`useCallback`/`React.memo` for React Compiler-driven deletion | Planned — [#621](https://github.com/RonenMars/threadbase-mobile/issues/621). Sequence after [#607](https://github.com/RonenMars/threadbase-mobile/issues/607) so there is a number to regress against |
| Feature 29 — Spike: swap `@gorhom/bottom-sheet` for SDK 56's drop-in replacement | Planned — [#616](https://github.com/RonenMars/threadbase-mobile/issues/616). Still on `^5.2.13` |

**Suggested order for the orchestration cluster ([#617](https://github.com/RonenMars/threadbase-mobile/issues/617), re-verified 2026-11-02):** Features 6, 12 and 13 shipped and Feature 14 shipped as system dictation; their leftovers are in [BACKLOG.md](./BACKLOG.md#leftovers-from-partly-shipped-features).
Remaining order: **Feature 15 Scheduled prompts** → **Feature 7 Workspace tagging** → **Feature 8 Saved views** → **Feature 10 Snippets** → **Feature 11 Workspace sync** (needs 7/8/10) → **Feature 9 Split view**.

---

## Planned

### Feature 7 — Workspace tagging across sessions / conversations / projects

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 2).

**Goal:** Let the user tag any session, conversation, or project with arbitrary text labels (`bug-bash`, `production`, `client-acme`, `friday-experiment`), then filter every list view by tag — across servers.

**Why:** With 2,700+ conversations across 10 projects, the existing axes (server, project, recency) aren't enough. Tags are a flat orthogonal dimension users can define themselves. Bigger payoff the more tags exist.

**Direction:**
- A `stores/tags.ts` Zustand store. Compound key `serverId::entityType::entityId` → `string[]`. Persisted to SecureStore alongside servers (private to device for v1).
- Long-press anywhere → action sheet → "Add tag".
- New "Tags" tab inside Quick Access (per the `QuickAccessStrip.tsx` pattern).
- Filter chip in History + Sessions tabs.

**Open questions:**
- Tag autocomplete: free-text only, or remember-and-suggest? (Easy win to add suggestions from existing tags.)
- Tag colors: assign automatically (hash → palette), let user pick, or no color?
- Bulk-tag UX: multi-select mode in a list? Defer to v2?
- Cross-device sync (covered by Feature 11) vs. device-local-forever?

**Scope:** ~1.5 weeks, entirely client-side for v1.

**Files likely involved:**
- `stores/tags.ts` — new
- `components/shared/TagSheet.tsx` — new (the action sheet for managing tags on an entity)
- `components/quick-access/QuickAccessStrip.tsx` — add Tags tab option
- `components/sessions/hub/ProjectHubCard.tsx`, `ConvRow.tsx`, `SessionRow.tsx` — render tag chips inline
- `app/index.tsx` — wire tag filter into the existing FilterSortSheet

**Related:** Feature 8 (Saved views) depends on this for the tag-filter dimension. Feature 11 (Workspace sync) wants this synced once it exists.

---

### Feature 8 — Saved views: persisted filter + sort + tag combos as named tabs

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 3).

**Goal:** "I want to see all *running* sessions tagged `production` from servers `prod-us` and `prod-eu`, sorted by elapsed time, every time I open the app." Save that combination as `Prod Watch`. It becomes a tab.

**Why:** Builds on Feature 7 but works without it too. Operators with many servers (`displayedServerIds`, `FilterSortSheet`) keep manually re-applying the same filters. A saved view is a one-tap re-application.

**Direction:**
- `stores/savedViews.ts` storing `{ name, serverIds, statusFilter, tagFilter?, sortBy, sortOrder }`.
- New horizontal scroll row above the Hub/Tree/Classic switcher with chip-shaped saved views.
- Long-press to rename / reorder / delete.
- "Save current view" button in `FilterSortSheet`.

**Open questions:**
- Default views shipped out of the box (e.g. "All running", "Waiting input") vs. all user-created?
- Visual treatment: tab strip vs. chip strip vs. dropdown — pick after wiring; depends on how many views people actually create.
- Conflict with the existing Hub/Tree/Classic switcher: do saved views replace it, sit above it, or live as a separate axis?

**Scope:** ~1 week if Feature 7 is already in; ~1 week standalone (without tag-filter dimension).

**Files likely involved:**
- `stores/savedViews.ts` — new
- `components/sessions/SavedViewsStrip.tsx` — new
- `components/servers/FilterSortSheet.tsx` — add "Save current view" button
- `app/index.tsx` — apply active saved view's filters on mount

**Related:** Feature 7 (Tagging) provides the tag-filter dimension. Feature 11 (Workspace sync) wants this synced.

---

### Feature 9 — Side-by-side session split view for live runs

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 4).

**Goal:** Open two sessions in a 50/50 split so you can watch one while interacting with the other. Or compare diff output across two parallel approaches on the same codebase.

**Why:** Operating across multiple agents working different tickets is the orchestration-angle killer use case. Today you tab-swap, which loses the "watch terminal scroll" benefit. A real split view turns the iPad/Pro-Max into a multi-agent cockpit.

**Direction:**
- A new `/session/split?left=<id>&right=<id>` route.
- Each pane is the existing `/session/[id]` content trimmed to ~50% width.
- Tap a divider to swap, drag to resize, swipe horizontally on a pane to swap that side.
- iPad gets a full 50/50 by default; phones get a stacked vertical mode (bottom one minimized to a peek strip you can tap to expand).

**Open questions:**
- WebSocket connection accounting: does the singleton `wsManager` already support N subscribers per session, or do we need refcounting? Verify before designing.
- VirtualTerminal: one instance per pane (memory cost) or reused?
- Keyboard handling when both prompt inputs exist — which is focused, what happens on Tab?
- How do users *enter* split view? Long-press a session card → "Open beside X"? Action in the session header? Both?

**Scope:** ~2 weeks. Trickiest part is the keyboard + focus management. Memory cost of two VT100 grids may need profiling on older devices.

**Files likely involved:**
- `app/session/split.tsx` — new
- `services/ws-client.ts` — verify multi-subscriber support
- `services/virtual-terminal.ts` — verify it's safe to instantiate twice
- `app/session/[id].tsx` — extract reusable pane component

**Note:** iPad-coded. If iPhone is the primary device, deprioritize. Could potentially be cut entirely if usage data shows nobody splits.

---

### Feature 10 — Cross-server prompt templates / snippets library

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 5).

**Goal:** "Apply linting + tests + commit message rules" — save the prompt once, paste into any session on any server. Optionally with variable slots (`{branchName}`, `{ticketId}`).

**Why:** People say the same things to the agent dozens of times. The composer's `stores/drafts.ts` saves the last-typed-but-not-sent draft per session — useful but not the same thing. A library is share-once-use-everywhere.

**Direction:**
- New `stores/snippets.ts` (persisted).
- A `/snippets` screen for management.
- In the composer, a button next to the attach icon opens a snippets sheet → tap to insert into the input.
- Simple `{var}` prompts: when inserting a snippet that contains `{...}` tokens, a quick inline form asks for each variable before pasting into the input.

**Open questions:**
- Snippet scope: all-servers / per-server / per-project? Start global, add scopes later if needed.
- Variable syntax: `{foo}` vs. `${foo}` vs. `{{foo}}` — `{foo}` is shortest but ambiguous with regular text containing braces. Pick after seeing real snippet content.
- Sharing snippets across users (later, requires streamer)? Likely Feature 11 territory.
- Markdown / code-fence handling in the inserted text?

**Scope:** ~1 week. Pure client for v1.

**Files likely involved:**
- `stores/snippets.ts` — new
- `app/snippets.tsx` — new
- The composer component (TBD location — likely under `components/conversation/` or `app/session/[id].tsx`)
- A new `components/shared/SnippetPickerSheet.tsx`

**Related:** Feature 11 (Workspace sync) wants this synced.

---

### Feature 11 — Workspace sync across devices via streamer

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 6).

**Goal:** Phone, iPad, and web all see the same tags, snippets, saved views, and favorites. Threadbase server becomes the source of truth.

**Why:** Connective tissue. Without it, every preference is stuck on one device — fine for a hobby user, blocking for a real workflow.

**Direction:**
- A `services/workspace-sync.ts` module.
- New REST endpoints on streamer: `GET/PUT /api/workspace/preferences` (JSON blob; last-write-wins per top-level key).
- Sync triggered on app foreground + on local change (debounced).
- Conflict resolution: each top-level key is timestamped, latest wins.
- Device-local exclusions: server URLs + API keys (stay in Keychain), `stripCollapsed`, `displayedServerIds` (these are per-device UI state, not workspace state).

**Open questions:**
- Which preferences sync vs. stay device-local? Settle the list before designing the JSON shape.
- Per-server vs. per-user identity: do we sync workspace prefs *per streamer*, or merge across all paired streamers? Per-streamer is simpler and matches the multi-server architecture.
- LWW is naive — fine for v1 but causes silent overwrites. Acceptable risk?
- Encryption at rest on the streamer: tags / snippet bodies could contain sensitive text. E2E vs. trust the streamer?
- Migration path: on first launch after the feature ships, do we upload existing local state, or wait for the user to opt in?

**Scope:** ~2 weeks client + ~3–5 days streamer side. Realistically a feature that follows once Features 7 / 8 / 10 exist and are worth syncing.

**Files likely involved:**
- `services/workspace-sync.ts` — new
- `stores/tags.ts`, `stores/snippets.ts`, `stores/savedViews.ts`, `stores/quickAccess.ts` — each gets a sync hook
- streamer: new endpoint + storage table

**Sequencing:** Don't build this until Features 7, 8, and 10 are shipped or close to. Syncing a single setting isn't worth the complexity.

---

### Feature 15 — Scheduled prompts ("send tomorrow at 9am")

**Filed:** 2026-05-22 (promoted from [IDEAS.md](./IDEAS.md) Idea 10).

**Goal:** Compose a prompt, tap "Send later," pick a time. The streamer delivers it at that time, even if the app is closed.

**Why:** "Async teammate" pattern. Combine with Feature 12 (Live Activities) and Feature 13 (Mission Control) and you have a meaningful "I delegate to the agent, then check the result in the morning" loop. Single biggest unlock for the away-from-desk workflow.

**Direction:**
- Streamer-side: a small queue. `POST /api/sessions/:id/schedule { prompt, at }` + cron-style trigger that fires the prompt at the scheduled time.
- Client-side: `/schedule` screen listing pending scheduled prompts, edit / cancel.
- The streamer fires the prompt; existing WS flow delivers the assistant turn back to the device whenever it opens.
- Optional client-only fallback: `expo-background-fetch` (less reliable on iOS, but works if streamer cron isn't ready).

**Open questions:**
- Does the streamer already have a job-queue / cron mechanism (for session lifecycle, push tokens, etc.) we can reuse? If yes, this is a small extension. If no, the streamer side becomes the bulk of the work.
- Recurring prompts ("every Monday at 9am") — v1 or punt?
- Timezone handling: store as UTC, render in user's local. Standard fare, but worth being explicit.
- What if the session is no longer alive at fire time? Auto-resume? Notify the user and abandon? Configurable per scheduled prompt?
- Edit window: can the user edit a scheduled prompt up to T-5 minutes? Or only cancel?

**Scope:** ~1.5 weeks client + ~1 week streamer (if cron infra exists). Add 1–2 weeks streamer if cron infra needs to be built from scratch.

**Files likely involved:**
- `app/schedule.tsx` — new
- `services/api-client.ts` — new endpoint methods
- `hooks/useScheduledPrompts.ts` — new
- streamer: scheduled-prompts table + cron worker + send-as-user endpoint
- Composer: "Send later" affordance next to the send button

**Related:** Feature 13 (Mission Control) is the natural "see what your scheduled prompts did" surface.

---

### Feature 16 — Sync mode: JSONL-sourced bubbles + native prompt forms

**Filed:** 2026-05-23. **Expanded:** 2026-05-25.

**Goal:** Add a per-session **Sync mode** that switches the message-rendering source from the PTY stream to Claude Code's own JSONL session file (tailed by `tb-streamer`). In sync mode, each appended JSONL record renders as a typed bubble (`MessageBubble` for user/assistant, `ToolCard` / `ThinkingCard` for tool blocks, **`PromptForm`** for detected interactive prompts — radio for single-choice, checkbox for multi-select). PTY mode stays the default and is unchanged.

**Why:** Two problems collapse into one solution. (1) On a phone, typing numbers into the chat input to answer a Claude Code interactive question that's buried above in tool output is awkward and error-prone — this is the widest gap between Claude Code's TTY-native UX and what a touch-native client should feel. (2) Parsing prompts (or anything else) out of the PTY byte stream is fragile across Claude Code versions and ANSI variations. The JSONL Claude Code already writes to `~/.claude/projects/<project>/<session>.jsonl` is structured, append-only, and reliable — using it as the source of truth lets us render bubbles + structured forms without ever parsing terminal bytes.

**Direction:**
- **Source:** `tb-streamer` tails the per-session `.jsonl` file under `~/.claude/projects/<project>/` (fs.watch / chokidar), parses each appended NDJSON line, emits typed WS events: `jsonl.message`, `jsonl.tool_use`, `jsonl.tool_result`, `jsonl.prompt` (the last carries `{ shape: 'single' | 'multi', options, promptId }`). Prompt detection runs against the **structured assistant message content**, not PTY bytes.
- **Mobile rendering:** new `SyncModeMessageList` (FlashList of bubbles fed by `jsonl.*` events), sibling to the existing `ChatScrollback`. Per-session "Stream / Sync" toggle persisted in the session store.
- **Incremental render:** JSONL is append-only, so bubbles render as records land mid-turn. Layout-refresh + autoscroll-to-bottom are coalesced via a small `useDebouncedAutoscroll(targetRef, deps, ~120ms)` hook so partial writes don't visually jump.
- **Prompt form:** new `components/session/PromptForm.tsx` — radio list for single-choice, checkbox list for multi-select, "Submit" button. Submission goes through the existing streamer stdin-injection endpoint with `{ promptId, answer }`; the streamer translates to whatever keystrokes Claude Code's TUI expects.
- **Fallback:** unknown prompt shapes (free-text follow-ups, novel formats) render as a plain bubble — never block the user.

**Open questions:**
- **Mode coexistence.** Can a session toggle between Stream and Sync live, or is mode locked at session start? Affects whether `ChatScrollback` stays mounted in sync mode.
- **Sync-on for an already-running session.** Backfill bubbles from the full JSONL on toggle, or only render records appended from "now" forward?
- **JSONL discovery.** How does the streamer correlate a `tb-streamer` session with the right `.jsonl` file? Likely PID + cwd, but needs validation against Claude Code's actual session-file naming.
- **Prompt detection details.** Does Claude Code's JSONL carry option metadata for interactive prompts, or does the streamer still need to parse option text out of the assistant message body? Determines how robust single vs. multi-select detection can be.
- **Multi-select submission.** Claude Code's multi-select TUI uses cursor keys + space + enter — replaying that via stdin isn't clean. Single-choice can ship first; multi-select submit may be gated on upstream cooperation.

**Scope:** ~1 week mobile (`SyncModeMessageList` + debounced-autoscroll hook + `PromptForm` + toggle + Zustand slice) + ~1 week streamer (JSONL tailer + typed WS events + session-file correlation + prompt detection on structured content). Multi-select submission may slip to a follow-on.

**Files likely involved:**
- `tb-streamer`: new JSONL tailer module, WS event types (`jsonl.message` / `jsonl.tool_use` / `jsonl.tool_result` / `jsonl.prompt`), stdin-injection endpoint accepting `{ promptId, answer }`
- `tb-mobile`: new `components/session/SyncModeMessageList.tsx`, `components/session/PromptForm.tsx`, `hooks/useDebouncedAutoscroll.ts`, session-detail Zustand slice for `activePrompt` + render-mode, header toggle chip, WS handler wiring

**Acceptance criteria (preliminary):**
- [ ] Per-session "Sync mode" toggle persists and survives app restart
- [ ] In sync mode, a completed turn renders as bubbles sourced from the JSONL (not PTY)
- [ ] Bubbles render incrementally as JSONL records land mid-turn
- [ ] Autoscroll-on-new-message is debounced (~120ms); mid-turn writes don't cause visible jumps
- [ ] Single-choice interactive prompts render as a `PromptForm` (radio) and submit correctly
- [ ] Multi-choice prompts at minimum render (submit may be gated on upstream support)
- [ ] Unknown prompt shapes fall back to a plain bubble with no errors
- [ ] PTY mode is unchanged and remains the default

**Plan stub:** [`superpowers/plans/2026-05-23-claude-code-prompt-miniform.md`](./superpowers/plans/2026-05-23-claude-code-prompt-miniform.md)

---

### Feature 19 — Queue-while-thinking: recolor send button as "add to queue" during a turn, auto-send when idle

**Filed:** 2026-05-24.

**Goal:** While Claude is still mid-turn (streaming a response, running a tool, "thinking"), let the user keep typing and tap a recolored send button that **queues** the message instead of either disabling the input or trying to interrupt. The moment Claude finishes the current turn, the queued message is auto-sent.

**Why:** Today the user has to wait until the turn fully settles before they can compose the next message — or worse, they type ahead and the send action is ambiguous (does it interrupt? buffer? get lost on a re-render?). A queue affordance with explicit visual state turns the dead time during a long turn into productive typing time. This is one of the most common "mobile orchestration" moments — you read the partial output, react, and want to fire the follow-up the instant the agent is free.

**Direction:**

- **Visual state of the send button.**
  - Idle (no in-flight turn): current accent color, current Phosphor icon (`PaperPlaneTilt` or whatever's in use), label "Send".
  - In-flight (Claude is mid-turn): swap to a distinct **marine / teal** tint (pick something clearly different from both the idle accent *and* the disabled gray) and swap the icon to a queue affordance (Phosphor `Plus`, `PlusCircle`, `Stack`, or `ListPlus` — see plan stub for the final pick). Optionally a small badge with the count of queued messages (`1`, `2`, …) when more than one is staged.
  - Per project icon rule: no emojis — Phosphor only.
- **Behavior on tap.**
  - Idle: send immediately, as today.
  - In-flight: push the typed text into a queue (FIFO). Clear the composer. Optionally light haptic to confirm the queue.
- **Flush on idle.**
  - Listen for the "turn finished" signal (whatever existing WS event / state slice currently flips `isThinking` → false in the session-detail screen). On the falling edge, dequeue the next message and send it as a real send.
  - If multiple messages are queued, send them one at a time, waiting for the next idle window between each — OR merge them into a single message with a separator (e.g. blank-line join). Decide on pickup; FIFO-one-at-a-time is the conservative default.
- **Queue management.**
  - Show the queued messages somewhere visible (e.g. a small chip strip above the composer, or pinned above the latest assistant turn) so the user can see what's about to fire.
  - Allow per-item cancel (tap chip → remove) and reorder (long-press → drag) only if it's cheap; otherwise FIFO-locked is fine for v1.
- **Edge cases.**
  - User backgrounds the app with a queue pending → on resume, replay state, don't lose messages.
  - User leaves the session screen entirely → queue is cleared (it's per-session ephemeral state). Confirm; the alternative is per-session-persisted queue, which feels surprising.
  - Turn errors out mid-flight → don't auto-fire the queue. Surface "queue paused — turn failed, [Send] to fire `<n>` queued messages" affordance.
  - Streaming abort (user taps Stop) → same as error: pause the queue, let the user explicitly resume or cancel.

**Open questions:**

- **Single-vs-multi-message flush.** If two messages are queued, do we (a) send them one-at-a-time across two turns, (b) merge into one message before sending, or (c) let the user pick per-queue? (a) is simplest and most faithful to what the user typed; (b) avoids creating turns the user didn't explicitly ask for; (c) is overkill for v1.
- **Where does the queue live?** Per-session ephemeral state in the session-detail screen (lost on unmount) vs. a small slice on a Zustand store (`stores/queue.ts`?) keyed by `sessionId` (survives unmount). The latter handles "user briefly navigates away and back" but adds persistence surface area. Probably ephemeral for v1.
- **"Thinking" detection.** What's the canonical signal today? Verify against `hooks/useSession.ts` / WS handler / VirtualTerminal idle detector before designing the trigger. The PTY turn-divider (shipped 2026-05-02) already has an idle-detect heuristic — reuse if applicable.
- **Visual treatment of the queued chips.** Above the composer (in-line with the input) vs. floating above the bottom-bar vs. inline with the assistant turn as "queued: <preview>". First option is most discoverable; pick after seeing the composer layout.
- **Stop/Abort interaction.** If the user taps Stop on the current turn while there's a queue, does that also flush the queue? Almost certainly yes — they're explicitly bailing out — but confirm.

**Files likely involved (to verify):**

- The composer component (TBD location — likely under `components/conversation/` or `app/session/[id].tsx`).
- The send-message handler / hook (currently in `hooks/` or `services/api-client.ts`).
- Whatever currently exposes `isThinking` / "turn in flight" state to the composer.
- A new `stores/queue.ts` (or local state on the session screen) for the queued messages.
- A small queue-chip-strip component above the composer if we go with the inline-strip UX.

**Coordination:**
- Related to [Feature 16](#feature-16--native-mini-form-for-claude-code-interactive-prompts): both touch the moment a turn is in flight, and both involve the composer area. If 16 lands first, account for the prompt-form taking precedence over the queue UI when a structured prompt is active.
- Related to Bug 5 (done) only loosely — queueing is independent of attachments — but verify that a queued message with attachments fires the same code path on auto-send.

**Scope:** ~3–5 days client-side, no streamer change required. Single-message-at-a-time flush is a smaller, safer v1; multi-message merge / reorder is v2.

---

### Feature 23 — Onboarding: optional server-name slide before the QR scan

**Filed:** 2026-05-25 (promoted from BACKLOG Bug 27 on 2026-05-25 — net-new onboarding step, not a fix). **Related:** Feature 5 — Polish the onboarding flow (shipped, see [FEATURES.md](./FEATURES.md#completed-roadmap-and-backlog-items)).

**Goal:** Add an onboarding carousel slide before the QR-scan slide that asks "What's this server called?" — a single text input with a Skip affordance. Optional — empty submit is allowed and the user continues to the scanner regardless.

**Why:** Server names matter the moment a user pairs more than one server (label in lists, in pull-to-refresh, etc.). Today the only way to set a name is after pairing, buried in Settings. Capturing it at pair time costs the user nothing if they Skip, and unlocks better UX downstream — including a clean fallback path that the `Bug 28` IP+port label depends on.

**Direction:**
- New `components/onboarding/ServerNameSlide.tsx` inserted into `OnboardingNavigator` immediately before the QR-scan slide.
- One text input + "Skip" affordance. Empty submit treats the field as not provided.
- If a name is provided, persist it on the server record at pair time (carry it into the `services/pair-exchange.ts` payload).
- Don't gate the QR scan on filling the field.

**Files likely involved:**
- `components/onboarding/OnboardingNavigator.tsx`
- New `components/onboarding/ServerNameSlide.tsx`
- `services/pair-exchange.ts` (carry optional name into the pair payload)

**Coordination:** Pairs with Bug 28 (done, see [FEATURES.md](./FEATURES.md#completed-roadmap-and-backlog-items)) — once Bug 28's IP+port fallback is in, the Skip path is safely labeled everywhere a server name shows up. Ship Feature 23 → Bug 28 together if you can. Also consider folding into Feature 5 — Polish the onboarding flow (shipped, see [FEATURES.md](./FEATURES.md#completed-roadmap-and-backlog-items)) when its scope is defined; otherwise this stays standalone.

**Scope:** ~half a day mobile (slide + persistence wiring + 1 Maestro flow update).

---

### Feature 27 — Adopt EAS precompiled community libs for iOS build time

**Filed:** 2026-05-27.

**Goal:** If/when the iOS pipeline moves to EAS (Feature 4 candidate path 1 or 3), pick up SDK 56's additional ~20% EAS-side precompile of community libraries — specifically `react-native-reanimated@4.3.1` and `react-native-screens@4.25.2`, both of which we depend on.

**Why:** The numbers compound: SDK 56 prebuilt XCFrameworks save ~16% on every iOS build (Feature 26), and EAS-side community precompile saves another ~20% on top of that. Cumulatively ~33% off cold iOS build time. Only realizable if iOS builds run on EAS, so this is gated on whatever Feature 4 ("Auto-deploy to App Store + Google Play") decides about EAS vs. self-hosted macOS runners.

**Direction:**
- Decide as part of Feature 4 whether iOS goes through EAS.
- If yes, confirm `eas.json` profile doesn't disable precompile (`EXPO_USE_PRECOMPILED_MODULES=0` as an EAS env var).
- Measure: pick a single iOS profile, run `eas build` twice (once with precompile, once without via the env override), compare times, document.
- Watch for breakage on minor reanimated/screens version bumps — the precompiled artifacts are version-locked.

**Acceptance criteria:**
- iOS EAS profile uses precompile (no override).
- Median EAS iOS build time measured and documented.
- Falls back gracefully if a future reanimated/screens bump misses the precompile cache.

**Out of scope:** Local builds (Feature 26 covers those). Android (different toolchain).

**Scope:** ~half a day of measurement once Feature 4 picks the iOS pipeline.

**Depends on:** Feature 4 iOS pipeline decision (shipped: iOS deploys through fastlane, see [FEATURES.md](./FEATURES.md#completed-roadmap-and-backlog-items)).

---

### Feature 28 — Audit manual `useMemo`/`useCallback`/`React.memo` for React Compiler-driven deletion

**Filed:** 2026-05-27.

**Goal:** With React Compiler enabled and the lint baseline clean (Feature 25), audit the ~40 files currently using manual memoization and delete the calls RC now handles automatically. The deletion reduces code surface, removes a class of dependency-array bugs, and lets RC do its full job (it can memoize conditional paths that manual hooks can't).

**Why:** Manual memoization is a hand-maintained substitute for what RC now does at build time. Every `useMemo`/`useCallback` is a place where the dependency array can go stale, where a refactor silently breaks memoization, or where the cost of the memoization machinery exceeds the saved work. Particularly relevant for the Hub perf backlog (Issues 1 + 2 in BACKLOG.md) — `ProjectHubCard`'s inline `.map` is exactly the shape RC targets. Meta reports 20–30% render-time reduction internally post-RC; some of that comes from deleting now-redundant manual hooks, not just from RC's own work.

**Direction:**
- Cannot start until Feature 25 ([its leftover](./BACKLOG.md#leftovers-from-partly-shipped-features)) is green — RC bails out on components that violate Rules of React, and a "delete the manual memo" change on a component RC skipped would regress perf, not improve it.
- Sweep the 40 known files (see hot list below) in a single branch, one component at a time.
- For each deletion: keep the manual hook only if either (a) the value is referentially compared in a downstream `useEffect` dep array where reference identity matters (RC's auto-memo gives a new reference per call), or (b) profiling shows RC didn't actually compile the component (use `babel-plugin-react-compiler`'s feedback output).
- Verify with React DevTools profiler before/after on Hub cold-launch + accordion expand — those are the documented stalls.

**Acceptance criteria:**
- Manual `useMemo`/`useCallback`/`React.memo` count drops measurably (e.g. by half or more).
- Hub cold-launch and accordion-expand profiles improve (concrete numbers TBD on pickup; baseline lives in `project_2026_05_22_hub_perf_backlog.md`).
- `npm run test:ci` and `npm run test:e2e:mock` stay green.
- No new visual regressions on the iPhone 17 Pro dev device.

**Hot list (concentration of manual memoization, by memory):** `components/sessions/hub/ProjectHubCard.tsx`, `components/sessions/hub/useProjectGroups.ts`, `components/sessions/hub/useServerGroups.ts`, `components/sessions/hub/SessionRow.tsx`, `components/sessions/hub/ConvRow.tsx`, `components/sessions/tree/TreeSessionsList.tsx`, `components/sessions/shared/ConversationListItem.tsx`, `components/terminal/TerminalOutput.tsx`, `contexts/ThemeContext.tsx`, `app/conversation/[id].tsx`, `app/project/[id].tsx`.

**Depends on:** Feature 25 ([its leftover](./BACKLOG.md#leftovers-from-partly-shipped-features)).

**Scope:** ~2–3 days; the audit dominates over the deletion.

---

### Feature 29 — Spike: swap `@gorhom/bottom-sheet` for SDK 56's drop-in replacement

**Filed:** 2026-05-27.

**Goal:** Time-boxed spike to evaluate replacing `@gorhom/bottom-sheet@^5.2.13` (used in ~6 sheets) with the Expo SDK 56 drop-in `BottomSheet` primitive shipped under stable Expo UI. Decide go/no-go on a full migration.

**Why:** SDK 56 ships Expo-maintained drop-in replacements for several common community deps, including `@gorhom/bottom-sheet`. Adopting it removes a community dep, consolidates on Expo's release cycle, and (per the SDK 56 changelog) is intended to be a no-API-change swap. But "drop-in" claims for sheet libraries are historically optimistic — gesture handling, snap points, and keyboard behavior have plenty of edge cases. Worth a one-day spike to find out, not a roadmap-blocking migration.

**Direction:**
- Pick the simplest sheet first (e.g. `SortSheet.tsx` — pure list, no keyboard, no animation chaining).
- Swap the import, run on iPhone 17 Pro, run the Maestro flow that hits it.
- Document any behavior delta: snap-point math, gesture overlap with parent scroll, keyboard-avoidance, dismiss-on-backdrop.
- If trivial → file a follow-on Feature for the remaining 5 sheets. If gnarly → close this and stay on gorhom.

**Acceptance criteria:**
- A written assessment in this entry (or its plan stub): "drop-in is real for our use cases — swap all 6" OR "drop-in has caveats X/Y/Z — stay on gorhom for now."
- One sheet migrated in a throwaway branch to back the assessment with code, even if we don't merge it.

**Files likely involved (for the spike):** `components/servers/SortSheet.tsx` and whichever Maestro flow exercises sort.

**Sheet inventory (for the follow-on, if we go forward):** `components/sessions/RenameSessionSheet.tsx`, `components/sessions/shared/ConversationPreviewSheet.tsx`, `components/queue/PromptQueueSheet.tsx`, `components/queue/PlanPreviewSheet.tsx`, `components/servers/AddServerActionSheet.tsx`, `components/servers/FilterSortSheet.tsx`, `components/servers/SortSheet.tsx`, `components/servers/NewSessionServerPicker.tsx`, `components/servers/ServerFilterSheet.tsx`.

**Scope:** ~1 day for the spike. Migration of the remaining sheets would be ~half a day if drop-in checks out.

**Priority:** Low — current `@gorhom/bottom-sheet` works. Pick up only when an iOS-26 or SDK-57 incompatibility forces the hand, or as filler during a slow week.

---

### Feature 31 — Reuse the Fly demo server as a stable backend for Maestro and visual regression tests

**Filed:** 2026-06-01 (during App Store submission — see `demo-server/` and the Fly-hosted demo server).

**Goal:** Promote the Fly-hosted demo server (currently spun up so Apple App Review reviewers can pair against a public Threadbase streamer) into a first-class CI/test fixture. Today `e2e/mock-server.js` runs only on localhost; the Fly deploy is a copy of it with the same fixtures. The duplication invites drift, and the Fly URL is a real piece of infra we already pay nothing for — we should put it to work.

**Direction:**

- **Sub-item A — Single source of truth for mock fixtures.** Decide between (a) keeping `demo-server/` as the deployable copy and writing a sync check (CI fails if `demo-server/server.js` or `demo-server/fixtures/` drift from `e2e/`), or (b) making `demo-server/` import from `e2e/` directly via relative path so there is literally one copy. Option (b) is simpler if Fly's Docker context can reach the parent `e2e/` directory (it can, but requires moving the Dockerfile up or using `--file`). Option (a) keeps the deploy directory self-contained.

- **Sub-item B — Maestro flows runnable against either backend.** Today `setup.yaml` hardcodes `http://localhost:7071`. `setup-demo.yaml` used to read `DEMO_SERVER_URL` from `.env.demo` the same way, but it was deleted as unrun (issue #519, no surviving caller after the `shots-*.yaml` family was removed) — the env-var approach would need to be rebuilt from scratch if this sub-item is picked up. Extend `setup.yaml` so a single parameterized flow covers both local CI runs (against `mock-server.js`) and remote/device runs (against the Fly demo).

- **Sub-item C — Visual regression test harness.** Now that we have a deterministic backend producing the same fixtures every time, we can checksum or diff screenshots between builds. Tooling options: `playwright-test` against the simulator via Maestro hooks; `reg-cli` / `pixelmatch` for image diffs; or roll a tiny `vitest`-based diff suite. Decision point: where do baseline images live (the repo? Git LFS? a separate bucket?), and what is the diff threshold before we fail CI.

- **Sub-item D — Fly cost + reliability check.** Right now the demo server is on the free tier with `auto_stop_machines = "stop"` and `min_machines_running = 0`. That's fine for App Review (one or two reviewers paired against it across the review window). It would NOT be fine if Maestro CI hits it on every PR — cold starts add 5-10s per flow, and there is a per-minute machine-hour cap. Either bump `min_machines_running = 1` (and pay ~$2/mo), or accept the cold-start cost as part of test latency.

**Open questions:**

- Is anyone else likely to pair to the demo server outside CI / App Review? If so, the load model changes and we may want auth (a rotating shared secret) rather than "accept any non-empty token."
- For visual regression, do we care about pixel-perfect diffs (will catch font / kerning regressions but flake on simulator GPU non-determinism), or structural diffs only (less flaky but misses subtle layout shifts)?
- Does fly.io's free-tier policy still cover this VM size in 2026? Worth confirming before betting CI on it.

**Files likely involved:**

- `demo-server/` — Dockerfile + fly.toml + server.js (already exists)
- `e2e/setup.yaml` — parameterize for both backends (`e2e/setup-demo.yaml`, its would-be collapse target, was deleted as unrun — issue #519)
- `e2e/shots-*.yaml` — deleted as unrun (issue #519); would need to be rewritten if this sub-item is picked up
- `.github/workflows/` — new visual regression job
- A new `e2e/baselines/` (or LFS-backed equivalent) for reference images
- `package.json` — possibly new `test:visual` script

**Acceptance criteria:**

- A single mock source-of-truth (no copies between `e2e/` and `demo-server/`).
- One `setup-*.yaml` Maestro flow that works against both local and remote backends.
- A documented baseline-screenshot workflow (how to record, how to update, how CI runs the diff).
- A cost/reliability note in this repo explaining what Fly does (and does not) cover for CI.

**Scope:** ~1-2 days for sub-items A and B (the deduplication + parameterization). Sub-item C (visual regression) is its own ~2-3 day project depending on tooling choice. Sub-item D is a 30-minute decision once we know the test cadence.

**Priority:** Medium. Not gating any release, but the longer the two copies diverge the more painful the eventual merge. Worth picking up before we add more Maestro flows that depend on fixtures.
