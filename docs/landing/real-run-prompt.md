# Real-run prompt — execute the landing against `origin`

The third and last stage. Paste the fenced block into a fresh Claude Code session at the repo root.

- **Stage 1** — [`LANDING-integration-to-main.md`](../../LANDING-integration-to-main.md), the plan.
- **Stage 2** — [`audit-then-rehearse-prompt.md`](audit-then-rehearse-prompt.md), which audited that
  plan and then replayed it locally, producing [`2026-08-01-rehearsal-notes.md`](2026-08-01-rehearsal-notes.md).
- **Stage 3** — this. The same script, executed for real. **This one merges to `main`.**

It is short because the rehearsal came back clean: three slices, zero conflicts in B and C, zero
DRIFT, zero UNEXPLAINED. What remains is execution plus two named hazards that the rehearsal
could not exercise.

## Before you run this

- **Read §7 of the rehearsal notes first.** It is the script; this prompt only says how to run it.
- **Two things are live now that the rehearsal never tested.** `main` moved twice after the
  rehearsal (buildNumber 187 → 188, versionCode 39 → 40), so the version-conflict path is
  exercised for the first time during the real run. And `#495` landed a fix to
  `scripts/reset-podfile-lock-path-noise.sh` that two slices carry a stale copy of. Both are in
  the hazards list below.
- **This is supervised, not unattended** — but far less so than streamer's equivalent. There are
  no unreviewed conflict resolutions here; the stops are the two hazards and anything genuinely new.
- Worktrees go outside the repo (`../tb-mobile-worktrees/<slug>`). A nested one makes Jest report
  phantom failures from a stale branch.
- Node 24.15.0 (`.nvmrc`).

---

```
Repo: /Users/ronenmars/dev/ai-tools/tb-mobile

Execute the landing of `land/integration-prep` onto `main` for real, following §7 of
docs/landing/2026-08-01-rehearsal-notes.md. That script is authoritative — it was produced by a
local rehearsal that replayed all three slices and ended with zero DRIFT and zero UNEXPLAINED.

This stage DOES push and merge. Everything before it was local.

## Authority and precedence

1. §7 of the rehearsal notes — the ordered script.
2. §6 of the same file — corrections to the runbook. Where the runbook and the notes disagree,
   the notes win; the runbook was written before anything was replayed.
3. CLAUDE.md — rebase onto latest main, wait for green, one PR at a time, worktrees outside the
   repo.

Read §7 in full before the first command.

## The stop rule

STOP and report rather than improvising whenever reality diverges from the rehearsal:

- a conflict in a file the ledger (§3) does not list for that slice
- a verification failure the rehearsal did not record
- a slice whose commit count differs from what §7 expects
- any command in §7 that errors or returns an unexpected count

The rehearsal hit zero conflicts in slices B and C. So *any* conflict there is new information
and worth stopping on — that is a much stronger signal here than it would be on a noisy branch.

## Named hazards

**1. The version conflict is live and was never rehearsed.** Both branches sat at 187/39
throughout the rehearsal, so `app.json` and `android/app/build.gradle` never conflicted. `main` is
now ahead on both. Every slice rebase will hit them. Take `main`'s HIGHER values — and read them
live, do not trust any number written in these documents, including 188/40.

**2. `CLAUDE.md` will silently revert `#495` unless Guard B catches it.** `#495` fixed
`scripts/reset-podfile-lock-path-noise.sh` and updated `CLAUDE.md` to say four checksums are
path-dependent, not three. Slice B's `309bd80e` and slice C's `f3487f97` both touch `CLAUDE.md`
carrying a copy that predates `#495`. Guard B is the only thing between that and a silent revert.

**Guard B's list does not grow from this, and that is the trap.** All three files `#495` touched
were already on the 21-file list, so regenerating it produces a byte-identical list that reads as
"nothing changed" while the baseline moved underneath. **Membership is not the check.** For every
file on the list that a slice touches, diff the post-slice trunk against `main`'s CURRENT content
and confirm additions only. A line `main` has today that the slice removes is a revert until
proven otherwise.

**3. Slice A is a cherry-pick, not a replay.** It lands the 11-file end state that slices 1–7 of
the old plan netted out to. Do not replay the 87 commits — §6 records why: they would put six
successive states on `main` that are strictly worse than `main` already is.

**4. Use `--no-keep-empty --onto`.** A plain rebase replays 97 commits instead of 9 and preserves
`b74387b3`, an already-empty commit. The rehearsal's Phase A claimed rebase drops it by default;
that was wrong and the rehearsal proved it wrong by executing.

## Per slice

Rebase onto latest `main`, run the full local verification, push, open the PR, wait for required
green, merge, then move to the next. Never two in parallel.

    npm run typecheck && npm run test:unit && npm run test:integration \
      && npm run test:i18n && npm run lint

Scope Jest to the repo root so sibling worktrees do not pollute results. If a suite fails in batch
but passes alone, that is the documented load artifact, not a regression — record it and say which
it was.

Required green in CI: Gate, Setup, Type check, Unit, Integration, Lint, i18n, Native deps.
`E2E maestro (iOS)` reporting `skipping` on PRs is expected. Never merge red.

Show me the diff and the message before any commit you author.

## Progress

Keep a running log at ../tb-mobile-landing-run/RUN-LOG.md: per slice, the SHA it merged as, every
conflict and its resolution, whether that matched the rehearsal's prediction, and both guards'
results. Write it after every merge — this will outlive its session.

## After the last slice

    $G rev-list --left-right --count origin/main...origin/land/integration-prep

`0 0` is not the target — slice A collapsed 87 commits into one, so the counts will never match.
The tree is the measure:

    $G diff origin/main origin/land/integration-prep

Expect only what §5 classified. Anything else is a finding.

Then confirm the app builds and runs from `main`:

    npm ci && cd ios && bundle exec pod install && cd .. && npx expo run:ios --device "<udid>"

`#457` (`land/integration-prep` → `main`) drains as the slices land and closes itself. Do not
merge it whole at any point — that would land the remainder in one opaque commit, which is the
exact thing `9cf00d99` already did to this content once.
```

## What "done" looks like

`main` carries the remainder, `#457` has closed itself, and `RUN-LOG.md` records every deviation.

Do not delete `land/integration-prep`, `backup/prep-landing-*` or the `archive/prep-*` tag until
that log is written and reviewed. After `9cf00d99`, the branch is the only remaining witness to
what this content was supposed to be.
