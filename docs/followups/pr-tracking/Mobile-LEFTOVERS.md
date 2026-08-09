# tb-mobile — Leftovers (as of 2026-08-09 13:20)

Open threads from the Codex active-writer / E2E session. Companions: `Mobile-MERGE-ORDER.md` (merge sequence) and `Mobile-ADR-0001-LEFTOVERS.md` (the parallel lazy-loading session).

Treat as stale by default — re-check before acting.

**Changed since first draft (two refreshes):**
- #578 merged to `main` (`867effbe`), porting #575's two commits — `main`'s `e2e/setup.yaml` no longer calls `hideKeyboard`.
- **#577 merged** into the integration branch; the toolchain break is fixed there.
- **#572 and #576 were re-targeted onto `main`** and are now green and clean. The integration branch is largely bypassed.
- `main` is at `4d80e984` (#579 landed since).

## Decisions waiting on a human

| # | Decision | Why it is not mine to make |
|---|----------|----------------------------|
| ~~1~~ | ~~Merge **#577**~~ | **Done** — merged into the integration branch. |
| 2 | Add a `dependabot.yml` ignore for `jest` and `typescript`, or keep closing the PRs by hand | Suppressing dependency updates is a policy choice, not a bug fix. Both bumps are open against `main`: **#557** (jest + @types/jest), **#291** (typescript). |
| 3 | Spend macOS runner budget on the E2E dispatch (~15 min, ~$3 per run) | Recurring cost, and the first run after the pods fix may well fail again. |
| 4 | Whether the integration branch still has a future | Only #575 and #580 still target it, and both conflict. Either land them and retire it, or close them and let `main` be the only trunk. |

## Unfinished by circumstance, not by choice

### ~~#572 has never had a passing CI run~~ — resolved

**Superseded.** #572 was re-targeted onto `main` (head now `e26b2d1d`) and reports `MERGEABLE/CLEAN` with 19 checks green. The five red checks were the integration branch's toolchain break, exactly as diagnosed.

Still true: `codex_parity.yaml` has never run end-to-end, so the flow itself remains unexercised.

### #574's CocoaPods fix is a hypothesis

`expo prebuild --no-clean` skips `pod install` when `ios/` already exists, so `xcodebuild` dies on a missing `Pods-Threadbase.release.xcconfig`. That is why every scheduled E2E run since at least June 2026 failed at the build step — 2026-06-01, 2026-07-01 and 2026-08-01 all died there.

The fix mirrors `deploy.yml`, which genuinely builds iOS on a runner, but a `workflow_dispatch` change can only be tested by merging it to `main` first. Three months of red means nothing past that step has executed in a long time, so expect the possibility of a second failure behind the first.

### The E2E verification chain was never completed

The original goal — a Maestro run against #572 — needs, in order: #577 → #575 → #572 rebased → #574 on `main`. Then:

**Mostly satisfied since.** #577 merged, #578 put the setup fix on `main`, and #572 was re-targeted onto `main` — so its branch now carries that fix too. Only **#574** is still outstanding, and it is green and waiting.

The earlier warning that a `ref=572` dispatch would still hit the broken `setup.yaml` **no longer applies**, because #572 no longer sits on the integration branch.

```
gh workflow run E2E -f ref=572 -f flows=e2e/codex_parity.yaml
```

Four flows are known-failing for unrelated reasons per #575's ADR (`session_lifecycle`, `feedback_flow`, `05_chat_flow`, `06_search_anchor`), so a full-suite run stays red even when everything above is done. Narrowing to `codex_parity` sidesteps them.

### Streamer side of #572 — it exists, and this section was wrong

Corrected in [`Streamer-CODEX-FORK-AND-FOLLOWUPS.md`](https://github.com/RonenMars/threadbase-streamer/blob/docs/pr-follow-notes/docs/pr-follow/Streamer-CODEX-FORK-AND-FOLLOWUPS.md): the server half is tb-streamer PR #463 on branch `fix/codex-active-writer-resume`, green and unmerged, with `POST /api/sessions/:id/fork` implemented. Both contract assumptions are answered there — and the second (no idempotency key) is answered the other way, so mobile's withheld Retry affordance can come back.

### Device-level verification of #572 never ran

The local simulator carries the Expo **dev-launcher**, not the Release build the mock suite requires, so `setup.yaml` fails at `hub-screen` before reaching any changed screen. Installing a Release build would replace the dev client on that simulator — not done without asking.

The three live streamer scenarios that are also unverified (a Codex session owned by a terminal, by VS Code, and by the desktop app) moved to [`Streamer-CODEX-FORK-AND-FOLLOWUPS.md`](https://github.com/RonenMars/threadbase-streamer/blob/docs/pr-follow-notes/docs/pr-follow/Streamer-CODEX-FORK-AND-FOLLOWUPS.md).

## Traps that cost time here

- **#572's worktree `node_modules` is hardlinked from the primary checkout** (jest 29 / TS 6), not installed from its own lockfile. Run `npm ci` there before trusting any test result. This produced a green local run that CI flatly contradicted.
- **The Bash tool is zsh; Actions `run:` steps are bash.** Unquoted list expansion splits in bash and does not in zsh, so checking CI shell logic locally returns a convincing false failure. Exercise it with an explicit `/bin/bash`.
- **A fresh worktree makes jest hang** on watchman's crawl. Use `--watchman=false`; see `docs/troubleshooting.md`.

## Not carried forward, on purpose

- The Maestro `hideKeyboard` finding belongs to #575 and is documented in its ADR and in `07_conversation_scroll_gaps.yaml`'s header.
- The `expo prebuild` / pod-install gotcha now lives as a comment in `.github/workflows/e2e.yml`, where someone reading that job will find it.

## Follow-ups from the #578 port

Two things flagged when #575's commits were cherry-picked to `main` and merged as `867effbe`. Neither is urgent; both are the kind of thing that confuses whoever touches this next.

### 1. #575 is now redundant on `main`, and conflicting on its own base

#575 stays open against `integration/open-prs-291-544-…-569`. Its two commits — `fix(e2e): repair cold-start onboarding in the setup flow` and `docs(e2e): write up the 05_chat_flow hideKeyboard follow-up` — are already on `main` via #578, byte-identical.

Nothing breaks. When the integration branch eventually reaches `main`, git applies the identical patch without conflict. But two states are now worth being deliberate about:

- **#575 is still needed on the integration branch.** Merging it there is what lets a `ref=572` dispatch reach an assertion, since that dispatch tests `refs/pull/572/head`, not `main`. It is still item 2 in `Mobile-MERGE-ORDER.md`.
- **Do not close #575 as "already done".** The port covers `main` only. Closing it would leave the integration line — and #572 with it — still running the broken `setup.yaml`.

**Update (13:20):** #575 is now `CONFLICTING/DIRTY` against the integration branch, and #572 — the PR that needed it there — has moved to `main`. So the reason to merge it into the integration branch has largely evaporated. The remaining question is decision #4 above: does that branch still have a future at all? If not, #575 and #580 can both be closed as superseded rather than rebased.

### 2. The setup flow still has not been executed

#578 was verified structurally, not behaviourally:

- the two files are byte-identical to #575's,
- `e2e/setup.yaml` parses as valid YAML and no `hideKeyboard` remains,
- both testIDs the new NOTIFY step needs exist on `main` unchanged — `onboarding-notifications-cta` (`components/onboarding/steps/NotificationsStep.tsx:154`) and `onboarding-done-cta` (`DoneStep.tsx:124`).

**The "1/15 → 11/15" figure is #575's author's, reproduced but not independently confirmed.** Nothing in this session ran the suite.

Running it needs a Release build on a booted simulator, and the E2E job is separately broken at the iOS build step until **#574** lands. So the honest state of `main` is: the fix is present and structurally sound, its effect is unproven.

First real test, once #574 is on `main`:

```
gh workflow run E2E                     # main, whole suite — expect 11/15 if the fix works
gh workflow run E2E -f flows=e2e/codex_parity.yaml   # or narrow, once #574 gives us the input
```

A full-suite run stays red regardless: four flows fail for unrelated reasons (`session_lifecycle`, `feedback_flow`, `05_chat_flow`, `06_search_anchor`).
