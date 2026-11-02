// Maestro runScript — fires one permission gate with the prompt, detail and
// option labels the flow passes in, so a flow can emit two different gates in a
// row (trigger-gate-build.js / trigger-gate-approve.js are fixed content).
// GATE_LABELS is comma-separated: Maestro env values are strings.
// runScript http.request is host-side; rewrite the emulator alias.
/* global E2E_MOCK_SERVER_URL, GATE_PROMPT, GATE_DETAIL, GATE_LABELS */
const mockUrl = String(
  typeof E2E_MOCK_SERVER_URL === 'string' && E2E_MOCK_SERVER_URL.length > 0
    ? E2E_MOCK_SERVER_URL
    : 'http://localhost:7071',
)
  .replace(/\/$/, '')
  .replace('10.0.2.2', '127.0.0.1')
const response = http.request(`${mockUrl}/__test__/gate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-key-123' },
  body: JSON.stringify({
    sessionId: 'session-abc123',
    prompt: GATE_PROMPT,
    detail: GATE_DETAIL,
    options: String(GATE_LABELS)
      .split(',')
      .map((label, i) => ({ index: i + 1, label })),
  }),
})
if (response.status !== 200) {
  output.error = `gate trigger failed: HTTP ${response.status} body=${response.body}`
} else {
  output.gate = 'ok'
}
