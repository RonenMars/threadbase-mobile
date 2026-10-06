// Maestro runScript — second permission gate, same mechanism as
// trigger-gate-build.js, different prompt so card-approve.png doesn't
// duplicate hero-approval-card.png.
// runScript http.request is host-side; rewrite the emulator alias.
/* global E2E_MOCK_SERVER_URL */
const mockUrl = String(
  typeof E2E_MOCK_SERVER_URL === 'string' && E2E_MOCK_SERVER_URL.length > 0
    ? E2E_MOCK_SERVER_URL
    : 'http://localhost:7071',
)
  .replace(/\/$/, '')
  .replace('10.0.2.2', '127.0.0.1')
const response = http.request(`${mockUrl}/__test__/gate`, {
  method: 'POST',
  // Every mock-server route requires this — see e2e/mock-server.js's blanket
  // Bearer check — including its own __test__ triggers. Token matches the one
  // setup.yaml pairs with.
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-key-123' },
  body: JSON.stringify({
    sessionId: 'session-abc123',
    prompt: 'Approve the release branch for production?',
    detail: 'release/2026-09-checkout → production\nCanary checks and rollback plan verified',
  }),
})
if (response.status !== 200) {
  output.error = `gate trigger failed: HTTP ${response.status} body=${response.body}`
} else {
  output.gate = 'ok'
}
