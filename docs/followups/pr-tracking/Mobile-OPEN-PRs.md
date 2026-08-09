# tb-mobile — Open PRs

Snapshot: **2026-08-09 13:20**. Regenerate with `gh pr list --state open --json number,title,headRefName,baseRefName,headRefOid,author,updatedAt` in `tb-mobile`, then re-fetch each PR individually for mergeability — bulk queries return `UNKNOWN` because GitHub computes it lazily. Treat as stale by default — re-scan before acting.

`main` tip: `4d80e984`. Integration branch tip: `0a4dd2d5`.

20 open. Every PR targets `main` except the four noted.

## Ready to merge — green and clean

| PR | Title | Branch | Head |
|----|-------|--------|------|
| #576 | feat(hub): load grouped views from project summaries | `feat/lazy-project-summary-groups` | `34667999` |
| #572 | feat(conversation): handle Codex active-writer collisions with fork recovery | `fix/codex-active-writer-mobile` | `e26b2d1d` |
| #574 | ci: dispatch a subset of Maestro flows, and fix the E2E iOS build | `ci/e2e-flow-subset` | `92c4e21e` |
| #569 | fix(favorites): open conversations with stored id | `fix/favorite-conversation-navigation` | `7127e13c` |
| #567 | chore(signing): bootstrap android keystore and play credentials from 1password | `chore/local-signing-op-android` | `0fda9d9a` |
| #566 | fix(sessions): stop the Hub background-refresh re-render loop | `fix/hub-render-loop` | `e2c96efe` |
| #563 | perf(sessions): coalesce eager-fetch progress and memoize list roots | `perf/coalesce-eager-progress` | `7a89e3be` |
| #560 | feat(session): persist accordion collapse state across session views | `feat/persist-accordion-collapse-state` | `2321a450` |
| #556 | refactor(session): adopt streamer lifecycle for ended vs hold | `refactor/session-lifecycle-phase` | `9c04478b` |
| #553 | docs: add cloud dev environment instructions | `docs/cloud-dev-environment-18a1` | `4b5cc9e3` |
| #544 | fix(terminal): disclose missing scrollback after resume | `fix/resumed-terminal-scrollback-disclosure` | `c48d20f9` |
| #559 | chore(deps-dev): bump eslint-config-expo 57.0.0 → 57.0.1 | dependabot | `fc6f6c2d` |
| #558 | chore(deps): bump expo-updates 57.0.10 → 57.0.11 | dependabot | `639afe0a` |
| #554 | chore(deps): bump the npm_and_yarn group (2 updates) | dependabot | `a574ae99` |

`#551` (`fix(conversation): back to live session from resumed history`, `b26bbece`) is also clean, but **stacked on `#544`** — its base is `fix/resumed-terminal-scrollback-disclosure`, not `main`. Merge #544 first.

## Conflicting — need a rebase before anything else

| PR | Title | Base | Why |
|----|-------|------|-----|
| #580 | docs(followups): brief the ADR 0001 follow-up work | **integration** | `CONFLICTING/DIRTY` |
| #575 | fix(e2e): repair cold-start onboarding in the setup flow | **integration** | `CONFLICTING/DIRTY`. Its content is already on `main` via #578 — see `Mobile-LEFTOVERS.md` before resolving. |
| #568 | feat(conversation): prototype infinite-query pagination for classic history | main | `CONFLICTING/DIRTY` |

## Blocked on red CI — do not merge

| PR | Title | Failing | Cause |
|----|-------|---------|-------|
| #557 | chore(deps-dev): bump jest and @types/jest | Unit, Integration, i18n, E2E jest | jest 30 is incompatible with `jest-expo@57`. This is the bump #577 reverted out of the integration branch. |
| #291 | chore(deps-dev): bump typescript 6.0.3 → 7.0.2 | Lint | TS 7 is outside `@typescript-eslint`'s peer range (`>=4.8.4 <6.1.0`). |

Both are `MERGEABLE/BLOCKED` — mergeable in git terms, blocked by required checks. **They are red on `main` for exactly the reasons diagnosed on the integration branch**, which is independent confirmation, not a coincidence. See `Mobile-LEFTOVERS.md` → the dependabot decision.

## Merged today, for context

| PR | Title | Landed |
|----|-------|--------|
| #579 | docs(followups): brief the ADR 0001 follow-up work [skip-ci] | `main` @ `4d80e984` |
| #578 | fix(e2e): repair cold-start onboarding in the setup flow | `main` @ `867effbe` |
| #577 | fix(deps): revert jest and typescript to the versions the toolchain supports | integration branch |
| #573 | ci: run the Maestro E2E suite on manual dispatch | `main` @ `d8cd6897` |
