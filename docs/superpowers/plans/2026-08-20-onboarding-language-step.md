# Onboarding Language Step — Final Implementation Plan

## Summary

Add a dedicated language screen as onboarding step 1 of 5:

**Language → Welcome → Connect → Notifications → Done**

The device’s first supported locale is preselected, with English as fallback. The screen appears both on first launch and when onboarding is reopened from Settings. LTR↔RTL changes persist, reload automatically, and resume at Welcome.

Implementation occurs in the isolated `.worktrees/onboarding-language-step` worktree on branch `feat/onboarding-language-step`, based on fresh `origin/main` because the prescribed integration branch is not remote.

## Task 1: Research documents

Create:

- `docs/research/2026-08-20-onboarding-language-selector-ui-ux.md`
- `docs/research/2026-08-20-onboarding-language-step-order.md`

The UI/UX research document concludes:

- Respect the device locale and preselect it rather than forcing an uninformed choice. Expo returns device locales in preference order. [Expo Localization](https://docs.expo.dev/versions/latest/sdk/localization/)
- Use four large radio-style rows, native language names—English, עברית, العربية, Русский—and one explicit Continue action.
- Keep native language names as the primary identifiers because languages do not map cleanly to countries. Match Threadbase's landing-page selector by omitting country flags while keeping the autonyms directionally isolated and accessible. [W3C language-selection guidance](https://www.w3.org/International/questions/qa-site-conneg), [W3C selector guidance](https://www.w3.org/International/questions/qa-navigation-select), [Threadbase landing page](https://threadbase.sh/)
- Provide selected state, accessible radio semantics, adequate touch targets, and visible keyboard/focus behavior.
- Do not add search, regions, explanations, or a dependency for a four-item list.
- Keep onboarding short and actionable. [Apple onboarding guidance](https://developer.apple.com/design/human-interface-guidelines/onboarding), [Android onboarding guidance](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding)

The ordering document states that “language first” is an inference from the research: the chosen language determines comprehension and direction for every later screen. It also records the alternative platform guidance—normally follow system/per-app language without another onboarding step—and explains why the required explicit step is kept lightweight and preselected. Android’s native per-app locale integration remains a separate follow-up, not part of this change. [Android per-app languages](https://developer.android.com/guide/topics/resources/app-languages)

## Implementation Changes

## Task 2: Locale foundation

- Add a shared locale module exposing:
  - `SupportedLocale = 'en' | 'he' | 'ar' | 'ru'`
  - `SUPPORTED_LOCALES` with code, translation-label key, and `ltr`/`rtl` direction
  - `resolveSupportedLocale(...)`, selecting the first supported device preference and falling back to `en`
  - `isRTLLocale(...)`
- Use that resolver in both i18n initialization and the settings-store default. This fixes the current contradiction where i18n initially detects the device locale but settings hydration resets a fresh installation to English.
- Narrow `SettingsStore.locale` and `setLocale` to `SupportedLocale`; coerce invalid persisted values to the resolved device/default locale.
- Extract the settings serialization already used by the Zustand subscriber into `persistSettingsNow()`, allowing onboarding to await locale persistence before reloading.
- Reuse `SUPPORTED_LOCALES` in Settings instead of retaining a second hardcoded four-language list.

## Task 3: Language screen and navigation

- Create `LanguageStep.tsx` plus its mandatory `LanguageStep.stories.tsx`.
- Render four fixed-order, full-width language rows using localized autonyms, selected/check state, test IDs, and accessible radio semantics. Keep Hebrew and Arabic labels clear of the radio control with explicit trailing spacing. Use only Phosphor for functional icons; do not use flags or emoji.
- Selecting a row immediately updates Zustand and `i18n`, allowing the screen copy to preview the chosen language.
- Continue or forward-swipe:
  - Persist the selected locale.
  - For same-direction changes, advance directly to Welcome.
  - For LTR↔RTL changes, write a one-shot onboarding resume marker, call `I18nManager.forceRTL`, and invoke Expo’s `reloadAppAsync()`, which works in debug and release builds. Resume at Welcome and consume the marker before rendering. [Expo reload API](https://docs.expo.dev/versions/latest/sdk/expo/#reloadappasyncreason)
  - Disable repeated selection/navigation while persistence or reload is in progress. If persistence/reload fails, clear the resume marker, remain on the language step, and show localized retry guidance.
- Increase `TOTAL_STEPS` to 5 and shift all index-dependent behavior:
  - Connect guard and Pair Later: index 2
  - Successful pairing advances to Notifications: index 3
  - Done: index 4
  - Back from Welcome returns to Language
- Update numbered onboarding copy and pager expectations.
- Open onboarding from Settings with an explicit review mode, and exempt that mode from AuthGate’s “paired users leave onboarding” redirect so an RTL reload can resume correctly.

## Task 4: Localization and completeness

- Add the language-screen, persistence-error, reload-error, and updated step-number strings to all four `onboarding.json` files in the same change.
- Localize existing user-facing onboarding literals currently hidden behind ESLint suppressions, especially Notifications, Connect tooltips, copy status, and dismiss actions. Preserve true non-translatable tokens such as `tb pair`, URL schemes, API-token prefixes, and the Threadbase brand.
- Strengthen `__tests__/i18n-completeness.test.ts` to assert:
  - The locale directory set is exactly `en`, `he`, `ar`, and `ru`.
  - Every locale has exactly the English namespace-file set—no missing or extra namespace.
  - Every English key has a locale counterpart and every locale key has an English counterpart.
  - Locale-specific CLDR plural forms remain validated without treating legitimate Arabic/Russian suffix differences as stale keys.
- Keep `i18n-unused-keys` and run a manual four-locale review of the onboarding namespace. The automated gate proves structural completeness, not linguistic quality.

## Contradictions Resolved

- Platform guidance favors automatic system locale; the mission requires a step. Resolution: first screen, device-preselected, one confirmation tap, Settings remains available.
- Apple recommends minimal optional onboarding; adding a fifth screen increases friction. Resolution: no search, region selection, tutorial, or new dependency.
- Immediate translation cannot immediately change React Native RTL direction. Resolution: reload only across direction boundaries and resume at Welcome.
- Reloading reopened onboarding would currently redirect paired users to Home. Resolution: explicit review mode survives the reload path.
- Existing TS1 documentation says Notifications is absent while current code includes it. Resolution: update the flow and documentation to drive Language and Notifications.
- Existing parity tests pass while hardcoded onboarding English remains invisible to them. Resolution: migrate the literals and retain both lint and parity checks.
- A new component without a story violates repository policy. Resolution: include the story in the same change.

## Test and Verification Plan

- Add pure unit tests for locale resolution, first-supported-device preference, English fallback, direction metadata, and invalid persisted locale coercion.
- Add component tests for four options, autonyms, selected accessibility state, row selection, disabled/retry state, and Storybook rendering.
- Add navigator tests for the five-step order, guarded Connect navigation, Pair Later, successful-pair advancement, back navigation, same-direction changes, cross-direction persistence/reload, resume-marker consumption, and reload failure.
- Extend AuthGate/settings tests for `mode=review`.
- Update `e2e/ts1_onboarding_pairing.yaml` and its documentation to drive:
  - Language → Welcome → Connect → Notifications → Done
  - Relaunch persistence and onboarding skip
- Run from pinned Node 24.15.0 with Watchman disabled where required:
  - `npm run test:i18n -- --runInBand --no-watchman`
  - Focused locale, store, onboarding, AuthGate, and settings tests
  - `npm run lint:i18n`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:ci -- --no-watchman`
  - `npm run storybook:build`
  - `npm run test:e2e:ts1` in a Release simulator build
- Manually verify English↔Hebrew and English↔Arabic reload/resume on iOS and Android, plus text expansion, RTL row alignment, VoiceOver/TalkBack labels, and reopening onboarding from Settings. Report either platform as unverified if unavailable.

## Worktree and Delivery Constraints

- Preserve the unrelated untracked `E2EE-PAIRING-UX-REVIEW-2026-08-19.md` in the main checkout.
- Do not change packages or native dependencies; CocoaPods should therefore remain untouched.
- Do not add native per-app language APIs, new locales, translation-service integration, analytics, or locale/region selection.
- Before any commit, stage only the approved worktree changes, run ESLint on staged JS/TS files, show the complete staged diff and conventional commit message, and wait for explicit approval.
