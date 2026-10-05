// Maestro runScript — moves a demo session between running and waiting_input.
// A real agent reaches waiting_input by finishing its turn; nothing a flow can
// tap makes that happen, so the demo streamer exposes it as a control.
//
// Env: PORT, SESSION_ID, STATUS, LAST_OUTPUT.
/* global PORT, SESSION_ID, STATUS, LAST_OUTPUT */
const response = http.request(`http://localhost:${PORT}/__demo__/status`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-key-123' },
  body: JSON.stringify({ sessionId: SESSION_ID, status: STATUS, lastOutput: LAST_OUTPUT }),
})
if (response.status !== 200) {
  throw new Error(`status change failed: HTTP ${response.status} body=${response.body}`)
}
