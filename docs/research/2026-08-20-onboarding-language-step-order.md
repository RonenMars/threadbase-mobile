# Onboarding language step order research

**Date:** 2026-08-20
**Status:** Decision record
**Question:** Should language selection be first in the onboarding flow, and how does that fit platform guidance?

## Decision

Place the lightweight language selector first.

This is an inference from the research, not a platform rule: the selected language determines both comprehension and text direction for every later onboarding screen. Asking for a server address, API key, permission, or account decision before the person can reliably read its labels or consequences adds avoidable friction. A preselected, four-choice step with one Continue action supplies that context before those screens appear.

## Why language first

1. **Comprehension precedes configuration.** Later onboarding actions are only actionable when their instructions, validation, and recovery paths are understood.
2. **Direction precedes layout.** Hebrew and Arabic introduce RTL content requirements. Selecting language before rendering subsequent steps gives those steps one known language and direction.
3. **The cost stays bounded.** The device-preselected default lets most people continue immediately, while visible radio rows give anyone else a direct correction. No search, region choice, or explanation screen is added.
4. **The ordering supports concise onboarding.** Android advises collecting only minimum information up front and avoiding too many steps or inputs. One small choice is justified here because it makes the rest of the required setup legible; it must remain the narrow selector described in the companion UI/UX research.

## Platform guidance and the deliberate exception

The normal platform direction is to follow the system or per-app language, rather than asking every person to choose language during onboarding.

On Android 13 and later, per-app language preferences can appear in system settings. Android provides `LocaleManager` APIs that synchronize a custom in-app language picker with system settings, and recommends enabling per-app language support so users can select an app-specific preferred language centrally. This is the preferred long-term platform integration for a multilingual native app.

That does not remove the product need for this explicit first-run step: this change requires a small set of supported in-app choices before later onboarding content is shown. The step remains consistent with platform intent because it starts from the user's ordered device preferences, keeps an immediately reversible visible choice, and does not pretend that a geographic locale alone determines reading preference.

Android native per-app locale integration is a separate follow-up. It is not implemented, configured, or implied by this change; it needs its own technical design covering Android resources, supported locale declarations, persistence/migration, and synchronization with system settings.

## Alternatives considered

### No onboarding language step

Follow the device locale only, with language changes deferred to Settings or Android system settings. This is closest to the platform default, but it cannot satisfy the required explicit choice and gives someone using a shared, unfamiliar, or deliberately different device language no first-run correction before the rest of onboarding.

### Ask after server setup or permissions

This makes the language choice later, but those earlier prompts then arrive before the person has selected the language and direction in which they can best understand them. It reverses the dependency order.

### Full locale or region picker

This adds choice and maintenance without helping the current four-language product requirement. Region is not a reliable proxy for reading language, and search or regional variants would make a short onboarding step heavier.

## Scope boundaries

- “Language first” applies to the required onboarding sequence only; it is not a claim that every app should add this step.
- This decision does not replace system-language handling or commit Threadbase Mobile to a native per-app locale implementation.
- The companion document, [onboarding language selector UI/UX research](2026-08-20-onboarding-language-selector-ui-ux.md), defines the selector itself.

## Sources checked

- Expo — [Localization](https://docs.expo.dev/versions/latest/sdk/localization/): preferred device locales are ordered by the user and expose text direction.
- W3C Internationalization — [Guiding users to translated pages](https://www.w3.org/International/questions/qa-site-conneg): user preferences are a useful default but must be paired with an easy language change; location is not a reliable language proxy.
- Android Developers — [Authentication & onboarding](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding): minimize up-front collection and avoid overwhelming users with steps or inputs.
- Android Developers — [Per-app language preferences](https://developer.android.com/guide/topics/resources/app-languages): Android 13 system settings and APIs support synchronized per-app language preferences; automatic support is recommended when applicable.
