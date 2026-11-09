# Build and toolchain findings (ROADMAP Features 26, 27, 29, 30)

Checked 2026-11-02 against `main` at `500e37e3`, Expo SDK 57 / React Native 0.86.3. Tracked by [#616](https://github.com/RonenMars/threadbase-mobile/issues/616).

## Feature 26 — precompiled XCFrameworks: active

Nothing disables them, and the CI log shows them in use.

- `ios/Podfile.properties.json` sets `"EXPO_USE_PRECOMPILED_MODULES": "true"`, and `ios/Podfile` exports `ENV['EXPO_USE_PRECOMPILED_MODULES'] ||= '1'` unless that property is `"false"`.
- `ios.buildReactNativeFromSource` is unset, so `RCT_USE_RN_DEP` and `RCT_USE_PREBUILT_RNCORE` both default to `1`. If React Native were built from source, Expo would fall back to building every Expo module from source too.
- No `.github/workflows/*.yml`, `scripts/`, `eas.json` or `.env*` file sets `EXPO_USE_PRECOMPILED_MODULES=0` or `usePrecompiledModules: false`.
- The iOS job of the last green `e2e.yml` run ([41360652836](https://github.com/RonenMars/threadbase-mobile/actions/runs/41360652836), 2026-11-01) logged, during `Install CocoaPods`:
  - `[ReactNativeCore] Using React Native Core and React Native Dependencies prebuilt versions.` and `Building from source: false`.
  - `[Expo-precompiled] Precompiled modules:` listing `ExpoModulesCore`, `ExpoModulesWorklets`, `ExpoFileSystem`, `ExpoFont`, `ExpoCamera`, `ExpoCameraBarcodeScanning`, `ExpoImageManipulator`.
  - The compile step then produced `Build/Products/Release-iphonesimulator/XCFrameworkIntermediates/ExpoModulesCore/ExpoModulesCore.framework`.
- A local `bundle exec pod install` in a clean worktree extracted `ios/Pods/ExpoModulesCore/ExpoModulesCore.xcframework` before stopping on a local Swift toolchain error unrelated to the repo.
- The four path-dependent checksums described in `CLAUDE.md` are the same thing seen from the lockfile: the generated podspec embeds a `file://` tarball URL.

Not done: the "build time delta over 3 runs" acceptance criterion. It needs runs with the feature switched off (`ios.usePrecompiledModules: false`) to compare against, and no such baseline exists. For reference, that run's `Install CocoaPods` took 1m34s and `Build iOS app (Release)` 21m34s, with a partial DerivedData restore-key hit.

## Feature 27 — EAS precompiled community libs: not applicable today

- The shipping paths are local `ship-*` scripts and `deploy.yml` on `macos-26`; EAS is opt-in only (`docs/deployment.md`, Path C) and no workflow or `package.json` script calls `eas`.
- `eas.json` has a `production` profile and nothing that disables precompile, so the opt-in path would not be blocked.
- The same CI log shows the gap this feature targets: `RNReanimated`, `RNScreens`, `react-native-safe-area-context`, `RNSVG`, `RNWorklets` and `RNCAsyncStorage` each print `building from source (prebuilt tarball not found)`. Those prebuilts are not shipped in the npm packages, so they cannot be picked up on the Actions path.
- Revisit only if the iOS pipeline moves to EAS (Feature 4).

## Feature 30 — warning cleanup

The ship-121 build log is not in the repo or the tracker, so this uses the 2026-11-01 CI log above as a stand-in. It has 2366 `warning:` lines and the same classes the roadmap names.

- **A, Swift `Sendable`.** Still present, and wider than the two warnings the roadmap lists: 14 files across `expo-image-picker`, `expo-updates`, `expo-speech-recognition`, `expo-mail-composer`, `expo`, `expo-secure-store`, `expo-document-picker`, `expo-application`, `expo-clipboard`, `expo-asset` and `expo-router`. These are `must restate inherited '@unchecked Sendable' conformance` on exception classes. Newer releases do not fix it: `expo-secure-store@57.0.4` still declares `SecAccessControlError` the same way, and `expo-speech-recognition@57.1.1` has no `@preconcurrency`. Nothing to bump; the fix is upstream in Expo's `GenericException`.
- **B, Hermes "variable not declared".** Still present (`main.jsbundle` lines such as `the variable "Promise" was not declared in anonymous function`). The roadmap's default is to tolerate it; no decision was recorded.
- **C, fastlane.** Done: `Gemfile.lock` pins `fastlane (2.240.1)`, past the 2.233.1 that prompted the entry.

## Feature 29 — `@gorhom/bottom-sheet` spike: not a clean swap

The replacement is `@expo/ui/community/bottom-sheet`. `@expo/ui` is already a dependency (`~57.0.19`), so no install is needed, and its README presents it as a drop-in.

Six files import `@gorhom/bottom-sheet` (the roadmap's sheet inventory is stale: `SortSheet`, `RenameSessionSheet` and others no longer exist):

| File | Uses |
|---|---|
| `components/alerts/StatusSheet.tsx` | `BottomSheetBackdrop`, `BottomSheetScrollView`, `bottomInset`, `animateOnMount` |
| `components/servers/FilterSortSheet.tsx` | `BottomSheetBackdrop`, `enableDynamicSizing`, `maxDynamicContentSize`, `containerStyle`, nested draggable list |
| `components/servers/ServerFilterSheet.tsx` | `BottomSheetBackdrop`, `BottomSheetView` |
| `components/servers/NewSessionServerPicker.tsx` | `BottomSheetBackdrop`, `BottomSheetView` |
| `components/sessions/shared/ConversationPreviewSheet.tsx` | ref `snapToIndex`/`close`, `index={-1}` |
| `components/ui/GlassSheet.tsx` | type `BottomSheetBackgroundProps` only |

Gaps found by reading the replacement's README and `types.ts`:

- `BottomSheetBackdrop` is not exported. Four of the six files import it, and `backdropComponent` is accepted but ignored (native scrim instead).
- `backgroundComponent` is ignored, so the glass background that four sheets pass as `glassBackground` (`FilterSortSheet`, `ServerFilterSheet`, `NewSessionServerPicker`, `ConversationPreviewSheet`) would not render; `backgroundStyle` is only partly applied on iOS.
- `containerStyle` is ignored, which `FilterSortSheet` relies on for stacking above the hub chrome and FAB.
- `maxDynamicContentSize` and `bottomInset` are not in `BottomSheetProps` at all, so `FilterSortSheet` and `StatusSheet` would fail typecheck, not only behave differently.
- `enableDynamicSizing` cannot be combined with snap points, and `enablePanDownToClose` cannot separate swipe from backdrop tap on iOS (`FilterSortSheet` turns it off while reordering).
- The sheet is a native modal, not inline; behaviour inside `NestableScrollContainer` (drag-reorder) is untested.
- `jest.setup.js` mocks `@gorhom/bottom-sheet`; the mock and `ErrorRecoverySheetA11y.test.tsx` would need rewriting.
- Maestro flows hit `filter-sort-sheet` (`browse`, `feat1_tree_drill_new_session`, `promo_04_multi_machine`, `server_drag_reorder`).

Verdict: stay on gorhom for now. `StatusSheet` is the closest to a straight swap (it loses the custom backdrop and `bottomInset`), and no sheet is swappable with identical visuals. A swap would need on-device checks of the glass background, stacking and the reorder flow, which were not done here.
