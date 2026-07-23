# Landing runbook — getting the open PR chain onto `main`

**Source:** [`../integration-merge-report-2026-07-22.md`](../integration-merge-report-2026-07-22.md). Conflicts are named **A–I** and the two carry-beyond hazards live under "Standing hazard" there. The report is a **run log**: **Run 2 is current, Run 1 is superseded** — never carry a Run 1 resolution forward.
**Status:** live procedure — edit it as PRs land.

The integration branch `integration-dev/v1.0.0-2026-07-22` proves these PRs *can* coexist and land green as a set. It does not land them. Each still goes onto `main` one at a time under the repo's rebase + squash rule, and **conflicts A–I recur when the same two branches meet on `main`.** This document maps them to an order so nobody meets them cold — but its single most important message is that the report records what *was* true at the snapshot, and every resolution is perishable: Run 2 itself watched `#341`'s six-file conflict *vanish* once its branch was rebased onto `#339`, and conflict **A**'s resolution depended on a byte-identical precondition that no longer holds (see below). **Re-verify the precondition, then apply the resolution — never the reverse.**

## Who should run this

Not uniform. Three phases are mechanical rebase-and-squash; two contain conflicts that git resolves *cleanly while deleting code*, where the only signal is a `tsc` error you have to already expect.

| Phase | Character of the work | Model | Effort |
|---|---|---|---|
| **A** — mechanical independents | Rebase, check a *fresh* CI, squash. No documented conflict. | **Sonnet 5** (`claude-sonnet-5`) | **medium** |
| **B** — cache stack + live sessions (`#339`, `#341`, `#346`, `#354`) | Conflict **A** (must be rebuilt by hand now — see traps), one stacked `--onto` pair, and the `#354 × #346` navigation trap. | **Opus 4.8** (`claude-opus-4-8`) | **high**, **xhigh** for `#354` |
| **C** — i18n / onboarding locale cluster (`#356`, `#357`, `#360`, `#362`, `#364`, `#368`) | Conflicts **C, E, F, G, H, I**, including **F**, a locale-key deletion git applies with *no conflict marker*. Failure here is *absence*. | **Opus 4.8** (`claude-opus-4-8`) | **xhigh** |
| **D** — docs (`#347`, `#358`, `#372`) | Conflict **D** (`BACKLOG.md` + a `</details>` repair). Textual, predictable. | **Sonnet 5** (`claude-sonnet-5`) | **medium** |

**On effort.** Not `low` even for the mechanical phases: every phase ends in an irreversible squash to `main`, and `low` is where "CI is green, ship it" wins over checking *which commit* CI tested — and on this repo a `[skip-ci]` head commit makes the required checks report green in seconds having run *nothing* (see "Known traps"). Phase C is `xhigh` on purpose and it is the one place the extra deliberation earns its cost: the dangerous outcome there is a clean auto-merge, a green `tsc` *on a stale pre-rebase run*, and a locale file quietly missing keys. Nothing prompts you to look — you have to already know to re-run `tsc` on the freshly rebased branch and grep for the keys. That is a "read this specific file and compare against a list" task; `xhigh` buys the patience to do it rather than assume. Not `max` anywhere — noticing an absence is not something more tokens per step buys.

**Do not use Haiku for any phase.** Every phase ends in a squash-merge to `main`, and Phases B and C require deciding whether a green signal is trustworthy — the Run 2 log records four genuinely-broken suites nearly dismissed as flakes and two real load artifacts, indistinguishable in batch output.

**Operating constraints:**

