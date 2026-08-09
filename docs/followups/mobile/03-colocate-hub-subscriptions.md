# 03 — Colocate the Hub's high-frequency subscriptions (ADR 0001 step 4)

**Repo:** tb-mobile · **Base:** after 01 lands
**Owns:** `app/index.tsx` (the subscription/header region)
**Depends on:** 01 — it rewrites the same region; running both at once guarantees a conflict in the file hardest to review

## Goal

Stop a status tick from re-rendering the whole Hub.

## State of play

`ProjectsHub` subscribes at the root to progress, fetch-status, WS-status and ~15 stores, so any of them re-renders the entire tree. On-device tracing found it re-rendering hundreds of times and never settling; `serverFetchStatus` alone accounted for 57 of 120 commits before PR #566 made its setter idempotent.

## The task

Move the ephemeral, high-frequency UI into leaves that subscribe to just their slice:

- the sync spinner / "showing cached data" notice
- the header health dot
- any remaining progress indicator

Each leaf subscribes via an atomic zustand selector (or `useShallow`), so a tick re-renders a chip rather than the tree. Generalise the PR #564 convention while here: a store setter returns the same state object when the value is unchanged, so a no-op write wakes nobody.

Do not memo your way around this. `React.memo` on the list roots (PR #563) already exists and is not the fix — the root component itself must stop subscribing.

## Done when

- `ProjectsHub` no longer reads `serverFetchStatus`, WS status, or progress at the root
- a fetch-status change re-renders the chip only, shown with `useWhyRender`
- no visual regression in the header dot, the cached-data notice, or the multi-server chips

## Reading

`docs/adr/0001-hub-data-layer-lazy-pagination.md` (step 4). Measurement method in `docs/troubleshooting.md` → "Measuring the wrong thing" — read it before trusting any number.
