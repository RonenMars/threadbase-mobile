// Maestro runScript — clears the pagination mock's in-memory request log so
// the surrounding flow's assertions see only its own traffic. Called by the
// pagination-classic.yaml and pagination-hub.yaml flows before the app starts.
//
// Maestro's runScript JS sandbox provides http.request — not Node's fetch.
const response = http.request('http://localhost:7072/__mock/reset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
})
if (response.status !== 200) {
  // Surface the failure to maestro's CLI output so a misconfigured mock is
  // obvious rather than silently letting stale log entries leak in.
  output.error = `mock reset failed: HTTP ${response.status} body=${response.body}`
} else {
  output.reset = 'ok'
}
