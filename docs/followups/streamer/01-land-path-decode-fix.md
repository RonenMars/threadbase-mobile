# streamer 01 — land the project path decode fix (PR #461)

**Check first:** `gh pr view 461 --json state,mergedAt`. If merged, this task is done.

## The bug

`src/handlers/handleListProjects.ts`:

```ts
function decodeProjectPath(dirName: string): string {
  return dirName.replace(/-/g, "/");
}
```

Claude encodes `/` as `-` when naming its project directories, but this reverses *every* hyphen. `-Users-me-tb-mobile` decodes to `/Users/me/tb/mobile`. Any project with a hyphen inside a path segment — including this org's own repos — produces a path that can never be joined against `conversation_meta.project_path`.

## Why it matters beyond this endpoint

Reported from the mobile side, where the mirror image of this was measured on a real Windows server: sending a reconstructed path to `/api/conversations?project=` returned **0** conversations where the verbatim path returned **37**. The client shows a correct count on a collapsed group and an empty list on expand, with no error at any layer. Silent wrong answers are the expensive kind.

## The fix already proposed

PR #461, `fix/list-projects-path-decode`, titled *"resolve project paths from the recorded cwd, not the dir name"*. That is a better approach than un-mangling the directory name — the recorded cwd is authoritative and needs no decoding.

Review it for:

- **Projects with no recorded cwd.** Old rows, or directories with no conversations yet. What does the endpoint return for those — a best-effort decoded name, or omission? Omission changes the shape mobile sees.
- **Windows paths.** `C:\Users\…` must survive verbatim. The mobile tree keys groups on the exact string the conversation list matches on.
- **Consistency with `/api/projects/summary`** (PR #460), which reports raw `project_path` values from `conversation_meta`. If the two endpoints disagree about a project's path, a client joining them gets nothing.

## Done when

PR #461 is merged with CI green, and a hyphenated project path round-trips: the path returned by `/api/projects` matches a row in `conversation_meta.project_path` exactly.
