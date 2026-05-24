# Plan — Upgrade Threadbase Mobile to Expo SDK 56

**Status:** queued
**Created:** 2026-05-23
**Source brief:** [docs/upgrade-to-expo-56.md](../../upgrade-to-expo-56.md) — full procedure, acceptance criteria, and rollback context

## TL;DR

Move from Expo SDK 55 → 56 on a `chore/expo-56-upgrade` branch. The detailed step-by-step procedure lives in `docs/upgrade-to-expo-56.md` and is the source of truth. This file is a lightweight pointer + status log.

## Phases (from brief)

0. Discover + report — confirm current state, read SDK 56 changelog, list impact areas, **stop for approval**
1. Branch + dep bump — `npx expo install expo@56 --fix`, `expo-doctor`, pod install, watchman reset
2. Code-level fixes — typecheck, lint (baseline 43 errors / 46 warnings), Jest suites
3. Native rebuild + sim smoke — Release build, Maestro suite, iOS 26.4 + iOS 17.x sanity
4. Ship dry-run — archive only, no upload
5. PR — open against `main`, do not merge

## Acceptance criteria (from brief)

See `docs/upgrade-to-expo-56.md#acceptance-criteria` — copied here so the plan is self-contained:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` ≤ baseline (43 errors / 46 warnings on `main`)
- [ ] `npm run test:ci` exits 0
- [ ] `npm run test:e2e:mock` exits 0
- [ ] App launches cleanly on iPhone 17 Pro / iOS 26.4 sim
- [ ] App launches cleanly on iOS 17.x sim
- [ ] `expo-doctor` exits 0
- [ ] No new TS2345 / TS2322 from `t('ns:key')` cross-namespace usage
- [ ] iOS Release build succeeds via `npx expo run:ios --configuration Release --device <udid>`
- [ ] TestFlight archive via `/expo-local-ship` succeeds (no actual ship)
- [ ] PR opened with before/after dep version table

## Risk notes

- Previous 55→56 attempt rolled back on 2026-05-06 (`project_sdk55_downgrade_2026_05_06.md`). Wait for `~56.0.5`+ if possible.
- iOS-26 Hermes path was a crash source 54→55; re-test on iOS 26.x.
- `ship.sh` step-2 `npm install` corrupts Watchman/Metro mid-ship — reset Watchman before any ship dry-run.
- A separate `chore/dep-upgrade-2026-05` branch already exists with prior 56 work — inspect before re-doing from scratch.

## Out of scope

See `docs/upgrade-to-expo-56.md#things-explicitly-not-in-scope` — no NativeWind migration, no react-native-screens@5, no expo-updates re-enablement, no Zustand/Router refactors.
