# Integration merge log — integration/2026-09-14-open-prs (real run) (2026-09-16)

**Status:** complete
**Goal:** publish the rehearsed integration branch (`docs/integration/2026-09-15-open-prs-refresh-rehearsal-log.md`) to `origin` so it can be tested/CI'd together, without opening a PR or touching `main`.
**Operator:** operator  **Repo:** tb-mobile  **Log started:** 2026-09-16 08:42 IDT

This is flow C (real run from a rehearsal), per the integration-branch skill. Mobile only. It does not re-derive the merge order or resolutions — it replays them after re-verifying the preconditions the rehearsal assumed. Where this log and the rehearsal disagree, this one wins.

---

## 1. Provenance and refs

| What | Ref | SHA | Note |
|---|---|---|---|
| Cut point (rehearsal) | `origin/main` | `58bbd07a` | recorded by the 2026-09-15 refresh rehearsal |
| Cut point (re-verified now) | `origin/main` | `58bbd07a` | `git fetch origin && git rev-parse origin/main` — unchanged |
| Integration branch (local, from rehearsal) | `integration/2026-09-14-open-prs` | `d4a27a51` | rehearsal tip including #1100 quiet-tail unique docs |
| Integration branch (pushed) | `origin/integration/2026-09-14-open-prs` | `d4a27a513496f612f7bf96d3fe41896874704924` | `git push origin integration/2026-09-14-open-prs` — new branch, no force |
| Backup of previous INT | — none | | no prior `integration/*` ref on origin |
| Worktree | `../tb-mobile-worktrees/int-2026-09-14` | | same worktree the rehearsal used; reused, not rebuilt |

### Environment provenance

Unchanged from the rehearsal — no new install or environment step; no merges were redone. See the rehearsal log §1.

---

## 2. Baseline — the state of `main` before anything landed

Not re-run. `origin/main` did not move (`58bbd07a` in both the rehearsal and this run), so the rehearsal's last full checkpoint (after #1094 wait-duration unique) still applies: lint green, typecheck green, unit 2239, integration 522 / 71 suites, i18n 460 passed / 1 skipped.

---

## 3. Scope — what is in, what is out

Precondition re-verification: `gh pr view` / `git fetch origin pull/<n>/head` against the rehearsal's last recorded origin unique, 2026-09-16 08:42 IDT.

| PR | Recorded head (rehearsal) | Current head (re-verified) | Match |
|---|---|---|---|
| #1085 | `b359c2bf` | `b359c2bf` | yes |
| #1088 | `f9706d72` | `f9706d72` | yes |
| #1089 | `bcddf5ef` | `bcddf5ef` | yes |
| #1091 | `e513e49f` | `e513e49f` | yes |
| #1092 | `d265535b` | `d265535b` | yes |
| #1093 | `ed866281` | `ed866281` | yes |
| #1094 | `b235b662` (origin tip after pathTail; rehearsal §6 last unique `5a5a3493`) | `b235b662` | yes vs last known origin tip |
| #1095 | `7653c38a` | `1dbd16ea` | **moved** — see below |
| #1096 | `0d186469` | `0852d3e5` | **moved** — see below |
| #1097 | `3f9eae33` | `3153aa01` | **moved** — see below |
| #1098 | `37f89433` | `4d0e3fab` | **moved** — see below |
| #1099 | `56d36b94` | `eb211b9b` | **moved** — see below |
| #1100 | `789cb7a5` | `789cb7a5` | yes |
| #1101 | `2498cf94` | `2498cf94` | yes |

#1095–#1099 heads moved because origin published INT follow-ups onto the stacked alert branches, which rewrote every child SHA. Unique feat patch-ids: #1096 `bedf9169` ≡ INT `a4efa150`; #1097 `3153aa01` ≡ INT `17d35c4a`; #1098 `4d0e3fab` ≡ INT `035b13b4`. #1095 feat and #1099 unique differ by patch-id because the rehearsal already resolved ledgers 8–16 and 17 onto INT. New origin follow-ups (`1dbd16ea` lastError shard, `0852d3e5` AuthError mock, #1094 `e2bce5e4`/`b235b662` pathTail) are already on INT (`f00e79ea`, `ca078370`, `9733ee0e`). No unique was missing, so nothing was re-rebased.

### Deliberate exclusions

| PR | Why excluded | Standing or one-off? |
|---|---|---|
| #952 jest-preset 0.87.1 | CI red; nothing in the set repairs an RN 0.87 bump | standing until green (same as 2026-09-12 / 2026-09-14) |
| #1039 react-native 0.87.1 | CI BLOCKED | same |

**Drafts:** none.

### Extra branches included (non-PR)

— none

---

## 4. Order plan

Unchanged from the rehearsal. See `docs/integration/2026-09-15-open-prs-refresh-rehearsal-log.md` §4.

**Final order:** `#1088 unique → #1091 unique → #1092 → #1093 → #1094 → INT follow-up → #1095 → #1096 → INT follow-up → #1097 → #1098 → #1099 → INT follow-up → #1094 wait-duration unique → INT pathTail → #1100 → #1101 → #1100 quiet-tail unique`

### Order changes made mid-run

— none

---

## 5. Action log (chronological)

### 08:42 — re-verify preconditions

- **Command:** `git fetch origin && git rev-parse origin/main`
- **Result:** `58bbd07a4639180e5269e0b39425c7568f958a0b` — matches rehearsal cut point exactly.
- **Note:** no re-cut needed. `git ls-remote origin 'refs/heads/integration/*'` was empty.

### 08:42 — re-verify PR heads

