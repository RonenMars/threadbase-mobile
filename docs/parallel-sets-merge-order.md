# Parallel sets — merge order to main

Companion to the parallel-set grouping derived from `docs/BACKLOG.md` + `docs/ROADMAP.md` on 2026-05-27. Each set is a worktree-bound branch worked by one agent. This doc covers **which set to merge first** and **why**, so two parallel branches don't fight over the same file.

Status of the underlying items reflects the 2026-05-27 audit (Feature 1, Feature 2, Bug 6 already shipped via PR #11; Bug 32 already shipped via commit `1ec1686`; Bug 18 partial). The sets below are post-audit.

---

## The sets at a glance

| Set | Theme | Items | Primary files |
|---|---|---|---|
| A | Conversation screen polish | Bug 10, 11, 17 | `app/conversation/[id].tsx` |
| B | Browse → new-session handoff | Bug 13, 14, 15, 16 | `app/browse.tsx`, `app/_layout.tsx`, `hooks/useStartSession.ts` |
| C | Quick Access strip UX trio | Bug 7, 9, 26, 29 | `components/quick-access/QuickAccessStrip.tsx`, `stores/quickAccess.ts` |
| D | Onboarding + Settings entry points | Bug 22, Feature 22, Feature 23, Bug 28 | `app/settings.tsx`, `components/onboarding/*`, Filter & Sort bar, PTR modal |
| E | Popular tab fix-up | Bug 23, 24 | `components/sessions/quickAccess/PopularTab.tsx` |
| F | Hub perf + Maestro re-enable | Issue 1, Issue 2, Bug 18, Bug 19 | `app/index.tsx`, `components/sessions/hub/ProjectHubCard.tsx`, `e2e/*.yaml`, `app/_layout.tsx` (Bug 19 only) |
| G | Theme audit | Bug 31 | App-wide (theme provider + every screen) |

---

## Conflict matrix

`✓` = touches the same file, expect to rebase or coordinate. `·` = no overlap.

|        | A | B | C | D | E | F | G |
|--------|---|---|---|---|---|---|---|
| **A**  | — | · | · | · | · | · | ✓ |
| **B**  | · | — | · | · | · | ✓ (`_layout.tsx` via Bug 19) | ✓ |
| **C**  | · | · | — | · | · | · | ✓ |
| **D**  | · | · | · | — | · | · | ✓ |
| **E**  | · | · | · | · | — | · | ✓ |
| **F**  | · | ✓ | · | · | · | — | ✓ |
| **G**  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |

Two structural conflicts to plan around:

- **B ⨯ F** — both edit `app/_layout.tsx`. B touches the modal-presentation config (the browse-route handoff bug); F's Bug 19 touches the `threadbase://onboarding?mode=add` deeplink handler. Different concerns inside the same file, but the same file. Merge B first, rebase F.
- **G ⨯ everything** — the theme audit (Bug 31) touches color literals, NativeWind class strings, and theme-context wiring across the whole app. Any UI work merged at the same time will conflict. Merge G in a quiet window with no other sets in flight.

Everything else is disjoint.

---

## Recommended merge order

The order below maximises parallelism and minimises rebase pain. Each wave is shippable on its own.

### Wave 1 — independent UX fixes (parallel, no conflicts)

Merge in any order within the wave; the agents can develop and rebase in parallel.

1. **Set C — Quick Access strip UX trio.** Smallest blast radius (one component file + one store). Lands first because it's self-contained and unblocks Bug 30 (Favorites — spec-gated) UI choices later.
2. **Set E — Popular tab fix-up.** Two-bug PR in one component file. Tiny.
3. **Set A — Conversation screen polish.** Three bugs in one screen file. The internal order inside the branch is **Bug 10 → Bug 11 → Bug 17**, because Bug 17 changes the `handleScroll` semantics that Bug 10 + 11 rely on (per the backlog sequencing notes).
4. **Set D — Onboarding + Settings entry points.** Four small items in four different files. Can be one agent or fanned out further; nothing in D touches anything in A/B/C/E/F.

Outcome of Wave 1: every UI-quality fix that doesn't touch shared layout/router is in main.

### Wave 2 — handoff + perf (sequential because of `app/_layout.tsx`)

5. **Set B — Browse → new-session handoff cluster.** Four bugs (13, 14, 15, 16) on the same root cause; ships as one PR. Touches `app/_layout.tsx` (modal presentation). Land this **before** Set F starts on Bug 19, because Bug 19's deeplink handler change also edits `app/_layout.tsx` and the modal-config edits in B will be more invasive.
6. **Set F — Hub perf + Maestro re-enable.** Rebase onto post-Set-B main. Split into two PRs if useful:
   - **F.perf** — Issue 1 + Issue 2 (Hub cold-launch flash + accordion stall). Independent of `_layout.tsx`.
   - **F.maestro** — Bug 18 + Bug 19. Bug 19 is the only one that touches `app/_layout.tsx`.

Outcome of Wave 2: the handoff bug cluster and Hub-stall regressions are gone; Maestro CI re-covers the two skipped flows.

### Wave 3 — solo

7. **Set G — Theme audit (Bug 31).** Run alone. Backlog explicitly recommends a single audit pass across every top-level screen + modal before fixing; any UI change in flight will fight it. Schedule when Waves 1 + 2 are merged and there's no other open UI PR.

---

## Branch hygiene per set

For each set:

- One worktree under `.claude/worktrees/<set-id>-<slug>/` (e.g. `c-quick-access-ux-trio`). Keeps every set's `node_modules`, Pods, and DerivedData isolated from the others.
- Branch name `fix/set-<letter>-<slug>` (e.g. `fix/set-c-quick-access-ux`).
- One PR per set unless explicitly noted (Set F may split into F.perf + F.maestro).
- Conventional-commit titles per the repo CLAUDE.md rule (`fix(<scope>): …`). No external ticket-scope prefix required — this repo uses plain conventional commits.
- Always commit `app.json` build-number bumps separately, before shipping (per project CLAUDE.md).

---

## Rebase recovery if order slips

If two sets land out of order and one of the conflict pairs above (B/F, anything/G) needs to rebase:

- **B then F**: F's `app/_layout.tsx` edits are deeplink-handler-only — fast to rebase against B's modal-config changes.
- **F then B**: B's modal-presentation edits are the bigger change; if F lands first, expect B to need a small rebase pass on the `Stack.Screen` block in `app/_layout.tsx`. Still cheap.
- **G then anything**: G touches color/theme tokens in many files. Any UI set rebasing after G has to re-verify its new components don't reintroduce hard-coded color literals. Run G's "theme audit checklist" (in the Bug 31 entry) on the rebased branch before merge.

---

## What's intentionally not in any set

- **Bug 5 — Multi-attachment send produces no output.** Diagnosed in PR #11 (`docs/superpowers/diag/2026-05-XX-bug5.md` per the commit list), but no fix; expected to collapse into Feature 3.
- **Bug 30 — Add-to-favorites.** Spec-gated; design doc must land under `docs/superpowers/specs/` first.
- **Bug 20, Bug 21 — Tree-view path error + Recents "Session not found".** Backlog flags them as "investigate in parallel — may share an app↔streamer-boundary root cause." Worth picking up as a separate diagnostic pair (call it Set H) once Wave 2 is in.
- **Feature 3, 4, 5, 6–24.** Roadmap-scale features, not bug-cluster work.

---

## Verification gate per set

Before opening the PR for any set, the agent must:

1. `npm test` — all 493+ Jest tests pass.
2. `npm run test:e2e:mock` — full Maestro suite runs on a clean iOS simulator. If your set added a new Maestro flow, it's in the arglist.
3. `npm run lint` — no new warnings introduced.
4. Smoke-test on the iPhone 17 Pro physical device (UDID `00008150-00115DEA1A40401C`, per [[iphone-17-pro-udid]] memory) for sets A, B, C, E, F.perf — these touch user-facing surfaces that simulators don't always exercise the same way (scroll inertia, keyboard avoidance, list virtualization at scale).

Set G additionally runs the theme-audit checklist from the Bug 31 entry on every theme variant before merging.

---

## Open question for the user (single decision)

Set D (Onboarding + Settings entry points) bundles four unrelated items into one set for convenience. Two choices:

- **One agent, sequential commits** — simplest, but each item blocks the next.
- **Fan out to four sub-agents on four sub-branches** — faster wall-clock, but each sub-PR is tiny enough that the PR-overhead may not be worth it.

Default recommendation: **one agent, one PR**. The four items are small and the agent can serialise them in a single afternoon.
