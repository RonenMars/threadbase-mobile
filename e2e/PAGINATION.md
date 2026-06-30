# Pagination E2E

> **Status (2026-05-24, initial commit):** mock-server + harness + network
> assertion are smoke-tested standalone and confirmed working. The maestro
> flow itself has not yet been run end-to-end against a clean Release build
> on this machine — the local sim was in Debug state at commit time and
> rebuild attempts hit a transient `@babel/code-frame` resolution issue. Run
> `./scripts/run-pagination-e2e.sh` against a Release build to verify.

Tests that the conversation list paginates correctly in the **hub** layout.
Validates two things at once:

1. **Visual** — high-index conversations become visible after scrolling, proving the rendering pipeline handles every page.
2. **Network** — the mock server sees multiple `/api/conversations` requests with monotonically increasing `offset` query params, proving the client actually fetches subsequent pages instead of stopping at the first one.

## Files

| Path | Purpose |
|---|---|
| `e2e/pagination-mock-server.js` | Mock streamer serving 346 conversations + 5 sessions on port `7072`. Logs every request to an in-memory array, exposed via `GET /__mock/requests`. |
| `e2e/scripts/reset-pagination-mock.js` | Maestro `runScript` JS that POSTs to the mock's `/__mock/reset` endpoint at the start of each flow. |
| `e2e/pagination-hub.yaml` | Maestro flow: paired against mock → hub layout → all 5 project rows visible → drill into `alpha-service` → scrollUntilVisible conversation #100, #345. |
| `scripts/run-pagination-e2e.sh` | Harness — boots the mock, runs the hub flow on the booted iOS simulator, asserts the mock's request log shows pagination (≥ 2 distinct offsets, at least one > 0), tears down. |

## Prerequisites

- A **Release-configuration** build of the app installed on a booted iOS simulator. Debug builds go through the expo-dev-launcher and dev-menu modal, which interferes with these flows. Rebuild with `npx expo run:ios --configuration Release` if the sim has a Debug build.
- `maestro` CLI installed (`maestro --version` should report 2.0+).
- Port `7072` free.

## Run

```bash
# Hub flow + network assertion
./scripts/run-pagination-e2e.sh
```

> The classic-layout flow was removed: its conversation rows never had stable
> `testID`s (`classic-conv-*`), so it could not assert reliably. Pagination is
> exercised by the hub flow, which shares the same network-pagination assertion.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Visual + network assertions both passed |
| 1 | Maestro flow failed (visual) |
| 2 | Network assertion failed (no pagination observed) |
| 3 | Mock server failed to start |

## Screenshots

Maestro writes per-step screenshots to `e2e/_artifacts/`:

- `pagination-hub-01-top.png` — hub with first project row
- `pagination-hub-02-all-projects.png` — after scrolling to verify all 5 projects
- `pagination-hub-03-project-top.png` — drilled into alpha-service
- `pagination-hub-04-project-deep.png` — scrolled deep within alpha-service

## How the pagination assertion works

The mock-server records every request in an in-memory array. After the maestro flows complete, the runner script fetches `GET /__mock/requests`, filters for `GET /api/conversations`, extracts the `offset` query param from each, and asserts:

- ≥ 2 distinct offsets seen (else the client never made a second-page request)
- At least one offset > 0 (else all calls were for page 1)

This catches regressions where `fetchAllConversationPagesForServer` silently exits the loop after the first page (e.g. if `hasMore` were always false, or if `total` were misread).
