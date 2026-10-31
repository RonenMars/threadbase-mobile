// Maestro runScript — reads the demo streamer's E2EE public key, so the hero
// flow can open a pair link that carries `spk` and reach the encrypted
// pair-confirm screen.
//
// Env: PORT. Sets output.spk.
/* global PORT */
const response = http.request(`http://localhost:${PORT}/__demo__/spk`, {
  method: 'GET',
  headers: { Authorization: 'Bearer mock-key-123' },
})
if (response.status !== 200) {
  throw new Error(`spk lookup failed: HTTP ${response.status} body=${response.body}`)
}
output.spk = JSON.parse(response.body).spk
