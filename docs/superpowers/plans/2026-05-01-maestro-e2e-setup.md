# Maestro E2E Test Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a Maestro E2E test suite with a Node mock server covering the Sessions Hub and Session Detail flows.

**Architecture:** A static Node `http` mock server (`e2e/mock-server.js`) serves JSON fixtures for the four endpoints the app hits. Two new Maestro YAML flows (`03_hub.yaml`, `04_session_detail.yaml`) launch the app against the mock server and assert on visible content. A reusable `00_setup.yaml` flow handles onboarding so each test starts from a clean state. Six `testID` props are added to components to give Maestro stable element targets.

**Tech Stack:** Node.js built-in `http` (no extra deps), Maestro CLI, React Native `testID` props, JSON fixtures.

---

## File Map

**Create:**
- `e2e/mock-server.js` — Node HTTP mock server
- `e2e/fixtures/sessions.json` — 3 sessions (running, waiting_input, idle)
- `e2e/fixtures/session-detail.json` — single session detail for `session-abc123`
- `e2e/fixtures/terminal-output.json` — canned terminal lines
- `e2e/fixtures/conversations.json` — 2 conversations
- `e2e/00_setup.yaml` — reusable onboarding flow against mock
- `e2e/03_hub.yaml` — Sessions Hub assertions
- `e2e/04_session_detail.yaml` — Session Detail assertions

**Modify:**
- `app/index.tsx` — add `testID="hub-screen"` to root `SafeAreaView`
- `components/sessions/hub/SessionRow.tsx` — add `testID={`session-row-${session.id}`}` to root `TouchableOpacity`
- `app/session/[id].tsx` — add `testID="session-detail-screen"` to main `SafeAreaView`, `testID="terminal-output"` to terminal `View`, `testID="message-input"` to `TextInput`
- `components/terminal/TerminalOutput.tsx` — no change needed (terminal-output testID goes on wrapper in session detail)
- `package.json` — add `test:e2e:mock` script

---

## Task 1: JSON Fixtures

**Files:**
- Create: `e2e/fixtures/sessions.json`
- Create: `e2e/fixtures/session-detail.json`
- Create: `e2e/fixtures/terminal-output.json`
- Create: `e2e/fixtures/conversations.json`

> Note: `Session.status` is typed as `'running' | 'waiting_input' | 'idle'` in `types/api.ts`. Use only these values in fixtures. The Hub groups sessions by project path — all three sessions share the same `projectPath` so they appear in one card.

- [ ] **Step 1: Create `e2e/fixtures/sessions.json`**

```json
[
  {
    "id": "session-abc123",
    "status": "running",
    "ptyAttached": true,
    "projectPath": "/home/user/my-project",
    "projectName": "my-project",
    "branch": "main",
    "lastOutput": "Waiting for input",
    "elapsedMs": 12000,
    "promptCount": 3,
    "startedAt": "2026-05-01T10:00:00.000Z"
  },
  {
    "id": "session-def456",
    "status": "waiting_input",
    "ptyAttached": true,
    "projectPath": "/home/user/my-project",
    "projectName": "my-project",
    "branch": "feature/auth",
    "lastOutput": "Waiting for input",
    "elapsedMs": 45000,
    "promptCount": 7,
    "startedAt": "2026-05-01T09:30:00.000Z"
  },
  {
    "id": "session-ghi789",
    "status": "idle",
    "ptyAttached": false,
    "projectPath": "/home/user/my-project",
    "projectName": "my-project",
    "branch": "fix/login",
    "lastOutput": "",
    "elapsedMs": 90000,
    "promptCount": 12,
    "startedAt": "2026-05-01T08:00:00.000Z"
  }
]
```

- [ ] **Step 2: Create `e2e/fixtures/session-detail.json`**

```json
{
  "id": "session-abc123",
  "status": "running",
  "ptyAttached": true,
  "projectPath": "/home/user/my-project",
  "projectName": "my-project",
  "branch": "main",
  "lastOutput": "Waiting for input",
  "elapsedMs": 12000,
  "promptCount": 3,
  "startedAt": "2026-05-01T10:00:00.000Z"
}
```

- [ ] **Step 3: Create `e2e/fixtures/terminal-output.json`**

```json
{
  "lines": ["$ claude .", "Starting session...", "Waiting for input"]
}
```

- [ ] **Step 4: Create `e2e/fixtures/conversations.json`**

```json
[
  {
    "id": "conv-111",
    "title": "Initial setup",
    "projectPath": "/home/user/my-project",
    "branch": "main",
    "messageCount": 4,
    "lastActivity": "2026-05-01T10:00:00.000Z"
  },
  {
    "id": "conv-222",
    "title": "Feature discussion",
    "projectPath": "/home/user/my-project",
    "branch": "feature/auth",
    "messageCount": 2,
    "lastActivity": "2026-05-01T09:00:00.000Z"
  }
]
```

- [ ] **Step 5: Commit**

