# Pre-ship checks (shared)

This document defines the gating checks that **must** run before any
TestFlight or App Store upload, regardless of pipeline (`/expo-local-ship`
local CLI, `/ship-expo-cloud` EAS Cloud, or any future variant).

Both ship skills reference this file directly — keep it canonical. If you
change the rules here, the behavior changes everywhere.

---

## Why these checks exist

Multi-machine ship hazards have bitten this project before:

- Another laptop pushed an `app.json` `buildNumber` bump that the local
  machine hadn't pulled. The pipeline auto-bumped from a stale base, then
  Apple rejected the upload as a duplicate build number — or worse,
  silently re-used a number that confused TestFlight history.
- A teammate shipped from a different branch and never pushed the
  `app.json` commit. Local main looked clean but was actually behind
  reality.
- An uncommitted `app.json` got shipped to TestFlight, then someone else
  pulled and clobbered it on the next ship attempt.

Each of these is recoverable but expensive. The pre-ship checks below
fail loud, early, and cheaply — before EAS minutes or local Xcode time
are spent.

---

## The checks (in order)

### 1. Branch sanity

- Refuse to ship from a non-`main` branch in `--strict` mode. Otherwise
  warn — sometimes a hotfix branch is intentional, but it must be
  deliberate.

### 2. No uncommitted `app.json`

- `git diff --quiet -- app.json` and `git diff --cached --quiet -- app.json`
  must both succeed. The pipeline must ship a tracked, committed `app.json`
  so the build number you upload matches what's in git.

### 3. Local main is up to date with `origin/main`

- `git fetch origin main` (skip with `--no-fetch` for offline runs).
- If `origin/main` is ahead of local `main`, **fail loud** and print the
  recent remote commits not yet local so the user can see what they're
  missing.
- If local is ahead of `origin/main`, that's fine — log it and remind the
  user to push after the ship completes.

### 4. Build number reconciliation against TestFlight

- Query the App Store Connect API for the highest `buildNumber` already
  uploaded for this `bundleIdentifier`.
- Print the comparison upfront: `local app.json buildNumber: 78` and
  `latest TestFlight buildNumber: 79 (VALID, uploaded ...)`.
- If `local <= remote`, auto-bump `app.json` to `remote + 1` (with a
  prominent warning).
- If `remote - local >= 2`, print a louder warning: this is almost always
  a sign that another machine shipped without committing the `app.json`
  bump. Ask the user to investigate before reshipping.
- After the ship, the bump must be committed and pushed. Both pipelines
  remind the user.

### 5. App.json is committed *before* archive/upload

- The pipeline never ships an uncommitted `app.json`. After step 4
  auto-bumps, stage and commit `app.json` before the build phase begins.

---

## Implementation

Both skills delegate to the same shell scripts in `scripts/`:

| Script | Role |
|--------|------|
| `scripts/git-sync-check.sh` | Implements checks 1, 2, 3. Fails non-zero on any violation; prints recent missing remote commits when behind. Flags: `--strict` (fail on non-main), `--no-fetch` (offline). |
| `scripts/check-build-number.sh` | Implements check 4. Queries ASC API, compares local vs remote, auto-bumps with warnings. Flags: `--check-only` (don't auto-bump; exit non-zero instead). |

Each pipeline's orchestrator runs these scripts as gating steps before
the heavy work (archive, EAS build) begins. The scripts are independent
and idempotent — a developer can run them by hand to dry-run the pre-ship
state.

## Bypassing

There is no `--skip-pre-ship` flag. If you genuinely need to bypass (e.g.
shipping from a fork during an outage), run the steps inline, fix the
condition that's blocking, then re-run the pipeline. Bypass logic in the
script would tempt people to use it as a default.
