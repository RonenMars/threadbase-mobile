// Maestro runScript — reads (and with MODE=reset, clears) the mock's log of
// POST /api/sessions/:id/input. MODE=assert-empty throws when anything was
// sent, which fails the flow step; the message names what leaked.
// runScript http.request is host-side; rewrite the emulator alias.
/* global E2E_MOCK_SERVER_URL, MODE */
const mockUrl = String(
  typeof E2E_MOCK_SERVER_URL === 'string' && E2E_MOCK_SERVER_URL.length > 0
    ? E2E_MOCK_SERVER_URL
    : 'http://localhost:7071',
)
  .replace(/\/$/, '')
  .replace('10.0.2.2', '127.0.0.1')
const response = http.request(`${mockUrl}/__test__/inputs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-key-123' },
  body: JSON.stringify({ reset: MODE === 'reset' }),
})
if (response.status !== 200) {
  throw new Error(`inputs log failed: HTTP ${response.status} body=${response.body}`)
}
const inputs = JSON.parse(response.body).inputs
if (MODE === 'assert-empty' && inputs.length > 0) {
  throw new Error(`stray input reached the PTY: ${JSON.stringify(inputs)}`)
}
