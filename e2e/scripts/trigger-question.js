// Maestro runScript — pushes one single-select AskUserQuestion to session-abc123.
// TERMINAL_ROWS=1 also lists Claude's two terminal-only rows marked terminalRow,
// the way a card built from the screen arrives; without it the card is shaped
// like one built from the JSONL, which lists neither row.
// runScript http.request is host-side; rewrite the emulator alias.
/* global E2E_MOCK_SERVER_URL, TOOL_USE_ID, QUESTION, TERMINAL_ROWS */
const mockUrl = String(
  typeof E2E_MOCK_SERVER_URL === 'string' && E2E_MOCK_SERVER_URL.length > 0
    ? E2E_MOCK_SERVER_URL
    : 'http://localhost:7071',
)
  .replace(/\/$/, '')
  .replace('10.0.2.2', '127.0.0.1')
const options = [
  { label: 'SQLite', description: 'One file, no server' },
  { label: 'Postgres', description: 'Needs a running server' },
]
if (TERMINAL_ROWS === '1') {
  options.push({ label: 'Type something.', description: '', terminalRow: 'other' })
  options.push({ label: 'Chat about this', description: '', terminalRow: 'chat' })
}
const response = http.request(`${mockUrl}/__test__/question`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-key-123' },
  body: JSON.stringify({
    sessionId: 'session-abc123',
    toolUseId: TOOL_USE_ID,
    questions: [{ question: QUESTION, header: 'Store', multiSelect: false, options }],
  }),
})
if (response.status !== 200) {
  throw new Error(`question trigger failed: HTTP ${response.status} body=${response.body}`)
}
