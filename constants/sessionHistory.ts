// Byte budget for seeding a live session view from its conversation, shared by
// LiveConversationView and TerminalView. See
// docs/superpowers/specs/2026-08-15-session-history-byte-budget-design.md —
// measured against 40 real API payloads (p50 62 KB, p90 0.5 MB, max 3.1 MB):
// 90% of conversations load whole at this budget, 10% truncate and page the
// rest in on backward scroll. Measure the PAYLOAD, not the source JSONL, if
// this is ever retuned — the payload/JSONL ratio ranges 0.03 to 0.61, so the
// file-size distribution predicts nothing.
export const SESSION_HISTORY_MAX_BYTES = 512 * 1024
