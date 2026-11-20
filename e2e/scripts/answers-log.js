// Maestro runScript — reads (and with MODE=reset, clears) the mock's log of
// POST /api/sessions/:id/answer. MODE=assert-last throws unless the last body
// answered TOOL_USE_ID with exactly the answers JSON in EXPECT.
// runScript http.request is host-side; rewrite the emulator alias.
/* global E2E_MOCK_SERVER_URL, MODE, TOOL_USE_ID, EXPECT */
const mockUrl = String(
  typeof E2E_MOCK_SERVER_URL === 'string' && E2E_MOCK_SERVER_URL.length > 0
    ? E2E_MOCK_SERVER_URL
    : 'http://localhost:7071',
)
  .replace(/\/$/, '')
  .replace('10.0.2.2', '127.0.0.1')
const response = http.request(`${mockUrl}/__test__/answers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-key-123' },
  body: JSON.stringify({ reset: MODE === 'reset' }),
})
if (response.status !== 200) {
  throw new Error(`answers log failed: HTTP ${response.status} body=${response.body}`)
}
const answers = JSON.parse(response.body).answers
const last = answers[answers.length - 1]
if (MODE === 'assert-last' && !(last && last.toolUseId === TOOL_USE_ID && JSON.stringify(last.answers) === EXPECT)) {
  throw new Error(`last answer was ${JSON.stringify(last)}, expected ${TOOL_USE_ID} ${EXPECT}`)
}
