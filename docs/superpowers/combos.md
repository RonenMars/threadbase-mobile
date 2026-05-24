# Parallel Worktree Combos

**Date:** 2026-05-23
**Purpose:** Sets of tasks that can be implemented simultaneously in separate worktrees without stepping on each other's toes.

---

## Methodology

Each task is grouped by the files/areas it touches. Combos group tasks whose footprints don't overlap on the same files — especially "hot files" that many features modify.

### Hot files (single-writer at a time)

Any two tasks both modifying one of these files cannot parallelize:

- `stores/settings.ts` — i18n / theming / session-naming / quick-access / projects-hub
- `app/_layout.tsx` — i18n / theming / projects-hub
- `app/index.tsx` — projects-hub / quick-access / Bug 4 / Bug 6 / i18n Wave 2 / PR #4
- `app/settings.tsx` — i18n / theming / session-naming / projects-hub / PR #4
- `app/conversation/[id].tsx` — Bug 1 / Bug 4 / Bug 6 / Feature 2 / PR #4
- `app/session/[id].tsx` — pty-turn-divider / session-naming
- `components/sessions/hub/ProjectHubList.tsx` + `ProjectHubCard.tsx` — Bug 2a / Bug 2b / projects-hub / PR #4

### PR #4 footprint (open: `fix/flashlist-v2-recycling-mvcp`)

86 files, +2751 / -401. Touches MessageBubble, ToolCard, ThinkingCard, DiffViewer, ProjectHubList, multiple onboarding steps, `app/conversation/[id].tsx`, `app/index.tsx`, `app/settings.tsx`, `components/quick-access/*`. **Treat as a blocker for any UI-shaped task until merged or rebased.**

---

## Combo A — Maximum parallelism while PR #4 is still open (4 worktrees)

Pick if you want to keep working while PR #4 sorts itself out. Each task touches different subtrees and zero hot files in common.

| Worktree | Task | Files touched | Why safe |
|---|---|---|---|
| **A1** | **Bug 6** — bottom-bar inset on conversation list | `app/conversation/[id].tsx` + the bottom-bar component | Only A1 touches `app/conversation/[id].tsx` in this combo |
| **A2** | **Server drag-reorder** (`plans/2026-05-11-server-drag-reorder.md`) | `stores/servers.ts`, `components/servers/DisplayedServersList.tsx`, `components/servers/FilterSortSheet.tsx`, tests | Servers area; no overlap with conversation/hub |
| **A3** | **Tree server headers** (`plans/2026-05-01-tree-server-headers.md`) | `components/sessions/tree/types.ts`, `TreeSessionsList.tsx`, new `ServerHeaderRow.tsx` | Tree subtree, isolated |
| **A4** | **PTY turn divider** (`plans/2026-05-02-pty-turn-divider.md`) | `hooks/useTerminalStream.ts`, `components/terminal/TerminalOutput.tsx`, `app/session/[id].tsx` | Terminal/session screen, not conversation/hub |

**Caveats:**
- A4 touches `app/session/[id].tsx`; if you also want session-naming parallel, see Combo B.
- PR #4 doesn't touch `app/session/[id].tsx`, so A4 is fine alongside it.
- A1 (Bug 6) could alternatively be folded into PR #4 if it's about to land.

---

## Combo B — "PR #4 is merged or rebased" (5 worktrees)

| Worktree | Task | Files touched |
|---|---|---|
| **B1** | **Bug 1** — `useMinDisplayTime` hook + wiring | new `hooks/useMinDisplayTime.ts`, `app/conversation/[id].tsx`, tests |
| **B2** | **Bug 2b** — Hub long-list profiling + virtualize | `components/sessions/hub/ProjectHubCard.tsx` (root cause per memory: inline `.map`) |
| **B3** | **Server drag-reorder** | `stores/servers.ts`, `components/servers/*Sheet*.tsx`, `DisplayedServersList.tsx` |
| **B4** | **Tree server headers** | `components/sessions/tree/*` |
| **B5** | **Feature 2** — Move Export to info shelf | bottom-bar component + info-shelf component (read-only on `app/conversation/[id].tsx` if possible) |

**Caveats:**
- B1 and B5 both touch the Historical session bottom area. Run B1 first; do B5 after B1 lands (or fold B5 into the same worktree as B1).

---

## Combo C — "Foundation pass" — low-risk, guaranteed-clean (3 worktrees)

For when you want zero conflicts:

| Worktree | Task | Files touched |
|---|---|---|
| **C1** | **Tree server headers** | `components/sessions/tree/*` only |
| **C2** | **Server drag-reorder** | `stores/servers.ts` + `components/servers/*` only |
| **C3** | **Extend ROADMAP** (land PR #6 or add items) | `docs/ROADMAP.md` only |

Zero file overlap; all three can land in any order.

---

## Single-track tasks (can NEVER parallelize cleanly)

Pick at most ONE of these per parallel run — each touches `stores/settings.ts` and/or the root layout, so they conflict with most other UI work:

- **i18n waves** — `stores/settings.ts`, `app/_layout.tsx`, plus a long tail of components per wave
- **Theming system** — `stores/settings.ts`, `app/_layout.tsx`, `app/settings.tsx`, `tailwind.config.js`
- **Session-naming** — `stores/settings.ts`, `app/session/[id].tsx`, `app/settings.tsx`, `app/browse.tsx`
- **Projects-hub redesign** — `app/index.tsx`, `app/_layout.tsx`, `stores/settings.ts`, deletes `app/(tabs)/*`
- **Quick-access strip (extending)** — `stores/settings.ts`, `app/index.tsx`, `app/manage-favorites.tsx`

---

## Quick conflict cheatsheet

| File | Owned by (mutually exclusive) |
|---|---|
| `stores/settings.ts` | i18n / theming / session-naming / quick-access / projects-hub |
| `app/_layout.tsx` | i18n / theming / projects-hub |
| `app/index.tsx` | projects-hub / quick-access / Bug 4 / Bug 6 / i18n W2 / PR #4 |
| `app/settings.tsx` | i18n / theming / session-naming / projects-hub / PR #4 |
| `app/conversation/[id].tsx` | Bug 1 / Bug 4 / Bug 6 / Feature 2 / PR #4 |
| `app/session/[id].tsx` | pty-divider / session-naming |
| `components/sessions/hub/*` | Bug 2a / Bug 2b / projects-hub / PR #4 |

---

## Recommended starting combo

**Combo A** (4 parallel worktrees) — none of A2/A3/A4 touch PR #4's modified files. A1 (Bug 6) is a tiny inset fix you could fold into PR #4 instead if it's about to land.

---

## Notes on running these

- Spin up worktrees with `git worktree add ../tb-mobile-<task-name> <base-branch>`.
- Each worktree's branch should be off latest `origin/main` (or off PR #4's branch if the task explicitly extends it).
- Before merging, rebase against latest `main` to catch any drift; the conflict cheatsheet above tells you where to look.
- If two tasks in different worktrees both need to change a hot file, sequence them — don't parallelize.
