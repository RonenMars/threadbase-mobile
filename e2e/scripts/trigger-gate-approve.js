// Maestro runScript — second permission gate, same mechanism as
// trigger-gate-build.js, different prompt so card-approve.png doesn't
// duplicate hero-approval-card.png.
// E2E_MOCK_SERVER_URL is injected by Maestro from `-e`, not a Node global.
/* global E2E_MOCK_SERVER_URL */
const mockUrl =
  typeof E2E_MOCK_SERVER_URL === 'string' && E2E_MOCK_SERVER_URL.length > 0
    ? E2E_MOCK_SERVER_URL.replace(/\/$/, '')
    : 'http://localhost:7071'
const response = http.request(`${mockUrl}/__test__/gate`, {
  method: 'POST',
  // Every mock-server route requires this — see e2e/mock-server.js's blanket
  // Bearer check — including its own __test__ triggers. Token matches the one
  // setup.yaml pairs with.
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-key-123' },
  body: JSON.stringify({
    sessionId: 'session-abc123',
    prompt: 'Merge this pull request?',
    detail: 'PR #482 → main\nAll checks green',
  }),
})
if (response.status !== 200) {
  output.error = `gate trigger failed: HTTP ${response.status} body=${response.body}`
} else {
  output.gate = 'ok'
}
