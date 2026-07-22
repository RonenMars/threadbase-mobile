# Kick-off — build the landing runbook for the mobile PR chain

**Run this from the `merge-prs-v2` worktree** (`integration-dev/v1.0.0-2026-07-22`) so every path below is relative. Paste the section below into a fresh session.

---

Create a landing runbook for this repo's open PR chain — the procedure for merging the 20 open PRs onto `main` one at a time, without re-hitting the documented conflicts or the traps that produce a green signal.

**Format to follow:** `docs/runbooks/_template.md`. Read it first; it opens with the seven rules its sections encode. `docs/runbooks/_example-streamer-land-open-prs.md` is the same template filled in for another repo — use it to see the shape of a finished runbook, but its PR numbers and paths are not ours. `docs/runbooks/README.md` explains why runbooks and merge reports are separate files.

**Source material:** `docs/integration-merge-report-2026-07-22.md`. It is a **run log**: Run 2 is current, **Run 1 is superseded** — do not carry Run 1's resolutions forward. Link to the report by conflict letter (A–I); do not restate it.

**Write to** `docs/runbooks/2026-07-22-land-open-prs.md`.

## Decide these before writing the order

**`#355` — close as superseded by `#354` (investigated, not an open question).** Both PRs are the mobile counterpart to streamer #253 and deliver the **same** live-session capability — the core feature files (`useConversationStream.ts`, `mergeLiveMessages.ts`, `lib/externalSession.ts`, `app/conversation/[id].tsx`) are byte-identical between the two tips. #355 is the *integration-testing twin*: authored on the superseded `bfc800d-2026-07-20` snapshot, so it carries pre-formed cross-PR glue — the #341∪#354 union in `services/api-client.ts` (conflict A) and #339/#341's `cache_alert` frames in `services/ws-client.ts` — that #354 lacks. That glue is only valid on a base that already has #341, and re-forms as conflict A when #341 and #354 both land on `main`; it is **not** live-session functionality. #354 is the one to land: it targets `main` and additionally carries the ar/he/ru take-over translations #355 is missing (`takeOver` keys in `locales/ar/conversation.json`: #354 has 2, #355 has 0). Closing #355 loses no capability — verified by an end-to-end contract trace: every WS event (`conversation_event`, `conversation_events`, `conversation_updated`), type (`ownership`, `processLiveness`) and error code (`CONVERSATION_BUSY`) that streamer #253 emits is consumed by #354. Re-verify before acting: if #355 has been rebased since, re-run the comparison.

**`#291`** (typescript 6→7) is excluded by request.

**Count:** 21 PRs are open and **20** are merged into the snapshot. The report's merge-log table lists only **19** — `#372` (`docs/jest-suite-verification`) is merged and named in the prose but missing from the table. Confirm against `git log --merges origin/main..HEAD` and make the runbook authoritative.

## Stacked pairs

`#341` is based on `#339`, not `main` — identify this from `baseRefName`, never from PR number. The runbook needs both `--onto` rebases and the distinction between them: the one required whenever the parent is force-pushed or gains a commit, and the one required after the parent squash-merges (because the squash produces a commit git cannot match against the originals). Note that a stacked PR may not get full CI until its base is `main`.

## Treat every recorded resolution as perishable

The report demonstrates this itself: `#341`'s run-1 conflict across six files **disappeared** once its branch was rebased onto `#339`. Re-verify preconditions rather than applying resolutions blind — conflict A's resolution in particular depends on a byte-identical precondition the report states explicitly.

The same applies to the fixes pushed upstream during the run — `#346 b84f18c`, `#354 25c83b6` / `5b26bf7`, `#362 ec5260f` / `4c6a275`, `#343 393b9ca`. The runbook's correctness depends on them still being on those branches. Verify, and say in the runbook how to re-check.

## The centrepiece: traps that produce a green signal

**`#356` × `#360`** — a locale-key deletion git applies with **no conflict marker**. The report proves with `git merge-tree` in both directions that reordering does not help, and that the merge hands you a conflict *in the very file silently losing keys*, so it looks handled. What works: rebase, then merge only on a **fresh post-rebase green**, because Type check catches it (`lib/i18n.types.ts` makes a missing key a `TS2345`). This needs its own "Known traps" subsection with the exact post-merge check.

**`#354` × `#346`** — `#354`'s suite omits `useNavigation`; the screen only calls it once `#346` is present. Neither PR is wrong alone.

## Mechanics that must be stated

Worktree **outside `.claude/`** or jest silently finds 0 tests. Each worktree needs its own `npm ci` (~3 min). Verify heavy `SessionScreen` suites with `--runInBand`, and **re-run any single failure in isolation before calling it a flake** — this run had four genuine failures nearly dismissed as flakes and two real load artifacts, and batch output cannot distinguish them.

One post-merge action that is not a merge: **after `#368` lands, add `i18n` to the required status checks**, or the new job runs without being able to block anything.

## Also derive

- **Who should run it** — model *and* reasoning effort per phase, justified by what failure looks like rather than command difficulty. Raise effort where the failure mode is *absence*: the locale cluster (`#356`, `#357`, `#360`, `#362`) is where a clean merge silently deletes keys.
- **Stop points** — three lists: always-stop (irreversible/outward-facing), stop-because-this-isn't-the-described-situation, and explicitly **do-not-stop**. The third is what keeps the first two credible.
- **Pre-flight** — sweep all 21 PRs for `CONFLICTING` and red checks, and record what it catches. `gh pr view` must run **twice**: GitHub computes mergeability lazily and the first call only triggers it.

## Done when

Someone who has not read the merge report can land the chain from the runbook alone, and every trap that produces a green signal has an explicit "after merging X, check Y" step.
