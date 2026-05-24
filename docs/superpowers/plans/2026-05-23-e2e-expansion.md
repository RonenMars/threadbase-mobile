# Plan — Expand Maestro E2E coverage to high-value flows

**Status:** queued
**Created:** 2026-05-23
**Related:** `e2e/README.md` (current suite + known limits + future work), `e2e/launch.yaml`, `e2e/browse.yaml`, `e2e/setup.yaml`

## Current state

`npm run test:e2e:mock` runs two flows against a local Node mock on `:7071`:

- **`launch.yaml`** — app boots to `hub-screen`. `setup.yaml` walks the 7-step onboarding carousel on a fresh sim; on subsequent runs Keychain-stored pairing credentials survive `clearState: true` and the carousel is skipped.
- **`browse.yaml`** — asserts `hub-screen` is mounted and the filter/sort sheet opens. Does **not** tap into a session.

Time: 30–60s locally. Coverage: ~5% of user-visible surface.

## What's NOT covered (gap analysis)

Drawn from `e2e/README.md` + recent project memory:

| Area | Reason untested | Difficulty |
|---|---|---|
| Session detail navigation | Project group row `TouchableOpacity` testID doesn't surface to iOS a11y tree — README "Known limits" item 1 | Low (source fix: wrap row in `<View accessible testID>`) |
| Chat send + streamed response | Mock server is REST-only; no `/ws` upgrade | Medium (extend mock to fake WS frames) |
| Attachment send — single | No mock endpoint for upload | Medium |
| Attachment send — multi | Bug 5: produces no output — likely unsupported multi-file path | Medium (regression test; also needs Feature 3 work) |
| Onboarding end-to-end on erased sim | Currently only walked when Keychain empty | Low (CI step: `xcrun simctl erase` before run) |
| Session rename | Needs `PATCH /api/sessions/:id` mock | Low |
| Settings — theme toggle | Pure client; needs new flow + testIDs | Low |
| Settings — language/RTL | Pure client; i18n already in place (291 tests) | Medium (RTL layout assertions are hard in Maestro) |
| Keyboard-avoidance regression | Recent fix on `fix/flashlist-v2-recycling-mvcp` — input clipped behind keyboard incl. predictive-text bar | Medium (Maestro keyboard handling is finicky) |
| Filter/sort *application* (vs. sheet opening) | Out of smoke scope today but a clear next step | Low |

## Priority order (proposal — confirm with user when picking up)

**P0 — quick wins, unblocks the rest**
1. Fix project-row testID a11y so Maestro can tap into a session. Source change in `components/sessions/hub/SessionRow.tsx` (or the parent project group row component). New flow: `session_open.yaml`.
2. Add the mock endpoints currently 404ing (`/api/sessions/names`, `/api/projects/popular`, `/api/conversations/count`, `POST /api/push/register`) so the error banner stops obscuring the hub. Listed in README "Future work".

**P1 — regression coverage for recent bugfixes**
3. Keyboard-avoidance flow on chat input — guards the 2026-05-22 fix (`KeyboardAvoidingView` outside `SafeAreaView`).
4. Onboarding end-to-end on a freshly erased sim, gated behind a CI-only env flag (local dev shouldn't pay the erase cost).
5. Session rename flow.

**P2 — needs mock work**
6. `/ws` WebSocket fake in `e2e/mock-server.js` — minimal frame-replay from a fixture. Unlocks `chat_send.yaml`.
7. Single-attachment send flow.
8. Multi-attachment send flow — currently expected to fail (Bug 5); use as a watchdog test that flips green when the bug is fixed.

**P3 — broader UX**
9. Settings: theme toggle.
10. Settings: language switch + RTL spot-check.
11. Filter/sort *application* (not just sheet open).

## TestIDs likely needed (preliminary)

To be confirmed during execution — most will need to be added to source:

- `project-row-<projectId>` on the hub's project group row (wrap in `<View accessible>`)
- `session-detail-back`, `session-detail-rename-cta`, `session-rename-input`, `session-rename-confirm`
- `chat-input`, `chat-send-cta`, `chat-attachment-cta`, `chat-message-<index>`
- `settings-screen`, `settings-theme-toggle`, `settings-language-select`
- `keyboard-spacer` or equivalent anchor to assert input visibility above keyboard

## Mock server work

`e2e/mock-server.js` is dependency-free Node HTTP. Extensions needed:

- Suppress 404 banner: stub `/api/sessions/names`, `/api/projects/popular`, `/api/conversations/count`, `POST /api/push/register`
- `PATCH /api/sessions/:id` for rename
- `POST /api/sessions/:id/messages` + minimal `/ws` upgrade with hardcoded frame replay
- Attachment upload endpoints — TBD when reading the actual client calls

Keep it dependency-free; if WS gets complex, gate the chat-send flow behind a separate `test:e2e:full` script and leave `test:e2e:mock` as the fast smoke.

## Open questions

- Are we OK paying the cost of erasing the sim once per CI run for the onboarding flow?
- Should attachment + WS flows live in `test:e2e:mock` (slower smoke) or a separate `test:e2e:full` job?
- Is there appetite to also run the suite on Android (Maestro's testID handling is better there, per README)?

## Acceptance criteria (for the plan once executed)

- [ ] At least P0 + P1 flows merged and passing locally
- [ ] `npm run test:e2e:mock` runtime stays under 3 min
- [ ] Each new flow documented in `e2e/README.md` with what it covers + any testIDs added
- [ ] Mock server changes don't break existing flows