```bash
git add e2e/fixtures/
git commit -m "test: add e2e fixture JSON files"
```

---

## Task 2: Mock Server

**Files:**
- Create: `e2e/mock-server.js`

The server matches paths using simple `if` chains (no dependencies). It reads fixtures from `e2e/fixtures/` relative to the project root. Dynamic path segments (`:id`) are extracted with a regex.

- [ ] **Step 1: Create `e2e/mock-server.js`**

```js
#!/usr/bin/env node
'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = parseInt(process.env.MOCK_PORT ?? '7071', 10)
const FIXTURES = path.join(__dirname, 'fixtures')

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8')
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  const method = req.method
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const p = url.pathname

  console.log(`${method} ${p}`)

  const auth = req.headers['authorization'] ?? ''
  if (!auth.startsWith('Bearer ') || auth.slice(7).trim() === '') {
    return json(res, 401, { error: 'Unauthorized' })
  }

  if (method === 'GET' && p === '/api/sessions') {
    return json(res, 200, readFixture('sessions.json'))
  }

  if (method === 'GET' && p === '/api/conversations') {
    return json(res, 200, readFixture('conversations.json'))
  }

  const sessionMatch = p.match(/^\/api\/sessions\/([^/]+)$/)
  if (method === 'GET' && sessionMatch) {
    return json(res, 200, readFixture('session-detail.json'))
  }

  const outputMatch = p.match(/^\/api\/sessions\/([^/]+)\/output$/)
  if (method === 'GET' && outputMatch) {
    return json(res, 200, readFixture('terminal-output.json'))
  }

  // Stub info endpoint — used by the app on connect
  if (method === 'GET' && p === '/api/info') {
    return json(res, 200, {
      version: '0.0.0-mock',
      machineName: 'mock-machine',
      platform: 'linux',
      activeSessions: 1,
    })
  }

  // Stub conversations count
  if (method === 'GET' && p === '/api/conversations/count') {
    return json(res, 200, { count: 2 })
  }

  // Stub sessions count
  if (method === 'GET' && p === '/api/sessions/count') {
    return json(res, 200, { count: 3 })
  }

  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`Mock server listening on http://localhost:${PORT}`)
})
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x e2e/mock-server.js
```

- [ ] **Step 3: Smoke-test it manually**

```bash
node e2e/mock-server.js &
curl -s -H "Authorization: Bearer test" http://localhost:7071/api/sessions | head -c 200
curl -s http://localhost:7071/api/sessions  # should return 401
kill %1
```

Expected: first curl returns the sessions JSON array. Second curl returns `{"error":"Unauthorized"}`.

- [ ] **Step 4: Commit**

```bash
git add e2e/mock-server.js
git commit -m "test: add Node mock server for Maestro e2e"
```

---

## Task 3: Add `testID` props

**Files:**
- Modify: `app/index.tsx:177`
- Modify: `components/sessions/hub/SessionRow.tsx:54`
- Modify: `app/session/[id].tsx:491` (main SafeAreaView), `:505` (terminal View), `:579` (TextInput)

- [ ] **Step 1: Add `testID="hub-screen"` to `app/index.tsx`**

Find line 177:
```tsx
    <SafeAreaView style={styles.container} edges={['top']}>
```
Change to:
```tsx
    <SafeAreaView style={styles.container} edges={['top']} testID="hub-screen">
```

- [ ] **Step 2: Add `testID` to `SessionRow` in `components/sessions/hub/SessionRow.tsx`**

Find lines 54–58:
```tsx
  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.75}
      style={styles.row}
    >
```
Change to:
```tsx
  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.75}
      style={styles.row}
      testID={`session-row-${session.id}`}
    >
