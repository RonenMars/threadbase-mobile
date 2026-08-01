# Landing runbook — getting the open PR chain onto `main` (superseded)

**Status:** superseded 2026-08-01. Do not follow this procedure — the PR chain it sequenced no longer exists.

> **Delete this file once [`../../LANDING-integration-to-main.md`](../../LANDING-integration-to-main.md)
> is done.** It survives only as a tombstone for the links that still point here and
> as a warning against rebuilding the same plan while that landing is in flight.
> Once `land/integration-prep` is fully on `main`, the last reason to keep it is
> gone — remove the file and its row in [`README.md`](README.md).

This runbook ordered 20 open PRs onto `main` one at a time, with a phase order, per-conflict resolutions (**A–J**), and a set of traps that produce a green signal while something is wrong.

## What actually happened

The chain was never landed this way. The work reached `main` through the integration branch instead, and the PRs were then closed as redundant rather than merged.

Verified 2026-08-01: every PR this runbook orchestrated — `#339 #341 #343 #345 #346 #347 #353 #354 #355 #356 #357 #358 #359 #360 #361 #362 #363 #364 #368 #372 #373`, plus the follow-up chains `#376` and `#385`/`#386`/`#387` — is `CLOSED` with `mergedAt=null`.
The integration branch `integration-dev/v1.0.0-2026-07-22`, which the runbook treated as proof the set could coexist, has been deleted.

Everything downstream of that is dead: the phase order, the per-PR loop, the pre-flight sweep, the decision to close `#355`, the conflict **A–I** resolutions, and the definition of done.

The one row still accurate is **`#291`** (`typescript 6 → 7`): still open, still excluded by standing request.

## Where the durable content went

The conflict analysis stays in [`../integration-merge-report-2026-07-22.md`](../integration-merge-report-2026-07-22.md), which is a report — a record of what was true at a point in time, not a procedure.

The traps outlived the chain, because they are repo-wide facts rather than properties of these branches:

| Trap | Now lives in |
|---|---|
| A `[skip-ci]` head commit reports the required checks green having run nothing | [`../troubleshooting.md`](../troubleshooting.md) → "CI signals" |
| A stacked PR (base ≠ `main`) still gets full CI in this repo | [`../troubleshooting.md`](../troubleshooting.md) → "CI signals" |
| `npx jest` finds 0 tests in a worktree under `.claude/` | [`../troubleshooting.md`](../troubleshooting.md) → "Jest test suites" |
| `SessionScreen.*` batch failures must be re-run serially before being called flakes | [`../troubleshooting.md`](../troubleshooting.md) → "Jest test suites", and [`../../CLAUDE.md`](../../CLAUDE.md) |

Conflict **J** (`ios/Podfile.lock` `ExpoWidgets` checksum on rebase) is obsolete for a different reason: that checksum encodes the checkout's absolute path, so resolving it was never meaningful either way. `scripts/reset-podfile-lock-path-noise.sh` now drops that drift — see [`../../CLAUDE.md`](../../CLAUDE.md) → "Native Dependencies After Package Changes".

The runbook's one post-merge action — add `i18n` to `main`'s required status checks — was completed on 2026-08-01, together with `Unit tests` and `Integration tests`, which had never been required either. The runbook's claim that those four were already required was wrong: only `Lint` and `Type check` were.

## Why this file still exists

Kept as a tombstone so links pointing here still resolve, and so the next person does not rebuild the same plan from the report.

The general lesson outlived the specifics: a runbook that sequences PR *numbers* has a short shelf life, because the branch set moves faster than the document can be edited. What survived here was never the ordering — it was the handful of places where this repo reports a green signal that means nothing.
