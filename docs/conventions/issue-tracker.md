# Issue tracker conventions — threadbase-streamer and threadbase-mobile

> **Synced copy.** Canonical source: `threadbase-streamer` `docs/conventions/issue-tracker.md`. Synced 2026-08-10.

**Single source of truth for both repositories.** `threadbase-streamer` and `threadbase-mobile` use one identical label vocabulary and one issue format, so a reader moving between them does not have to relearn anything and a cross-repo item reads the same from either side.

The canonical copy lives in `threadbase-streamer` at [`docs/conventions/issue-tracker.md`](https://github.com/RonenMars/threadbase-streamer/blob/main/docs/conventions/issue-tracker.md). This is a synced copy, kept here because the convention has to be readable from a mobile checkout without a second clone.

**Two copies of a convention become two conventions**, so treat this file as read-only: change the streamer copy, then re-sync this one in the same sitting. If they ever disagree, the streamer copy wins.

Adopted 2026-08-10, generalising the scheme `threadbase-mobile` had already converged on.

---

## The shape of an issue

```
Title:   P<N>: <what is wrong or what should exist>
Labels:  <one priority> + <one type> + <zero or more areas>
```

Three rules, and they are checkable:

1. **Exactly one priority label**, and the title repeats it as a `P<N>: ` prefix. The prefix is what makes a plain issue list scannable, since GitHub renders labels after the title and they wrap out of view on narrow screens.
2. **Exactly one type label.**
3. **Areas are free** — zero, one, or several.

## Priority

Priority answers *when*, never *how hard*. A one-line fix that blocks the release is P0; a month of work nobody is waiting on is P3.

| Label | Meaning |
|---|---|
| `P0` | Release blocker. Ships broken, or blocks the public listing. |
| `P1` | Fix before release. Not broken for users, but the release should not go out with it. |
| `P2` | Soon, but does not gate a release. |
| `P3` | Deferred. Real, but nobody is waiting — includes work blocked on an external dependency. |

**Re-prioritising means editing the title too.** They are two representations of one fact, and a mismatch is worse than either alone.

`P0` and `P1` are the release gate. Keeping them few is the point — if everything is P0, the tracker no longer tells you what to do next. As of 2026-08-10 the streamer carries 4 P0 and 2 P1 against 32 lower items, which is roughly the intended ratio.

## Type

Exactly one. What kind of change this is.

| Label | Meaning |
|---|---|
| `bug` | Behaviour is wrong. Something worked, or was supposed to. |
| `enhancement` | New capability or a deliberate improvement to existing behaviour. |
| `documentation` | The code is right; what is written about it is not. |
| `question` | A decision to make or a fact to establish. Closing it produces an answer, not a diff. |
| `tech-debt` | Cleanup with no user-visible change. Refactors, test isolation, dead code. |

`question` earns its place: a real category of work here is *verify X against a live session* or *decide whether Y is acceptable*, and filing that as `bug` or `enhancement` misrepresents what finishing it looks like.

## Area

Zero or more. Where the work lands. Useful for filtering, never for priority.

| Label | Meaning |
|---|---|
| `ci` | CI, workflows, release automation, build harness. |
| `e2e` | End-to-end and contract test suites. |
| `performance` | Query cost, latency, memory, render cost, throughput. |
| `security` | Auth boundary, secrets, replay, injection. |
| `observability` | Logging, metrics, traceability of runtime behaviour. |
| `platform` | OS-level behaviour. Streamer: launchd, systemd, Task Scheduler. Mobile: OS and store-level behaviour, as distinct from native modules. |
| `native` | Native modules and toolchain. Streamer: `node-pty`, `better-sqlite3`. Mobile: iOS/Android modules. |
| `provider` | Claude Code / Codex integration, including collision, resume and prompt-detection behaviour. |
| `ux` | User-facing interaction and polish. Streamer: CLI and API ergonomics. Mobile: the interface. |

`dependencies` and `javascript` are applied by Dependabot to PRs. Do not hand-apply them to issues.

### `platform` versus `native`

They get confused, so: `native` is about *code that compiles*, `platform` is about *the OS behaving differently*. A `better-sqlite3` ABI mismatch is `native`. Task Scheduler not redirecting stdout is `platform`. An issue can be both — a Windows-only node-pty build failure is `native` + `platform`.

## Body

Lead with what is wrong, in one or two sentences, with no heading. Then use whichever of these sections carry real content, and omit the rest. **Do not pad an issue to fit the template.**

| Section | Purpose |
|---|---|
| `## Verified state` | What is true in the code today, with a file:line, a PR number, or a quoted log line. Say when it was checked. |
| `## Blocked on` | The named blocker. Only when the work genuinely cannot start. |
| `## Depends on` | Ordering against other work, and why the order matters. |
| `## Done looks like` | Observable acceptance. What a reviewer checks. |
| `## Reference` | Doc paths, PR numbers, related issues in either repo. |

`## Verified state` is the section that earns the format. An issue asserting a defect without evidence costs the next reader a re-investigation, and an issue whose claim silently went stale is worse than no issue — this whole scheme was adopted after an audit found trackers listing eight already-merged PRs as open work.

**Prose rules**, matching the repos' commit and PR conventions:

- One sentence per line. Never break a line mid-sentence; let the renderer wrap.
- No AI attribution anywhere — not in issues, comments, commits, or PR bodies.
- Name files as `path/to/file.ts:123`. GitHub does not linkify them, but they are greppable and unambiguous.

## Cross-repo items

Plenty of work spans both repos: a server contract plus the client that consumes it.

File it in **both**, each describing that repo's half, and link them by URL. Do not file one issue covering both — one of the two teams then tracks work it cannot close, and neither issue has a meaningful "done".

Where a change must ship in a specific order, say so in `## Depends on` on both sides. The streamer is the compatibility-constrained end: released mobile builds cannot be force-updated, so an additive server change lands first and the client follows.

## Worked example

```markdown
Title: P2: log the 401 decision in the auth middleware
Labels: P2, enhancement, observability, security

`src/api/middleware/auth.middleware.ts` contains zero log calls, so a 401 is invisible.

Silent 401s hide a brute-force attempt and a misconfigured client equally well, and the
streamer is reachable from the public internet through a tunnel.

## Verified state

Confirmed absent 2026-08-10: no `log.` or `logger.` reference anywhere in the file.

## Done looks like

A rejected request logs `{event, path, method, remoteAddr}` at warn.

## Reference

`docs/observability-audit.md` Rank 1
```

## Checking compliance

```sh
# every open issue has exactly one priority label
gh issue list --state open --limit 200 --json number,labels \
  -q '.[] | select((.labels|map(.name)|map(select(test("^P[0-3]$")))|length) != 1) | .number'

# every open issue has a type label
gh issue list --state open --limit 200 --json number,labels \
  -q '.[] | select((.labels|map(.name)|map(select(.=="bug" or .=="enhancement" or .=="documentation" or .=="question" or .=="tech-debt"))|length)==0) | .number'

# every title carries its priority prefix
gh issue list --state open --limit 200 --json number,title \
  -q '.[] | select(.title|test("^P[0-3]: ")|not) | .number'
```

All three print nothing when the tracker is clean. Run them against either repo — `-R RonenMars/threadbase-streamer` for the other one.

## Changing the vocabulary

Add a label when **three or more** issues need it and no existing label fits. A label with one member is a filter nobody uses and a decision everybody has to make.

Add it to **both** repos in the same sitting, even if only one has members today. A vocabulary that has diverged is no longer shared, and re-converging costs more than the empty label.

Then update the canonical streamer copy and re-sync this one. Never edit this file alone.
