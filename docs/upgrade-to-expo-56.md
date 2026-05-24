# Prompt: upgrade Threadbase Mobile to Expo SDK 56

Paste this prompt to Claude Code (or use as a task brief). It is designed to be self-contained.

---

## Context (do not skip — read everything first)

You are upgrading a working React Native + Expo project from **Expo SDK 55 → SDK 56**. Read the briefing carefully before touching code.

### Project facts (current state at time of writing)

- **Repo:** `~/Desktop/dev/ai-tools/tb-mobile`
- **Branch to start from:** `main` (cut a new branch `chore/expo-56-upgrade`)
- **Current SDK:** Expo `~55.0.23`
- **Target SDK:** Expo `~56.0.x` (latest stable patch at upgrade time)
- **RN currently:** `0.83.6` → expected target `0.85.x`
- **React currently:** `19.2.0` → expected target `19.2.3`
- **Node requirement:** ≥ 22.13 (already satisfied locally and in CI)
- **Architecture:** **New Architecture enabled** (`RCTNewArchEnabled = true` in `ios/Threadbase/Info.plist`, Hermes engine in `ios/Podfile.properties.json`). Keep it enabled.
- **Routing:** Expo Router (file-system, `app/` dir, `typedRoutes: true` in app.json experiments).
- **Native dirs:** `ios/` and `android/` exist and are CNG-managed (`prebuild` regenerates them from `app.json` plugins). Treat them as derived.
- **Custom dev client:** project ships its own `Threadbase.app` via `expo-dev-client`. **Public Expo Go is not relevant** — the App Store's Expo Go is frozen at SDK 54, which has nothing to do with what this project ships.
- **iOS-only ship pipeline currently:** TestFlight via `/expo-local-ship` skill. Android side is configured in `app.json` but has not been built recently.
- **Bundle ID:** `com.ronenmars.threadbase`
- **Sim used for local validation:** iPhone 17 Pro, iOS 26.4 (UDID `8F447B99-3E7C-4419-AEAD-EB10B7151BF0`)
- **E2E suite:** `npm run test:e2e:mock` runs Maestro flows (`e2e/launch.yaml`, `e2e/browse.yaml`) against a local mock server. This is the smoke test the upgrade must keep green. See `e2e/README.md`.

### Notable third-party deps that may need attention

- `react-native-reanimated@4.2.1` + `react-native-worklets@0.7.4` (New-Arch-only Reanimated 4 pair — bump together via `expo install --fix`)
- `react-native-screens@~4.23.0` (may move to 5.x on SDK 56)
- `react-native-safe-area-context@~5.6.2`
- `@shopify/flash-list@2.0.2` (recently introduced — check 2.x compatibility with RN 0.85)
- `expo-router@~55.0.14` (typed routes; 56 makes typing stricter — watch for `as Href`/`as any` casts breaking)
- `expo-notifications@~55.0.22` (API has had slow rework across SDK versions)
- `nativewind@^4.2.3` + `tailwindcss@^3.4.10` (NativeWind v4 works on RN 0.85)
- `expo-dev-client@~55.0.32`
- `@gorhom/bottom-sheet@^5.2.13`
- `zustand@^5.0.12`
- `i18next@^26.0.8`, `react-i18next@^17.0.6`
- Polyfills already in place: `intl-pluralrules`, `react-native-get-random-values`
- Crypto: `tweetnacl`, `tweetnacl-util`

### Briya commit rules (NOT applicable here)

This is **not** a Briya repo — no `ENG-<n>` ticket scope required. Use plain conventional commits: `chore(expo): …` etc. **No `Co-Authored-By` trailer** — global hook blocks it.

### Existing memory worth respecting

- A previous SDK 55→56 attempt was made on `chore/dep-upgrade-2026-05` and rolled back to SDK 55 stable on 2026-05-06 (`project_sdk55_downgrade_2026_05_06.md` in user memory). Treat 56 as still potentially fragile. Avoid SDK-56-only APIs unless necessary. Wait for a patch release if possible (`expo@~56.0.5`+).
- An iOS-26 Hermes crash was fixed by going 54→55 (`feedback_hermes_ios26_crash.md`). Same Hermes path will be exercised again on 56. Test on iOS 26.x sim after upgrade.
- `ship.sh` step-2 `npm install` corrupts Watchman/Metro state mid-ship — fix the race, don't remove the install (`feedback_ship_npm_install_metro_race.md`). After this upgrade, do a Watchman reset before shipping.

---

## Goal

