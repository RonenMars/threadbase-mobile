# Investigation: missing Sentry Release metadata (`your-org/threadbase`)

> **Superseded in part — see [Update — 2026-08-01](#update--2026-08-01) at the bottom.**
> §2's root-cause finding (release-name mismatch) still holds and its fix shipped.
> But the follow-up ship showed that fixing the *name* was not sufficient: builds
> 184 and 185 produced no Release object at all. The reason, and the second fix,
> are in the update section. Release strings also now carry the platform, so the
> `threadbase-mobile@<version>+<build>` form quoted throughout this document is
> no longer what the pipeline produces.

**Date:** 2026-07-31
**Method:** live queries via the Sentry MCP and the Sentry dashboard (via
claude-in-chrome) against org `your-org` / project `threadbase`,
cross-referenced with the iOS build pipeline in this repo (including the
vendored `@sentry/react-native` Xcode build-phase scripts and today's actual
`build/archive.log` from shipping build 183). Nothing here is asserted from
documentation alone — every claim below cites an MCP tool result, a dashboard
page, a build log line, or a specific file+line.

## Corrected premise

The task described the Releases page as showing **no application Releases at
all**. That's not what the live data shows.

`find_releases(organizationSlug='your-org', projectSlug='threadbase')` returns
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

**No — confirmed directly from today's build 183 archive log, and this is the
real root cause.** `build/archive.log` (produced by `scripts/archive-and-upload.sh`
during today's local ship) shows the actual sentry-cli sourcemap upload:

```
output: sentry-cli - > Organization: your-org
output: sentry-cli - > Projects: threadbase
output: sentry-cli - > Release: com.ronenmars.threadbase@1.0+183
output: sentry-cli - > Dist: 183
output: sentry-cli - > Upload type: artifact bundle
```

Compare to what the SDK tags every event with
(`services/safe-metadata.ts:131-134`):

```ts
export function getReleaseString(): string {
  const { appVersion, buildNumber } = getSafeBuildMetadata()
  return `threadbase-mobile@${appVersion}+${buildNumber}`
}
```
→ `threadbase-mobile@1.0.0+183`.

*(As of 2026-08-01 this function also interpolates the platform — see the
update section. The mismatch analysed below is unaffected by that change.)*

**These are two different strings, both package name and version:**

| | Package | Version |
|---|---|---|
| SDK (`getReleaseString()`) | `threadbase-mobile` (hardcoded) | `1.0.0` (`app.json` → `expo.version`) |
| sentry-cli (auto-detected) | `com.ronenmars.threadbase` (Info.plist `CFBundleIdentifier`, i.e. the iOS bundle id) | `1.0` (Info.plist `CFBundleShortVersionString`, stale relative to `app.json`) |

Neither `sentry-xcode.sh` nor `sentry-xcode-debug-files.sh` ever sets
`SENTRY_RELEASE` (grepped `scripts/`, `.github/workflows/`, and both vendored
scripts — no repo code sets it), so `sentry-cli react-native xcode` falls back
to its own convention (bundle id `@` marketing version), which has no relation
to the SDK's hardcoded `threadbase-mobile` package name. This is why
`find_releases` never returns a `com.ronenmars.threadbase@...` release: the
sourcemap upload's debug-ID artifact bundle gets tagged with that release
string for association purposes, but it's not the release Sentry events are
ever tagged with — so the release the Releases UI shows (`threadbase-mobile@1.0.0+183`)
reports **0 source map artifacts** even though an upload happened successfully
in the same build.

**My original conclusion for this question — that the names "should" match
because both sides use the same `Info.plist`— was wrong.** It assumed the SDK
release string was itself derived from `Info.plist`, but it isn't: it's a
hardcoded `threadbase-mobile` literal in application code, independent of the
iOS bundle identifier. Only the live archive log surfaced this; static
reasoning about the code wasn't enough here.

### 3. Is `dist` set consistently?

Yes, `dist` itself is fine — `> Dist: 183` in the log above matches
`services/sentry.ts:171`'s `dist: getSafeBuildMetadata().buildNumber` exactly.
The mismatch is entirely in the release name (see §2), not dist.

**Confirmed via Sentry dashboard (not just the archive log):** navigated to
`https://your-org.sentry.io/explore/releases/threadbase-mobile%401.0.0%2B183/`
via claude-in-chrome — the release detail page shows **"Source Maps — 0
artifacts"** and a **"Finalize"** action still available (i.e. not finalized),
directly confirming that the sourcemap upload seen in the archive log landed
on a different release object than the one events/the UI reference.

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

**Also confirmed via the Sentry dashboard:** `Settings → Repositories`
(`https://your-org.sentry.io/settings/repos/`) and `Settings → Integrations`
both show every VCS provider (GitHub included) as **"Not Installed"/"Connect"**
— there is currently no repository connected to this Sentry org at all. This
means `set-commits`/suspect-commits cannot work yet regardless of any pipeline
change; connecting a repository is an org-admin action in the Sentry dashboard
that has to happen before any code change here can populate commit metadata.
This is a genuine blocker, not a pipeline gap — left as a manual follow-up for
the user rather than something this branch can fix.

## Summary

| Question | Finding |
|---|---|
| Are Release objects created? | Yes, 3 exist — but likely via Sentry's auto-create-on-event fallback rather than a completed sentry-cli finalize, at least for `+163`/`+164`. `dateReleased` is null for all three. |
| Does the release name match? | **No — this is the root cause.** sentry-cli auto-detects `com.ronenmars.threadbase@1.0+183` (bundle id + stale marketing version) while the SDK tags events `threadbase-mobile@1.0.0+183`. Confirmed directly in today's `build/archive.log`. **Fixed in this branch.** |
| Is `dist` consistent? | Yes — `Dist: 183` in the archive log matches the SDK's `dist: buildNumber` exactly. Not the issue. |
| Is commit association configured? | No — never called anywhere in this repo, unconditionally. Additionally blocked externally: no VCS integration/repository is connected in the Sentry org at all (confirmed via dashboard), so `set-commits` can't work yet regardless of pipeline changes. |

## Fix implemented (this branch)

The same mismatch exists on both platforms, since both auto-detect
release/dist from the platform bundle identifier rather than the SDK's
hardcoded `threadbase-mobile` package name — and both `com.ronenmars.threadbase`
(iOS bundle id, confirmed in the archive log) and `com.ronenmars.threadbase`
(Android `expo.android.package` in `app.json`) are the same string, so Android
would hit an identical mismatch (e.g. `com.ronenmars.threadbase@1.0.0+37`
instead of `threadbase-mobile@1.0.0+37`).

- **iOS:** `scripts/archive-and-upload.sh` now exports `SENTRY_RELEASE` and
  `SENTRY_DIST` — computed identically to `services/safe-metadata.ts`'s
  `getReleaseString()` — before invoking `xcodebuild archive`. sentry-cli
  honors these env vars over its own Info.plist-derived auto-detection. Used
  by both the local ship path (`scripts/ship-ios.sh` → `archive-and-upload.sh`)
  and CI (`.github/workflows/deploy.yml` → `ship-ios.sh`), so one change
  covers both.
- **Android:** `scripts/bundle-and-upload-android.sh` now exports the same two
  vars before `./gradlew :app:bundleRelease`. `node_modules/@sentry/react-native/sentry.gradle.kts`
  (lines 432, 442-443) explicitly falls back to
  `$applicationId@$versionName+$versionCode` only `if SENTRY_RELEASE`/`SENTRY_DIST`
  aren't set in the environment — same override mechanism as iOS, confirmed by
  reading the vendored Gradle script rather than assumed. Used by both
  `scripts/ship-android.sh` and CI.

Both uploaded release/dist now land on `threadbase-mobile@<version>+<build>`,
matching what the SDK tags events with, going forward. *(Superseded 2026-08-01:
the release string now carries the platform — see the update section.)*

**What this fix does not (yet) do:**
- It doesn't finalize the release or create commit/deploy markers — the
  sourcemap upload path used here (`sentry-cli react-native xcode`, debug-ID
  artifact bundle) never calls `releases finalize`, `set-commits`, or
  `deploys new` regardless of release-name correctness. `dateReleased` will
  likely stay `null` even for future builds unless that's added separately.
  *(This turned out to be the bigger problem — see the update section. Fixed
  2026-08-01.)*
- It doesn't retroactively fix `+163`/`+164`/`+183` — those already-uploaded
  artifact bundles are stuck under their mismatched release names; only future
  archives benefit.
- Commit association remains blocked on connecting a repository in the Sentry
  dashboard (see §4 above) — no code change can work around that.

## Follow-up (not done in this branch)

1. Confirm whether `SENTRY_DISABLE_AUTO_UPLOAD` was set for builds 163/164 (or
   whether `SENTRY_AUTH_TOKEN` was simply absent/invalid at the time) — if so,
   their releases exist only via the event-ingestion fallback and never had a
   real finalize/sourcemap-upload attempt.
2. Ship a build with this fix and confirm via the Sentry dashboard that the
   matching `threadbase-mobile@<version>+<build>` release now shows non-zero
   Source Map artifacts.
3. Fix the stale `MARKETING_VERSION` ("1.0" instead of "1.0.0") in the Xcode
   project if it matters for anything else — it's now irrelevant to Sentry
   since `SENTRY_RELEASE` overrides it, but it's still a real drift from
   `app.json`.
4. If commit/deploy metadata is wanted: connect a repository under
   `Settings → Repositories` in the Sentry dashboard (user action, not
   code), then wire `sentry-cli releases set-commits --auto` and
   `sentry-cli releases deploys new -e production` into the ship pipeline
   after the archive step.

## Update — 2026-08-01

**Trigger:** builds 184 (local) and 185 (CI, run `30689149168`) both shipped
successfully, and neither produced a Release object. `find_releases` still
returned only `+163`, `+164`, `+183`.

### The premise that had to be discarded first

The working assumption was "183 came from GitHub Actions, 184 came from local,
so the local script is missing something CI has." Both halves are wrong:

- **183 did not come from CI.** Release `+183` was created
  `2026-07-31T16:06:13Z`. The only Deploy run that day
  (`gh run list --workflow deploy.yml`) started `2026-07-31T18:20:25Z` — over
  two hours later. No workflow run existed at the moment the release appeared.
- **There is no local-vs-CI difference to find.** `.github/workflows/deploy.yml:181`
  runs `./scripts/ship-ios.sh`, which calls `archive-and-upload.sh` at
  `ship-ios.sh:154` — the exact script the local ship runs. Android is the same
  (`deploy.yml:404` → `ship-android.sh:210` → `bundle-and-upload-android.sh`).

### Actual root cause: nothing ever created a Release

Grepping `releases new|releases finalize|set-commits|deploys new` across every
`scripts/*.sh` and `.github/workflows/*.yml` returned **zero matches**. The two
Sentry build phases are `sentry-cli react-native xcode` (sourcemaps) and
`sentry-cli debug-files upload` (dSYMs), and both key their uploads by debug ID
— neither creates a Release object. This is the same conclusion §1 reached about
`sentry-xcode-debug-files.sh`, now confirmed to apply to the sourcemap path too.

So a Release appeared **only when an event arrived tagged with it**. That fully
explains the three that exist and the two that don't:

| Release | Has events? | Why it exists (or doesn't) |
|---|---|---|
| `+163` | yes | event ingestion |
| `+164` | yes | event ingestion |
| `+183` | `newIssues: 1`, no deploys, no commits | event ingestion |
| `+184` | no | never crashed — nothing else creates a release |
| `+185` | no | never crashed — nothing else creates a release |

§1's speculation that `+163`'s ~7-hour `dateCreated`-before-`firstEvent` gap
implied a partial sentry-cli release attempt is **not supported** by this: no
code path could have made that call. The gap is more likely event-timestamp
skew than a sentry-cli invocation.

### Fix (2026-08-01)

Both ship scripts now create and finalize the release explicitly after a
successful store upload, guarded on credentials and non-fatal (the binary is
already uploaded by that point, so a Sentry failure must not fail the ship):

```bash
"$SENTRY_CLI" releases new "$SENTRY_RELEASE" &&
"$SENTRY_CLI" releases finalize "$SENTRY_RELEASE"
```

- `scripts/archive-and-upload.sh` — after the `xcrun altool --upload-app` step.
- `scripts/bundle-and-upload-android.sh` — after the Play upload. Additionally
  guarded on `-n "${SENTRY_RELEASE:-}"`, because that variable is exported only
  on the Gradle path; `--skip-bundle` (promote an existing AAB) skips it, and
  `set -u` would otherwise abort the script.

Because the scripts are shared, this covers CI and local ships alike — "local
only" was not achievable, and would have been wrong anyway.

A deploy marker follows the finalize, so the release timeline records *where* a
build went, not just that it exists:

```bash
"$SENTRY_CLI" deploys new -r "$SENTRY_RELEASE" -e "$DEPLOY_ENV"
```

`ship-ios.sh` passes `SENTRY_DEPLOY_ENV="$TARGET"` (testflight / production) and
the Android script uses `$ANDROID_TRACK` (alpha / internal / beta / production).
`ship-android.sh --promote` records a deploy against the *existing* release
rather than minting a second one — a promote reships the same artifact, so the
release already exists from the build that produced it.

### Release health is on (2026-08-01)

`enableAutoSessionTracking` was `false`, which meant no crash-free rate and no
adoption data — a Releases page that could list builds but never rank them. It
is now `true`. A session is a start/end timestamp plus an `ok`/`errored`/
`crashed` status; it carries no content and no PII, so it does not weaken the
privacy hardening around it. Everything else in that block stays off.

### Release strings now carry the platform

`services/safe-metadata.ts` `getReleaseString()` interpolates
`getSafeBuildMetadata().platform`:

```
threadbase-mobile-ios@1.0.0+186        threadbase-mobile-android@1.0.0+38
```

iOS build numbers and Android version codes are independent counters, so the
previous platform-less form could collide on the same `version+build` and blend
two platforms into one release-health view. Both ship scripts were updated to
match, keeping the SDK and sentry-cli strings identical as §2 requires.

This starts a new release lineage — the existing `threadbase-mobile@…` releases
are untouched and will not gain new builds.

### Per-platform deploys create only that platform's release

Release identity and the create/finalize call live inside each platform's own
script, and `deploy.yml` gates each job on the `platform` input
(`deploy-ios` at line 46, `deploy-android` at line 307). So `platform: ios`
creates only the `-ios` release, `platform: android` only the `-android` one,
and `all` creates both. Keep it that way — hoisting release creation into a
shared workflow step would require that step to know which jobs actually ran.

### Do not filter alerts on `os.name` — it is absent from JS errors

This cost a pair of broken alert rules before it was caught, so it is worth
stating plainly: **`os.name` is not populated on this project's JavaScript
errors.** `filterIntegrations()` in `services/sentry.ts` blocks `DeviceContext`,
and that integration is what supplies the `os` and `device` contexts. Only
native crashes — which arrive through the platform SDK rather than the JS layer
— carry it.

Live confirmation, aggregating every error in the project:

| release | `os.name` | `platform` | count |
|---|---|---|---|
| `…+163` | *(empty)* | `javascript` | 2 |
| `…+163` | `iOS` | `cocoa` | 1 |
| `…+164` | *(empty)* | `javascript` | 1 |

For a React Native app the `javascript` rows are the normal case, so an alert
rule filtering `os.name equals iOS` fires on almost nothing, and the Android
equivalent fires on nothing at all. Both rules were built that way on
2026-08-01 and had to be rewritten.

**Filter on `release` instead.** It is set in `Sentry.init` itself, so it is on
every event regardless of which integrations are stripped, and since the release
string now carries the platform it answers "which platform" and "which build" at
once:

```
release  starts with  threadbase-mobile-ios@
release  starts with  threadbase-mobile-android@
```

A quick way to tell a real tag from a phantom one: type it into the alert
builder's tag field. Sentry offers an existing tag as a plain suggestion, but a
name it has never indexed comes back as *Create "…"*. `release` suggests;
`os.name` offered to create.

Two related traps in the same area:

- **`platform` is a reserved Sentry event field** (`javascript`, `cocoa`,
  `java`), so `scope.setTag('platform', …)` is shadowed by it and never becomes
  queryable. The tag is now `app.platform`, matching the `app.version` /
  `app.build` prefix already in use.
- **Verify a tag against a JS error, not a native crash.** The single
  `os.name: iOS` row above came from a `cocoa` event and is exactly what made
  the tag look present when it was not.

### Commit association — unblocked and wired (2026-08-01)

**§4's "no repository is connected" finding is obsolete.** The GitHub integration
was installed and `RonenMars/threadbase-mobile` connected shortly after that
check. Confirmed from both sides on 2026-08-01: `Settings → Integrations` shows
GitHub *Installed, 1 Configuration*, `Settings → Repositories` lists the repo,
and `sentry-cli repos list` returns it. The external blocker §4 described is
gone, so the pipeline half was added:

```bash
"$SENTRY_CLI" releases set-commits \
  --commit "${SENTRY_REPO:-RonenMars/threadbase-mobile}@$(git rev-parse HEAD)" \
  "$SENTRY_RELEASE"
```

Deliberately **outside** the `new && finalize && deploys new` chain and
non-fatal — a Sentry problem must never fail a ship whose binary is already at
the store.

**Why one commit rather than `--auto`.** The first implementation used `--auto`,
which derives the range from *local* git lineage. That is wrong whenever the
deploy ref has diverged from whatever the previous release was cut from: on
release 187 it swept in ten commits spanning a rebase, including unrelated
landing work. Naming a single commit lets Sentry compute the range server-side
from the previous release, which is both more accurate and independent of how
the checkout was cloned.

That second property removed a CI change too. `--auto` had forced
`fetch-depth: 0` on both `deploy.yml` checkout steps, because `actions/checkout`
defaults to a depth-1 shallow clone and a range needs history. `git rev-parse
HEAD` works fine in a shallow clone, so both checkouts went back to the default
and every future deploy keeps the cheaper clone.

**Failures are annotated, not buried.** All three non-fatal paths route through a
`sentry_warn` helper that emits a `::warning::` workflow command under
`GITHUB_ACTIONS` and falls back to stderr locally. A silently-degraded release
pipeline is the failure mode nobody notices, and a `!` line inside a 20-minute
log is functionally invisible; an annotation surfaces on the run summary and the
checks UI without failing the build. Workflow commands are read from stdout, so
that branch deliberately does not redirect to stderr.

What this unlocks once a build ships with it: suspect commits on each issue,
suggested assignees from code owners, "resolved via commit/PR", and — per the
Repositories page — Seer.

### Still open

- Nothing blocking. The remaining Sentry items are verification: the deploy
  marker, `set-commits`, and both alert rules have all been written but not yet
  exercised by a real ship or a real event.
