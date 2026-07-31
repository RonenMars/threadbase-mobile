# Investigation: missing Sentry Release metadata (`ronen-mars/threadbase`)

**Date:** 2026-07-31
**Method:** live queries via the Sentry MCP against org `ronen-mars` / project
`threadbase`, cross-referenced with the iOS build pipeline in this repo
(including the vendored `@sentry/react-native` Xcode build-phase scripts).
Nothing here is asserted from documentation alone — every claim below cites
either an MCP tool result or a specific file+line.

## Corrected premise

The task described the Releases page as showing **no application Releases at
all**. That's not what the live data shows.

`find_releases(organizationSlug='ronen-mars', projectSlug='threadbase')` returns
three release objects:

| Release | Created | First event | Last event | New issues |
|---|---|---|---|---|
| `threadbase-mobile@1.0.0+163` | 2026-07-13T06:19:03.611Z | 2026-07-13T13:30:36.000Z | 2026-07-13T18:05:18.000Z | 11 |
| `threadbase-mobile@1.0.0+164` | 2026-07-20T10:10:12.692Z | 2026-07-20T10:10:12.000Z | 2026-07-20T10:10:12.000Z | 1 |
| `threadbase-mobile@1.0.0+183` | 2026-07-31T16:06:13.065Z | *(null)* | *(null)* | 1 |

This lines up exactly with what actually shipped: 163 and 164 are the two
early builds that reported events, 165–182 shipped nothing (the separate DSN
gap, already fixed), and 183 is today's fix build. **So the Releases tab is
not empty — it's just sparse and looks unfinished**, which is a different (and
narrower) problem than "nothing ever creates a Release."

## Answers to the four questions

### 1. Is a release object ever created?

Yes, but not reliably via an explicit, successful `sentry-cli releases new` /
`finalize` call — the evidence points to a mix of two paths:

- **`get_release_details`** for all three releases returns `dateReleased: null`
  and `"Deploys: No deploys found"` / `"Commits: No commits found"`. A release
  created and explicitly finalized by sentry-cli normally gets a
  `dateReleased` timestamp; none of these three do.
- For `+164`, `dateCreated` is **692ms after** `firstEvent` — the signature of
  Sentry's server-side "auto-create a bare release row the first time an event
  arrives tagged with a release Sentry hasn't seen" behavior. This does *not*
  require any sentry-cli call at all.
- For `+163`, `dateCreated` is **~7 hours before** `firstEvent` — inconsistent
  with pure event-triggered creation. This timing gap suggests the CI archive
  process did invoke sentry-cli around build time (which is the only way a
  release row could exist before any event referencing it), but the
  release/sourcemap-upload step never completed to the finalize stage.

**Where release creation could happen, and why it can be skipped:**
`node_modules/@sentry/react-native/scripts/sentry-xcode.sh` is the *only* place
in the pipeline that can create/finalize a release — it's the "Bundle React
Native code and images" Xcode build phase, and it runs
`sentry-cli react-native xcode $ARGS ...`, which internally does
propose-version → create release → upload sourcemaps → finalize. Line 61 only
adds `--no-auto-release` if `AUTO_RELEASE == false`, which this repo never
sets, so auto-release is nominally on. **But line 68-70 is a full bypass:**

```bash
if [ "$SENTRY_DISABLE_AUTO_UPLOAD" == true ]; then
  echo "SENTRY_DISABLE_AUTO_UPLOAD=true, skipping sourcemaps upload"
  /bin/sh -c "$REACT_NATIVE_XCODE"
```