Land Expo SDK 56 on `main` via PR. Suite is green, app boots cleanly on iOS sim and on a TestFlight build, no functional regressions, no new type errors, lint baseline unchanged.

---

## Acceptance criteria

You may not mark the upgrade done until all of these pass:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` reports the **same or fewer** problems than `main` (current baseline: 43 errors / 46 warnings — these are pre-existing; do not let the count grow)
- [ ] `npm run test:ci` exits 0 (Jest unit + integration + e2e)
- [ ] `npm run test:e2e:mock` exits 0 (Maestro suite against the freshly built `.app`)
- [ ] App launches cleanly on iPhone 17 Pro / iOS 26.4 simulator (no red box, no error banner that wasn't there before)
- [ ] App launches cleanly on iOS 17.x simulator (sanity: New Arch + Hermes 0.16 work on older iOS)
- [ ] `expo-doctor` exits 0
- [ ] No new TS2345 / TS2322 errors from `t('ns:key')` cross-namespace usage (memory: `project_i18n_ts_errors_post_sdk55.md`)
- [ ] iOS Release build succeeds via `npx expo run:ios --configuration Release --device <udid>`
- [ ] TestFlight build via `/expo-local-ship` succeeds (no need to actually ship; verifying the archive + signing path works is enough)
- [ ] PR opened with detailed before/after of every dep version that moved

---

## Procedure

### Phase 0 — Discover and report

Do **not** start the upgrade yet. First produce a short report:

1. Confirm current state: `node --version`, `npx expo --version`, `cat package.json | grep -E '"expo"|"react"'`.
2. Verify branch state: `git status`, `git log --oneline -5`.
3. Check the official SDK 56 changelog and upgrade guide. Identify breaking changes that touch the deps this project uses.
4. List the most-likely impact areas in this codebase based on the changelog (search for affected APIs in source).
5. Estimate effort and risk.
6. **Stop and ask for approval to proceed.**

### Phase 1 — Branch + dep bump

After approval:

1. From `main`: `git checkout -b chore/expo-56-upgrade`
2. Use the official upgrade helper:
   ```bash
   npx expo install expo@56 --fix
   ```
   This updates `expo` plus every `expo-*` package and the React / RN / Reanimated / screens / safe-area trio to versions known-good for SDK 56.
3. Check what else `expo-doctor` complains about:
   ```bash
   npx expo-doctor
   ```
   Fix every issue it flags (peer deps, missing fields in `app.json`, etc.).
4. Regenerate iOS Pods:
   ```bash
   cd ios && pod install --repo-update && cd ..
   ```
5. Reset Watchman + Metro caches to avoid stale-state failures:
   ```bash
   watchman watch-del-all
   watchman shutdown-server
   rm -rf $TMPDIR/metro-* $TMPDIR/haste-map-*
   ```
6. Verify `package.json` diff is sensible. No silent removals.
7. Verify nothing in `ios/Threadbase/Info.plist` got reset (especially `RCTNewArchEnabled=true`, your custom `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` / `ITSAppUsesNonExemptEncryption=false`).
8. Verify `ios/Podfile.properties.json` still has `expo.jsEngine: hermes`.

Commit: `chore(expo): bump SDK 55 → 56 via expo install --fix`

### Phase 2 — Code-level fixes

Run the cheap checks first, fix what breaks:

1. `npm run typecheck` — fix every new TS error. Common likely fix areas:
   - `router.push(... as any)` casts may now fail differently — re-cast to a proper `Href<T>` where reasonable, otherwise keep `as any` if the route is truly dynamic.
   - `t('ns:key')` cross-namespace usage may produce new TS2345 — pre-existing pattern documented in memory; fix only if it BLOCKS the build (not if it's just a warning).
   - `expo-notifications` API: `setNotificationHandler` signature may have changed; consult the SDK 56 notes.
   - `react-native-reanimated` strict typing may flag worklet capture issues.
2. `npm run lint` — must match `main`'s baseline (43 errors / 46 warnings). Do NOT fix pre-existing issues during this upgrade. Only address NEW lint errors caused by API changes.
3. Run the Jest suites: `npm run test:unit`, `npm run test:integration`. Fix anything that breaks because of API shifts. Common fix area: Jest mocks of `@shopify/flash-list` need the same `useRecyclingState` / `useLayoutState` stubs as before (memory: `feedback_flash_list_jest_mock.md`).

Each focused fix → a separate commit. Conventional commit style.

### Phase 3 — Native rebuild + sim smoke

1. Erase the simulator's prior install of `com.ronenmars.threadbase` (it's cached at the old SDK):
   ```bash
   xcrun simctl uninstall booted com.ronenmars.threadbase
   ```
2. Build Release:
   ```bash
   npx expo run:ios --configuration Release --device 8F447B99-3E7C-4419-AEAD-EB10B7151BF0
   ```
   (See `e2e/README.md` for why Release, not Debug.) Expect 5–10 min cold.
3. Once installed: launch the app, walk the onboarding carousel manually OR run `npm run test:e2e:mock` and watch the sim.
4. Run `npm run test:e2e:mock` — must exit 0. If a flow fails, capture the screenshot from `~/.maestro/tests/<timestamp>/` and debug.
5. Also boot an iOS 17.x sim and install the same `.app`. Verify it launches without a red box. (Quick sanity that older iOS isn't broken by the New-Arch / Hermes update.)

### Phase 4 — Ship dry-run

Without actually submitting:

1. Reset Watchman before shipping (memory: ship-time race):
   ```bash
   watchman watch-del '/Users/ronenmars/Desktop/dev/ai-tools/tb-mobile'
   watchman watch-project '/Users/ronenmars/Desktop/dev/ai-tools/tb-mobile'
   ```
2. Bump `app.json` iOS `buildNumber` (commit as `chore(ios): bump build number to <N+1>` BEFORE archiving — global rule).
3. Run the archive step from `/expo-local-ship` up to but NOT including the App Store Connect upload. Verify the archive succeeds.
4. Roll back the build number bump if you want to keep TestFlight's build counter pristine until real ship — but typically just leave it and ship for real after PR is reviewed.

### Phase 5 — PR

1. Open PR against `main`:
   ```bash
   gh pr create --title "chore(expo): upgrade to SDK 56" --body "..."
   ```
2. PR body must include:
   - Before/after table of every dep version that moved
   - Output of `npx expo-doctor` (clean)
   - Output of `npm run test:ci` (clean)
   - Output of `npm run test:e2e:mock` (clean exit 0)
   - Confirmation that Release `.app` archived successfully
   - Any user-visible behavior changes you noticed (should be none)
3. Do NOT merge yet — wait for review.

---

## Things explicitly NOT in scope

- Migrating off NativeWind (stay on v4)
- Switching state management away from Zustand
- Refactoring Expo Router routes to the new SDK-56 stricter typing (only fix what breaks the build)
- Bumping any dep not driven by `expo install --fix` (third-party libs that are version-pinned independently — leave alone)
- Touching `e2e/` flows unless they break (they should not)
- Bumping iOS deployment target or Android minSdk
- Migrating to the new `react-native-screens@5` if it's optional
- Re-enabling `expo-updates` (currently `enabled: false` per app config; leave that)
- Anything mentioned in `e2e/README.md#future-work`

