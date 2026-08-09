# 04 — Measure the ADR 0001 render target on device

**Repo:** tb-mobile · **Base:** after 02 and 03 land
**Owns:** the simulator, exclusively — no other task may run a build or a Maestro flow while this does
**Depends on:** 01, 02, 03

## Goal

Produce the number ADR 0001 was written to produce: `ProjectsHub` settling to **~1 render per real, user-visible data change**, down from the ~6/sec loop this work started from.

This has never been measured. PR #576 verified the *mechanism* — eager hook unmounted for grouped layouts, one `/api/projects/summary` and zero `conversations/count` in the tree's network trace — but produced no render count. Do not treat the mechanism evidence as the criterion; it isn't.

## Method

Instrument `ProjectsHub` with `useRenderTally` / `useWhyRender` and read `.expo/dev/logs/start.log`. These probes are **not committed** — they were a local instrument, deliberately stripped before PR #576. Re-add them locally and strip them again before any commit.

Exercise, per layout (tree, hub, classic): cold start → settle → pull-to-refresh → settle → open a project → settle. Record the `[render]` count for each settle, and `[why]` for anything that re-renders without a data change.

## Two traps, both of which return a plausible wrong answer rather than an error

Read `docs/troubleshooting.md` → "Measuring the wrong thing" first. Both have already cost real time on this work:

1. **The flag must live in `.env.local`** (`EXPO_PUBLIC_OPEN_TRACE=1`). A shell export does not inline into the bundle. Verify by grepping the served bundle, not by assuming:
   ```bash
   curl -s "http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true" | grep -c 'OPEN_TRACE": "1"'
   ```
2. **The dev client serves a disk-cached bundle.** Reload, deep link and `simctl launch` all no-op against it. Uninstall + reinstall forces a fresh fetch — which wipes pairing, so re-pair afterwards.

A third, learned here: `simctl launch` lands on the Expo dev-launcher, not the app. Deep-link past it:
```bash
xcrun simctl openurl <udid> "threadbase://expo-development-client/?url=http%3A%2F%2F<lan-ip>%3A8081"
```

## Pairing

Test against both real servers; one has 600+ conversations. Pairing is where automation repeatedly stalls — `hideKeyboard` is broken on iOS 26.x and typing into the second field lands in the first while the keyboard covers it.

The reliable route is the **per-field paste buttons**, which never raise the keyboard: put the value on the clipboard with `xcrun simctl pbcopy <udid>`, then tap `server-form-paste-url`; repeat for `server-form-paste-key`. Note the URL field takes **host:port only** — there is a separate `http://` scheme dropdown beside it.

`tb pair` prints a `threadbase://pair?...` link, but it currently hits Unmatched Route as a deep link (see 08), so it is not a shortcut yet.

## Done when

A recorded `[render]` count per layout per interaction, with the settle value stated plainly. If the target is not met, the `[why]` output naming the remaining churn source is the deliverable — a number that misses with an explanation beats a number that hits without one.
