# LinkedIn Marketing Video — Shot Flows

Candidate flows for a short (20–45s) LinkedIn video promoting the Threadbase Mobile beta.
Every step names the actual screen or view that must be on camera, so the flows can be filmed — or driven by Maestro — without guessing.

**Positioning line:** your AI coding agent doesn't stop working when you leave the desk — Threadbase is the remote control for it.

**Audience:** developers already running Claude Code or Codex daily, plus the leads who watch several agents at once.

**CTA:** `threadbase.sh/betas`

See [Screen inventory](#screen-inventory) at the bottom for the route and component behind each screen name.

---

## Flow 1 — "The agent asked a question. You were at lunch." ⭐ primary

**Length:** 20s · **Why it wins:** it opens on the single most recognisable pain — Claude Code blocking on a permission prompt while nobody is at the keyboard.

| t | Screen / view | What happens on screen | Overlay text |
|---|---|---|---|
| 0–2s | *No app* — closed laptop on a café table | Establishing shot, person walking away | "Your agent is still working." |
| 2–5s | **iOS lock screen** (push notification) | Notification lands: *"Waiting for Input"* with project name | "It just hit a question." |
| 5–7s | **Sessions Hub** (`hub-screen`, Tree layout) | Tap-through from the notification; the session row shows the amber **Waiting** status pill | — |
| 7–11s | **Session detail** (`session-detail-screen`) → Terminal view | `QuestionCard` renders the agent's structured options; finger taps one | "Answer it from your pocket." |
| 11–15s | **Session detail** — Terminal view | Terminal output resumes streaming; status pill flips **Waiting → Running**, `LiveDot` pulses | "It keeps going." |
| 15–18s | **iOS lock screen** (push notification) | *"Session Completed"* notification | — |
| 18–20s | End card | Logo + URL | "Threadbase — threadbase.sh/betas" |

**Notes for capture**
- The waiting-input state already exists as a fixture: `e2e/fixtures/session-waiting-input.json` (served by `e2e/mock-server.js` for session id `session-waiting`).
- Push notifications cannot come from the mock server — fire them with `xcrun simctl push booted com.ronenmars.threadbase payload.apns`, timed by hand.
- Keep the Terminal view (RAW), not Chat view: real ANSI output is what makes it read as genuine.

---

## Flow 2 — "Sixty seconds from zero to paired"

**Length:** 25s · **Why:** kills the "this is probably a pain to set up" objection, and the onboarding copy is already cinematic.

| t | Screen / view | What happens on screen | Overlay text |
|---|---|---|---|
| 0–3s | **Desktop terminal** (not the app) | Type `tb-streamer pair`; a QR code prints in the terminal | "Your machine. Your keys." |
| 3–6s | **Onboarding — Welcome** (`onboarding-welcome-cta`) | `// AMBIENT CODING` eyebrow, headline *"Pull a thread. Watch it weave."*, tap **Get started** | — |
| 6–8s | **Onboarding — Connect** (`onboarding-connect-qr-card`) | Two pairing cards; tap **Scan QR** (marked *Recommended*) | "One scan." |
| 8–12s | **Pair scanner modal** (`pair-scanner-modal`) | Camera viewfinder frames the terminal QR; it locks on and dismisses | — |
| 12–15s | **Onboarding — Done** | Eyebrow `HANDSHAKE COMPLETE`, headline *"Thread is live."*, paired pill showing host · port | — |
| 15–20s | **Sessions Hub** (`hub-screen`) | Tap **Enter Threadbase**; hub populates, `LiveSessionsHeader` reads `LIVE · 3` | "Three sessions. Already running." |
| 20–25s | End card | — | "No cloud account. threadbase.sh/betas" |

**Notes for capture**
- `e2e/ts1_onboarding_pairing.yaml` already walks this path; `npm run test:e2e:ts1:record` records it via `scripts/record-simulator-flow.js`.
- Skip the Notifications step on camera (step 3) or the iOS permission dialog interrupts the take — `e2e/setup.yaml` skips it for exactly this reason.

---

## Flow 3 — "Review the diff on the train"

**Length:** 30s · **Why:** repositions the app from *monitor* to *review surface*, which is the objection you get from senior devs.

| t | Screen / view | What happens on screen | Overlay text |
|---|---|---|---|
| 0–3s | **iOS lock screen** (push) | *"Session Completed"* | "It finished while you were out." |
| 3–6s | **Sessions Hub** (`hub-screen`, Hub layout) | `ProjectHubCard` for the project; tap the conversation row | — |
| 6–10s | **Conversation detail** (`app/conversation/[id].tsx`) | Message bubbles, `ToolCard` and `ThinkingCard` entries scroll past | "Read what it actually did." |
| 10–13s | **Conversation detail** — bottom bar | Tap **Review changes** (`review.open`) | — |
| 13–20s | **Review sheet** (`review-sheet`) | Summary header `12 files · +340 / −87`; tap a file row (`review-file-row`); `DiffViewer` shows the highlighted diff | "Every file. Every line." |
| 20–25s | **Review sheet** | Tap **Send note to agent** (`review-send-note`); confirm dialog; note posts into the live session input | "Send it back for another pass." |
| 25–30s | **Session detail** (`session-detail-screen`) | Agent picks the note up and starts revising | "Ship the review, not the laptop." |

**Notes for capture**
- Use `e2e/fixtures/conv-code-heavy.json` — it has enough file changes for a credible summary line.
- `review.incompleteWarning` may render above the list; crop it or pick a fixture that doesn't trigger it, since on camera it reads as an error.

---

## Flow 4 — "Four machines, two agents, one screen"

**Length:** 25s · **Why:** targets leads and anyone running parallel work; shows multi-server and multi-provider, which no cloud agent dashboard does for self-hosted runtimes.

| t | Screen / view | What happens on screen | Overlay text |
|---|---|---|---|
| 0–3s | **Sessions Hub** (`hub-screen`, Tree layout) | Server root rows expand; `MachineBadge` chips show different hosts | "Every machine you own." |
| 3–7s | **Sessions Hub** — Tree layout | Scroll: Claude Code and Codex sessions side by side, each with `session-provider-chip` | "Claude Code and Codex. Same list." |
| 7–10s | **Filter & sort sheet** (`filter-sort-sheet`) | Open via `filter-sort-button`, filter down to running sessions | — |
| 10–14s | **Sessions Hub** — History tab (`hub-history-tab`) | Full-text search in `hub-search-input` across indexed history | "Search everything you ever ran." |
| 14–19s | **Conversation detail** | Open a historical conversation; tap **Resume Session** (`resume.start`) | "Pick up a thread from last week." |
| 19–22s | **Session detail** (`session-detail-screen`) | It's live again — `LiveDot`, streaming terminal | — |
| 22–25s | End card | — | "One thread. threadbase.sh/betas" |

**Notes for capture**
- Switch layouts under **Settings → Appearance → Layout** (`Tree` / `Hub` / `Classic`); Tree is the one that shows the machine hierarchy.
- Two mock servers already run side by side in the mock suite (`MOCK_PORTS=7071,7072`), which is what makes multi-machine filmable.

---

## Flow 5 — 8-second cutdown ("I didn't open my laptop")

**Length:** 8s · **Why:** a second post, or the reply-to-comments clip. Vertical, one idea, no setup.

| t | Screen / view | What happens on screen | Overlay text |
|---|---|---|---|
| 0–2s | *No app* — walking, phone in hand | — | — |
| 2–5s | **Session detail** (`session-detail-screen`) — Chat composer | Hold `chat-mic-button`, dictate *"add tests for the auth service"*, text appears as it's spoken | — |
| 5–7s | **Session detail** — prompt queue | Tap `chat-send-button`; the queued-prompt chip appears | — |
| 7–8s | **Session detail** — Terminal view | Terminal starts writing test files | "I didn't open my laptop." |

**Notes for capture**
- Speech-to-text is on-device (`NSSpeechRecognitionUsageDescription`); `e2e/voice_dictation.yaml` covers the path.

---

## Bonus beats (use as B-roll, not as their own flow)

| Beat | Screen / view | Why it's worth a second of screen time |
|---|---|---|
| Start a session from the phone | **Browse** (`browse-screen`) → **Start Session Here** (`browse-start-session`) | Proves it's control, not just read-only |
| The wake-up animation | **Browse** — starting overlay (`waking-up-animation`) | The rotating phrases ("Brewing a fresh pot of tokens, hold tight…") are genuinely charming and very shareable |
| Quiet hours | **Settings → Notifications** | Answers "won't this ping me at 2am?" before it's asked |
| Privacy | **Settings** — crash reporting toggle, off by default | Anchors the local-first claim in something visible |
| Live Activity | **iOS lock screen / Dynamic Island** (`widgets/SessionLiveActivity.tsx`) | Instantly reads as a polished native app |

---

## Editing rules

These matter more than which flow you pick.

- **Silent-first.** LinkedIn autoplays muted — every beat needs burned-in text. Nothing may depend on voiceover.
- **4:5 or 1:1**, 30–45s max. The feed favours it and a phone screen fills the frame.
- **Hook in the first 2 seconds** on the *pain* — a blocked agent, a notification. Never open on a logo or an app icon.
- **Real output, real latency.** No speed-ramping the streaming terminal; the unstaged look is where the credibility comes from.
- **One CTA, at the end only.** `threadbase.sh/betas`.
- **Say "your own server, no telemetry" explicitly.** It's the differentiator against every cloud agent dashboard, and this audience cares.
- **No fake repo names.** Use demo fixtures rather than a real client's project path.

**Post copy angle:** lead with the number — *"my agent used to sit blocked for 40 minutes while I was at lunch"* — not with a feature list.

---

## Screen inventory

Reference for the names used above.

| Name used in flows | Route / component | testID |
|---|---|---|
| Onboarding — Welcome | `app/onboarding.tsx` step 1 | `onboarding-welcome-cta` |
| Onboarding — Connect | `app/onboarding.tsx` step 2 | `onboarding-connect-qr-card`, `onboarding-connect-paste-card` |
| Pair scanner modal | `components/pair/` | `pair-scanner-modal` |
| Onboarding — Notifications | `app/onboarding.tsx` step 3 | `onboarding-notifications-cta` |
| Onboarding — Done | `app/onboarding.tsx` step 4 | `onboarding-done-cta` |
| Sessions Hub | `app/index.tsx` | `hub-screen` |
| — Tree layout | `components/sessions/tree/TreeSessionsList.tsx` | — |
| — Hub layout | `components/sessions/hub/ProjectHubList.tsx` | — |
| — Classic layout | `components/sessions/classic/ClassicSessionsList.tsx` | — |
| — History tab | — | `hub-history-tab` |
| — Filter & sort sheet | — | `filter-sort-sheet` |
| — Quick Access strip | `components/quick-access/QuickAccessStrip.tsx` | — |
| Session detail | `app/session/[id].tsx` | `session-detail-screen` |
| — Terminal view (RAW) | `components/terminal/TerminalView.tsx` | `terminal-line-row` |
| — Chat view | `components/conversation/LiveConversationView.tsx` | `session-view-mode-chip` |
| — Question card | `components/terminal/QuestionCard.tsx` | — |
| — Chat composer | `components/conversation/ChatComposer.tsx` | `chat-message-input`, `chat-mic-button`, `chat-send-button` |
| — Prompt queue / Plan preview | `components/queue/` | — |
| Conversation detail | `app/conversation/[id].tsx` | `conversation-bottom-bar` |
| — In-conversation search | `components/conversation/ConversationSearchView.tsx` | `conversation-search-bar` |
| Review sheet | `components/review/` + `DiffViewer.tsx` | `review-sheet`, `review-file-row` |
| Browse | `app/browse.tsx` | `browse-screen`, `browse-start-session` |
| Project | `app/project/[id].tsx` | — |
| Settings | `app/settings.tsx` | `hub-settings-btn` |
| Notification health | `app/notification-health.tsx` | `notif-health-quiet` |
| Server health | `app/server-health.tsx` | `server-health-overall` |
| Live Activity | `widgets/SessionLiveActivity.tsx` | — |
