# Real Streamer CI E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the six-case leave-session navigation matrix against a commit-pinned deterministic `threadbase-streamer` demo container in an opt-in Android GitHub Actions job.

**Architecture:** Make `e2e/run-leave-nav.js` distinguish the runner-visible control URL from the emulator-visible app URL, poll pending session starts, and clean up only session IDs created during the invocation. Reuse the existing Android APK/emulator runner and add a dispatch-only workflow that builds the streamer's `demo` target, probes it, records provenance, and always tears it down.

**Tech Stack:** Node.js 24, Jest, Maestro, Android API 35, Docker Buildx, GitHub Actions.

**Spec:** `docs/research/2026-09-09-real-streamer-ci-e2e.md`

## Global Constraints

- The provider process is the deterministic `/usr/local/bin/claude` stub and has no Anthropic credential.
- The default streamer source is pinned to commit `2177f5b634855ac9a33903d9ed780978c1aa8d30`.
- The runner calls `http://127.0.0.1:8766`; the Android app calls `http://10.0.2.2:8766`.
- CI sessions use `/home/demo/projects/threadbase-mobile`.
- Cleanup stops only sessions created by the current invocation.
- The initial workflow is opt-in through `workflow_dispatch`; it is not a required pull-request check.

---

### Task 1: Ownership-safe, platform-neutral leave-navigation harness

**Files:**
- Modify: `e2e/run-leave-nav.js`
- Create: `__tests__/unit/scripts/run-leave-nav.test.js`

**Interfaces:**
- Consumes: `REAL_STREAMER_CONTROL_URL`, `REAL_STREAMER_APP_URL`, `REAL_STREAMER_SESSION_PATH`, and `E2E_SERVER_TOKEN`.
- Produces: `streamer(url, token, options)`, `runMatrix(options)`, and a CLI that passes the app URL to Maestro while using the control URL for HTTP requests.

- [ ] **Step 1: Write failing behavioral tests**

Cover separate HTTP/app URLs and explicit session paths, `202 { id, status: "pending" }` readiness polling, and preservation of a pre-existing live session while newly observed invocation sessions are stopped.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npx jest --config jest.config.scripts.js --runInBand __tests__/unit/scripts/run-leave-nav.test.js`

Expected: FAIL because the runner does not export the testable interfaces, uses one URL, rejects 202 responses, and stops all live sessions.

- [ ] **Step 3: Implement the minimal harness changes**

Export the runner helpers behind `if (require.main === module)`, add bounded pending-session polling, snapshot session IDs around each flow, add only newly created IDs to an owned set, and stop only owned IDs in `finally`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npx jest --config jest.config.scripts.js --runInBand __tests__/unit/scripts/run-leave-nav.test.js`

Expected: PASS.

### Task 2: Android real-streamer execution path and dispatch workflow

**Files:**
- Modify: `e2e/run-android-ci.sh`
- Create: `.github/workflows/real-streamer-e2e.yml`
- Create: `__tests__/unit/scripts/real-streamer-e2e-workflow.test.js`

**Interfaces:**
- Consumes: the Task 1 CLI environment contract and the existing prebuilt Release APK path.
- Produces: a dispatch-only Android job with a pinned streamer checkout, cached demo-image build, unique container/volume, authenticated readiness probes, provenance summary, failure artifacts, and `always()` cleanup.

- [ ] **Step 1: Write failing workflow and runner behavior tests**

Parse the workflow YAML and verify dispatch-only triggering, the 40-character default streamer SHA, `demo` target, loopback/emulator URL split, server-side path, authenticated probe, provenance summary, failure artifact upload, and unconditional teardown. Execute `e2e/run-android-ci.sh` with command stubs and verify the real-streamer environment selects `run-leave-nav.js` without starting the mock server.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npx jest --config jest.config.scripts.js --runInBand __tests__/unit/scripts/real-streamer-e2e-workflow.test.js`

Expected: FAIL because the workflow and real-streamer Android branch do not exist.

- [ ] **Step 3: Implement the minimal workflow and runner branch**

Reuse the existing Release APK cache/build and emulator setup, build the pinned streamer's `demo` target with Buildx GHA caching, start it on runner port 8766, wait for `/healthz` and authenticated `/api/info`, invoke the leave matrix inside the emulator runner, collect failure artifacts, and remove the exact container and volume in an `always()` step.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npx jest --config jest.config.scripts.js --runInBand __tests__/unit/scripts/real-streamer-e2e-workflow.test.js __tests__/unit/scripts/run-leave-nav.test.js`

Expected: PASS.

### Task 3: Documentation status and repository verification

**Files:**
- Modify: `docs/research/2026-09-09-real-streamer-ci-e2e.md`

**Interfaces:**
- Consumes: completed Tasks 1 and 2.
- Produces: an implementation-status note naming the opt-in workflow and pinned default compatibility revision.

- [ ] **Step 1: Update the research status**

Change `Proposed` to `Implemented (opt-in)` and add a short implementation note linking the workflow and runner.

- [ ] **Step 2: Run all required checks**

Run: `npm run lint`, `npm run typecheck`, `npm run test:ci`, and `npm run test:scripts`.

Expected: all commands exit 0.

- [ ] **Step 3: Inspect the final diff**

Run: `/opt/homebrew/bin/git diff --check && /opt/homebrew/bin/git status --short && /opt/homebrew/bin/git diff --stat && /opt/homebrew/bin/git diff`

Expected: only the plan, harness, tests, workflow, runner branch, and research status are changed; no generated artifacts are present.
