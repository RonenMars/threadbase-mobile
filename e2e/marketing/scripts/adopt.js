// Maestro runScript — takes over the Work Mac session that was started in a
// plain terminal, through the same endpoint the app's Take over button calls.
// Flow 1 does this by hand; Flow 3 starts from the state it leaves behind.
const response = http.request('http://localhost:7071/api/sessions/wm-claude-persistence/adopt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-key-123' },
  body: '{}',
})
if (response.status !== 200) {
  throw new Error(`adopt failed: HTTP ${response.status} body=${response.body}`)
}
