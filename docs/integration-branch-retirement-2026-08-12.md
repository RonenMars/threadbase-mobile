# Integration branches — retirement and stale-ref audit, 2026-08-12

Closes the decision left open by [`followups/repo-health/06-integration-branch-decision.md`](./followups/repo-health/06-integration-branch-decision.md), and records what remains.

Companion to [`integration-to-main-2026-08-09.md`](./integration-to-main-2026-08-09.md), which logs the merge run itself.

## Decision: retired

The long-lived integration branch is gone. Every open PR was landed on `main` individually instead — 20 merged, 4 closed unmerged — and `main` was shipped from that state as build 198 / versionCode 50.

Brief 06's two open items are both closed:

| Item | Outcome |
| --- | --- |
| Record a decision — retire, or keep under two rules | **Retire.** Executed 2026-08-09 → 2026-08-11 |
| #575 and #580 need a path that is not manual conflict resolution | **Closed unmerged.** Their content was already on `main` via #578/#579, verified byte-identical against their own commits' file sets — no conflict to resolve |

The branch that replaced it, `integration/fresh-2026-08-09` (`e4f6056c`), was itself retired once `main` held its content. That is the intended lifecycle: an integration branch is a staging area with an expiry, not a parallel trunk.

## What was deleted

| Ref | SHA | Scope |
| --- | --- | --- |
| `integration/fresh-2026-08-09` | `e4f6056c` | remote + local |
| `integration/open-prs-291-544-…-568-569` (the branch brief 06 is about) | `0a4dd2d5` | remote + local |
| `integration/open-prs-291-544-…-568` | `d33ef5f4` | remote |
| `integration/2026-08-08-1740-prs-544-…-560` | `07376543` | remote |
| `integration/open-prs` | `9580ddfe` | remote |
| `integration/open-prs-544-551-553-554-556` | `5079c28d` | local only |

Two worktrees holding them were removed with them.

**Retained deliberately:**

```
origin/backup/int-mobile-2026-08-09-fresh      0a4dd2d5   # identical to the old INT
origin/backup/integration-open-prs-2026-08-09  60aef087   # the pre-#577-revert state
```

Deleting the old INT cost nothing because `backup/int-mobile-2026-08-09-fresh` points at the same commit. The second backup is genuinely distinct — it predates the #577 jest/TypeScript revert.

## The audit that made deletion safe

The question for each ref is not "is it merged" — none of these are ancestors of `main`, because every PR that fed them was squash-merged under a new SHA. The question is **does it hold a file that `main` has never had.**

```bash
# for each candidate ref: files present there and absent from main, ignoring docs
git diff --diff-filter=A --name-only origin/main "$REF" | grep -v '^docs/' |
while read -r f; do
  # empty result = main never deleted it = main never had it
  [ -z "$(git log --diff-filter=D -1 --format=%h origin/main -- "$f")" ] && echo "NEVER on main: $f"
done
```

Across all 16 surviving integration-named refs: **zero files were ever unlanded.**

| Ref | SHA | Last commit | Non-doc files not on `main` | Never on `main` | Remote |
| --- | --- | --- | --- | --- | --- |
| `27-07-2026.09-47-integration` | `28b13601` | 2026-07-27 | 17 | **0** | local only |
| `archive/26-07-2026.18-44-integration` | `eb330e71` | 2026-07-31 | 17 | **0** | yes |
| `chore/cherry-pick-sentry-fix-onto-integration-prep` | `57a3852a` | 2026-07-31 | 17 | **0** | local only |
| `feat/in-chat-search-integration` | `0ce45291` | 2026-07-23 | 19 | **0** | local only |
| `feat/live-external-sessions-integration` | `e87619c6` | 2026-07-23 | 18 | **0** | yes |
| `fix/diff-viewer-full-width-lines-integration` | `1f255696` | 2026-07-26 | 17 | **0** | local only |
| `fix/integration-branch-ci-failures` | `422709d5` | 2026-07-25 | 19 | **0** | yes |
| `integration-dev-merge-sim` | `33ecfc31` | 2026-07-23 | 19 | **0** | local only |
| `integration-dev-merge-sim-2` | `33ecfc31` | 2026-07-23 | 19 | **0** | local only |
| `integration-dev-merge-sim-3` | `33ecfc31` | 2026-07-23 | 19 | **0** | local only |
| `integration-dev/v1.0.0-2026-07-22` | `5502eb34` | 2026-07-23 | 19 | **0** | local only |
| `integration-dev/v1.0.0-df91938-2026-07-22` | `c9a78cd4` | 2026-07-22 | 18 | **0** | local only |
| `integration-merge-354-355-376` | `597f0293` | 2026-07-25 | 19 | **0** | local only |
| `integration-merge-354-355-376-v2` | `a2e94002` | 2026-07-26 | 17 | **0** | yes |
| `integration-merge-354-355-376-v2-rebased-main` | `7bfd942d` | 2026-07-26 | 17 | **0** | local only |
| `land/integration-prep` | `28c0c374` | 2026-08-01 | 16 | **0** | yes |

