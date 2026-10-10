# Threadbase marketing captures (Maestro)

Twenty-eight screenshots from four flows (three demos and onboarding), captured by `npm run test:e2e:marketing` (`e2e/marketing/`).

## How these were produced

- **App:** the real Release build of Threadbase on an iOS 26 simulator, dark theme, one device for every image.
- **Backend:** `e2e/marketing/demo-streamer.js`, a deterministic stand-in that speaks the streamer wire contract on three ports, one per machine. Each machine is paired through the real pairing deep link, so the app holds three separate server records. Nothing in the UI is painted or edited.
- **Not real agents.** No Claude Code or Codex process ran. Session state, transcripts and the reply that streams after a prompt come from `e2e/marketing/demo-data.js`. A caption that says "the agent replied" describes the app's behaviour against that contract, not a model's output.
- **"Started outside Threadbase"** is the streamer's `ownership: external` session, which the app shows as *Observed*. Taking it over is the app's own Resume → Take over path.
- All names, paths (`/code/...`) and URLs are demo data. No real hostnames, keys or personal paths appear.

## Devices

The same four flows run on four devices. The tables below describe the iPhone set; the other folders hold the same 28 file names.

| Folder | Device | Size | Command |
|---|---|---|---|
| `.` (this folder) | iPhone simulator, iOS 26 | 1206×2622 | `npm run test:e2e:marketing` |
| `ipad/` | iPad Pro 13-inch (M5) simulator, iOS 26.5, portrait | 2064×2752 | `MAESTRO_UDID=<udid> MARKETING_SCREENSHOT_DIR=artifacts/marketing/threadbase-maestro/ipad npm run test:e2e:marketing` |
| `android-phone/` | Pixel 9 emulator, API 35 | 1080×2424 | `E2E_PLATFORM=android E2E_ANDROID_AVD=<avd> MARKETING_SCREENSHOT_DIR=artifacts/marketing/threadbase-maestro/android-phone npm run test:e2e:marketing` |
| `android-tablet/` | Pixel Tablet emulator, API 35, landscape | 2560×1600 | as above with the tablet AVD and `android-tablet` |

- The app has no tablet layout: both tablets show the phone layout at full width, and the iPad's portrait session screens are mostly empty above a short transcript.
- Android pairs through `10.0.2.2` instead of `localhost`.
- The runner sets the dark system theme on every device, so the keyboard is dark like the app, and pins the clock to 9:41 (`simctl status_bar` on iOS, SystemUI demo mode on Android).
- All four sets were captured on 2026-10-06 from a Release build of `main` at `a82fbb2f`, the iPhone set on an iPhone 17 Pro simulator (iOS 26.5).

Topology: **Work Mac** (Claude Code running, Codex waiting), **Home Mac** (finished Claude Code work), **Linux Devbox** (Codex running).
The spec's Flow 3 step 4 asks for a Claude Code session on Linux Devbox while its topology puts Codex there; the topology was followed.

## Flow 1 — Start anywhere. Continue anywhere.

| File | Demonstrates | Marketing proof | State assumptions |
|---|---|---|---|
| `01-start-anywhere-continue-anywhere/01-session-discovered.png` | Hub lists "Summarize session persistence" on Work Mac as *Observed* | A session started in a plain terminal appears without being launched from the app | Fresh pairing of three machines; session is `external`, running |
| `…/02-existing-session-opened.png` | Its transcript, with Resume Session | Existing work is readable from the phone | Opened from the hub row |
| `…/03-waiting-for-input.png` | Live session screen: *Needs you*, Live control | The phone knows the agent is waiting | After Resume → Take over; demo streamer flips status to waiting |
| `…/04-prompt-sent-from-mobile.png` | Prompt in the transcript under LIVE, keyboard still up | The follow-up was typed on the phone | Keyboard is deliberate here: it is the moment of sending |
| `…/05-agent-resumed-remotely.png` | *Working*, the prompt and the streamed reply | The agent picked up the phone's prompt | Reply is scripted demo output |
| `…/06-hero.png` | Hub: the same session now a live *Working* card beside the other machines | One session, started in a terminal, now controlled from the phone | After leaving the session screen |

## Flow 2 — Your coding agents have memory.