- **One PR per session.** Context exhaustion mid-merge is how a resolution gets half-applied. Phases B and C deserve a fresh context per PR.
- **Never parallelise.** Each squash advances `main` and stales the next branch; two in flight guarantees a stale rebase. Rebase → wait for green → squash → move on.
- **Worktree must live outside `.claude/`.** A worktree under `.claude/` is excluded by `testPathIgnorePatterns`, so `npx jest` finds **0 tests** and the suite looks broken when it is not. This session used `worktrees/merge-prs-v2`. Each worktree needs its own `npm ci` (~3 min, 1292 packages).
- **Verify heavy suites serially.** `npx jest --ci --runInBand --testPathPattern "SessionScreen"`. A load artifact and a real defect look identical in batch output — **re-run any single failure in isolation before calling it a flake.** Passes alone → artifact. Fails alone → real, fix it.
- **Verify, do not infer.** A blocked compound shell command runs *none* of its parts; a negative `grep` may mean the wrong working directory or path (this session's first `#355` comparison reported `DIFFER` only because the path `lib/mergeLiveMessages.ts` was wrong — the file is `utils/mergeLiveMessages.ts`).

## Before starting — decide these once

| PR | Decision |
|---|---|
| **#291** `typescript 6 → 7` | **Excluded.** Standing request. It is `BLOCKED` on a failing `Lint` regardless; do not touch it. |
| **#355** `feat/live-external-sessions-integration` | **Close as superseded by `#354`.** Both are the mobile counterpart to streamer #253; the four core files are byte-identical, so closing loses no live-session capability, while `#355` (built on the superseded `bfc800d-2026-07-20` snapshot) is *missing* the ar/he/ru take-over translations `#354` carries and its only extra content is pre-formed cross-PR glue (the `#341 ∪ #354` union in `api-client.ts`, `#339`/`#341`'s `cache_alert` frames) that is not functionality and re-forms as conflict **A**. **Re-verify before closing** (perishable): `git rev-parse origin/feat/live-external-sessions:<f>` vs `origin/feat/live-external-sessions-integration:<f>` for `hooks/useConversationStream.ts`, `utils/mergeLiveMessages.ts`, `lib/externalSession.ts`, `app/conversation/[id].tsx` — all four hashes must match; and `#354`'s `locales/ar/conversation.json` must carry the two `takeOver` keys `#355` lacks. Verified 2026-07-23: 4/4 identical, `#354` = 2 keys, `#355` = 0. |
| **#373** `chore/deps-update-podfile-lock-2026-07-22` | **Land — but note it postdates the snapshot.** It was opened after Run 2 was cut and is therefore **not** one of the 20 PRs the report integration-tested. It is `ios/Podfile.lock` only (`MERGEABLE`/`CLEAN`), so the risk is low, but confirm it is still wanted before spending a squash on it. Not in Phase A/B/C/D conflict scope; land it as a mechanical independent. |

**Count — the runbook is authoritative here.** **23 PRs are open** as of 2026-07-23 (the report's era had 21; `#373` and `#376` are both new since). `#376` is separate follow-up work, not part of this chain — see "Follow-up PRs" at the end. Run 2 merged **20** distinct PRs into the snapshot — confirmed by `git log --merges origin/main..HEAD`: `#339 #341 #343 #345 #346 #347 #353 #354 #355 #356 #357 #358 #359 #360 #361 #362 #363 #364 #368 #372`. The report's merge-log **table lists only 19** — `#372` (`docs/jest-suite-verification`) is merged and named in the prose but absent from the table. After excluding `#291` and closing `#355`, and adding the new `#373`, **20 PRs land.**

## Pre-flight

Sweep every open PR for mergeability and red checks before landing anything. Two blockers were sitting in the Run 2 set when it looked ready and neither was visible from a green integration branch.

```bash
nums="291 339 341 343 345 346 347 353 354 355 356 357 358 359 360 361 362 363 364 368 372 373"
for n in $nums; do gh pr view $n --json mergeable -q .mergeable >/dev/null 2>&1; done   # pass 1: triggers lazy compute
for n in $nums; do
  gh pr view $n --json number,mergeable,mergeStateStatus,statusCheckRollup \
    -q '"\(.number)|\(.mergeable)|\(.mergeStateStatus)|\([.statusCheckRollup[]?|select(.conclusion=="FAILURE")|.name]|join(","))"'
done   # pass 2: real values
```

**Run it twice.** GitHub computes mergeability lazily; the first `gh pr view` only *triggers* the computation and the bulk value comes back `UNKNOWN`. The second pass returns real states. Expect most PRs to read `BEHIND` — normal, handled by step 1 of the loop. You are hunting for `CONFLICTING`/`DIRTY` or a non-empty failing-checks column.

Also re-list open PRs (`gh pr list --state open`) and diff the number set against the 22 above — a PR that appeared since (as `#373` did) means the branch set moved and this runbook's counts need re-confirming.

Found this way, 2026-07-23: **`#291`** `BLOCKED` on failing `Lint` (excluded — ignore). **`#355`** `UNSTABLE` with `Integration tests` failing — that is the inherited `#346` `useNavigation` failure, and it is moot because `#355` is being closed. Everything else `MERGEABLE`/`CLEAN`, including `#341` (`CLEAN` **with a full green check suite** — see "Stacked pairs", this repo is not like others).

## The per-PR loop

Run this for one PR at a time. Never two in parallel.

1. `git fetch origin && git rebase origin/main` on the PR branch. **Rebase immediately before merging, not in advance** — see "Moving target".
2. Resolve conflicts using the matching entry (**A–I**) in the report. **Re-verify that entry's stated precondition first** — do not apply a resolution whose precondition no longer holds. If the conflict is not one of A–I, stop (see "Stop points").
3. If either side extracted code into a method, or you resolved a locale conflict, **read the resolved file, not just the marker.** Conflict markers only show the call site; the silent trap (**F**) shows no marker at all. See "Known traps".
4. `npx eslint <staged>` (per repo rule), then `npx tsc --noEmit`, then the affected suites (`--runInBand` for `SessionScreen.*`).
5. `git push --force-with-lease` (never plain `--force`, never force-push `main`).
6. Wait for a **fresh, non-`[skip-ci]`** CI run to go green. If red on a suspected flake, re-run **once**; if still red, stop and report.
7. `gh pr merge <N> --squash --delete-branch`. Conventional title, no AI attribution.
8. If the merged PR was the base of a stacked PR, immediately `--onto` rebase the child (see "Stacked pairs").

## Stop and wait for approval

If an agent is running this unattended, these are hard stops. Present the evidence and wait; do not batch several past a stop.

**Always stop before** (irreversible or outward-facing):

1. **Any squash-merge to `main`** (step 7). The only irreversible step, and it changes a shared branch. Show: PR number, squash title, CI state (and that it was a *fresh, non-`[skip-ci]`* run), and — for Phases B/C — the result of the trap check.
2. **Any commit.** Repo rule, no exceptions: show `git diff --staged` and the exact message, then wait — even when told "just commit it".
3. **Any force-push** (step 5), including `--force-with-lease`. State what is being rewritten and why the rewrite is safe.
4. **Closing `#355`.** Closing is a judgment about someone's work. Present the re-verified byte-identical evidence from the decide-once table first.

**Stop and ask when the situation is not the one this runbook describes** — these matter most, because they are where an agent confidently does the wrong thing:

5. **A conflict that is not one of A–I**, or an A–I conflict whose stated precondition no longer holds (e.g. the pre-merge file is *not* byte-identical to what conflict A assumes). Report the files and hunks; do not improvise.
6. **A trap check that comes back missing** — the `connect.step1`/`step2` keys absent from any of the 4 onboarding locales after the cluster merges; the `api-client.ts` union missing `warmupState` *or* the 409 `ConversationBusyError` branch; the `SessionScreen.externalGate` suite red after both `#346` and `#354` are on `main`. A missing check means the resolution was wrong.
7. **CI red after exactly one re-run.** One re-run for a suspected flake, then stop. Before calling anything a flake, re-run the single suite in isolation with `--runInBand`.
8. **Pre-flight finds a blocker not listed here** — any `CONFLICTING`/`DIRTY` beyond `#291`, any new red check, or a new PR number in the open set. The branch set moved.
9. **A verification claim that cannot be proven mechanically.** If you cannot show a resolution is lossless (tree-hash match, clean reverse-apply, `tsc` green on the *rebased* branch), say "I could not verify this" rather than asserting it.

**Do not stop for these** — the reversible majority; asking about each turns a 20-PR sequence into an interrogation: fetching, rebasing, resolving a conflict A–I already documents, running eslint/tsc/tests, reading files, `npm ci`, creating a worktree, or an `--onto` rebase of a stacked child.

## Order

Grouped by risk, not by number. Within a phase, order is free unless stated.

**Phase A — mechanical independents. Land first.** No documented conflict; each is clean onto `main`. `#343`, `#345`, `#353` (dependabot, lockfile-only), `#359`, `#361`, `#363`, `#373`. Land `#363` here even though `#368` will later hit conflict **I** against it — `#363` is clean now and being on `main` first is what makes **I** a normal rebase for `#368`.

**Phase B — cache stack + live sessions, in this order.**

1. `#339` `feat/cache-integrity-alert` — clean onto `main`. It is the **base of `#341`**; land it first.
2. `#341` `feat/cache-warmup-status` — **stacked on `#339`** (`baseRefName`, not number). After `#339` squash-merges, `--onto` rebase it (see "Stacked pairs"). Its Run 1 six-file conflict is *gone* (rebased onto `#339`); do not expect it.
3. `#346` `fix/abandoned-empty-sessions` — clean onto `main`, but land it **before `#354`**: it introduces the `useNavigation` the `#354` external-gate suite needs. Confirm its upstream fix `b84f18c` is present (`git merge-base --is-ancestor b84f18c origin/fix/abandoned-empty-sessions`).
4. `#354` `feat/live-external-sessions` — expect conflict **A** on `services/api-client.ts`, now **rebuilt by hand** (the report's "take `#355`'s tip" shortcut dies with `#355` — see "Known traps"). Then the `#354 × #346` navigation check. Confirm upstream fixes `25c83b6` and `5b26bf7` are present.

**Phase C — i18n / onboarding locale cluster. Highest risk.** Conflicts **C, E, F, G, H, I** live here, including the silent **F**. Recommended order `#356 → #357 → #360 → #362 → #364 → #368`, driven by real dependencies (**G**: `#362` reworks the manual-pairing step `#360` also touches, so `#360` first; **H**: `#364`'s comment conflict is against `#360`; **I**: `#368` vs already-landed `#363`). **Order does not defuse trap F** — the report proved with `git merge-tree` in both directions that the keys vanish either way. What defuses it is landing each PR only on a **fresh post-rebase green** (see "Known traps"). Land `#368` last so its own new `i18n` job validates the settled locale set; confirm `#362`'s upstream fixes `ec5260f` and `4c6a275` are present before it lands.

**Phase D — docs, last.** `#347`, then `#358` (conflict **D**: take `#358`'s 2026-07-22 sync over `#347`'s 2026-07-19, and re-add the `</details>` that `#343`'s `<details>` wrapper needs in `ROADMAP.md` — verify tag count balanced), then `#372` (independent). Landing docs last resolves `BACKLOG.md`/`ROADMAP.md` once against a settled `main` instead of on every merge.

## Known traps

Each of these produces a **green signal** while something is wrong. A trap that announces itself needs no runbook; these are the ones a careful operator still walks into.

### F — `#356 × #360` locale-key deletion with no conflict marker (the centrepiece)

`#356` deletes `connect.step1`/`connect.step2` as unused; `#360` adds the *usage* (`ConnectStep.tsx`) but inherits the keys from its base as plain context lines, so **git applies the deletion cleanly, no marker.** Worse: the merge *does* hand you a conflict — the `manualSectionLabel`/`footnote` hunk in the *same file* — so you resolve that, the file looks handled, and the silent deletion rides along. Reordering does not help; the report's `git merge-tree` runs both directions produce identical key loss.

**What catches it:** `lib/i18n.types.ts` types `t()` against the locale JSON, so a referenced-but-missing key is a `TS2345` **compile error** — but only on a run that actually reflects the post-rebase tree.

**Exact check — for whichever of `#356`/`#360` lands second:**
1. `git fetch origin && git rebase origin/main`, `git push --force-with-lease`.
2. On the rebased branch: `npx tsc --noEmit` — confirm **no `TS2345` on `connect.step*`**. If red, re-add `connect.step1`/`step2` (byte-identical to `main`'s originals) to **all four** `locales/{ar,en,he,ru}/onboarding.json` as part of the rebase, then re-run.
3. `grep -l 'connect.step1' locales/{ar,en,he,ru}/onboarding.json` — expect all four.
4. Merge **only** on the resulting fresh green. Conflicts **C** (`#357`'s `removeMessage`) and **G** (`#362`'s locale keys) are the same class but surface as *real* markers, so they are less dangerous — still re-check by usage.

### `[skip-ci]` vacuous-green (repo-wide, feeds every phase)

`test.yml`'s gate skips the heavy step when `[skip-ci]` is in the head commit / PR title / body, and the required contexts (`Type check`, `Unit tests`, `Integration tests`, `Lint`) still report **green in seconds having run nothing.** For Phase C this is lethal: the whole F defence rests on `Type check` *actually running*. **Before trusting green, confirm the fresh run executed** — a real `Type check` takes minutes, not seconds; if the landing commit carries `[skip-ci]`, the green is meaningless.

### A — `#354 × #341` on `api-client.ts`, resolution no longer shortcuttable

Both rewrote the same `!response.ok` block: `#341` added `warmupState`; `#354` hoisted `errBody` and added a 409 `ConversationBusyError` branch. Run 2 resolved it by **taking the file from `#355`'s tip**, which already held the union — **that shortcut dies when `#355` is closed.** Landing `#354` after `#341` is on `main`, you must **build the union by hand**: keep `#341`'s `warmupState`, keep `#354`'s hoisted `errBody` and the 409 branch. The report's precondition ("pre-merge `api-client.ts` byte-identical to `#355`'s base") no longer applies — re-read both sides.

*After merging `#354`, open the `!response.ok` block and confirm **both** `warmupState` and the 409 `ConversationBusyError` branch are present.*

### `#354 × #346` — external-gate suite navigation

`SessionScreen.externalGate` is new in `#354` and its local `expo-router` mock omits `useNavigation`; the screen only calls `useNavigation` once `#346` is present. Neither PR is wrong alone. Fixed on `#354` (`25c83b6`) — so this only bites if that fix is missing.

*After both `#346` and `#354` are on `main`, run the suite in isolation: `npx jest --ci --runInBand --testPathPattern "externalGate"`.*

## Stacked pairs

Only one: **`#341` is based on `#339`** (`baseRefName: feat/cache-integrity-alert`, **identify from the base ref, never the PR number**). `#355`'s base is the old snapshot branch, but `#355` is being closed, so it is not a stacking concern.

Two different `--onto` rebases, not interchangeable:

- **Whenever the parent is force-pushed or gains a commit**, the child is left on orphaned commits — replay onto the parent's new tip:
  `git rebase --onto origin/feat/cache-integrity-alert <old-parent-tip> feat/cache-warmup-status`
  (`<old-parent-tip>` is the last of the child's orphaned copies of the parent's commits, found via `git merge-base` — not the parent's *current* tip.)
- **After the parent squash-merges**, GitHub retargets the child to `main`, but the branch still carries the parent's individual commits, which the squash collapsed into one commit git cannot match against the originals — replay only the child's own work:
  `git rebase --onto main feat/cache-integrity-alert feat/cache-warmup-status`

**This repo gives stacked PRs full CI — unlike some.** `test.yml`'s `pull_request` trigger has **no `branches:` filter**, so it fires for a PR targeting *any* base branch. Verified 2026-07-23: `#341` (base `feat/cache-integrity-alert`) shows `Type check`, `Unit tests`, `Integration tests`, `Lint` all `SUCCESS`. So step 6 of the loop **can** be satisfied for `#341` — do not assume a stacked PR is un-CI'd here. (If `test.yml` ever gains a base-branch filter, this reverts and stacked PRs would need local verification instead.)

## Moving target

Anything prepared in advance can go stale before the squash:

- **`main` advances mid-run.** Run 2 watched `main` take two CI commits (`54f6f43`, `3219d6f`) while landing. Rebase as **step 1 of the merge**, not the day before.
- **New PRs appear.** `#373` opened *after* the report was cut. Re-run the pre-flight PR-number diff before starting, and again if a phase spans sessions.
- **Upstream fixes must still be on their branches.** The runbook's correctness depends on `#346 b84f18c`, `#354 25c83b6`/`5b26bf7`, `#362 ec5260f`/`4c6a275`, `#343 393b9ca` staying present. Re-check each before landing its PR: `git merge-base --is-ancestor <sha> origin/<branch>` (exit 0 = present). All six verified present 2026-07-23; a force-push that dropped one would silently reintroduce the defect it fixed.

## Content that exists nowhere else

Work that lives only in the integration branch and **cannot be landed by merging a PR**, because it is a consequence of *combining* branches — expect to re-derive it:

- **The conflict A union in `api-client.ts`.** It exists as one resolved file on the snapshot (and on `#355`'s now-doomed tip); on `main` it must be hand-built when `#341` and `#354` meet. Verified this is genuine merge-glue, not a single-branch defect: neither `#341` nor `#354` fails `tsc` alone.
- **The `ROADMAP.md` `</details>` repair** (conflict D) — only needed once `#358`'s text meets `#343`'s `<details>` wrapper.
- **The re-added `connect.step*` keys** (trap F) — only needed once `#356`'s deletion meets `#360`'s usage.

Everything the report once listed as merge-glue but which turned out to be a *source-branch* defect (e.g. a lint failure a branch has in isolation) belongs at the source, not here — before filing something as merge-only, confirm the source branch fails on it alone, or you send the next operator into a red build with no diagnosis.

## One post-merge action that is not a merge

**After `#368` lands, add `i18n` to the required status checks in branch protection.** `#368` adds the `test:i18n` script and an `i18n` CI job (it closes the gap where `i18n-completeness`/`i18n-unused-keys` never ran on a PR), but a new job that is not *required* runs without being able to block anything. Reading protection via the API on 2026-07-23 returned "Branch not protected" (likely a token-scope limit, not the real state) — confirm and set the required checks in the repo **Settings → Branches** UI, do not trust that API read.

## Definition of done

- All **20** PRs squash-merged to `main`; `#355` closed with its re-verified evidence recorded; `#291` untouched.
- `i18n` added to `main`'s required status checks (the post-merge action above).
- `main` green on a **fresh, non-`[skip-ci]`** run.
- `integration-dev/v1.0.0-2026-07-22` reduced to nothing but the report file — `git log --merges origin/main..HEAD` shows no unlanded PR merges. Any code still unique to the integration branch at that point is a change that was never landed.

## Follow-up PRs — session-name display (separate chain)

These were opened **after** the kick-off and are **not** part of the 20-PR chain above — different base, different set. They fix interactive Claude Code conversations carrying no session name (the scanner only read the `slug` field, which the human REPL never writes), so mobile showed the project name instead of a real title in the list, conversation, and live-session views. It is a **cross-repo** chain; only the mobile PR lands in *this* repo.

| Order | Repo | PR | Branch | What it does |
|---|---|---|---|---|
| 1 | tb-scanner | [#53](https://github.com/RonenMars/threadbase-scanner/pull/53) | `fix/session-name-from-first-message` | Derive session name from the first user message when no `slug`. The data source. |
| 2 | tb-streamer | [#267](https://github.com/RonenMars/threadbase-streamer/pull/267) | `fix/emit-session-name` | Emit `session_name` in the conversation detail `meta` block. |
| 3 | **tb-mobile** | [#376](https://github.com/RonenMars/threadbase-mobile/pull/376) | `fix/session-name-display` | Read `session_name` in the list, conversation, and live-session views (user rename → session name → project name). **The only one that lands here.** |

**`#376` is safe to land alone, whenever.** It is additive and targets `main` directly (verified 2026-07-23: `OPEN`, `MERGEABLE`/`CLEAN`). It shows nothing new until the server pipeline lands (scanner #53 → scanner release → streamer dep bump → streamer #267); until then the name simply stays blank, so there is no ordering constraint against the chain above — treat it as a Phase-A-style mechanical independent, just recorded separately because it is a different set. Include `#376` in the pre-flight sweep even though it is not in the count of 20.

## Follow-up PRs — session load + cumulative slowdown (separate chain)

Opened 2026-07-23, **after** the kick-off and **not** part of the 20-PR chain above — different set, all mobile-only, all cut from the integration branch. They came out of two diagnosed bugs: a live session parked on a question/permission card showed a blank terminal that "failed to load" (the WS `terminal_replay` came back blank and the client latched it as a successful load, disarming the HTTP `/output` fallback that held the full transcript), and the app slowed down progressively after opening 5-6 sessions (native-stack screens stay mounted, so each opened session kept its WS handlers firing and its `VirtualTerminal` grid growing). The three fixes are already committed on `integration-dev/v1.0.0-2026-07-22` (`83cfe3a`, `77e568b`, `4b25551`).

| Order | PR | Branch → base | What it does |
|---|---|---|---|
| 1 | [#385](https://github.com/RonenMars/threadbase-mobile/pull/385) | `fix/terminal-empty-replay-fallback` → `main` | Ignore a blank `terminal_replay` so the 2s HTTP `/output` fallback stays armed and fills a card-parked session's terminal. Independent. |
| 2 | [#386](https://github.com/RonenMars/threadbase-mobile/pull/386) | `perf/freeze-hidden-session-screens` → `main` | `freezeOnBlur` on the session Stack so a pushed-under screen stops running effects/handlers while hidden. |
| 3 | [#387](https://github.com/RonenMars/threadbase-mobile/pull/387) | `perf/cap-virtualterminal-scrollback` → **`perf/freeze-hidden-session-screens`** | Cap the `VirtualTerminal` grid at 10k rows so memory and the per-frame `getLines()` scan stay bounded. **Stacked on #386.** |

**Each is additive and mobile-only** — no server, API, or WS-contract change — and each carries the full integration history against `main`, as intended (verified 2026-07-23: all three `MERGEABLE`/`CLEAN`).
**#385 and #386 target `main` and are independent** of each other and of the chain above — land either order, Phase-A-style.
**#387 is stacked on #386** (its base is `#386`'s branch, so its diff shows only the `VirtualTerminal` change): merge #386 first, then rebase #387 `--onto main` before merging it — otherwise a squash of #387 would drag #386's commit onto `main` a second time.
Include all three in the pre-flight sweep even though they are not in the count of 20.

## Local integration merge — PRs #354, #355, and #376

On 2026-07-23, the three PRs previously reported as missing were merged into the isolated worktree `/private/tmp/tb-mobile-merge-354-355-376`, based on integration tip `5502eb3`, in this order: **#354 → #355 → #376**.

| PR | Local merge commit | Result |
|---|---|---|
| #354 | `a70110d` | Merge commit created; the substantive live-session code was already represented in the integration tree through equivalent content. |
| #355 | `1ee5e4e` | Added the three missing `takeOver` translation blocks in `locales/{ar,he,ru}/conversation.json`; its `app/conversation/[id].tsx` conflict retained the integration branch's in-chat search UI. |
| #376 | `6840078` | Merge commit created; the session-name display code was already represented in the integration tree through equivalent content. |

These are local preparation merges only. They were not pushed or squash-merged to `main`; the worktree remains the place to run focused verification before any outward-facing merge.
