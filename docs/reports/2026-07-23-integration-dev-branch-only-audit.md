# integration-dev/v1.0.0-2026-07-22 branch-only audit

Date: 2026-07-23
Branch: `integration-dev/v1.0.0-2026-07-22`
Head: `33ecfc31435c0771ac36345f0bba24ed59944b6f`
Base checked against: `origin/main`

## Summary

- `c19b40c` does not currently have a clean PR path to `main`.
- `origin/main..c19b40c` includes a large integration stack, not just the live-reload change.
- A correct PR for the `c19b40c` work requires isolating that change onto a fresh branch from `main`.
- On the current integration branch, the branch-only non-docs set is:
  - app/code: `c19b40c`
  - non-app config: `51c4db1`
- The rest of the integration-only history is either:
  - docs/runbook/report commits, or
  - merge commits that aggregate PR work.

## PR status for `c19b40c`

Current state:

- No existing PR was found for `c19b40c` by title search.
- `git log origin/main..c19b40c` shows that `c19b40c` sits on top of many unrelated integration commits.

Implication:

- Opening a PR by pointing a branch directly at `c19b40c` with `main` as base would produce a polluted PR.
- The correct path is:
  1. create a fresh branch from `origin/main`
  2. apply only the `c19b40c` change onto that branch
  3. push it
  4. open the PR against `main`

Blocked step:

- That isolation step requires creating a new commit, so it needs the repo's commit-approval checkpoint before execution.

## Branch-only app/code commits

These are on `integration-dev/v1.0.0-2026-07-22` and were not matched to any PR.

### `c19b40c` — `feat(conversation): stabilize live reload, animate new messages, add live pause toggle`

Changed files:

- `app/conversation/[id].tsx`
- `components/conversation/ConversationHistoryList.tsx`
- `components/conversation/LivePauseControl.tsx`
- `components/conversation/MessageItem.tsx`
- `hooks/useConversations.ts`
- `__tests__/integration/conversation-live-view.test.tsx`
- `__tests__/unit/hooks/reuseMessageIdentities.test.ts`
- `locales/ar/conversation.json`
- `locales/en/conversation.json`
- `locales/he/conversation.json`
- `locales/ru/conversation.json`

Notes:

- This is the only branch-only app/code commit found in the current integration-only range.
- `19d340d` was not included here because its content is already represented by open PR `#376` even though the exact SHA differs.

## Branch-only non-app config commits

### `51c4db1` — `chore: update Podfile.lock following deps updates`

Changed files:

- `ios/Podfile.lock`

Notes:

- This commit is not app logic.
- PR `#373` covers the later `98d640f` Podfile snapshot refresh, not this earlier standalone `51c4db1` change.

## Docs/runbook/report commits not represented by PRs

These are branch-only, but they are not app/code commits:

- `eeae779` — mobile land-open-prs runbook
- `82dd5f6` — kickoff runbook append
- `e15a422` — runbook template/example setup
- `6c01d18` — integration merge report update
- `e26af8e` — integration merge report update
- `0fff361` — integration merge report update
- `c250363` — integration merge report update
- `7494342` — integration merge report update

## Merge commits that only aggregate PR work

These commits are merge wrappers. They combine parent histories and do not represent separate authored feature work of their own.