- **Command:** `gh pr list --state open` plus `git fetch origin +pull/<n>/head:refs/integration/pr/<n>`
- **Result:** #1085–#1094 (tip), #1100, #1101 match. #1095–#1099 moved (stack rewrite + published follow-ups). Deviation recorded in §3; no re-merge.

### 08:43 — confirm local branch/worktree state

- **Command:** `git rev-parse HEAD && git status --porcelain`
- **Result:** `d4a27a51`, clean tree. 56 commits ahead of `origin/main`.

### 08:43 — write list (executed)

- Push `integration/2026-09-14-open-prs` to origin (new branch, no `--force`).
- Do not force-push any PR head.
- Do not merge or close any PR.
- Do not delete any remote branch.
- Do not open a PR for the integration branch (skill requires separate consent).

### 08:44 — push integration branch to origin

- **Command:** `git push origin integration/2026-09-14-open-prs`
- **Result:** new branch created on `origin`, no conflicts, no force flag used.
- **Branch SHA after:** `d4a27a513496f612f7bf96d3fe41896874704924`

### 08:44 — confirm push landed

- **Command:** `git ls-remote --heads origin integration/2026-09-14-open-prs`
- **Result:** `d4a27a513496f612f7bf96d3fe41896874704924	refs/heads/integration/2026-09-14-open-prs`

---

## 6. Per-PR record

No PR was re-merged in this run. See `docs/integration/2026-09-15-open-prs-refresh-rehearsal-log.md` §6 for the per-PR rebase/verification record.

---

## 7. Conflict ledger

— none in this run (no merges). The rehearsal's ledger 1–24 carries over unchanged.

---

## 8. Semantic conflicts — problems git did not flag

— none investigated in this run; carried over from the rehearsal's §8. No new merges occurred.

---

## 9. Obstacles and detours

### O1 — #1095–#1099 origin heads moved after the rehearsal

- **Symptom:** Flow C precondition check would have treated the alert stack as stale.
- **Cause:** origin published INT follow-ups (`1dbd16ea`, `0852d3e5`) onto the stacked bases, rewriting every child SHA. Feat unique patch-ids for #1096/#1097/#1098 still match INT.
- **Fix:** compared unique patch-ids and the follow-up file trees against INT HEAD; no missing unique. Did not re-rebase.
- **Recurs?** yes — a stacked PR that absorbs an INT follow-up will always move its descendants.

---

## 10. Verification checkpoints

| Checkpoint | Integration SHA | Commits ahead of `main` | lint | typecheck | tests | Δ vs baseline |
|---|---|---|---|---|---|---|
| Rehearsal after #1100 quiet-tail unique | `a2f56bf9` / docs `d4a27a51` | 56 | targeted NowList/rowTitle/displayTitle 70/70; ProviderMark/providers 5/5 | not re-run | not re-run full | carried over |
| Real-run push | `d4a27a51` (identical tree) | 56 | — carried over | — carried over | — carried over | unchanged — same tree as rehearsal |

Full lint/typecheck/unit/integration/i18n were not re-run in this session. The tree is the rehearsal tip.

---

## 11. Decisions, open questions, deferrals

| # | Decision | Alternatives considered | Reversible? | Owner |
|---|---|---|---|---|
| 1 | Reuse the rehearsal branch/worktree as-is rather than re-cutting | Re-cut from scratch; re-rebase #1095–#1099 | yes — branch can be deleted on origin | operator |
| 2 | Treat #1095–#1099 SHA moves as published follow-ups, not missing uniques | Re-rehearse the whole alert stack | yes | operator |
| 3 | Did not open a PR for the integration branch, did not merge to `main` | Open a PR for CI visibility | n/a — deferred, requires separate consent | user |

| Open item | Why deferred | Next action | Owner | Tracked as |
|---|---|---|---|---|
| Whether to open a PR for `integration/2026-09-14-open-prs` | Skill requires explicit separate consent | Ask the user | operator | this log |
| Land the in-scope PRs individually onto `main` | This skill never merges to `main` | Rebase + squash-merge each PR in dependency order | user | this log |
| Standing exclusions #952 / #1039 | Red RN 0.87 Dependabot | Keep out until green | user | rehearsal + this log |

---

## 12. Coverage gate

Not re-run — unchanged from the rehearsal, since no PR was re-merged and the branch tip is identical.

---

## 13. Risk and rollback

- **Backup ref / archive tag:** none pushed — this push only added a new branch; it did not overwrite or force-push anything.
- **Abort mid-run:** `git push origin --delete integration/2026-09-14-open-prs` removes the pushed branch; the local worktree is untouched.
- **Restore:** re-run `git push origin integration/2026-09-14-open-prs` from `../tb-mobile-worktrees/int-2026-09-14` at `d4a27a51`.
- **Blast radius:** none to production — no PR was opened, no merge to `main` occurred. The only external effect is the existence of a new branch on `origin`.

---

## 14. Gaps in this log

- The five required checks were not re-run against the pushed tree in this session. Targeted suites from the rehearsal still apply; a full local or GitHub run is the way to remove that doubt.
- No CI was triggered on `origin` by this push (a branch with no PR does not trigger the required-checks workflow set).
- #1094 origin tip `b235b662` includes pathTail commits the rehearsal first applied as INT-only (`ca078370`, `9733ee0e`); they match origin by patch-id (`e2bce5e4`) / file tree (`pathTail.ts`).

---

## 15. Timeline

| Phase | Start | End | Elapsed |
|---|---|---|---|
| Precondition re-verification | 08:42 | 08:43 | ~1 min |
| Push + confirm | 08:43 | 08:44 | ~1 min |
| Log + summary write-up | 08:44 | 08:50 | ~6 min |

Total wall-clock: ~10 min. No conflicts resolved in this run.
