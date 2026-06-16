// Maestro runScript — clears the progress mock's in-memory request log.
// Used by parallel-fetch-progress.yaml before the app starts.
//
// Maestro's runScript JS sandbox provides http.request — not Node's fetch.
const response = http.request('http://localhost:7073/__mock/reset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
})
if (response.status !== 200) {
  output.error = `mock reset failed: HTTP ${response.status} body=${response.body}`
} else {
  output.reset = 'ok'
}