| File | Demonstrates | Marketing proof | State assumptions |
|---|---|---|---|
| `02-agent-memory/01-history-across-sessions.png` | Hub scrolled to the history of all three machines | A real corpus across machines, projects and days | Header shows blurred list content behind it (app design) |
| `…/02-search-engineering-memory.png` | Search "Auth0 localhost callback multiple environments" → one hit with highlighted snippet | Search by the problem, not the session name | — |
| `…/03-recovered-old-solution.png` | The old conversation opened at the match, "1 of 1" | The actual fix is recovered, not just a title | In-conversation search opens on its own |
| `…/04-cross-project-search.png` | "session persistence SQLite resume" → hits on Work Mac and Home Mac | Memory is not tied to one machine or thread | — |
| `…/05-cross-provider-memory.png` | "authentication retry" → a Codex result (marked) among Claude Code results | Memory spans providers | The app marks only rows that differ from the list's majority provider; Claude rows are unmarked |
| `…/06-history-to-active-session.png` | A day-old Home Mac conversation resumed into a live *Needs you* session | History turns back into live work | Resumed via Resume Session |
| `…/07-hero.png` | "session" → results grouped under all three machines, highlights, Codex marks | One search over every agent's history | — |

## Flow 3 — Every agent. Every machine. One control plane.

| File | Demonstrates | Marketing proof | State assumptions |
|---|---|---|---|
| `03-control-plane/01-all-machines-all-agents.png` | Hub: one *Needs you*, two *Working*, machine badges, provider marks | The whole fleet at a glance | Work Mac's Claude session already taken over (as Flow 1 leaves it) |
| `…/02-waiting-agent-work-mac.png` | Codex session on Work Mac asking which approach to take | The phone shows exactly what the agent is blocked on | — |
| `…/03-unblocked-remotely.png` | "Continue with the recommended approach. Do not modify files." sent; *Working* | Unblocked from the phone | Reply is scripted demo output |
| `…/04-switch-machine-session.png` | Codex session running on Linux Devbox | Hop between machines without changing tools | The session screen itself does not name the machine |
| `…/05-completed-session-other-machine.png` | Finished Claude Code review from Home Mac, with Resume Session | Finished work on a third machine stays readable | Opened from history |
| `…/06-search-across-machines.png` | "onboarding" → Home Mac and Linux Devbox results | One search across machines | 1–1 provider tie, so no provider marks render |
| `…/07-hero.png` | Projects layout: projects grouped per machine, live counts | Machines → projects → sessions in one place | — |

## Flow 4 — Onboarding

Every onboarding step on a clean install, pairing Work Mac by typed address and key.

| File | Demonstrates | State assumptions |
|---|---|---|
| `04-onboarding/01-language.png` | Language step, the device language preselected | Fresh install, nothing paired |
| `…/02-welcome.png` | Welcome step | — |
| `…/03-connect.png` | Connect step: scan a QR code or paste credentials | — |
| `…/04-connect-details.png` | Address and key typed, keyboard up | The key is shown, not hidden: iOS blanks a hidden field in screenshots. The form is scrolled to keep Connect above the keyboard, which pushes the heading off screen on the iPad |
| `…/05-confirm-key.png` | "Add server with a pasted key?" | The app asks because a typed key is never exchanged with the server |
| `…/06-notifications.png` | Notifications step | — |
| `…/07-done.png` | "Thread is live." with the paired address | Shows `localhost` on iOS and `10.0.2.2` on Android |
| `…/08-hub.png` | The hub with Work Mac's sessions | One machine, stored under a generated id because a typed key carries no machine name |

## Marketing selection

Story: keep using Claude Code and Codex the way you already do → Threadbase remembers all of it → one place to control it.

**Heroes**

1. `01-start-anywhere-continue-anywhere/06-hero.png` — the terminal-started session is now a live card among three machines' work.
2. `02-agent-memory/07-hero.png` — one word searches three machines and both providers, with highlighted evidence.
3. `03-control-plane/01-all-machines-all-agents.png` — needs-you, working, machine and provider all legible in one frame. Chosen over `07-hero.png`, whose Projects layout shows no provider and repeats `code/threadbase-streamer` three times.

**Supporting**

- `01-…/01-session-discovered.png` — *Observed* is the proof the session was not launched by the app.
- `01-…/05-agent-resumed-remotely.png` — prompt from the phone and the agent's response in one frame.
- `02-…/03-recovered-old-solution.png` — the recovered answer itself; the most concrete "memory" image.
- `02-…/05-cross-provider-memory.png` — Codex and Claude Code results in one list.
- `03-…/03-unblocked-remotely.png` — a waiting Codex session unblocked remotely.