- `33ecfc3` — merge of PR `#373`
- `9ce5a9a` — merge `origin/docs/jest-suite-verification`
- `59719a6` — merge `origin/feat/live-external-sessions`
- `e7c738b` — merge `origin/fix/onboarding-pair-token-exchange`
- `0818af0` — merge `origin/fix/abandoned-empty-sessions`
- `633637a` — merge `origin/fix/onboarding-pair-token-exchange`
- `c875eb3` — merge `origin/ci/i18n-parity-gate`
- `bd7f90a` — merge `origin/feat/onboarding-notifications-step`
- `c2af06b` — merge `origin/fix/e2e-drag-reorder-in-suite`
- `bdf8e47` — merge `origin/fix/onboarding-pair-token-exchange`
- `b94acfb` — merge `origin/fix/e2e-browse-and-feat1`
- `30a6e00` — merge `origin/feat/onboarding-polish-top5`
- `8cf5805` — merge `origin/fix/e2e-grant-speech-recognition`
- `2719288` — merge `origin/docs/pre-release-status-sync-2026-07-22`
- `d942e52` — merge `origin/fix/servers-remove-dialog-i18n`
- `9dc57b8` — merge `origin/chore/i18n-unused-keys-validation`
- `8928ae5` — merge `origin/feat/live-external-sessions-integration`
- `c86b4c2` — merge `origin/feat/live-external-sessions`
- `0d2b163` — merge `origin/dependabot/npm_and_yarn/npm_and_yarn-f53f33db58`
- `bd0402a` — merge `origin/docs/pre-release-status-2026-07-19`
- `50d45d4` — merge `origin/fix/abandoned-empty-sessions`
- `8041b30` — merge `origin/fix/multi-attachment-send`
- `684af98` — merge `origin/feat/crash-consent-model`
- `68a5a60` — merge `origin/feat/cache-warmup-status`
- `717b857` — merge `origin/feat/cache-integrity-alert`
- `bfc800d` — merge `origin/docs/pre-release-status-2026-07-19`
- `45c7d45` — merge `origin/fix/abandoned-empty-sessions`
- `7794715` — merge `origin/fix/multi-attachment-send`
- `6be5cbd` — merge `origin/feat/crash-consent-model`
- `8be2e11` — merge `origin/feat/cache-warmup-status`

## Suggested next step for the PR

If approved, isolate `c19b40c` onto a clean branch from `origin/main` and open a PR with:

- branch: `feat/conversation-live-reload-pause-toggle`
- base: `main`
- title: `feat(conversation): stabilize live reload, animate new messages, add live pause toggle`

## Latest origin diff after refresh

Refreshed on: 2026-07-23

Live refs fetched:

- `origin/integration-dev/v1.0.0-2026-07-22`: `33ecfc31435c0771ac36345f0bba24ed59944b6f`
- local `integration-dev/v1.0.0-2026-07-22`: `33ecfc31435c0771ac36345f0bba24ed59944b6f`
- `origin/main`: `d95088fabadfece709002817cee87ab5dbfd84d8`

### What changed since the report snapshot

- The integration branch head did not change. It is still `33ecfc3`.
- The open PR set did change.
- Open PR count excluding `#291` is now `24`.
- Two new open PRs are now present relative to the earlier 22-PR snapshot used in the previous audit context:
  - `#378` — `feat(conversation): stabilize live reload, animate new messages, add live pause toggle`
  - `#380` — `feat(conversation): add in-chat search entry on detail screen`

### Targeted checks for the newly surfaced PRs

For the new PRs, the integration branch does not currently contain their current heads by ancestry:

- `#378` head `f9e5bdbd006c2b84f6244a1d11f6d5a623f4adf2` is not an ancestor of `integration-dev/v1.0.0-2026-07-22`
- `#380` head `0ce45291fad3ebaf7766d007559ca9b438b1ee1e` is not an ancestor of `integration-dev/v1.0.0-2026-07-22`

Targeted changed-file equivalence checks against the current integration branch also failed for both PRs:

- `#378` changed-file set is not equivalent to the current integration-branch content
- `#380` changed-file set is not equivalent to the current integration-branch content

### Impact on the earlier conclusions

- The earlier statement "No existing PR was found for `c19b40c` by title search" is no longer current.
- There is now an open PR path for that feature area:
  - `#378` on branch `feat/conversation-live-reload-pause-toggle`
- However, the current fetched state does not show `#378` as already represented on the integration branch.
- `#380` is also a newly open PR not represented on the integration branch by the targeted checks above.

### Scope note

This section is a live diff against the earlier report snapshot. A full fresh branch-vs-all-PR rerun with the current open PR set did not complete in a reasonable window because the current audit script is still too slow on `tb-mobile` during the branch-only comparison phase. The high-confidence live changes established here are:

- branch head unchanged
- open PR set expanded to include `#378` and `#380`
- neither of those PRs is currently represented on the integration branch by direct ancestry or targeted changed-file equivalence
