# PR Merge Plan — 2026-05-24

Strategy for landing the 7 open PRs from the Combo A + Combo B parallel-worktree session. Strategy chosen: **Option A — Wave merge** (smallest rebase per PR; independent reviewer stories; surfaces conflicts early).

---

## The 7 PRs

| PR | Branch | Title | Type |
|---|---|---|---|
| [#12](https://github.com/RonenMars/threadbase-mobile/pull/12) | `bug6-bottom-bar-inset` | test(e2e): regression coverage for conversation list bottom-bar inset (Bug 6) | Test-only |
| [#13](https://github.com/RonenMars/threadbase-mobile/pull/13) | `feat/server-drag-reorder` | test(e2e): server drag-reorder maestro flow | Test-only |
| [#14](https://github.com/RonenMars/threadbase-mobile/pull/14) | `feat/tree-server-headers` | test(e2e): tree-view server-header rows regression coverage | Test + testIDs |
| [#15](https://github.com/RonenMars/threadbase-mobile/pull/15) | `feat/pty-turn-divider` | test(e2e): pty-turn-divider integration + maestro coverage | Test + testIDs |
| [#16](https://github.com/RonenMars/threadbase-mobile/pull/16) | `diagnose/multi-attachment-bug5` | docs(bug5): diagnose multi-attachment send drop point | Docs-only |
| [#17](https://github.com/RonenMars/threadbase-mobile/pull/17) | `feat/tree-drill-new-session-path` | feat(tree): pre-fill new-session path with current drill directory | Real feature |
| [#18](https://github.com/RonenMars/threadbase-mobile/pull/18) | `feat/export-to-info-shelf` | refactor(conversation): move Export from bottom bar to info shelf | Real refactor |

---

## Conflict matrix

| PR | Hot files touched | Conflicts with |
|---|---|---|
| #12 | `app/conversation/[id].tsx`, `e2e/mock-server.js` | #18 (`[id].tsx`, mock), #14/#17 (mock) |
| #13 | `components/servers/DisplayedServersList.tsx` only | — |
| #14 | `app/index.tsx`, `TreeSessionsList.tsx`, `e2e/mock-server.js`, `package.json` | #17 (`app/index.tsx`, `TreeSessionsList`, mock, pkg), #12/#15/#18 (mock/pkg) |
| #15 | `components/terminal/TerminalOutput.tsx`, `package.json` | #14/#17/#18 (pkg) |
| #16 | docs only | — |
| #17 | `app/index.tsx`, `TreeSessionsList.tsx`, `app/browse.tsx`, mock, pkg | #14 (heavily), #12/#15/#18 (mock/pkg) |
| #18 | `app/conversation/[id].tsx`, mock, pkg | #12 (`[id].tsx`, mock), #14/#15/#17 (mock/pkg) |

### Hard conflict pairs
- **#14 ↔ #17**: both modify `app/index.tsx` AND `TreeSessionsList.tsx`
- **#12 ↔ #18**: both modify `app/conversation/[id].tsx`

### Soft conflict overlay
Everyone touches `e2e/mock-server.js` and `package.json`. These are mechanical (route additions + e2e chain extension).

---

## Merge order

### Wave 1 — Zero-conflict, ship immediately (parallel-safe)

Touch zero hot files; merge in any order with no rebase.

1. **PR #16** (Bug 5 diagnosis) — docs-only.
2. **PR #13** (server drag-reorder testID + Maestro) — touches only `DisplayedServersList.tsx`.

### Wave 2 — One hot file each, no overlap with each other

3. **PR #15** (PTY divider testIDs + tests) — `TerminalOutput.tsx` + `package.json`. Only conflict is `package.json` mock-test chain.
4. **PR #12** (Bug 6 testIDs + Maestro) — `app/conversation/[id].tsx` + mock + fixture.

Order: #15 then #12 — they don't overlap.

### Wave 3 — Rebase required

5. **PR #18** (Export → info shelf) — also touches `app/conversation/[id].tsx`. Must rebase on #12.
6. **PR #14** (tree server-headers testIDs + Maestro) — touches `app/index.tsx`, `TreeSessionsList.tsx`. Must rebase on `main` (mock + pkg).

#18 only after #12 lands.
#14 can land any time before #17.

### Wave 4 — Biggest rebase

7. **PR #17** (tree drill → new-session path) — depends on `app/index.tsx` and `TreeSessionsList.tsx` post-#14, plus mock/pkg post everything.

---

## Dependency DAG

```
#16 ──┐
#13 ──┤
#15 ──┤
#12 ──┴── (no deps)
       │
       ├─→ #18 (rebase: app/conversation/[id].tsx)
       │
#14 ───┴──── (rebase: mock + pkg from #12/#15)
              │
              └─→ #17 (rebase: app/index.tsx + TreeSessionsList from #14, mock + pkg from all)
```

---

## Per-PR rebase notes

- **#12, #13, #15, #16**: should merge clean off `main` as-is.
- **#14**: rebase after #12 + #15 land — only `e2e/mock-server.js` and `package.json` conflicts; both mechanical.
- **#18**: rebase after #12 — both edit `app/conversation/[id].tsx`. #12 adds testIDs to bottom bar + last message; #18 removes the bottom-bar Export and adds it to `InfoModal`. Likely overlap around the `<View>` that wraps the bottom action bar — pick one merge of testIDs that survives both. Also rebase `mock-server.js` + `package.json`.
- **#17**: largest rebase. Both `app/index.tsx` and `TreeSessionsList.tsx` collide with #14. #14 adds `serverId` to `ServerHeaderRow`; #17 carries `serverId` through `selectedDrill` shape. They're independent intents on the same files; should compose cleanly because they hit different lines. Plus mock + pkg.

---

## Special-case caveats

- **PR #14 has a known failing Maestro flow** (API Key field focus). Flagged in the PR body. Doesn't block merge if you accept the limitation; the source change (testIDs on `ServerHeaderRow`) is sound.
- **PR #16** changes nothing functional — review for spec accuracy, not code review.
- **PR #17** scope is "core behavior only" — A/B test and confirmation sheet are explicitly out of scope per the plan.
- All 7 PRs were authored by background agents. Verify commits don't have `Co-Authored-By` trailer (CLAUDE.md forbids it).

---

## Strategy: why Option A (Wave merge)

Considered alternatives:

| Option | Pro | Con |
|---|---|---|
| **A — Wave merge (chosen)** | Smallest rebase per PR; independent reviewer stories; surfaces conflicts early | 4 round-trips of CI / time |
| **B — Stacked PR rewrite** | GitHub shows the dependency | Stacks aren't first-class in GitHub; same rebase cost as A |
| **C — Integration branch** | One CI run for the whole set | If something breaks, harder to bisect; skips incremental review |

**Picked A** because: only #17 has a non-trivial rebase; the file-overlaps are at different line ranges so most are clean three-way merges; the 4-wave structure surfaces problems early.

---

## Execution checklist

- [ ] Wave 1
  - [ ] Merge #16 (docs-only)
  - [ ] Merge #13 (DisplayedServersList only)
- [ ] Wave 2
  - [ ] Merge #15 (TerminalOutput + pkg)
  - [ ] Merge #12 (conversation testIDs + mock + fixture)
- [ ] Wave 3
  - [ ] Rebase #18 on main, merge (depends on #12)
  - [ ] Rebase #14 on main, merge
- [ ] Wave 4
  - [ ] Rebase #17 on main, merge (depends on #14)
- [ ] Post-merge: verify `npm run typecheck`, `npm test -- --watchAll=false`, and `npm run test:e2e:mock` against a fresh-erased sim