`integration-dev-merge-sim`, `-2` and `-3` are three names for one commit.

### What those 16–19 files actually are

The same set every time — content `main` **deliberately removed**:

| Content | Removed from `main` by |
| --- | --- |
| ~16 Maestro flows (`e2e/shots-0*.yaml`, `live-chat-tab.yaml`, `keyboard_session_input.yaml`, `servers_status_dots_menu.yaml`, …) | **#531** `test(e2e): delete the maestro flows that nothing runs` — a PR whose entire purpose was deleting them |
| further `e2e/*.yaml` including `codex_parity_real.yaml` | `243d5be4` |
| `crash-log.txt`, `log-mobile.txt` | #458 — stray logs |
| `KICKOFF-landing-runbook.md` | **#474** `docs: retire the landing kick-off…` |

So these branches are pre-cleanup snapshots. **Opening a PR from any of them would revert #531, #474 and #458** under a title that reads like recovery. That is the specific reason none of them should be "merged back".

**Security consequence.** `e2e/live-chat-tab.yaml` carried an API key as an `-e "API_KEY=…"` example. #531 removed it from `main` by deleting the flow, but the stale branches predate that deletion and still carry it — verified directly:

```
$ for b in land/integration-prep integration-merge-354-355-376-v2 archive/26-07-2026.18-44-integration; do
    git show "${b}:e2e/live-chat-tab.yaml" | grep -c API_KEY; done
3
3
3
```

Retiring these refs reduces how many places hold that blob, but **it does not remediate it** — the key is in history that any existing clone already has. Rotation is the fix; deletion is hygiene.

### `integration-merge-android-r8` — a misnamed commit

A detached worktree sits at `f2242bc4`, titled `fix(android): pin expo-modules-core for R8 ColorCompat`. It contains **no Android code**. Its entire diff is four `SPEC CHECKSUM` lines in `ios/Podfile.lock`:

```
ExpoModulesCore  71242aac → a4d8d4e5
ExpoModulesJSI   ef7f197a → b20fefa4
ExpoModulesWorklets …
ExpoModulesWorkletsAdapter …
```

That is the path-dependent pod noise documented in `CLAUDE.md`, not a fix. Anyone searching for that R8 fix on the strength of the commit subject will not find it, because it was never written here.

## Recommendation

**Drop all 16, local and remote. Do not open a PR from any of them.**

Two need an owner's nod rather than an audit result, and are held back pending that:

- `archive/26-07-2026.18-44-integration` — explicitly named *archive*, so someone may intend it as a keepsake. It is empty of unlanded content either way.
- `feat/in-chat-search-integration`, `feat/live-external-sessions-integration` — **feature** branches that merely contain the word "integration". They belong to feature work, not to this rollup effort, and should be judged on that basis.

## The method note worth keeping

Two checks in this audit return a confident wrong answer rather than an error, and both were hit here:

**A branch-name glob is a filter, not an inventory.** `git branch -a --list '*integration/*'` reported **zero** remaining branches, and that was reported as fact. It matches only refs with a literal `integration/` — every hyphenated name (`integration-merge-…`, `integration-dev-…`, `land/integration-prep`) was invisible to it. The true count was 23 refs. Use `git branch -a | grep -i <word>` when the question is "what exists", and reserve globs for when the pattern *is* the question.

**"Not an ancestor of `main`" does not mean "unlanded".** Squash-merging gives the landed content a new SHA, so ancestry calls every merged PR unlanded. The file-level "was it ever deleted from `main`" test above is what actually answers it. This is the same trap recorded in [`troubleshooting.md`](./troubleshooting.md) → "CI signals", where four tools in one day each returned a plausible wrong answer instead of failing.
