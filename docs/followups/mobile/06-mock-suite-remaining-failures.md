# 06 — Three pre-existing mock-suite failures

> **Overtaken 2026-09-05.** The four-flow table below is a 2026-08 iOS measurement and no longer describes the suite.
> Android CI run [33933929192](https://github.com/RonenMars/threadbase-mobile/actions/runs/33933929192) on `main` `8146d2f5` ran **16 flows and failed 1**: `session_lifecycle`, `05_chat_flow` and `06_search_anchor` all passed.
> The one failure is `feedback_flow`, and not at the assertion named below — #772 fixed `settings-help-feedback-row` on 2026-08-20.
> It now dies 30 lines later at `e2e/feedback_flow.yaml`'s `tapOn: "Help us squash a bug"`, because the Android IME scrolls that heading off the top of the `KeyboardAwareScrollView`.
> Re-measure before acting on any count here.

**Repo:** tb-mobile · **Base:** `main` (the onboarding repair is already there via PR #578) · **Owns:** `e2e/*.yaml`, the simulator
**Pair with:** 05 — same domain, same build, same device

## State of play

With `e2e/setup.yaml` repaired (PR #578 on `main`; PR #575 is the same fix against the integration branch) the mock suite runs **11/15**, up from 1/15. Three failures remain, plus `05_chat_flow` (task 05).

All are **confirmed pre-existing**: each reproduces in isolation, and each fails on the identical assertion against a Release build of the branch base with the feature code absent. They were invisible until now because every flow died during onboarding.

| flow | fails at |
|---|---|
| `session_lifecycle` | `hub-screen is visible` — after a back-navigation, though `launch` asserts the same id successfully |
| `feedback_flow` | `settings-help-feedback-row is visible` |
| `06_search_anchor` | `conversation-row-conv-search-anchor is visible`, after typing the query |
| `05_chat_flow` | `first-session-card is visible` (task 05 covers the later keyboard step) |

Most likely one cause each: a stale `testID`, or a screen that moved. Fix the flows, not the app, unless you find a genuine product bug — in which case stop and report it rather than folding an app change into a test PR.

## The trap that invalidated a previous run

`e2e/ensure-release-build.js` **silently reuses a stale `.app`**. One full suite run in this repo tested a week-old build and reported results as if they were current. Before believing any pass:

```bash
C=$(xcrun simctl get_app_container <udid> com.ronenmars.threadbase)
grep -ac "<a string you just added>" "$C/main.jsbundle"
```

Rebuild with `npx expo run:ios --configuration Release --device <udid>` when it returns 0.

Note every Release build rewrites four path-dependent checksums in `ios/Podfile.lock`. Those are never yours to commit — `scripts/reset-podfile-lock-path-noise.sh`, or `git checkout -- ios/Podfile.lock`.

## Done when

`npm run test:e2e:mock` reports 15/15, or any residual failure is explained with evidence that it is a product bug rather than a harness one.
