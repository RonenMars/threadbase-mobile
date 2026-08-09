# 04 — `e2e/ensure-release-build.js` silently reuses a stale build

**Priority: high.** This class of bug is the expensive one: it does not fail, it lies.

## State of play

Recorded during the ADR 0001 session:

> one full suite run this session tested a week-old `.app` and reported it as current

The script reuses whatever build is installed without checking whether it contains the code under test. A stale build does not error — it produces a confident, wrong pass or fail, and every conclusion drawn from that run is unsound.

The current defence is a manual check nobody will remember to run:

```bash
grep -ac "<string you just added>" \
  "$(xcrun simctl get_app_container <udid> com.ronenmars.threadbase)/main.jsbundle"
```

The script already resolves the `.app` path, so it is positioned to do this itself.

## Why this is worth real effort

The session that produced these briefs hit **three more bugs of the same shape**, none of which errored:

- a `node_modules` borrowed from another worktree — verified against the wrong dependency versions, producing a green 155-suite run that CI contradicted;
- bash logic checked under zsh — word-splitting differs, so a correct workflow reported a false failure;
- a zsh `:e` parameter modifier eating a git path — `git show` returned nothing and `grep -c` scored the empty result as `0`, which reads as a real measurement.

All four returned a plausible answer to a question nobody asked. Harness code that can silently answer the wrong question needs an assertion, not a comment.

## Approach

Compare a build stamp or bundle hash against `HEAD` and rebuild when they diverge; failing loudly is an acceptable minimum. Whatever the mechanism, it must be **impossible to get a pass out of a stale build**.

Watch the edge case: a dirty working tree has no clean `HEAD` to compare against. Decide deliberately whether that rebuilds every time or warns — and write down which, because the answer is not obvious to the next reader.

## Done when

- Running the suite against a stale build either rebuilds it or fails — never reports a pass.
- The behaviour is demonstrated: install an old build deliberately, run, show the actual output.
- The manual `grep -ac` workaround is removed from the docs that recommend it, or marked as no longer needed.