When `SENTRY_DISABLE_AUTO_UPLOAD=true`, the entire sentry-cli invocation is
skipped — no release, no sourcemap upload, nothing. This env var is the
documented escape hatch used in this repo when Sentry credentials are missing
(`scripts/bootstrap-local-signing-op.sh:183,199` and
`scripts/.env.signing-op.example:24` both call it out: *"Archive will fail
unless `SENTRY_DISABLE_AUTO_UPLOAD=true`... which costs symbolication"*), and
it was used for build 182 earlier in this session. Given that
`SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` were only wired into the ship
pipeline via 1Password as of commits `d50b3920`/`c435d74f` (2026-07-31, same
day as build 183), it's plausible this same fallback was in effect — knowingly
or not — for earlier builds too, which would explain why the release/finalize
step never completed for `+163`/`+164` even though a release row exists for
both.

**A second, independent build phase — `sentry-xcode-debug-files.sh` — uploads
dSYMs and never touches release objects at all** (it only calls
`sentry-cli debug-files upload`). Its success or failure is unrelated to
whether a Release exists.

### 2. Does the release NAME match between the SDK and the upload?

Almost certainly yes — no explicit override exists on either side, and both
sides compute the name the same way:

- **SDK side** (`services/safe-metadata.ts:131-134`):
  ```ts
  export function getReleaseString(): string {
    const { appVersion, buildNumber } = getSafeBuildMetadata()
    return `threadbase-mobile@${appVersion}+${buildNumber}`
  }
  ```
  → `threadbase-mobile@1.0.0+163`, matching exactly what `find_releases` shows.
- **sentry-cli side:** neither `sentry-xcode.sh` nor `sentry-xcode-debug-files.sh`
  ever sets `SENTRY_RELEASE` (grepped `scripts/`, `.github/workflows/`, and both
  vendored scripts — no repo code sets it). `sentry-cli react-native xcode`
  auto-detects the release name from the built `Info.plist`
  (`CFBundleShortVersionString` + `CFBundleVersion`), which is the same source
  of truth the app's own `app.json`/EAS build config stamps before Xcode runs.

So this dimension is not the source of the gap — the fact that all three
Sentry release *names* already match `getReleaseString()`'s output exactly
confirms this empirically, independent of the reasoning above.

### 3. Is `dist` set consistently?

The SDK sets `dist: getSafeBuildMetadata().buildNumber` (`services/sentry.ts:171`,
e.g. `"163"`). On the sentry-cli side, `SENTRY_DIST` is never set explicitly
either — same auto-detection from `Info.plist`'s `CFBundleVersion` applies,
which should produce the identical value. This is architecturally the same
non-issue as (2): nothing in the repo could cause a mismatch because nothing
overrides either side away from the shared source of truth (the built
`Info.plist`).

**Caveat — could not verify directly:** the Sentry MCP server exposes
`find_releases` and `get_release_details` but **no tool to list a release's
uploaded artifacts/files** (searched `search_sentry_tools` for "release
artifacts", "sourcemaps upload check", "debug files list" — none of the
returned tools cover this). So whether sourcemaps actually *bound* to
`+163`/`+164`/`+183` under the right dist could not be confirmed from this
session. Given `dateReleased: null` for all three, it's more likely no
sourcemaps were uploaded at all for any of them (see §1) than that they were
uploaded under a mismatched dist. To close this out: run
`sentry-cli releases files threadbase-mobile@1.0.0+183 list` (needs
`SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` in the shell) or check the
Artifacts tab on the release page in the Sentry UI directly.

### 4. Is commit association configured at all?

**No — and this is the one finding that's true unconditionally, independent
of credentials or timing.** Neither `sentry-cli releases set-commits` (with or
without `--auto`) nor `sentry-cli releases deploys new` is called anywhere:
not in any repo-authored script, not in `.github/workflows/deploy.yml`, and
not in the default code path of either vendored `@sentry/react-native`
build-phase script. `sentry-cli react-native xcode`'s auto-release behavior
covers release-create → sourcemap-upload → finalize; it does **not** call
`set-commits` or `deploys new` on its own. Even in a best-case future build
where credentials are valid and the release finalizes cleanly, "suspect
commits" and the release timeline/deploy markers will stay empty until one of
these is added explicitly to the pipeline — which requires:

- A Sentry↔GitHub (or other VCS) integration already connected at the org
  level (this can't be verified from code — it's a Sentry dashboard setting).
- An explicit `sentry-cli releases set-commits --auto <release>` (or
  `set-commits <release> --commit "org/repo@<sha>"`) call after the release is
  created, with enough git history checked out in the CI runner to resolve the
  commit range.
- An explicit `sentry-cli releases deploys new -e production <release>` call
  to populate the deploy marker.

This is a deliberate scope cut for this investigation (findings-only, no
pipeline changes) — see the "Follow-up" section below.

## Summary

| Question | Finding |
|---|---|
| Are Release objects created? | Yes, 3 exist — but likely via Sentry's auto-create-on-event fallback rather than a completed sentry-cli finalize, at least for `+163`/`+164`. `dateReleased` is null for all three. |
| Does the release name match? | Yes — both sides derive from the same `Info.plist` values, and the 3 live release versions already match `getReleaseString()`'s output exactly. |
| Is `dist` consistent? | Architecturally yes (same shared source), but artifact binding under that dist could not be verified — no MCP tool exposes it; check via `sentry-cli releases files list` or the Sentry UI. |
| Is commit association configured? | No — never called anywhere in this repo, unconditionally. This is the only gap that persists even if the release/finalize step succeeds. |

## Follow-up (explicitly out of scope for this investigation)

1. Confirm whether `SENTRY_DISABLE_AUTO_UPLOAD` was set for builds 163/164 (or
   whether `SENTRY_AUTH_TOKEN` was simply absent/invalid at the time) — if so,
   their releases exist only via the event-ingestion fallback and never had a
   real finalize/sourcemap-upload attempt.
2. Run `sentry-cli releases files <version> list` (or check the Sentry UI
   Artifacts tab) for `+183` once it has had time to fully process, to confirm
   sourcemaps actually bound.
3. If commit/deploy metadata is wanted going forward: confirm a GitHub
   integration is connected in the Sentry org, then wire
   `sentry-cli releases set-commits --auto` and
   `sentry-cli releases deploys new -e production` into the ship pipeline
   after the existing Xcode build phases (or as a discrete step in
   `.github/workflows/deploy.yml`).
