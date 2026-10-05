// Maestro runScript — puts all three demo streamers back to their seed state,
// so a flow never inherits the session status or resumed sessions the previous
// one left behind. Maestro's sandbox provides http.request, not fetch.
for (const port of [7071, 7072, 7073]) {
  const response = http.request(`http://localhost:${port}/__demo__/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-key-123' },
    body: '{}',
  })
  if (response.status !== 200) {
    throw new Error(`demo streamer on :${port} did not reset: HTTP ${response.status}`)
  }
}
