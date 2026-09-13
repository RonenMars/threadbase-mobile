// Maestro runScript — fires a real permission gate over the mock server's
// __test__ trigger (e2e/mock-server.js), targeting the deep-linked PTY
// session (session-abc123). Nothing an e2e flow can do makes a gate appear
// on its own — a real one is drawn by Claude and scraped from the PTY by the
// streamer — so this is the only way to reach it from Maestro.
//
// Maestro's runScript JS sandbox provides http.request — not Node's fetch.
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
    prompt: 'Run this command?',
    detail: 'Bash command\nnpm run build && npm test',
  }),
})
if (response.status !== 200) {
  output.error = `gate trigger failed: HTTP ${response.status} body=${response.body}`
} else {
  output.gate = 'ok'
}
