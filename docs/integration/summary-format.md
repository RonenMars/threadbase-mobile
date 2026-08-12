# Integration merge summary — standard format

The **summary** is written once, at the end, from the [log](log-format.md). It is the document
someone reads *instead of* the log: a reviewer deciding whether to merge, or the next operator
deciding how to run the next integration.

Filename: `docs/integration/<YYYY-MM-DD>-<branch-slug>-summary.md`, or `…-rehearsal-summary.md` for a
local rehearsal. A rehearsal summary is the input to the real run: its §3 order and §4 resolutions are
what the real run replays, so write it to be executed, not just read.

**Rules:**

- Derived from the log, never written in parallel with it. If a fact is not in the log, it does not go here.
- Every claim carries its evidence — a SHA, a command output, a PR number. An assertion with no evidence costs the next reader a re-investigation.
- Carries **conclusions**, not narrative. The narrative is the log; link to it.
- Fits on two screens. If it does not, the detail belongs in the log.
- No status duplication: open work lives in the issue tracker, and this file links to it.

---

## 0. Header and verdict

```markdown
# Integration summary — <branch> (<date>)

**Verdict:** ready to land | needs work | abandoned
**Branch:** `integration/…` @ `abc1234` — <N> PRs, <M> commits ahead of `main` @ `def5678`
**CI:** <12/12 green | which checks, which failed>
**Full log:** [<date>-<slug>-log.md](<date>-<slug>-log.md)
```

One paragraph: what was integrated, what state it is in, and the single thing a reader must know
before touching it.

---

## 1. Final refs

| What | Ref | SHA |
|---|---|---|
| Integration branch | | |
| Cut from | `origin/main` | |
| Backup / archive | | |

---

## 2. What is in the branch

| PR | Title | Effect in one line |
|---|---|---|

### Not included

| PR / branch | Why | Standing exclusion? |
|---|---|---|

An exclusion without a reason will be re-attempted next run. Mark the standing ones — they belong
in the skill's permanent exclusion list, not just in this file.

---

## 3. The order that actually worked

The reusable output of the whole run. Chronological order is the default; everything below is a
deviation from it and must survive into the next integration.

**Final order:** `#442 → #444 → …`

| Constraint | Kind | Reason |
|---|---|---|
| #456 after #448 | stacked | #456's base is #448's head; its second commit fixes the pair |
| #281 immediately after #275 | forced | #275 introduces a lint error #281 clears — lint is red in between |

If the executed order differed from the plan, say where and why in one line each.

---

## 4. Conflicts that mattered

Only the judgment calls (`J` rows in the log's ledger). Mechanical resolutions are noise here.

| Conflict | Kept | Discarded | Rule applied | How you would know it was wrong |
|---|---|---|---|---|

---

## 5. Silent problems found (and the ones still possible)

Semantic conflicts git did not flag — what was found, and equally: which sweeps were run and came
back clean, so the next reader knows what is already covered.

| Found | Where | How it was caught |
|---|---|---|

**Sweeps run clean:** … · **Sweeps not run:** …

---

## 6. Verification

| | Baseline (`main`) | Final (integration) | Δ |
|---|---|---|---|
| Lint | | | |
| Type check | | | |
| Unit tests | | | |
| Integration tests | | | |
| i18n | | | |
| Native deps / build | | | |

The first five are the checks that gate `main`; a summary reporting fewer has not established the
branch is green. Maestro E2E never runs on a PR — if the set touches a flow, say whether it was
dispatched by hand and what it returned, or record it as not run.

**Not verified:** state it plainly — which platforms, which suites, which behaviours were only
inspected rather than executed, and whether a real iOS/Android build was produced at all. A
verification gap named here is cheap; found later it is a rollback.

---

## 7. Obstacles worth remembering

Only the ones that will recur. Each with the fix, and whether it should become automation.

| # | Obstacle | Fix | Recurs? | Automate? |
|---|---|---|---|---|

---

## 8. Follow-ups

Open work leaving this run. Tracked in the issue tracker — this table links, it does not own status.

| Item | Why it is open | Next action | Owner | Issue |
|---|---|---|---|---|

---

## 9. Rules learned

The takeaways that change how the next integration is run — phrased as instructions, not observations.
These are the candidates to fold back into the integration skill and into `CLAUDE.md`.

- …

---

## 10. Cost

Wall-clock total, PR count, conflicts resolved, and the three biggest time sinks by name.
The input to deciding whether the next run is worth doing this way.
