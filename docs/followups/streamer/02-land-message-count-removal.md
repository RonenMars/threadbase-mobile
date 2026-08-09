# streamer 02 — land the `projects.message_count` removal (PR #462)

**Check first:** `gh pr view 462 --json state,mergedAt`. If merged, this task is done.

## The finding

`upsertProjectByPath` in `src/db/repositories/projects.repository.ts` writes `message_count: 0` on insert, and the UPDATE statement never mentions the column. It therefore always reads zero for every project, in every row, forever.

`origin/main` still has five references to it; the branch `fix/drop-project-message-count` has none.

## The decision already made

PR #462, *"drop the dead projects.message_count column"* — remove it rather than maintain it. That is the right call: `/api/projects/summary` (PR #460) already produces a real per-project count with `COUNT(*)` over `conversation_meta`, and it is the count mobile actually consumes. A second, always-zero count in a different table is a trap for the next reader.

Review it for:

- **The migration.** Dropping a column needs a migration that is safe against an existing `runtime.db`, not just a schema edit. SQLite's `ALTER TABLE ... DROP COLUMN` support depends on version — check what the bundled `better-sqlite3` provides and whether a table rebuild is needed.
- **Readers.** Confirm nothing outside the repository reads it. `ProjectSchema` in `src/schemas/project.schema.ts` declares `messageCount` as optional, so a consumer may be tolerating the zero rather than ignoring the field.
- **`latestMessageAt` in the same table stays.** It *is* maintained by `ensureProjectsForConversations` and is not part of this change.

## Done when

PR #462 is merged with CI green, and a fresh `runtime.db` plus an existing one both migrate without error.
