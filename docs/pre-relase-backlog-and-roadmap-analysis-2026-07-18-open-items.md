# Pre-release Open Items by Severity — status update

> **Superseded** by [`followups/RELEASE-READINESS-2026-08-10.md`](./followups/RELEASE-READINESS-2026-08-10.md). Several items listed open here have since shipped.

> **Derived from:** [`pre-relase-backlog-and-roadmap-analysis-2026-07-18.md`](./pre-relase-backlog-and-roadmap-analysis-2026-07-18.md)  
> **Original snapshot:** 2026-07-18 · **Status update:** 2026-07-19  
> **Scope:** Unfinished work only. Items closed by open PRs since the snapshot are listed under Resolved, not in the open tables.

## Sorting and scale

- **Priority:** P0 release gate · P1 before release · P2 soon · P3 defer
- **Effort:** XS `<0.5d` · S `0.5–1d` · M `2–3d` · L `4–5d` · XL `>1w`

## Resolved / in flight (since 2026-07-18)

| Item | Status | PR |
|---|---|---|
| Feature 35 — crash-report consent model | In flight — option (a): explicit feedback self-inits Sentry like one-shot crash | [#343](https://github.com/RonenMars/threadbase-mobile/pull/343) |
| Feature 36 — privacy checklist (code-side) | Partial in flight — code-verified items marked; human/store/legal remain | [#343](https://github.com/RonenMars/threadbase-mobile/pull/343) |
| Bug 5 — multi-attachment / spaced `@path` | In flight — escape spaces in composer; streamer sanitize is pair PR | [#345](https://github.com/RonenMars/threadbase-mobile/pull/345) |
| Bug 16 — abandoned empty session | In flight — stop unused fresh PTY on back | [#346](https://github.com/RonenMars/threadbase-mobile/pull/346) |

## Critical severity (still open)

| Item | Priority | Effort | Status | Type |
|---|---:|---:|---|---|
| [E2E remaining work](./e2e-remaining-work.md) — Maestro release suite | P0 | M | Partial — unit E2E pass; native Maestro release suite not green | Maintenance / test |
| Feature 36 — production/legal/store evidence | P0 | M | Partial — code path improved in #343; store consoles, legal, Sentry dashboard, on-device checks remain human-only | Privacy |

## High severity (still open)

| Item | Priority | Effort | Status | Type |
|---|---:|---:|---|---|
| Expo Router typed-route / typecheck failures | P0 | S | Open — CI credibility; not first-session UX | Bug / CI |
| [Feature 17](./ROADMAP.md#feature-17--expand-maestro-e2e-coverage-to-high-value-flows) — Maestro coverage | P0 | M | Partial — suite still ungreen | Maintenance / test |
| [Bug 2](./BACKLOG.md#bug-2--hub-tree-node-open-loader--long-list-render-stall) / [Issue 2](./BACKLOG.md#issue-2--hub-accordion-expand-stalls-on-long-projects-1266-items--9-s) — hub accordion stall | P1 | L | Open — only critical if demos expand huge trees | Bug / performance |

## Medium severity (still open)

| Item | Priority | Effort | Status | Type |
|---|---:|---:|---|---|
| Bug 18 / Bug 19 — skipped Maestro flows | P1 | S | Open | Maintenance / test |
| Feature 20 — screenshot regression gate | P2 | S | Open | Maintenance / test |
| Bug 17 — jumpy stream/reconnect scroll | P2 | M | Partial | Bug |
| Feature 5 — onboarding polish closeout | P2 | M | Partial — elevate for OSS first impressions | Task / UX |
| Feature 14 / 16 / 19 — voice / sync / queue polish | P2 | M–L | Partial | Feature |

## Low severity

Unchanged from 2026-07-18: Mission Control, saved views, snippets, Live Activities, scheduled prompts, memoization audit, bottom-sheet spike, etc. Remain P3 / defer.

## Release-focused shortlist (updated)

1. Merge Feature 35/36 consent PR (#343); finish human-only privacy/store checklist items before public posts.
2. Merge Bug 5 (#345) + streamer upload sanitize; smoke-test multi-attachment with spaced filenames.
3. Merge Bug 16 (#346); confirm abandoned browse→start sessions do not linger.
4. Restore typecheck green and Maestro release suite (maintainer gates; not stranger first-session blockers).
5. Optional for demos: hub accordion Issue 2 if large project trees are shown.
