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
│   ├── 0001-kickoff.md
│   ├── 0001-hub-data-layer-lazy-pagination.md
│   ├── 0001-followup-05-chat-flow-hidekeyboard.md
│   └── 0001-streamer-project-summary-request.md
└── app/ components/ services/ hooks/ …
```

**The ADR numbering is currently broken** — all four files are numbered `0001`, so "ADR-0001" does not identify a document.
Cite ADRs here by filename (`docs/adr/0001-hub-data-layer-lazy-pagination.md`), not by number, until they are renumbered.
Any new ADR should take the next free number (`0002`), not another `0001`.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`.
Don't drift to synonyms the glossary explicitly avoids.

Until `CONTEXT.md` exists, take domain vocabulary from `CLAUDE.md` and the existing code — this project's terms of art include *session*, *server*, *hub*, *streamer*, *conversation*, *terminal*, *provider*, and *live activity*.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts `docs/adr/0001-hub-data-layer-lazy-pagination.md` — but worth reopening because…_
