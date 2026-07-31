# Ideas — Staging ground for unprioritized features

This is the staging ground for forward-looking feature ideas before they're committed to. Items here are *not yet* on the roadmap. Promote items into [ROADMAP.md](./ROADMAP.md) as they get prioritized; once promoted, mark them as `→ promoted to Feature N` here for traceability.

For shipped features and already-prioritized planned work, see [ROADMAP.md](./ROADMAP.md). For open bugs, see [BACKLOG.md](./BACKLOG.md).

---

## Status: all 10 brainstormed ideas promoted to ROADMAP on 2026-05-22

The 2026-05-22 brainstorm sweep ("multi-agent / multi-project orchestration" angle, up-to-a-quarter scope) generated 10 ideas. All 10 are now in [ROADMAP.md](./ROADMAP.md) as Features 6–15. The original entries below are kept for traceability with cross-references to their promoted location.

The orchestration cluster's suggested order (set in ROADMAP) is: **13 → 6 → 12 → 15 → 7 → 8 → 10 → 11 → 14 → 9**.

---

## Original brainstorm (2026-05-22)

Forward-looking feature ideas brainstormed for the "multi-agent / multi-project orchestration" angle. Each scoped to fit within a quarter of work on the current Expo + RN stack.

---

## Honest take on sequencing

If picking 3 to ship next, in order:

1. **Idea 8 — Mission Control.** Biggest daily-orchestration unlock, lowest implementation risk (no native modules), uses existing infra.
2. **Idea 1 — Cross-session search.** Already half-shipped (`useConversations.ts:431`); finishing it dramatically changes what the app is *for*.
3. **Idea 7 — Live Activities.** Highest mobile-native ceiling. Significant native work but turns the app into a "second screen" for agents.

Idea 10 (scheduled prompts) is a strong candidate for that top-3 if the streamer cron piece turns out to be cheap.

