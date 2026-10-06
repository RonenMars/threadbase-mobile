# Threadbase marketing captures (Maestro)

Twenty screenshots from three demo flows, captured by `npm run test:e2e:marketing` (`e2e/marketing/`).

## How these were produced

- **App:** the real Release build of Threadbase on an iOS 26 simulator, dark theme, one device for every image.
- **Backend:** `e2e/marketing/demo-streamer.js`, a deterministic stand-in that speaks the streamer wire contract on three ports, one per machine. Each machine is paired through the real pairing deep link, so the app holds three separate server records. Nothing in the UI is painted or edited.
- **Not real agents.** No Claude Code or Codex process ran. Session state, transcripts and the reply that streams after a prompt come from `e2e/marketing/demo-data.js`. A caption that says "the agent replied" describes the app's behaviour against that contract, not a model's output.
- **"Started outside Threadbase"** is the streamer's `ownership: external` session, which the app shows as *Observed*. Taking it over is the app's own Resume → Take over path.
- All names, paths (`/code/...`) and URLs are demo data. No real hostnames, keys or personal paths appear.

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
