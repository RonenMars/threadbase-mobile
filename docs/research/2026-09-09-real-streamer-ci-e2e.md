# Real Streamer E2E in CI

**Status:** Implemented (opt-in)

**Date:** 2026-09-09

**Scope:** Run the leave-session navigation matrix against a real `tb-streamer` backend in GitHub Actions without invoking a hosted AI model.

## Implementation

The dispatch-only [Real Streamer E2E workflow](../../.github/workflows/real-streamer-e2e.yml) builds the deterministic streamer demo target at the default pinned compatibility commit `2177f5b634855ac9a33903d9ed780978c1aa8d30` and runs the Android matrix through [the ownership-safe controller](../../e2e/run-leave-nav.js).
The workflow accepts another full streamer commit SHA for deliberate compatibility probes, records the resolved container and image identities in the job summary, and does not run on pull requests or the weekly schedule.

## Goal

Exercise the mobile app, HTTP and WebSocket transports, streamer session lifecycle, PTY manager, and navigation behavior in one CI test.

The provider process should be deterministic and contain no Anthropic credential.

This test complements the existing mock-server suite.
It does not replace production validation against an installed Claude Code or Codex CLI.

## Reference: AutoKitteh Web Platform

The archived AutoKitteh web-platform workflow demonstrates the relevant service-container pattern.
Each browser job runs on an ephemeral `ubuntu-latest` runner and performs these steps:

1. Restore or pull an AutoKitteh server image.
2. Start the image with `docker run -d` and publish the real backend on runner port 9980.
3. Configure authentication, CORS, and initial database records through environment variables and the backend's startup command.
4. Follow the container logs into a job artifact.
5. Poll the backend until it responds or a five-minute timeout expires.
6. Build and serve the frontend on port 8000.
7. Run Playwright with one worker against the frontend and localhost backend.
8. Let the ephemeral runner dispose of the container and database after the job.

The workflow and composite action are pinned here:

