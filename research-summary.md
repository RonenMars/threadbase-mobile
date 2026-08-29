# iOS E2E failure research summary

## Scope

This investigates the failed iOS E2E workflow run [33165429413](https://github.com/RonenMars/threadbase-mobile/actions/runs/33165429413), compared with the successful Android run [33165415775](https://github.com/RonenMars/threadbase-mobile/actions/runs/33165415775) and the supplied successful iOS reference [32235343505](https://github.com/RonenMars/threadbase-mobile/actions/runs/32235343505).

## Result

There was one failure, and no application Maestro flow ran.  The job failed while Maestro was bringing up its own iOS XCTest driver.

| Item | Finding |
| --- | --- |
| Failing component | Maestro's local iOS XCTest driver, before the first flow |
| Direct failure | `LocalXCTestInstaller$IOSDriverTimeoutException`: `iOS driver not ready in time` |
| App state | The Release app installed successfully; the failure screenshot shows both Threadbase and the Maestro driver on the simulator home screen |
| Flow results | None: the driver timed out before `launch.yaml` or any subsequent flow began |
| Proven timing | Driver launch was logged at 12:40:04; Maestro timed out at 12:42:03; the captured XCTest log shows the driver only began tests at 12:43:09 and opened its HTTP server at 12:43:27—about 203 seconds after launch |

The XCTest artifact is particularly conclusive: it records six internal `SwipeRouteHandlerV2ClassificationTests` passing and then the driver's `testHttpServer` starting.  Those events occurred after Maestro had already returned exit code 1.  This is a startup-timeout/harness failure, not a failing Threadbase acceptance test.

## Root cause

The failed workflow had two linked defects.

1. The immediate cause is an insufficient Maestro iOS driver startup timeout for this run.  The default deadline expired at roughly 120 seconds, but the driver took about 203 seconds to become usable.  Maestro itself named `MAESTRO_DRIVER_STARTUP_TIMEOUT` in the error as the relevant setting.

2. The workflow's intended Maestro version pin was ineffective.  It ran:

   ```bash
   MAESTRO_VERSION="$MAESTRO_VERSION" curl -fsSL "https://get.maestro.mobile.dev" | bash
   ```

   In a shell pipeline, that assignment only applies to the left-hand `curl` process.  The installer is the right-hand `bash` process, so it receives no `MAESTRO_VERSION` and uses the latest release.  The official installer selects `releases/latest` when the variable is empty and `cli-$MAESTRO_VERSION` when it is set.

This was masked in the known-green iOS run: it used Maestro 2.8.0, which was both the configured pin and the then-current release.  Maestro 2.9.0 was released on 2026-08-26; the failed 2026-08-28 run silently installed and reported 2.9.0 even though `e2e/maestro-version.json` still declares 2.8.0.

The evidence establishes that an unreviewed Maestro upgrade occurred and that the resulting driver exceeded its default deadline.  It does not, by itself, prove that Maestro 2.9.0 is the sole source of the additional latency; a same-runner replay with 2.8.0 is needed to establish that narrower causal claim.

## Why Android being green does not contradict this

Android does not use XCTest, so it cannot exercise the failing component.  The two dispatches also did not test the same checkout despite both being triggered with `ref=main`:

| Run | Actual checked-out commit | Reason |
| --- | --- | --- |
| Android success | `12613c479b748b2df13a0e393b3281cc4ca66aac` | It acquired the shared E2E concurrency slot first. |
| iOS failure | `499ca2ffb302a5c2860d0602c5851882b4820801` | It waited for Android, then resolved the moving `main` ref when checkout began. |

The intervening commits changed Android versioning, `app.json`, and JavaScript dependency lockfiles, but the iOS build completed successfully and the job failed before any app interaction.  They are therefore not evidence of an application-flow regression.

## Suggested fixes

### 1. Correctly pin Maestro (implemented)

Pass the environment variable to `bash`, not to `curl`:

```bash
MAESTRO_VERSION=$(node -p "require('./e2e/maestro-version.json').version")
curl -fsSL "https://get.maestro.mobile.dev" | env MAESTRO_VERSION="$MAESTRO_VERSION" bash
installed_version=$("$HOME/.maestro/bin/maestro" --version)
test "$installed_version" = "$MAESTRO_VERSION"
```

Keep the final equality check.  It turns a silent toolchain drift into an early, diagnosable setup failure.

### 2. Increase the iOS driver startup budget (implemented)

Set `MAESTRO_DRIVER_STARTUP_TIMEOUT=300000` in the iOS Maestro-suite step.  The observed readiness time was about 203 seconds, so 300 seconds leaves a meaningful CI-variance margin.  This should be retained even after pinning if occasional slow XCTest launches are expected; it is not a substitute for pinning.

### 3. Verify the fix with controlled runs

Run the iOS workflow twice against an immutable SHA, not the moving `main` branch:

1. First, apply only the corrected pin and run `499ca2ffb302a5c2860d0602c5851882b4820801` with the existing timeout.  A green result would confirm the unintended 2.9.0 upgrade was sufficient to explain this incident.
2. If startup still exceeds the deadline, add the 300-second timeout and rerun the same SHA.
3. After a stable result, deliberately evaluate Maestro 2.9.0 in a separate change.  Update the pin only after a successful iOS suite run, and keep the exact-version assertion.

For any future Android-vs-iOS comparison, dispatch both platforms against the same full commit SHA.  The workflow correctly records the checkout SHA, but its `ref=main` input is resolved only when each queued job starts.

## Local validation

The corrected install step is covered by a script test that runs the workflow block against a local installer stand-in.  It proves both that the pinned version reaches the installer process and that a mismatched installed version fails setup.

On the local iPhone 17 Pro simulator, Maestro 2.8.0 started its iOS XCTest driver in about 17 seconds with `MAESTRO_DRIVER_STARTUP_TIMEOUT=300000`.  The full flow suite could not complete because the only local Xcode installation (26.6) hung in `simctl privacy grant location-always` before the first flow assertion.  GitHub uses the `macos-15-arm64` / Xcode 26.3 environment, so this is a local simulator-tooling incompatibility rather than evidence against the CI changes.

## Evidence consulted

- Failed-run job log and `maestro-artifacts` upload (including `xctest_runner_2026-08-28_124002.log` and `sim-at-failure.png`): [run 33165429413](https://github.com/RonenMars/threadbase-mobile/actions/runs/33165429413)
- Successful iOS reference, which used Maestro 2.8.0 on the same `macos-15-arm64` image release: [run 32235343505](https://github.com/RonenMars/threadbase-mobile/actions/runs/32235343505)
- Successful Android comparison and its recorded checkout: [run 33165415775](https://github.com/RonenMars/threadbase-mobile/actions/runs/33165415775)
- [Maestro install script](https://get.maestro.mobile.dev) version-selection logic and [Maestro 2.9.0 release](https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.9.0)
