// Maestro runScript — puts an alive external session into the mock's
// session list. The fixtures list holds managed sessions only.
// runScript http.request is host-side; rewrite the emulator alias.
/* global E2E_MOCK_SERVER_URL */
const mockUrl = String(
  typeof E2E_MOCK_SERVER_URL === 'string' && E2E_MOCK_SERVER_URL.length > 0
    ? E2E_MOCK_SERVER_URL
    : 'http://localhost:7071',
)
  .replace(/\/$/, '')
  .replace('10.0.2.2', '127.0.0.1')
const response = http.request(`${mockUrl}/__test__/session-update`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-key-123' },
  body: JSON.stringify({
    id: 'session-external',
    serverId: 'server-one',
    status: 'running',
    ptyAttached: true,
    lifecycle: 'attached',
    projectPath: '/workspace/northstar-commerce/apps/storefront',
    projectName: 'storefront',
    branch: 'release/2026-09-checkout',
    lastOutput: 'Verifying checkout rollback plan',
    elapsedMs: 30000,
    promptCount: 4,
    // Newer than the fixtures so it lands in the project card's 3-row preview.
    startedAt: '2026-05-01T12:00:00.000Z',
    ownership: 'external',
    pid: 41213,
    processLiveness: 'alive',
  }),
})
if (response.status !== 200) {
  output.error = `session update failed: HTTP ${response.status} body=${response.body}`
} else {
  output.external = 'ok'
}
