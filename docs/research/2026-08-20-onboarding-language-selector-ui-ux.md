# Onboarding language selector UI/UX research

**Date:** 2026-08-20
**Status:** Decision record
**Question:** What is the smallest, accessible first-run control for choosing one of Threadbase Mobile's four supported languages?

## Decision

Show a dedicated language step with four large radio-style rows and one explicit **Continue** action.

| Stored language | Visible label |
| --- | --- |
| English | English |
| Hebrew | עברית |
| Arabic | العربية |
| Russian | Русский |

Preselect the first supported match from the device's preferred locales. `expo-localization` returns locales in the order the user defined in device settings, so the first match is a useful default rather than an assumption about the user's location. Keep every label in its native language so a person who cannot read the current interface language can still recognize their choice. The user must be able to change the preselection before continuing.

## Interaction and accessibility requirements

- Make each whole row an accessible radio option, expose its selected state, and make it operable by touch, keyboard, and assistive technology.
- Give the rows adequate touch targets and a clear selected treatment that does not rely on color alone.
- Keep visible keyboard focus on the active row and on Continue.
- Keep each language name directionally isolated and self-readable. Hebrew and Arabic labels must render RTL without changing the reading order or alignment of the surrounding LTR screen; Russian and English remain LTR.
- Add trailing spacing to Hebrew and Arabic so their right-aligned text does not crowd the radio control.
- Make Continue the only progression action. A selection changes the pending choice; Continue confirms it and advances.

## Why this shape

### Respect the device, then let the person decide

The device preference list is meaningful user input. Expo's `getLocales()` and `useLocales()` return locale entries in the order defined in device settings, and each entry exposes its language code and text direction. Use that order to preselect a supported language, then retain an explicit selector because a device language is not always the language a person wants for a particular app. W3C likewise recommends making alternatives easy to change even when language negotiation starts from user preferences.

### Four direct choices are clearer than a compact selector

W3C advises against a pull-down when only a handful of localized versions exist because direct choices are faster to recognize and access. Four rows fit comfortably without search, filtering, regions, or a new dependency. A radio group makes the mutually exclusive choice and current selection clear, while a separate Continue action makes the transition intentional.

### Native names remain the language identifier

A flag denotes a country, not a language, and a person's location does not reliably identify the language they prefer to read. W3C specifically cautions against using location services to guess a user's language and recommends language links in the language they point to. Threadbase's landing-page selector likewise exposes plain language codes without country artwork. The mobile step follows that product pattern while using full autonyms, which are clearer in the available space.

### Keep onboarding brief and actionable

This step collects one decision that changes how every later screen can be understood. It should not become an explainer, a language catalogue, or an account-setup detour. Android's onboarding guidance says to collect only the minimum needed up front and avoid overwhelming people with too many steps or inputs. Apple's onboarding guidance is the corresponding platform reference for this first-run experience. The selector therefore needs no search, regions, descriptive text, or extra dependency for four fixed choices.

## Scope boundaries

- This is a first-run choice, not a language-management screen. Changing language later belongs in Settings or a later product decision.
- This research specifies the selector's product and UI behavior, not translation resources, persistence, navigation wiring, or native per-app locale integration.
- The selection's visual treatment should use the app's established controls and colors; this document does not introduce a new component system.

## Sources checked

- Expo — [Localization](https://docs.expo.dev/versions/latest/sdk/localization/): `getLocales()`/`useLocales()` return device locales in user-defined order and expose language and text-direction data.
- W3C Internationalization — [Guiding users to translated pages](https://www.w3.org/International/questions/qa-site-conneg): use preferences as a starting point, retain visible alternatives, avoid location-based language guesses, and show target-language names in that language.
- W3C Internationalization — [Using `select` to link to localized content](https://www.w3.org/International/questions/qa-navigation-select): direct links are preferable to a pull-down for a handful of languages.
- Threadbase — [landing-page language selector](https://threadbase.sh/): presents the four supported languages as plain text without country flags.
- Apple — [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding): onboarding guidance for introducing the app experience.
- Android Developers — [Authentication & onboarding](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding): minimize required up-front information and avoid too many onboarding steps or inputs.