```

- [ ] **Step 3: Add `testID="session-detail-screen"` to `app/session/[id].tsx`**

Find the main return's SafeAreaView at line 491:
```tsx
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
```
Change to:
```tsx
  return (
    <SafeAreaView style={styles.container} edges={['bottom']} testID="session-detail-screen">
```

- [ ] **Step 4: Add `testID="terminal-output"` to the terminal `View` in `app/session/[id].tsx`**

Find line 505:
```tsx
        <View style={styles.terminal}>
```
Change to:
```tsx
        <View style={styles.terminal} testID="terminal-output">
```

- [ ] **Step 5: Add `testID="message-input"` to `TextInput` in `app/session/[id].tsx`**

Find the `TextInput` at line 579:
```tsx
              <TextInput
                style={[styles.input, isWakingUp && styles.inputDisabled]}
                value={isWakingUp ? '' : inputText}
                onChangeText={isWakingUp ? undefined : handleInputChange}
                placeholder={isWakingUp ? wakingUpPhrase(id) : 'Send input to session…'}
```
Add `testID="message-input"` as a prop:
```tsx
              <TextInput
                testID="message-input"
                style={[styles.input, isWakingUp && styles.inputDisabled]}
                value={isWakingUp ? '' : inputText}
                onChangeText={isWakingUp ? undefined : handleInputChange}
                placeholder={isWakingUp ? wakingUpPhrase(id) : 'Send input to session…'}
```

- [ ] **Step 6: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/index.tsx components/sessions/hub/SessionRow.tsx app/session/\[id\].tsx
git commit -m "test: add testID props for Maestro e2e selectors"
```

---

## Task 4: Maestro Flows

**Files:**
- Create: `e2e/00_setup.yaml`
- Create: `e2e/03_hub.yaml`
- Create: `e2e/04_session_detail.yaml`

> **Before running flows:** The app must be built and installed on the simulator. Run `npx expo run:ios` once to get a build on the sim. Then run `node e2e/mock-server.js &` in a separate terminal before launching Maestro.

> **Hub rendering note:** The Hub groups sessions by `projectPath`. All three fixture sessions share `projectPath: "/home/user/my-project"` so they appear under a single card with `projectName: "my-project"`. The card must be tapped to expand before session rows are visible.

- [ ] **Step 1: Create `e2e/00_setup.yaml`**

```yaml
# Reusable setup flow — runs onboarding against the mock server.
# Usage: include via `runFlow` at the top of other flows.
# Requires: mock server running on localhost:7071

appId: com.ronenmars.threadbase
---
- launchApp:
    clearState: true

- assertVisible:
    text: "Connect"

- tapOn:
    placeholder: "http://localhost:7070"

- clearText

- inputText:
    text: "http://localhost:7071"

- tapOn:
    placeholder: "Enter THREADBASE_API_KEY"

- inputText:
    text: "mock-key"

- tapOn:
    text: "Connect"

- assertVisible:
    id: "hub-screen"
    timeout: 8000
```

- [ ] **Step 2: Create `e2e/03_hub.yaml`**

```yaml
# Maestro E2E — Sessions Hub flow
# Requires: mock server running on localhost:7071
# Usage: maestro test e2e/03_hub.yaml

appId: com.ronenmars.threadbase
---
- runFlow: 00_setup.yaml

# Hub screen is visible
- assertVisible:
    id: "hub-screen"

# Project card for my-project should be visible
- assertVisible:
    text: "my-project"

# Tap the project card to expand it
- tapOn:
    text: "my-project"

# Session rows should now be visible — match by branch name
- assertVisible:
    text: "main"

- assertVisible:
    text: "feature/auth"

- assertVisible:
    text: "fix/login"

# Tap the running session row and assert navigation to detail
- tapOn:
    id: "session-row-session-abc123"

- assertVisible:
    id: "session-detail-screen"
    timeout: 5000

# Navigate back
- tapOn:
    text: "Back"

- assertVisible:
    id: "hub-screen"
    timeout: 3000
```

- [ ] **Step 3: Create `e2e/04_session_detail.yaml`**

```yaml
# Maestro E2E — Session Detail flow
# Requires: mock server running on localhost:7071
# Usage: maestro test e2e/04_session_detail.yaml

appId: com.ronenmars.threadbase
---
- runFlow: 00_setup.yaml

# Navigate to the running session
- tapOn:
    text: "my-project"

- tapOn:
    id: "session-row-session-abc123"

- assertVisible:
    id: "session-detail-screen"
    timeout: 5000

# Terminal output is visible
- assertVisible:
    id: "terminal-output"

- assertVisible:
    text: "Waiting for input"

# Message input is present
- assertVisible:
    id: "message-input"

# Type a message and assert it appears in the input field
- tapOn:
    id: "message-input"

- inputText:
    text: "hello world"

- assertVisible:
    text: "hello world"
```

- [ ] **Step 4: Run 00_setup.yaml in isolation to verify onboarding works**

```bash
node e2e/mock-server.js &
maestro test e2e/00_setup.yaml
kill %1
```

Expected: flow passes, app lands on hub screen.

- [ ] **Step 5: Run 03_hub.yaml**

```bash
node e2e/mock-server.js &
maestro test e2e/03_hub.yaml
kill %1
```

Expected: all assertions pass.

- [ ] **Step 6: Run 04_session_detail.yaml**

```bash
node e2e/mock-server.js &
maestro test e2e/04_session_detail.yaml
kill %1
```

Expected: all assertions pass.

- [ ] **Step 7: Commit**

```bash
git add e2e/00_setup.yaml e2e/03_hub.yaml e2e/04_session_detail.yaml
git commit -m "test: add Maestro flows for Sessions Hub and Session Detail"
```

---

## Task 5: `package.json` Script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add `test:e2e:mock` script to `package.json`**

In the `"scripts"` block, add after `"test:e2e"`:
```json
"test:e2e:mock": "node e2e/mock-server.js & sleep 1 && maestro test e2e/03_hub.yaml && maestro test e2e/04_session_detail.yaml; kill %1"
```

- [ ] **Step 2: Verify the full suite runs end-to-end**

```bash
npm run test:e2e:mock
```

Expected: mock server starts, both flows pass, mock server killed.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "test: add test:e2e:mock npm script"
```
