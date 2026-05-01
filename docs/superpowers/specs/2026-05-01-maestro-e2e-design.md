# Maestro E2E Test Setup — Design Spec

**Date:** 2026-05-01  
**Scope:** Sessions Hub + Session Detail flows, mock server v1

---

## 1. Architecture

Three parts work together:

1. **Mock server** (`e2e/mock-server.js`) — Node `http` script, no dependencies, listens on `MOCK_PORT` (default `7071`). Returns static JSON fixtures for the endpoints the app hits. Returns `401` when `Authorization` header is missing. Logs each request to stdout.

2. **Fixtures** (`e2e/fixtures/`) — plain JSON files consumed by the mock server. Shared across all flows.

3. **Maestro flows** (`e2e/`) — YAML files that launch the app pointed at the mock server and assert on what's visible.

**Run sequence:**
```
node e2e/mock-server.js &
sleep 1
maestro test e2e/03_hub.yaml
maestro test e2e/04_session_detail.yaml
kill %1
```

Wrapped in a single `package.json` script: `test:e2e:mock`.

---

## 2. Mock Server

File: `e2e/mock-server.js`

Handles these endpoints (all others return `404`):

| Method | Path | Fixture |
|--------|------|---------|
| `GET` | `/api/sessions` | `fixtures/sessions.json` |
| `GET` | `/api/sessions/:id` | `fixtures/session-detail.json` |
| `GET` | `/api/sessions/:id/output` | `fixtures/terminal-output.json` |
| `GET` | `/api/conversations` | `fixtures/conversations.json` |

Auth: reads `Authorization: Bearer <key>` header. Returns `401` if missing or empty. Accepts any non-empty key (no key validation in mock).

No WebSocket support in v1. Terminal stream falls back to polled `GET /api/sessions/:id/output`, which `useTerminalStream` already supports.

---

## 3. Fixtures

**`e2e/fixtures/sessions.json`** — array of 4 sessions:
- `{ id: "session-abc123", name: "Build feature", status: "running" }`
- `{ id: "session-def456", name: "Review PR", status: "waiting" }`
- `{ id: "session-ghi789", name: "Fix bug", status: "completed" }`
- `{ id: "session-jkl012", name: "Deploy staging", status: "failed" }`

**`e2e/fixtures/session-detail.json`** — single session object for `session-abc123` with a short `messages` array (1 user message + 1 assistant reply).

**`e2e/fixtures/terminal-output.json`** — shaped as `TerminalHistoryResponse`:
```json
{ "lines": ["$ claude .", "Starting session...", "Waiting for input"] }
```

**`e2e/fixtures/conversations.json`** — array of 2 conversations:
```json
[
  { "id": "conv-111", "title": "Initial setup", "updatedAt": "2026-05-01T10:00:00Z" },
  { "id": "conv-222", "title": "Feature discussion", "updatedAt": "2026-05-01T11:00:00Z" }
]
```

All IDs are hardcoded strings so Maestro flows can reference them predictably.

---

## 4. Maestro Flows

**`e2e/00_setup.yaml` — Mock onboarding helper**

Reusable flow: runs onboarding against the mock server (`http://localhost:7071`). Called via Maestro's `runFlow` directive at the start of each test flow. Ensures a clean, credentialed state without repeating steps in every file.

**`e2e/03_hub.yaml` — Sessions Hub**

Calls `00_setup.yaml` via `runFlow`, then:
- Assert status sections visible: "Running", "Waiting for Input", "Completed", "Failed"
- Assert session names visible: "Build feature", "Review PR", "Fix bug", "Deploy staging"
- Tap "Build feature" row → assert `session-detail-screen` visible
- Navigate back → assert `hub-screen` visible

**`e2e/04_session_detail.yaml` — Session Detail**

Calls `00_setup.yaml` via `runFlow`, navigates to `session-abc123`, then:
- Assert session name "Build feature" visible
- Assert terminal line "Waiting for input" visible (via `terminal-output` testID)
- Assert `message-input` field present
- Type a message → assert it appears in the input field

---

## 5. `testID` Additions

Additive only — no existing props modified.

| Component | `testID` value |
|-----------|----------------|
| Sessions Hub screen root | `hub-screen` |
| Session row (each item) | `session-row-{id}` |
| Session detail screen root | `session-detail-screen` |
| Terminal output container | `terminal-output` |
| Message input field | `message-input` |
| Tab bar "Sessions" button | `tab-sessions` |

Status section headers ("Running", "Waiting for Input", etc.) are matched by visible text — no `testID` needed.

---

## 6. `package.json` Script

```json
"test:e2e:mock": "node e2e/mock-server.js & sleep 1 && maestro test e2e/03_hub.yaml && maestro test e2e/04_session_detail.yaml; kill %1"
```

---

## 7. Future: Real Server Tier

When ready, add `test:e2e:smoke` that runs `01_onboarding.yaml` + `02_sessions.yaml` against a real streamer instance using `THREADBASE_SERVER_URL` + `THREADBASE_API_KEY`. No mock server involved. The mock suite and smoke suite are independent and can be run separately.
