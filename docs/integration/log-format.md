# Integration merge log — standard format

The **log** is written *during* the merge, in real time, one append per action.
It is the primary record: the [summary](summary-format.md) is derived from it, never the other way round.

Filename: `docs/integration/<YYYY-MM-DD>-<branch-slug>-log.md`, or `…-rehearsal-log.md` for a local
rehearsal. A real run that replays a rehearsal gets its **own** log citing the rehearsal's, rather than
editing it — and where the two disagree, the real run wins.

**Rules that make the log worth keeping:**

- Append as you go. A log reconstructed at the end has already lost the obstacles — that is where the value is.
- Every number, SHA and count is quoted from a command that was actually run, not from memory of having run it.
- "No conflict" is a claim. Record the command that established it.
- When you skip a section, write `— none` under it. A missing section reads as "not investigated"; `— none` reads as "checked, empty".
- Sections 1–7, 10 and 12 are required. The rest are fill-when-applicable but must carry `— none`.

---

## 0. Header

```markdown
# Integration merge log — <integration branch> (<date>)

**Status:** in progress | complete | abandoned
**Goal:** one sentence — what this branch is for and what "done" means.
**Operator:** <who/which session>  **Repo:** <name>  **Log started:** <YYYY-MM-DD HH:MM TZ>
```

---

## 1. Provenance and refs

Every ref this run depends on, with the SHA it had **when the run started**. A stale `origin/main`
silently produces a branch that is not from today's `main`, with no error at any point — this table is
what catches it.

