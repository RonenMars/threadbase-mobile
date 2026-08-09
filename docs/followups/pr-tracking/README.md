# PR-tracking snapshots — mirrored 2026-08-09 15:25

Copies of the working notes kept in `~/dev/ai-tools/tb-PRs-follow/mobile/`, mirrored here on request so they travel with the repo.

## Read this before trusting any of them

**These are snapshots of a fast-moving state, not documentation.** They were accurate at the timestamp in each header and are expected to rot — during the session that produced them, the PR set changed materially three times in under two hours: PRs were re-targeted from an integration branch onto `main`, that branch was rebuilt, and two of the tracked PRs went from red to green to conflicting.

Every file carries its own "treat as stale by default" line. Honour it. Re-derive before acting:

```bash
gh pr list --state open --json number,title,headRefName,baseRefName,headRefOid,author,updatedAt
```

Then re-fetch each PR individually for mergeability — a bulk query returns `UNKNOWN` because GitHub computes it lazily.

They live outside any git repo by convention (`~/dev/ai-tools/tb-PRs-follow/`), precisely because committed snapshots go stale in place while looking authoritative. This mirror was made deliberately; the originals remain the working copies, so **the two will diverge**.

## The files

| File | What it holds |
|---|---|
| `Mobile-OPEN-PRs.md` | Full inventory of open PRs, grouped by actionability — green, conflicting, blocked on red CI. |
| `Mobile-MERGE-ORDER.md` | Merge sequence and the reasoning behind the ordering. |
| `Mobile-LEFTOVERS.md` | Open threads from the Codex active-writer / E2E session: decisions pending, work unfinished by circumstance, traps that cost time. |
| `Mobile-ADR-0001-LEFTOVERS.md` | Open threads from the ADR 0001 lazy-loading session. Carries a dated correction banner from a later refresh. |
| `Mobile-INTEGRATION-TO-MAIN-2026-08-09.md` | Working log of landing the open PRs on `main` via the integration branch. |

`Mobile-MERGE-ORDER.md` and `Mobile-INTEGRATION-TO-MAIN-2026-08-09.md` both describe merge sequencing and were written by different sessions. Neither has been designated authoritative — see the "smaller things" section of [`../repo-health/06-integration-branch-decision.md`](../repo-health/06-integration-branch-decision.md).

## The streamer half

Only the mobile notes are mirrored here. The streamer-side equivalents were committed to `tb-streamer` instead of being copied across repos, on branch `docs/pr-follow-notes` under `docs/pr-follow/` — [tb-streamer#468](https://github.com/RonenMars/threadbase-streamer/pull/468).

| Note | Covers |
|---|---|
| [`Streamer-CODEX-FORK-AND-FOLLOWUPS.md`](https://github.com/RonenMars/threadbase-streamer/blob/docs/pr-follow-notes/docs/pr-follow/Streamer-CODEX-FORK-AND-FOLLOWUPS.md) | The server half of the Codex active-writer work, and the follow-ups from it. |
| [`Streamer-OPEN-PRs.md`](https://github.com/RonenMars/threadbase-streamer/blob/docs/pr-follow-notes/docs/pr-follow/Streamer-OPEN-PRs.md) | Open-PR inventory for the streamer. |
| [`Streamer-FD-BUDGET-AND-SUITE-NOISE.md`](https://github.com/RonenMars/threadbase-streamer/blob/docs/pr-follow-notes/docs/pr-follow/Streamer-FD-BUDGET-AND-SUITE-NOISE.md) | File-descriptor budget and test-suite noise. |
| [`Streamer-ORPHAN-LIFECYCLE-GATE-FIX.md`](https://github.com/RonenMars/threadbase-streamer/blob/docs/pr-follow-notes/docs/pr-follow/Streamer-ORPHAN-LIFECYCLE-GATE-FIX.md) | Orphan lifecycle gate fix. |

Cross-repo links here are absolute URLs pinned to the `docs/pr-follow-notes` branch — they will break if that branch is deleted after #468 merges. Repoint them at the merged location then.

**Directly relevant to mobile #572:** the server half is **[tb-streamer#463](https://github.com/RonenMars/threadbase-streamer/pull/463)** (`fix/codex-active-writer-resume`, `MERGEABLE/CLEAN`, open), which implements `POST /api/sessions/:id/fork`. It answers both contract assumptions mobile coded against — and answers the idempotency one *the other way*, which means the Retry affordance mobile deliberately withheld can be restored. See `Mobile-LEFTOVERS.md` → "Streamer side of #572".
