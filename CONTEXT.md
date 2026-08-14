# Context — Threadbase Mobile

Domain glossary for this repo.
Use these terms as defined here; don't drift to synonyms.
Every entry below is traceable to code — the citation is part of the definition, so a term that stops matching its citation is a bug in one of the two.

Threadbase Mobile is a **thin client**. It holds almost no authority: the app renders and drives state that lives on a streamer.

## The two things that are not the same

**Session** — a live agent process on a machine, addressable while it runs (`types/api.ts:20`).
**Conversation** — the historical JSONL transcript that process left behind (`types/api.ts:120`).

They share `projectPath`, `projectId`, `branch`, `provider`, and often a `sessionName`, which is exactly why they get conflated.
The distinguishing fields are the tell: a Session has `status` and `ptyAttached`; a Conversation has `messageCount`, `lastActivity`, and `filePath`.
A Session may have no Conversation yet (freshly started, no history), and the overwhelming majority of Conversations have no Session (the process is long gone).

In the Hub's merged list both appear as rows, sorted by one contract: **live sessions cluster to the top regardless of conversation recency**, then idle sessions, then conversations chronologically (`app/index.tsx`, `mergedClassicItems`).

## A Session has two independent axes

Do not derive one from the other, and do not infer either from `completedAt` — it is stamped on both a real exit and a hold (`types/api.ts:6-11`).

**`status`** — what the agent is doing right now: `running`, `waiting_input`, `idle`.
**`lifecycle`** — the fate of the process, orthogonal to status: `attached`, `detached`, `orphaned`, `resumable`, `completed`, `failed`.

`lifecycle` is additive and older servers omit it, so absence means "unknown", never "attached".
Prefer it over inferring end-or-hold from `ptyAttached` + `status`.

## Everything else

**Streamer** — the backend (repo `tb-streamer`), one per machine. Owns sessions, transcripts, and the PTY. Mobile asks; the streamer decides.

**Server** — a streamer the user has paired, as modelled on the device: host, API key, health. "Server" is the user-facing word for one streamer instance; there can be several.

**Project** — a checkout on the machine. Identified by `projectPath` today and migrating to `projectId`, which is the stable backend identity — new code should carry both and prefer `projectId` when present.

**Provider** — the agent backing a session: Claude Code or Codex (`constants/providers`). Capabilities differ per provider; don't assume Claude's behaviour.

**Hub** — the home screen (`app/index.tsx`). Three layouts over the same data, and the difference is structural, not cosmetic: **classic** is a flat merged list, **tree** is a directory hierarchy, **hub** groups by project. Pagination that works on the flat list does not work on the grouped ones — they need the whole group to draw it. This is the subject of [ADR 0001](./docs/adr/0001-hub-data-layer-lazy-pagination.md).

## What this glossary does not cover

Architecture decisions live in `docs/adr/`; plans, briefs, and status reports live in `docs/followups/`.
If a term you need isn't here, that's a signal — either it isn't the project's language (reconsider) or there's a real gap worth filling.
