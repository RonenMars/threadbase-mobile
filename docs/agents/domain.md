# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **single-context** repo — one `CONTEXT.md` at the root, one `docs/adr/`.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the domain glossary. **Does not exist yet as of 2026-08-14.**
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**.
Don't flag their absence; don't suggest creating them upfront.
The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md          ← not created yet
├── docs/adr/
│   ├── 0001-hub-data-layer-lazy-pagination.md          ← the ADR
│   ├── 0001-kickoff.md                                 ← implementation brief for it
│   ├── 0001-streamer-project-summary-request.md        ← cross-repo request to tb-streamer
│   └── 0001-followup-05-chat-flow-hidekeyboard.md      ← task prompt, not a decision
└── app/ components/ services/ hooks/ …
```

**`docs/adr/` currently holds exactly one ADR.**
`0001-hub-data-layer-lazy-pagination.md` is the only file carrying ADR metadata (`Status: Proposed`, `Date: 2026-08-08`), so "ADR 0001" resolves unambiguously to it.
The other three share the `0001-` prefix because they are satellites of that same workstream, not because the sequence is broken — two of them link to the ADR by that number in their opening lines.

Numbering is sequential, one number per decision: scan `docs/adr/` for the highest number and increment, so the next real ADR is `0002`.
A file only belongs here if the decision it records is hard to reverse, surprising without context, and the result of a genuine trade-off — a plan, a request, or a task prompt is none of those.

`0001-followup-05-chat-flow-hidekeyboard.md` is the one misfiled file: a Maestro/iOS keyboard task prompt with no relation to the Hub data layer.
`docs/followups/repo-health/EVIDENCE.md` already records that it should move out of this directory, and `docs/followups/mobile/05-chat-flow-hidekeyboard.md` points at it as the full brief.
Don't treat it as a decision.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`.
Don't drift to synonyms the glossary explicitly avoids.

Until `CONTEXT.md` exists, take domain vocabulary from `CLAUDE.md` and the existing code — this project's terms of art include *session*, *server*, *hub*, *streamer*, *conversation*, *terminal*, *provider*, and *live activity*.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts `docs/adr/0001-hub-data-layer-lazy-pagination.md` — but worth reopening because…_
