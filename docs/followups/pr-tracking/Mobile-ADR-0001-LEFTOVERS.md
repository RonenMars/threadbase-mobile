# tb-mobile — ADR 0001 lazy-loading session, leftovers (as of 2026-08-09 11:55)

Open threads from the session that shipped the summary-driven grouped views. Companion to `Mobile-LEFTOVERS.md` (Codex active-writer / E2E session) and `Mobile-MERGE-ORDER.md`.

Treat as stale by default — re-check before acting.

> **Refreshed 2026-08-09 13:20 by the Codex active-writer session.** Original prose preserved; only facts overtaken by events are annotated below. Three things moved:
> 1. **#577 merged** into the integration branch (`59d6e68d`) — the jest/typescript break is fixed there.
> 2. **#576 and #572 were re-targeted onto `main`**, are `MERGEABLE/CLEAN`, and no longer depend on the integration branch at all.
> 3. **The integration branch was rebuilt on top of the new `main`** (tip `0a4dd2d5`) and now contains #578, #577, #574's two commits, #576's and #572's. It is a superset, not a blocker.
>
> Net effect: the "one thing gating #575 and #576" section below is **spent**, and #575 is now fully redundant *and* `CONFLICTING/DIRTY`. See `Mobile-MERGE-ORDER.md` for the current order.

## What shipped

| branch | commit | state |
|---|---|---|
| `fix/e2e-onboarding-setup-flow` | `85d30fc3` → `83b3bf4e` | **PR #575** open, now `CONFLICTING/DIRTY` — its content is already on both branches |
| `feat/lazy-project-summary-groups` | `87be0d4c` → `34667999` | **PR #576** open, **re-targeted to `main`**, `MERGEABLE/CLEAN`, 19 checks green |
| `docs/adr-0001-followups` | `44104292` → `9a593846` | became **PR #580** (integration, `CONFLICTING`); a variant merged to `main` as **#579** (`4d80e984`) |

~~All three base on `integration/open-prs-291-544-…-569`.~~ **Only #575 and #580 still do.**

## ~~The one thing gating #575 and #576~~ — resolved, kept for the diagnosis

**They are green on merit and blocked by their base.** Both show an identical failure set — `Unit tests`, `Integration tests`, `Lint`, `i18n`, `E2E jest` — while `Type check`, `Setup`, `Gate` and `Native deps` pass.

Every failing job dies at argument parsing, before a single test runs:

```
Option "testPathPattern" was replaced by "--testPathPatterns".
```

That is jest 30 rejecting the jest-29 flag every `package.json` script uses. The proof it is not mine: #575's entire diff is one markdown file and `e2e/setup.yaml`, which cannot make jest reject a CLI flag.

**→ #577 (`fix(deps): revert jest and typescript to the versions the toolchain supports`) was the unblocker.** **It merged** (`59d6e68d`). The integration branch now declares `jest ^29.7.0` / `typescript ~6.0.3`, and #576 went green — though by then it had also been re-targeted onto `main`, so both routes are now clear.

The diagnosis above is kept because it recurs: the same two bumps are still open against `main` as **#557** (red: Unit, Integration, i18n, E2E jest) and **#291** (red: Lint), which is independent confirmation on a second branch.

This is the recurring jest-30-on-SDK-57 break; see decision 2 in `Mobile-LEFTOVERS.md` about a dependabot ignore.

**PR #578 does *not* help here** (checked 2026-08-09 12:00). It ported #575's onboarding repair to `main` and touched only `e2e/setup.yaml` and a markdown file — no dependency change, so the jest 30 failures are untouched. #577 is still the only unblocker.

~~**#575 is not redundant either.**~~ **Overtaken (13:20).** The integration branch was rebuilt on top of the new `main` and now carries `867effbe` (#578) in its history — so **both** branches have zero `hideKeyboard` calls. #575 is redundant on both, which is why it now reports `CONFLICTING/DIRTY`. The open question is no longer *when* it becomes redundant but whether to close it as superseded; see `Mobile-LEFTOVERS.md` decision 4.

| | main `4d80e984` | integration `0a4dd2d5` |
|---|---|---|
| `hideKeyboard` in `setup.yaml` | 0 | **0** (was 2) |
| jest / typescript | `^29.7.0` / `~6.0.3` | **`^29.7.0` / `~6.0.3`** (was `^30.4.2` / `~7.0.2`) |

Both columns re-measured 13:20. Brace the ref when checking this yourself — `git show "$B:e2e/setup.yaml"` silently returns nothing under zsh because `:e` is a parameter modifier; use `"${B}:e2e/setup.yaml"`.

