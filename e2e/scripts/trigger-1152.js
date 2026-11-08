// Maestro runScript for the #1152 simulator check. KIND=structured fires a WS
// `question` event; KIND=scraped paints a numbered picker through terminal_output.
/* global E2E_MOCK_SERVER_URL, KIND */
const mockUrl = String(
  typeof E2E_MOCK_SERVER_URL === 'string' && E2E_MOCK_SERVER_URL.length > 0
    ? E2E_MOCK_SERVER_URL
    : 'http://localhost:7071',
).replace(/\/$/, '')
const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer mock-key-123' }
const LABELS = [
  'Extract the retry policy into lib/retry.ts and add a jitter option',
  'Patch withRetry in place and keep the current exponential backoff constants',
  'Run npx jest --ci --runInBand --testPathPattern "checkout" before touching anything',
  'Inline the helper at both call sites and delete the shared module entirely',
  'Leave the retry code alone and open a follow-up issue describing the problem',
]
let response
if (KIND === 'structured') {
  response = http.request(`${mockUrl}/__test__/question`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId: 'session-q1152',
      toolUseId: 'tool-1152',
      questions: [{
        question: 'Which approach should I take for the checkout retry code?',
        header: 'Approach',
        multiSelect: false,
        options: LABELS.map((label, i) => ({ label, description: `Option ${i + 1}` })),
      }],
    }),
  })
} else {
  const rows = LABELS.map((label, i) => `${i === 0 ? '❯' : ' '} ${i + 1}. ${label}`)
  const data = ['', 'Which approach should I take for the checkout retry code?', '', ...rows, '', 'Enter to select · ↑/↓ to navigate · Esc to cancel', ''].join('\r\n')
  response = http.request(`${mockUrl}/__test__/terminal`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId: 'session-q1152', data }),
  })
}
if (response.status !== 200) {
  output.error = `trigger failed: HTTP ${response.status} body=${response.body}`
} else {
  output.ok = KIND
}
