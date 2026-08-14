# Prompt — refresh the roadmap and backlog status against reality

Hand this to a fresh agent session opened in `~/dev/ai-tools/tb-mobile`.

Re-runnable: the dated facts below go stale quickly, so treat every one of them as a *starting point, not evidence*, and re-verify before writing.

> **Work in a new git worktree, outside the repo root.** Do not edit the main checkout — other sessions and verification runs use it, and a stray edit there gets read by whoever is mid-task. The exact command is under [Workflow](#workflow); the rules around it are not style preferences and are explained there.
>
> Because this prompt is meant to be re-run, **give the branch and worktree a unique suffix each time** — `docs/roadmap-refresh-2026-08-11`, then `-2026-09-02`, and so on. Check `git worktree list` and `gh pr list` first; if a previous refresh is still open, rebase onto it or wait rather than opening a competing PR against the same files.

---

## Why this is needed

`docs/ROADMAP.md` and `docs/BACKLOG.md` were swept on 2026-08-10 and drifted again within a day.

This repo has been bitten repeatedly by status tables that record **intent rather than outcome** — an audit once found trackers listing eight already-merged PRs as open work. So the standing rule:

**Verify every claim at its source.** `gh issue view` / `gh pr view` for state, `grep -n` at a `path:line` for code, `git show <sha>:<path>` for committed content. Never restate what another doc says — that is the mechanism by which these files went wrong in the first place.

A related trap worth knowing: **a CLOSED PR is not an unlanded change.** PRs #343, #345 and #346 are all closed rather than merged, yet all three fixes are in the tree — they landed by another route. Check the code, not the PR state.

## What changed since the last sweep (verify each)

**Merged to `main`:**

- PR #626 → `2de1c1ae` — `e2e/ensure-release-build.js` fails fast on a stale build instead of silently reusing it. Closed issue #598.
- PR #627 → `24627baa` — the `threadbase://pair` deep-link route, plus an AuthGate fix so a cold start with zero servers is not bounced to onboarding. Closed issue #597.
- PR #625 → `4eb1ae54` — scheduled E2E failure alert (`notify-schedule-failure` in `.github/workflows/e2e.yml`), gated on a `CI_ALERT_WEBHOOK` secret. Closed issue #599.
- PR #632 → `e935a6c8` — corrected alert payload compatibility docs; Telegram chosen as the channel.
- PR #634 → `b512d83d` — a `workflow_dispatch` smoke test for the alert secret.

Issues #597 and #598 were closed after **real-device verification** on 2026-08-11, not merely CI.

**Open issues:**

- https://github.com/RonenMars/threadbase-mobile/issues/636 (P0) — the Live Activity push payload carries terminal output, a prompt-derived title and the project name, while the privacy policy claims payloads exclude exactly those. The policy also describes an Expo relay that does not exist.
- https://github.com/RonenMars/threadbase-mobile/issues/638 (P2) — the pair deep-link error screen shows a raw exception instead of translated copy. May be fixed by the time you run this; check.
- https://github.com/RonenMars/threadbase-streamer/issues/528 (P1) — the streamer has **no ordinary push sender at all**, so a self-hosted streamer can deliver no notifications.

## The substantive finding, which is not a status flip

**Live Activities cannot work for self-hosters, ever.**

The streamer signs APNs pushes itself and targets `${bundleId}.push-type.liveactivity`. Apple issues APNs keys per developer team, and a key only signs topics for bundle IDs that team owns — so a self-hosted streamer cannot sign for the published app's bundle ID. That is Apple's trust boundary, not a configuration gap.

**Ordinary notifications are not implemented at all** — no Expo client, no FCM, no sender of any kind in the streamer. `POST /api/push/register` stores tokens that nothing consumes except the Live Activity sender.

Check how `docs/ROADMAP.md` describes Feature 12 (Live Activities / Dynamic Island) and anything mentioning notifications, and correct it. A roadmap entry implying every user gets Live Activities is wrong in a way that matters — the landing site is being corrected for the same overclaim.

## Scope

Files you own:

- `docs/ROADMAP.md`
- `docs/BACKLOG.md`
- `docs/followups/RELEASE-READINESS-2026-08-10.md` — its P0 table lists #597/#598/#599 as open. Add a dated update rather than rewriting history, matching how that file already handles supersession.

Do not touch anything outside `docs/`.

## How to write it

Match the existing conventions: status markers (`✅ DONE`, `🟡 Partial`, `⛔ Obsolete`), evidence inline (`path/to/file.ts:123`, a PR number, a commit SHA), and **full GitHub URLs for issues and PRs, not bare `#numbers`** — work spans four repos and a bare number is ambiguous about which.

One sentence per line. No AI attribution anywhere.

Where an item is genuinely uncertain, say so and say what would settle it. Do not manufacture a status you have not verified.

## Workflow

```bash
/opt/homebrew/bin/git -C /Users/ronenmars/dev/ai-tools/tb-mobile fetch origin
/opt/homebrew/bin/git -C /Users/ronenmars/dev/ai-tools/tb-mobile worktree add \
  ../tb-mobile-worktrees/roadmap-refresh -b docs/roadmap-refresh-<date> origin/main
cd /Users/ronenmars/dev/ai-tools/tb-mobile-worktrees/roadmap-refresh
```

Worktrees live **outside** the repo root — never nest one under the checkout, because jest, eslint and Metro all walk into a nested copy and report failures from a stale branch. You do not need `node_modules` for a docs-only change. Use the absolute git binary `/opt/homebrew/bin/git`; a shell function shadows `git` on this machine.

Docs-only, so the `commit-msg` hook appends `[skip-ci]`. That is correct, not a failure.

Do not use the iOS simulator — it may be in use for verification runs.

## Verify before claiming done

- Every relative link in the files you touched resolves.
- Every issue/PR state you assert matches `gh issue view` / `gh pr view` **at the time you write it**.
- No claim rests solely on what another doc says.

## Deliverable

Conventional commit title (`docs: …`), one sentence per line, no AI attribution. Push and open a PR against `main`.

Report: what you changed, which claims you re-verified and which you found already stale, and the PR URL.
