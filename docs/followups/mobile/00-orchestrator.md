# tb-mobile — orchestrator for the ADR 0001 follow-ups

Seven tasks descending from [ADR 0001](../../adr/0001-hub-data-layer-lazy-pagination.md) and from what shipped in PRs #575 and #576. The streamer-side work is a separate set under `docs/followups/streamer/`.

## Where the work happens

**Everything bases on the integration branch, in a worktree.**

```
integration/open-prs-291-544-551-553-554-556-557-558-559-560-563-566-567-568-569
```

Confirm it is still the active integration branch before starting — `git branch -a --list '*integration*'` — and use whatever has superseded it if it has moved. PRs #575 and #576 both target it.

```bash
git fetch origin
git worktree add ../tb-mobile-worktrees/<task-slug> \
  -b <type>/<slug> origin/integration/open-prs-291-…-569
cd ../tb-mobile-worktrees/<task-slug>
cp -Rc ../../tb-mobile/node_modules ./node_modules   # ~20s on APFS, no extra disk
```

Two rules that are not style preferences:

- **Worktrees live outside the repo root.** A nested one is a full second copy that Jest, ESLint, TypeScript and Metro all walk into, producing failures from a stale branch that do not exist in your tree.
- **`node_modules` must be a real copy, not a symlink.** Metro resolves the project root *through* a symlink and silently bundles the main checkout, so you test code you did not write. The tell is in `.expo/dev/logs/start.log`: the entry reads `../../tb-mobile/node_modules/expo-router/entry.js` instead of `node_modules/expo-router/entry.js`.

## What actually constrains parallelism

Not the code. Two shared resources:

1. **`app/index.tsx`** — tasks 01 and 03 rewrite overlapping regions. Together they conflict in the file hardest to review.
2. **One simulator** — tasks 04, 05+06 each need it exclusively. Maestro takes over the device, and two Release builds on one Mac skew any timing collected.

## Dependency graph

```
wave 1 (parallel, separate worktrees):
  07   pair deep-link route            — isolated new route
  05+06  all four e2e failures         — one stream, owns the simulator
  01   retire useEagerConversations    — owns app/index.tsx

wave 2 (after 01 merges, parallel with each other):
  02   conversation cache-patch
  03   colocate Hub subscriptions

wave 3 (alone, device exclusive, nothing else building):
  04   render measurement
```

Task 01 needs **#576 merged into the integration branch** — it builds directly on the summary-driven grouped views. If #576 is still open, either wait or base 01 on `feat/lazy-project-summary-groups`.

Tasks 05+06 want **#575 merged** first, or they inherit a suite where every flow dies during onboarding.

04 is deliberately last: measuring the render loop before 02 and 03 remove its final two sources produces a number you will discard.

## Rules every stream follows

From `CLAUDE.md`, plus what this work learned the hard way:

- **Branch + PR per task**, conventional title `type(scope): imperative summary`. No AI attribution in commits, PR bodies or comments. Commit approval before committing.
- **Never commit `ios/Podfile.lock` checksum drift.** Every Release build rewrites four path-dependent checksums. `scripts/reset-podfile-lock-path-noise.sh`, or `git checkout -- ios/Podfile.lock` when that is the only diff.
- **Lint the staged set** — and beware the zsh trap: `npx eslint $FILES` with an unquoted variable passes *one* argument and silently lints nothing. Use `... | tr '\n' '\0' | xargs -0 npx eslint`.
- **Typecheck baseline is 14 errors**, all pre-existing `expo-router` path typing. Count them, don't assert zero — and use `--pretty false`, because ANSI codes will break your grep and report 0.
- **Verify the binary before believing an e2e result.** `e2e/ensure-release-build.js` silently reuses a stale `.app`; one full suite run here tested a week-old build and reported it as current. `grep -ac "<string you just added>" "$(xcrun simctl get_app_container <udid> com.ronenmars.threadbase)/main.jsbundle"`.
- **Confirm a failure in isolation before calling it real, and against the branch base before calling it yours.** That distinction is what separated four pre-existing e2e failures from a regression.

## Reporting

Per task: what changed, the verification command and its **actual output**, and anything deliberately left undone. A number that misses its target with an explanation beats a number that hits without one.

Stop and ask if a brief is wrong or already done — they are a snapshot from when #575 and #576 were opened.