---

## When something blocks

- **`expo install --fix` fails to resolve:** Capture the error. Try a clean install: `rm -rf node_modules package-lock.json && npm install`. If still broken, check `npm config get registry` (some Israeli ISPs have proxy issues) and try `--registry https://registry.npmjs.org/`.
- **Pod install fails:** `cd ios && rm -rf Pods Podfile.lock && pod install --repo-update`. If still broken, check Ruby version: `ruby --version` (should be ≥ 3.0). Apple Silicon needs `arch -arm64 pod install` sometimes.
- **Metro bundle "Unable to resolve module":** Watchman/Metro cache. See `feedback_metro_unresolved_means_watchman_reset.md` in user memory. Reset both as documented above.
- **Hermes crash at runtime:** If it's an iOS-26-specific crash similar to the prior 54→55 issue, file it and decide whether to roll back or apply a workaround. Don't fight a Hermes regression for hours; SDK 55 was the answer once and could be again.
- **Native build failure:** Capture full Xcode log. Check `feedback_xcode26_swiftuicore.md` if it's an Xcode 26 linker error.
- **Maestro suite fails on first run but works second time:** Likely SecureStore-credential survival pattern from `e2e/setup.yaml` working as designed — see `e2e/README.md#carousel-state-survival`.

If something is genuinely blocked for >30 min, **stop and report**. Don't dig into Expo internals or patch node_modules. Cheaper to roll back the bump and post in the relevant Discord/GitHub Issues.

---

## When done

Report:

- Final dep version table
- `expo-doctor` output
- `npm run test:ci` output
- `npm run test:e2e:mock` output
- Branch name + PR URL
- Anything you noticed that wasn't covered in this prompt
- Anything you skipped and why

If you backed out the upgrade for any reason: report exactly why, leave the branch in place for inspection, do NOT delete commits.
