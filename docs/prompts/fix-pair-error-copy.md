# Prompt — fix the raw exception on the pair deep-link error screen

Issue: **https://github.com/RonenMars/threadbase-mobile/issues/638**

Hand this to a fresh agent session opened in `~/dev/ai-tools/tb-mobile`.

> **Work in a new git worktree, outside the repo root.** Do not edit the main checkout — other sessions and verification runs use it, and a stray edit there gets read by whoever is mid-task. The exact command is under [Workflow](#workflow); the rules around it are not style preferences and are explained there.
>
> If `../tb-mobile-worktrees/pair-error-copy` or the branch `fix/pair-error-copy` already exists, someone is running this now or has run it before — check `git worktree list` and `gh pr list` before starting, and pick a unique suffix rather than reusing them.

---

## The defect

The `threadbase://pair` deep-link error screen shows a raw exception string instead of translated copy.

Observed on device 2026-08-11 (iPhone 17 Pro Max / iOS 26.1, Release build of `97f2869c`), fresh install with zero paired servers, opening a pair link whose host was unreachable:

> **Pairing failed**
> Could not reach the server: fetch failed: UnexpectedException: Could not connect to the server. (at ExpoModulesCore/Promise.swift:56)

Three problems in one string. It is not localized — the surrounding "Pairing failed" / "Try again" / "Contact support" chrome **is** translated, so the mismatch is visible mid-screen. It leaks an internal Swift path. And it tells the user nothing actionable.

This is the first screen a new user sees on the flow onboarding instructs them to use, so it is the worst placement in the product for developer-facing text.

## Verified state

`app/pair.tsx` was built to reuse the QR scanner's translated taxonomy under the `pair:scanner.errors.*` keys, and that works for the failure shapes it recognises. This path is different: the raw `Error.message` from the failed `exchangeToken` fetch is surfaced instead of being mapped onto one of those keys.

**The bug is in the mapping, not the copy** — an unrecognised failure falls through to the exception text rather than to a translated fallback. Confirm that reading yourself before changing anything.

## Scope

Files you own:

- `app/pair.tsx`
- `locales/{en,he,ru,ar}/pair.json`
- tests under `__tests__/`

Do not touch `docs/`, `app/_layout.tsx`, `e2e/`, `.github/`, or `package.json`.

## What "fixed" looks like

An unreachable or refused host produces a translated, actionable message in all four locales — in the spirit of *"Could not reach that server. Check the streamer is running and that your phone is on the same network."* The wording is yours, but it must name a next action, not just a cause.

No internal file path, no `UnexpectedException`, no `Promise.swift` reaches the screen in any locale.

Keep the raw string diagnosable — route it to `lib/clientLog.ts` or the existing diagnostics surface. Do not discard it; the next person debugging a pairing failure needs it.

**Make the fallback total.** Any unrecognised error must land on a translated generic message rather than on `Error.message`. That is the actual defect — a narrow fix that only special-cases "connection refused" leaves the same hole open for the next unmapped shape.

## Locales

All four (`en`, `he`, `ru`, `ar`) or the i18n CI job fails on missing keys. `he` and `ar` are RTL.

Prefer reusing an existing translated `pair:scanner.errors.*` key where one genuinely fits — that was the original design and those strings are already vetted. Add a new key only when nothing fits.

If you add a key and cannot write a locale confidently, **say so explicitly in the PR** rather than guessing. Wrong copy in a language nobody on the team reads is worse than a flagged gap. Do not machine-translate silently.

Related open follow-up, **not your scope**: the reused scanner strings say "QR" where this entry point is a tapped link. Do not rewrite the scanner copy — just do not make it worse.

## Do not use the iOS simulator

It may be in use for verification runs. Implement and verify with jest, eslint and tsc only — no Maestro, no `npm run ios`, no `xcodebuild`, no install to a simulator. List the on-device check steps in your PR for whoever runs it next.

## Workflow

```bash
/opt/homebrew/bin/git -C /Users/ronenmars/dev/ai-tools/tb-mobile fetch origin
/opt/homebrew/bin/git -C /Users/ronenmars/dev/ai-tools/tb-mobile worktree add \
  ../tb-mobile-worktrees/pair-error-copy -b fix/pair-error-copy origin/main
cd /Users/ronenmars/dev/ai-tools/tb-mobile-worktrees/pair-error-copy
cp -Rc /Users/ronenmars/dev/ai-tools/tb-mobile/node_modules ./node_modules
```

Repo rules that are not style preferences:

- Worktrees live **outside** the repo root. A nested one gets discovered by jest, eslint and Metro and produces failures from a stale branch.
- `node_modules` must be a **real copy**, never a symlink, or Metro silently bundles the main checkout and you test code you did not write.
- jest needs `--watchman=false` in a fresh worktree or it hangs with no output.
- Use the absolute git binary `/opt/homebrew/bin/git`; a shell function shadows `git` on this machine.

## Verify before claiming done

`npx tsc --noEmit --pretty false` — the baseline is **14** pre-existing `TS2345` Expo Router typed-route errors, tracked as https://github.com/RonenMars/threadbase-mobile/issues/606. Adding any is a regression.

**`.expo/types/router.d.ts` does not exist in a fresh worktree**, and without it tsc reports 0 — a false clean that would hide a real regression. Generate it first (briefly run `npx expo start`, then kill it) before trusting the count.

Then `npx eslint <changed files>` and `npx jest --ci --watchman=false --runInBand --testPathPattern "pair|i18n"`.

Write a test that **fails without your fix**: assert an unmapped error produces the translated fallback rather than `Error.message`. Prove it fails by reverting your change, running it, and restoring — do not assume.

## Deliverable

Conventional commit title (`fix(onboarding): …`), one sentence per line in the body, **no AI attribution anywhere** — no `Co-Authored-By`, no "Generated with", no robot emoji.

Push and open a PR against `main` with `gh pr create`, linking issue #638.

Report: the mapping approach, which locales you wrote confidently and which you flagged, the test output including the fails-without-the-fix check, and the PR URL.