- [Test job](https://github.com/autokitteh/web-platform/blob/95d9899f9847abe6fba5a10311541dbd3e0bedc5/.github/workflows/build_test_and_release.yml#L66-L147)
- [Test-environment action](https://github.com/autokitteh/web-platform/blob/95d9899f9847abe6fba5a10311541dbd3e0bedc5/.github/actions/setup-test-env/action.yml)
- [Playwright frontend startup and authentication](https://github.com/autokitteh/web-platform/blob/95d9899f9847abe6fba5a10311541dbd3e0bedc5/playwright.config.ts#L9-L16)

The backend is real application code, not an HTTP fixture server.
The environment around it is controlled: the database is ephemeral and seeded, the user identity is fixed, and the browser sends a CI JWT with every request.

The reference workflow has one reproducibility weakness that Threadbase should avoid.
Its repository variable currently names `public.ecr.aws/autokitteh/server:latest`, and its Docker cache key hashes the image name rather than the resolved digest.
A cache hit can therefore select an older image while still reporting the `latest` tag.

## Existing Threadbase Building Blocks

`tb-streamer` already contains the backend environment needed for this approach.

Its `docker/Dockerfile` has a `demo` target that builds the real streamer and installs a deterministic executable as `/usr/local/bin/claude`.
The streamer still creates and controls a real child process through `node-pty`; only the provider executable is substituted.

The stub:

- prints the Claude welcome frame and ready prompt marker;
- remains alive while attached to the PTY;
- accepts terminal input and emits scripted output;
- exits on `SIGTERM` or `SIGINT`; and
- performs no network model request.

The demo entrypoint also provides:

- an isolated writable home at `/data`;
- a fixed, non-sensitive API key;
- seeded conversation history;
- real project directories beneath `/home/demo/projects`;
- a browse root restricted to those project directories; and
- an HTTP health check.

The relevant streamer files are:

- `tb-streamer/docker/Dockerfile`
- `tb-streamer/docker/entrypoint.sh`
- `tb-streamer/docker/claude-code-stub/claude.js`
- `tb-streamer/docker-compose.yml`

The resulting boundary is suitable for the leave-session matrix:

| Layer | Test implementation |
|---|---|
| Mobile UI and navigation | Real release app driven by Maestro |
| Pairing and authentication | Real streamer endpoints with a deterministic API key |
| Session list and detail | Real streamer REST and WebSocket state |
| Start, leave, stop, and hold | Real streamer handlers and lifecycle policy |
| PTY management | Real `node-pty` child process |
| Provider | Deterministic Claude stand-in |
| AI model and billing | Not present |

## Recommended First CI Target

Run the matrix in the existing Android E2E job on `ubuntu-24.04`.
Linux GitHub-hosted runners support Docker and the Android emulator already used by the repository.

The first implementation should use a streamer checkout pinned to an explicit commit and build its `demo` Docker target.
Pinning the source commit makes the tested compatibility boundary visible and avoids mutable image tags.

The job should perform this sequence:

1. Check out `threadbase-mobile`.
2. Check out `threadbase-streamer` at the selected compatibility commit into a separate path.
3. Build the streamer's `demo` Docker target with BuildKit layer caching.
4. Start a uniquely named container with an ephemeral data volume and publish container port 8080 on runner port 8766.
5. Poll `GET /healthz`, then make an authenticated `GET /api/info` request.
6. Build or restore the mobile Release APK.
7. Boot the Android API 35 emulator and install the APK.
8. Run the six-case leave-session matrix.
9. Upload streamer logs and Maestro artifacts when the test fails.
10. Stop the container and remove its test volume in an `always()` step.

The runner-side controller should call `http://127.0.0.1:8766`.
The app inside the Android emulator should call `http://10.0.2.2:8766`.

## Required Harness Changes

The current `e2e/run-leave-nav.js` assumes that the Node controller and mobile app use the same server URL.
That works on an iOS simulator because both use `localhost`, but it does not work on Android.

Split the address into two inputs:

| Input | Android CI value | Purpose |
|---|---|---|
| `REAL_STREAMER_CONTROL_URL` | `http://127.0.0.1:8766` | Node runner health, start, list, and stop requests |
| `REAL_STREAMER_APP_URL` | `http://10.0.2.2:8766` | URL paired inside the Android emulator |

The current default session path is the host mobile worktree.
That path does not exist inside the container and is outside the demo image's browse root.
CI should instead use a known container path such as `/home/demo/projects/threadbase-mobile`.

The following changes are required before enabling the job:

1. Accept separate controller and app URLs.
2. Accept an explicit server-side session path.
3. Replace the iOS-only preflight in `test:e2e:leave-nav` with platform-specific preflights or invoke the platform-neutral runner directly from Android CI.
4. Track every session created by the current test invocation.
5. Stop only those tracked sessions during cleanup.
6. If `POST /api/sessions/start` returns `202`, poll the returned session until it becomes ready or fails instead of treating the pending response as an immediate failure.
7. Write the container ID, selected streamer commit, image ID, and health response to the job summary.

The cleanup correction is required before CI adoption.
The current runner lists all sessions with `ptyAttached` and stops all of them.
That is acceptable only on a disposable isolated backend, but tracking owned IDs prevents the same helper from terminating unrelated local sessions when developers run it manually.

## iOS CI

The same Docker procedure is not directly available in the repository's `macos-26` GitHub-hosted job.
The initial CI gate should therefore use Android.

An iOS version can follow by checking out and building `tb-streamer` natively on the macOS runner, placing the existing Claude stub first on `PATH`, and starting the streamer with isolated `HOME` and configuration directories.
That path needs its same source pin, readiness probes, owned-session cleanup, log capture, and process teardown as the Docker job.

Running the test against the public demo server is useful as a separate availability smoke test.
It is a weaker pull-request gate because the deployed backend can change independently, network availability affects the result, and concurrent test runs share state.

## Scope of Confidence

This CI test would prove that:

- the app can pair with and authenticate to a real streamer;
- new and already-running PTY sessions appear through the real API and WebSocket paths;
- each leave-modal action reaches its real streamer handler;
- stop and hold acknowledgements complete without a mock response;
- the session-detail screen yields to the hub without the ended-session redirect winning the race; and
- the real streamer and app contracts remain compatible at the pinned revisions.

It would not prove that:

- an installed Claude Code or Codex release accepts the streamer's exact command-line arguments;
- provider authentication and model calls work;
- provider output detection remains correct across provider releases;
- remote tunnels, production TLS, or non-loopback networking work; or
- iOS-specific navigation and accessibility behavior match Android.

Those boundaries remain covered by local real-provider testing, production/demo smoke tests, and the existing iOS Maestro suite.

## Rollout

1. Make the leave-session runner platform-neutral and ownership-safe.
2. Add an opt-in Android workflow dispatch using the pinned streamer checkout.
3. Run the job repeatedly to establish build time and flake rate.
4. Add Docker and Gradle caching without introducing a mutable backend tag.
5. Make the job required after it is stable.
6. Add the native macOS streamer setup if iOS coverage justifies its maintenance cost.

The Android job is the smallest reliable first step because it combines the repository's existing emulator workflow with the streamer's existing deterministic container target.