Idea 9 (voice) is great but possibly overkill before the orchestration basics (#1, #8) settle the workflow.

Idea 4 (split view) is fun but iPad-coded; lower priority if the primary device is iPhone.

Idea 6 (workspace sync) is "necessary eventually but only after we have more things worth syncing" — sequence after Ideas 2 / 3 / 5.

---

## Idea 1 — Cross-session search with hit context, ranking, and "open in session" → [Feature 6](./ROADMAP.md#feature-6--cross-session-search-with-hit-context--open-in-session)

**One-line pitch:** Turn the existing per-server search API into a top-level workspace search that returns ranked hits across every server, with the matching message snippet inline and a tap-to-jump-to-message action.

**Why:** `hooks/useConversations.ts:431` already calls `/api/search?q=` per server. The bones are there, but it's wired into the History tab as "filter conversations by title" — not "find that one message where I told Claude about the bug we shipped last week." The mobile sweet spot is "I'm on the train, I need to look at a thing the agent said three days ago."

**What it adds:**
- A dedicated `/search` route. Single input, debounced.
- Fan-out across `activeServerIds` via `useQueries`.
- Group results by server → project → conversation; show the matching message excerpt with the hit highlighted.
- Tap → deep-link to that exact message in the conversation view (existing `/conversation/[id]` + a new `?focus=<messageId>` param + scroll-to-anchor).
- Recent searches persisted to AsyncStorage.

**Scope:** ~1 week. Streamer side may need to return message snippets in the search response (verify current response shape first); if it already does, this is pure client work.

---

## Idea 2 — Workspace tagging: pin labels to sessions/conversations/projects, then filter by tag → [Feature 7](./ROADMAP.md#feature-7--workspace-tagging-across-sessions--conversations--projects)

**One-line pitch:** Let the user tag any session, conversation, or project with arbitrary text labels (`bug-bash`, `production`, `client-acme`, `friday-experiment`), then filter every list view by tag — across servers.

**Why:** With 2,700+ conversations across 10 projects, the existing axes (server, project, recency) aren't enough. Tags are a flat orthogonal dimension users can define themselves. Bigger payoff the more you have.

**What it adds:**
- A `stores/tags.ts` Zustand store (compound key `serverId::entityType::entityId` → `string[]`), persisted to SecureStore alongside servers (private to device — or sync via streamer, see Idea 6).
- Long-press anywhere → action sheet → "Add tag".
- A new "Tags" tab inside Quick Access (per `QuickAccessStrip.tsx` pattern — fits naturally).
- Filter chip in History + Sessions tab.

**Scope:** ~1.5 weeks. Entirely client-side for v1.

---

## Idea 3 — Saved views: persisted filter + sort + tag combinations as named tabs → [Feature 8](./ROADMAP.md#feature-8--saved-views-persisted-filter--sort--tag-combos-as-named-tabs)

**One-line pitch:** "I want to see all *running* sessions tagged `production` from servers `prod-us` and `prod-eu`, sorted by elapsed time, every time I open the app." Save that as `Prod Watch`. It becomes a tab.

**Why:** Builds on Idea 2 but works without it too. Operators with many servers (`displayedServerIds`, `FilterSortSheet`) keep manually re-applying the same filters. A saved view is a one-tap re-application.

**What it adds:**
- `stores/savedViews.ts` storing `{ name, serverIds, statusFilter, tagFilter?, sortBy, sortOrder }`.
- A new horizontal scroll row above the Hub/Tree/Classic switcher with chip-shaped saved views.
- Long-press to rename / reorder / delete.
- "Save current view" button in `FilterSortSheet`.

**Scope:** ~1 week if Idea 2 is already in; ~1 week standalone.

---

## Idea 4 — Side-by-side session comparison ("split view") for live runs → [Feature 9](./ROADMAP.md#feature-9--side-by-side-session-split-view-for-live-runs)

**One-line pitch:** Open two sessions in a vertical 50/50 split so you can watch one while interacting with the other. Or compare diff output across two parallel approaches on the same codebase.

**Why:** Operating across multiple agents working different tickets is the orchestration-angle killer use case. Today you tab-swap, which loses the "watch terminal scroll" benefit. A real split view turns the iPad/Pro-Max into a multi-agent cockpit.

**What it adds:**
- A new `/session/split?left=<id>&right=<id>` route.
- Each pane is the existing `/session/[id]` content trimmed to ~50% width.
- Tap a divider to swap, drag to resize, swipe horizontally on a pane to swap that side.
- iPad gets a full 50/50 by default; phones get a stacked vertical mode (bottom one minimized to a peek strip you can tap to expand).

**Scope:** ~2 weeks. Tricky bits: shared WebSocket connection accounting (the singleton `wsManager` already supports multiple subscribers — verify), VirtualTerminal allocation per pane, keyboard handling when both prompt inputs exist.

---

## Idea 5 — Cross-server cross-project prompt templates / snippets library → [Feature 10](./ROADMAP.md#feature-10--cross-server-prompt-templates--snippets-library)

**One-line pitch:** "Apply linting + tests + commit message rules" — save once, paste into any session on any server. Optionally with variable slots (`{branchName}`, `{ticketId}`).

**Why:** People say the same things to the agent dozens of times. The composer's `stores/drafts.ts` saves the last-typed-but-not-sent draft per session — useful but not the same thing. A library is share-once-use-everywhere.

**What it adds:**
- New `stores/snippets.ts` (persisted).
- A `/snippets` screen.
- In the composer, a button next to the attach icon opens a snippets sheet → tap to insert into the input (with simple `{var}` prompts before insertion).
- Optionally: per-project snippet scope, per-server, or "all".

**Scope:** ~1 week. Pure client. Could add streamer-side sync in a v2.

---

## Idea 6 — Workspace sync: tags + snippets + saved views shared across the user's devices via the streamer → [Feature 11](./ROADMAP.md#feature-11--workspace-sync-across-devices-via-streamer)

**One-line pitch:** Phone, iPad, and web all see the same tags, snippets, saved views, and favorites. Threadbase server becomes the source of truth.

**Why:** This is the connective tissue feature. Without it, every preference is stuck on one device — fine for a hobby user, blocking for a real workflow.

**What it adds:**
- A `services/workspace-sync.ts` module.
- New REST endpoints on streamer: `GET/PUT /api/workspace/preferences` (JSON blob, last-write-wins per top-level key).
- Sync triggered on app foreground + on local change (debounced).
- Conflict resolution: each top-level key is timestamped, latest wins.
- The locally-private bits (server URLs + API keys — which live in Keychain) stay device-local.

**Scope:** ~2 weeks client + ~3–5 days streamer side. Realistically a feature that follows once Idea 2 / 3 / 5 exist and are worth syncing.

---

## Idea 7 — Live Activities + Dynamic Island for in-progress sessions → [Feature 12](./ROADMAP.md#feature-12--live-activities--dynamic-island-for-in-progress-sessions)

**One-line pitch:** A running session shows up in the iPhone's Dynamic Island and lock-screen as a live activity: project name, status (running / waiting input), elapsed time, latest terminal line. Tap to jump in.

**Why:** This is the *quintessential* mobile-orchestration superpower. The user can put the phone down, watch the island for status, glance at the lock screen, and only open the app when they need to act. It's the difference between "I check the app every 2 minutes" and "the app tells me when to care."

**What it adds:**
- A new iOS native module (or `expo-live-activities` once stable — check current status).
- On session start (or "make this session live"), register an ActivityKit activity.
- The WS `session_update` stream pushes updates via push tokens (already wired in `services/push.ts`).
- Android gets a foreground service notification equivalent.
- Follow-on: smartwatch surfaces via OS mirroring / Wear OS Live Updates — see [Smartwatch session surfaces](./roadmap/tasks/smartwatch-session-surfaces.md).

**Scope:** ~2 weeks iOS + ~1 week Android. Native module work is the spiky part. iOS Live Activities have a 12-hour cap per Apple — needs renewal logic for long-running sessions.

---

## Idea 8 — "Mission Control" — single screen aggregating all running/waiting sessions across all servers → [Feature 13](./ROADMAP.md#feature-13--mission-control-aggregate-every-live-session-across-servers) (recommended next-up)

**One-line pitch:** A dedicated screen that shows every live session across every server as a grid of small cards (project, last line of terminal, status badge, elapsed). Updates in real time. Tap any card to dive in.

**Why:** Today the Hub mixes live + historical + projects. When you're orchestrating, the *only* thing you care about for 30 seconds is "what's running and which one needs me?" Mission Control answers exactly that.

**What it adds:**
- A new `/mission-control` route (or a tab).
- Subscribes to all WS streams.
- Renders a 2-column grid (iPad: 3–4) of mini-cards.
- Cards highlight (amber border + haptic on first appearance) when their status flips to `waiting_input`.
- A header strip with counts: "3 running · 2 waiting · 1 failed".
- Tap-and-hold a card → quick-reply sheet without opening the full session.

**Scope:** ~1.5 weeks. The infrastructure already exists; this is largely a new view over the same data.

---

## Idea 9 — Voice prompts: dictate into the composer with on-device Whisper → [Feature 14](./ROADMAP.md#feature-14--voice-prompts-via-on-device-whisper)

**One-line pitch:** Tap a mic icon in the composer → record → transcript inserted at the cursor. Works offline (Whisper coreml). One-handed orchestration while walking.

**Why:** Typing prompts on a phone is the single biggest friction in mobile orchestration. Voice removes it. iOS native speech recognition is OK; Whisper is excellent. The streamer doesn't need to know — it sees plain text.

**What it adds:**
- A native module wrapping `whisper.cpp` with the coreml-optimized iOS build (or `expo-speech-recognition` for the simpler-but-cloud path).
- Mic button in the composer.
- Visual waveform during recording.
- Auto-stop on 2s silence.
- Edit before send.

**Scope:** ~2 weeks for the on-device path (native module + model bundling — model is ~75 MB for `tiny.en`, ~150 MB for `base.en`); ~1 week for the speech-recognition fallback.

---

## Idea 10 — Scheduled prompts: "tomorrow at 9am, send this prompt to that session" → [Feature 15](./ROADMAP.md#feature-15--scheduled-prompts-send-tomorrow-at-9am)

**One-line pitch:** Compose a prompt, tap "Send later," pick a time. The phone (or, better, the streamer) delivers it at that time, even if the app is closed.

**Why:** "Async teammate" pattern. Combine with Live Activities (Idea 7) and Mission Control (Idea 8) and you have a meaningful "I delegate to the agent, then check the result in the morning" loop. Single biggest unlock for the away-from-desk workflow.

**What it adds:**
- Streamer-side: a small queue (`POST /api/sessions/:id/schedule { prompt, at }` → cron-style trigger).
- Client-side: `/schedule` screen listing pending scheduled prompts, edit / cancel.
- The streamer fires the prompt at the scheduled time; existing WS flow delivers the assistant turn back to the device whenever it opens.
- Optional: client-only fallback using `expo-background-fetch` (less reliable but no streamer changes).

**Scope:** ~1.5 weeks client + ~1 week streamer. Streamer cron infrastructure may already exist for session lifecycle — verify before designing.

---

## Next step

When ready to commit an idea: move its full entry into [ROADMAP.md](./ROADMAP.md) as a numbered Feature, then delete it from this file (or strike it through with a "→ promoted to Feature N" note). Keeps IDEAS.md as the staging ground and ROADMAP.md as the prioritized list.