What #578 *did* change is the follow-up plan: mobile tasks 05+06 are now unblocked on `main` and no longer wait on #575. The briefs were updated accordingly (`e4de4f51`), which also split the base branch per task — the ADR chain (01–04) on the integration branch, the e2e and pair-route tasks (05+06, 07) on `main`.

## The real gap: the ADR criterion was never measured

ADR 0001's stated target is `ProjectsHub` settling to **~1 render per real data change**, down from the ~6/sec loop that started this work. **No render count was ever taken.**

What exists is *mechanism* evidence, which is strong but is not the criterion:

- `useEagerConversations` is provably not mounted for grouped layouts
- the tree's network trace shows one `/api/projects/summary` and **zero** `/api/conversations/count`
- `feat1_tree_drill_new_session` passes against a build verified to contain the code

PR #576's body says this in its own words rather than implying the goal was met. The measurement is mobile follow-up task 04, gated behind tasks 02 and 03 — measuring before those remove the last two churn sources produces a number you would discard.

## Follow-up programme — ready to dispatch

Ten briefs plus two orchestrators and two paste-ready kick-offs, committed on `docs/adr-0001-followups`:

- `docs/followups/mobile/KICKOFF.md` — paste at the tb-mobile root (7 tasks)
- `docs/followups/streamer/KICKOFF.md` — paste at the tb-streamer root (3 tasks); scope is in [`Streamer-CODEX-FORK-AND-FOLLOWUPS.md`](https://github.com/RonenMars/threadbase-streamer/blob/docs/pr-follow-notes/docs/pr-follow/Streamer-CODEX-FORK-AND-FOLLOWUPS.md)

Parallelism is capped by two shared resources, not by the code: `app/index.tsx` (contended by tasks 01 and 03) and a single simulator (needed exclusively by 04 and by 05+06). Wave order is in each orchestrator.

## State notes for whoever picks this up

- **The simulator holds a *baseline* Release build** — my code deliberately absent, left over from the A/B that classified the e2e failures. Anyone running e2e or measuring must rebuild and verify: `grep -ac "<string you just added>" "$(xcrun simctl get_app_container <udid> com.ronenmars.threadbase)/main.jsbundle"`. `e2e/ensure-release-build.js` silently reuses stale builds — one full suite run this session tested a week-old `.app` and reported it as current.
- **The working tree is on `docs/adr-0001-followups`**, not the feature branch.
- **`/Users/ronenmars/dev/ai-tools/0001-streamer-project-summary-request.md` is now a duplicate** of the copy committed at `docs/adr/0001-streamer-project-summary-request.md`. Safe to delete. (I had wrongly declared it lost after searching every git ref and PR in both repos — it was sitting one directory above the repo the whole time.)
- **`e2e/05_chat_flow.yaml` still calls `hideKeyboard`**, deliberately. Its composer input is `multiline`, so the `pressKey: Enter` fix used in `setup.yaml` would insert a newline instead of dismissing — and the next assertion checks the message text. Brief at `docs/adr/0001-followup-05-chat-flow-hidekeyboard.md`.

## E2E state

The mock suite went **1/15 → 11/15** once `setup.yaml` was repaired. Four failures remain and all are **confirmed pre-existing** — each reproduces in isolation *and* fails identically against a Release build of the branch base with the feature code absent:

| flow | fails at |
|---|---|
| `session_lifecycle` | `hub-screen is visible` |
| `feedback_flow` | `settings-help-feedback-row is visible` |
| `05_chat_flow` | `first-session-card is visible` |
| `06_search_anchor` | `conversation-row-conv-search-anchor is visible` |

> **Overtaken 2026-09-05:** the Android suite is 15/16 ([run 33933929192](https://github.com/RonenMars/threadbase-mobile/actions/runs/33933929192)) — `session_lifecycle`, `05_chat_flow` and `06_search_anchor` all pass. The one failure is `feedback_flow`, at a later step than the one named here, and it is an app layout bug (`headerTransparent` with no Android header inset), not a flow defect. Detail in [`../repo-health/03-e2e-suite-signal.md`](../repo-health/03-e2e-suite-signal.md).

They were invisible until now because every flow previously died during onboarding. Covered by mobile follow-up task 06.

## Two behaviour changes in #576 worth a reviewer's eye

Both follow from the hub card no longer holding conversation rows:

- the collapsed header's conversation "today" count reflects loaded rows only (sessions still counted normally)
- `mergeChats` shows the first page with a see-all row instead of every conversation inline