| What | Ref | SHA | Note |
|---|---|---|---|
| Cut point | `origin/main` | `abc1234` | re-fetched immediately before cutting |
| Base PR branch | `feat/x` (#441) | `def5678` | earliest PR — the branch was cut from here, then rebased onto `main` |
| Integration branch | `integration/…` | `—` (filled at end) | |
| Backup of previous INT | `backup/…` | `789abcd` | pushed before anything was cut; never deleted |
| Archive tag | `archive/…` | `789abcd` | annotated |
| Worktree | `../<repo>-worktrees/<name>` | | own `npm ci` — never a copied `node_modules` |

### Environment provenance

Often the difference between "the merge broke it" and "this box breaks it". Record it once, at the top.

| Item | Value |
|---|---|
| OS / arch | |
| node / npm | from `.nvmrc`? yes/no |
| `git` / `gh` | |
| `node_modules` | `npm ci` at `<sha>` / copied from `<path>` |
| Xcode / CocoaPods | only when the set touches `ios/`, `patches/` or a native dep |
| Pods / prebuild state | `pod install` run? `expo prebuild` re-run? |
| `npm run check:native-deps` | pass / fail — duplicate native modules are invisible to Jest |
| Host load at baseline | `uptime` — a saturated box makes every timing look pathological |

On mobile "the suite is green" and "the app builds" are different questions, and Jest answers only the
first. Any set touching `ios/`, `android/`, `patches/` or a native dependency needs a real build before
the branch is called good, and the log should say whether one was run.

---

## 2. Baseline — the state of `main` before anything landed

**Measure before you merge.** If `main` is already red, every later count is a delta against
that, not an absolute. Skipping this is how a pre-existing failure gets attributed to a merge.

| Check | Command | Result |
|---|---|---|
| lint | `npm run lint` | green / N errors |
| typecheck | `npm run typecheck` | |
| unit | `npm run test:unit` | `N failed / M passed / K skipped` |
| integration | `npm run test:integration` | |
| i18n | `npm run test:i18n` | |
| scripts | `npm run test:scripts` | only when `scripts/` is in the set |
| native deps | `npm run check:native-deps` | only when a native dep, `patches/` or `ios/`/`android/` is in the set |

**All five of the required suites, every time — `test:unit` alone is a false green.** Integration is
where a changed guard on a shared function actually shows, and it is a separate Jest run: a set can be
green on unit and broken on integration without a single warning. The five that gate `main` are Lint,
Type check, Unit tests, Integration tests and i18n.

Known-flaky before the run: list them by file, or `— none`. Anything not on this list that
fails later is caused by the integration.

---

## 3. Scope — what is in, what is out

| PR | Title | Head branch | Head SHA | Base | Draft? | Mergeable | CI on PR |
|---|---|---|---|---|---|---|---|

- `mergeable` from a bulk `gh pr list` returns `UNKNOWN` — query each PR individually or the column is noise.
- `isDraft` is invisible in the readiness fields; ask for it by name or a draft looks perfectly mergeable.
- A branch with no remote counterpart has no CI to read. Write "no remote — unverified"; an empty cell
  reads as green.
- Where a red CI was cleared by another member of the set, the pair belongs in §4 as a forced-order
  constraint, not just as a note here.

### Deliberate exclusions

Anything not merged, and **why**, in one line each. An exclusion with no recorded reason gets re-litigated
next run.

| PR | Why excluded | Standing or one-off? |
|---|---|---|

### Extra branches included (non-PR)

Local or remote branches merged alongside the PRs. Each needs a reason and an owner, because nothing
on GitHub is tracking them.

| Branch | SHA | Why included | Has a PR? |
|---|---|---|---|

---

## 4. Order plan

State the planned order **and the reason it is not simply chronological**. Chronological order is the
default; dependency order overrides it.

**Planned order:** `#442 → #444 → #446 → …`

### Stacked PRs

A PR whose base is another PR's head, not `main`. Merge the base first, and never drop the child's
own commits — they frequently fix the base/child interaction and exist nowhere else.

| Child PR | Stacked on | Base branch | Commits unique to the child | Risk if merged out of order |
|---|---|---|---|---|

### Forced-order constraints (not chronological)

A PR that must land before or after another for a reason other than age — a lint error one PR
introduces and another clears, a refactor that moves the code a later PR edits, a dependency bump
superseded by a newer one.

| Must land | Before/after | Reason | What breaks if ignored |
|---|---|---|---|

### Order changes made mid-run

Reordering is normal; silent reordering is not. Log each change with the trigger.

| When | Moved | From → to | Trigger |
|---|---|---|---|

---

## 5. Action log (chronological)

The running journal. One entry per action, appended immediately. This is the section that answers
"what did you actually do, and in what order".

```markdown
### <HH:MM> — <action in one line>

- **Command:** `git merge --no-ff refs/integration/pr/447`
- **Result:** conflict in `services/sessions.ts` (3 hunks) → ledger #7
- **Branch SHA after:** `1a2b3c4`
- **Note:** …
```

---

## 6. Per-PR record

One block per PR, filled as it lands. Rebase results, conflicts and verification belong here;
the ledger (§7) holds only the conflict detail.

```markdown
### #447 — fix(sessions): keep the status badge in sync after a hold

| Field | Value |
|---|---|
| Head before / after rebase | `3fb1152` → `1eb9764` |
| Rebased onto | `#446` head `6f4745e` |
| Conflicts | `app.json` build number ×1 → ledger #3 |
| Diff scope after rebase | identical to `gh pr diff 447 --name-only` |
| Integration SHA after merge | `de82c65` |
| Verification | lint · typecheck · unit · integration · i18n all green · native-deps n/a |
| Obstacles | O2 |
| Time | 12 min |
```

**"Diff scope after rebase" is not optional.** A rebase that silently widens or narrows a PR's file
set is the failure that survives every green check.

---

## 7. Conflict ledger

Every conflict git raised, numbered, with a **class**. The class is what makes the ledger reusable:
mechanical resolutions can be trusted next run, judgment calls cannot.

| # | PR | File | Hunks | What collided | Resolution | Class | Oracle | Verified by |
|---|---|---|---|---|---|---|---|---|
| 1 | #578 | `services/sessions.ts` | 3 | … | … | M / J | prior INT branch resolved identically | `test:integration` |

Two classes recur in this repo and are worth naming in advance:

- **Version bumps** — `app.json`, `ios/` build number, `android/` `versionCode`, `package-lock.json`.
  Nearly every pair of PRs collides here and the rule is always the same: take the higher value, never
  hand-merge the lockfile. Mechanical, and not worth a paragraph each time.
- **Native deps and `patches/`** — never mechanical, whatever the diff looks like. A resolution here is
  only verified by `npm run check:native-deps` plus a real build; Jest passing proves nothing about it.

- **M — mechanical:** one side is a strict superset, or the rule is obvious (keep both, take newer lockfile).
- **J — judgment:** a real either/or where information was lost. Every `J` row needs the alternative
  recorded, not just the winner — otherwise the next reader cannot tell it was a choice.
- **Oracle:** an independent source that resolved the same collision — a previous integration branch,
  the PR author, a landed commit. Say so; it converts a judgment call into a check.

### Judgment calls in full

For each `J` row: what was kept, what was discarded, what the discarded side was trying to do, and
what would signal the choice was wrong.

---

## 8. Semantic conflicts — problems git did *not* flag

**The section most integration logs are missing, and the one that costs the most later.** A clean
three-way merge routinely produces wrong code: one PR extracts a function while another edits the old
body, and both sides apply without a marker. `tsc` does not catch it. Tests catch it only if a test
covered that path.

Run these sweeps after any merge touching a refactor, and record the result even when it is clean:

| Sweep | What it catches |
|---|---|
| For each function moved/extracted by any PR in the set, grep its call sites | Guards and side effects silently dropped from the new call path |
| `git diff <pr-head> <integration> -- <pr's files>` | Content from the PR that did not survive |
| Blanket per-file resolutions (`--ours`/`--theirs` on a whole file) — list every one | A whole-file pick deletes unrelated additions from the losing side |
| Behaviour flags/env vars introduced by the set — confirm each is still read | Wiring lost in a merge |

| # | Where | What was silently lost/changed | Found how | Fix |
|---|---|---|---|---|

---

## 9. Obstacles and detours

Numbered, so later sections and the summary can cite them. Include the ones you worked around and
the ones you lost time to — the cost is the signal for whether to automate it.

```markdown
### O3 — `git fetch origin --prune` deletes every `origin/pr/*` ref

- **Symptom:** PR head refs vanish mid-run; merges resolve to stale SHAs.
- **Cause:** `--prune` removes refs with no counterpart in the remote's advertised set.
- **Fix:** fetch PR heads into a private namespace: `refs/integration/pr/<n>`.
- **Cost:** ~20 min.
- **Recurs?** yes — every run. Bake into the procedure.
```

---

## 10. Verification checkpoints

One row per checkpoint, not one row at the end. A checkpoint that went red identifies the PR that did it.

| Checkpoint | Integration SHA | Commits ahead of `main` | lint | typecheck | tests | Δ vs baseline |
|---|---|---|---|---|---|---|

**Report the delta, not the absolute.** `28 failed` means nothing if the baseline was `35 failed`.

---

## 11. Decisions, open questions, deferrals

| # | Decision | Alternatives considered | Reversible? | Owner |
|---|---|---|---|---|

Open questions and deferred work each need a **next action and an owner**, or they are not tracked,
they are just written down.

| Open item | Why deferred | Next action | Owner | Tracked as |
|---|---|---|---|---|

---

## 12. Coverage gate

Proof the branch contains every PR it claims to. Run before opening any PR against `main`.

For each PR: `gh pr diff <n> --name-only` vs the same paths on the integration branch.

| PR | Files reported missing | Hand-verified verdict |
|---|---|---|

**A coverage audit's "missing" list is not a verdict.** It false-negatives whenever a later PR edited
the same files, so every reported miss must be hand-checked. Record the false negatives by name —
the next run will hit the same ones.

---

## 13. Risk and rollback

- **Backup ref / archive tag:** …
- **Abort mid-run:** exact commands to get back to a clean tree.
- **Restore:** how to recreate the pre-run state from the backup.
- **Blast radius:** what a wrong resolution in this set would break in production, and how it would show.

---

## 14. Gaps in this log

Honest limits, written last. What was specified but never run, what was verified by inspection rather
than by execution, which claims rest on a single observation. A log that claims completeness it does
not have is worse than a short one.

---

## 15. Timeline

| Phase | Start | End | Elapsed |
|---|---|---|---|

Total wall-clock, and the three biggest time sinks by name. This is the input to deciding what to
automate before the next integration run.
