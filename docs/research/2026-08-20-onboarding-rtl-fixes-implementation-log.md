# Onboarding RTL Fixes — Implementation Log

Date: 2026-08-20

Worktree: `/Users/ronenmars/dev/ai-tools/tb-mobile/.worktrees/onboarding-rtl-fixes`

Branch: `fix/onboarding-rtl-fixes`

## Before implementation

### Starting state

- I created this worktree at the same committed base as `feat/onboarding-language-step` and applied that worktree's complete staged snapshot with its index state preserved.
- I left the source onboarding worktree and the primary checkout unchanged, apart from the separately requested root-level task prompt.
- I stopped the previous Expo/Metro process on port `8082` and verified that the port no longer had a listener.
- The user is running separate work on port `8081`; I will not stop, reuse, or inspect that process.
- No commit, package change, or native dependency change is authorized.

### Screenshot observations

- Step 1 uses global RTL layout, but its headings are still physically left-aligned and its four autonym rows follow the global direction instead of each language's own direction.
- Hebrew forward CTA arrows point right; they should point left.
- Step 2 keeps Back at the top-left with a left arrow. In Hebrew it belongs at the top-right with a right arrow.
- Step 2 Hebrew hero copy reads like a direct translation, mentions only Claude Code, and uses masculine-singular `בוא נתחיל`.
- Step 3 has the same Back-placement problem, while `Pair later` occupies the top-right; in RTL those controls should swap physical sides.
- Step 4 repeats the Back/forward-arrow issues and contains Hebrew instructions that can be made more natural without changing the pairing procedure.

### Assumptions and decisions before coding

- Screen chrome follows the active locale: Hebrew and Arabic use RTL placement; English and Russian retain LTR placement.
- Language autonyms remain directionally independent: English/Russian align left and Hebrew/Arabic align right in every global layout direction.
- I will retain Latin digits in breadcrumbs because localized numerals were explicitly left out of this task.
- I will preserve technical tokens and brands such as Threadbase, `tb pair`, QR, Claude Code, and Codex.
- I will prefer natural, concise Hebrew product copy over literal translation, but will not redesign the onboarding flow.
- I will use existing Phosphor arrow components and change direction/placement through locale-aware props and styles rather than adding assets.

### Verifiable plan

1. Inspect the four onboarding steps, shared navigation components, Hebrew strings, and existing focused tests.
2. Add focused regression tests for per-autonym alignment, RTL heading alignment, RTL/LTR arrow direction, Back/Pair Later placement, and revised Hebrew copy.
3. Run those tests under Node 24.15.0 and record the expected RED failures.
4. Apply the smallest component and locale changes that make the tests pass.
5. Run focused tests, i18n completeness, changed-file ESLint, typecheck, and diff checks; append exact outcomes here.
6. If native verification is useful, use only the `Threadbase-Clean` simulator and Metro port `8082`.

## During implementation

### Baseline and implementation research

- I linked this worktree's ignored `node_modules` entry to the primary checkout's existing dependency tree; no package manifest or lockfile changed.
- Baseline command: `npx jest --runInBand --no-watchman --runTestsByPath` for LanguageStep, OnboardingNavigator, and ConnectStepManual under Node 24.15.0.
- Baseline result: 3 suites passed, 24 tests passed, 0 failures.
- The official React Native layout documentation states that `direction` controls UI flow and is inherited by descendants. This supports assigning each autonym row its own direction and using a plain `row`, instead of trying to counter global RTL with mirrored physical alignment values.
- I confirmed the shell currently calls `flexRow()` even though its children already participate in RTL layout. In a native RTL process this becomes `row-reverse`, placing the first Back child on the physical left. The minimal fix is an explicit locale direction plus `flexDirection: 'row'`.
- I will replace the touched custom SVG arrows with Phosphor `ArrowLeft`/`ArrowRight` components, matching repository icon policy and making direction observable in component tests.

### Hebrew copy decision

- Welcome eyebrow: `// הקוד איתכם`
- Welcome title: `הקוד ממשיך לרוץ.`
- Welcome accent: `גם כשאתם בדרך.`
- Welcome body: `שליטה מרחוק ב־Claude Code וב־Codex, ישירות מהטלפון.`
- Welcome CTA: `בואו נתחיל`
- The wording keeps the short two-line rhythm, removes the literal thread/weaving metaphor in Hebrew, uses familiar product language, names both supported coding agents, and makes the CTA plural rather than masculine singular.
- For connection screens I will use `חיבור` instead of the less conversational `זיווג`, prefer plural imperatives (`בחרו`, `חברו`, `סרקו`, `פתחו`), and keep the technical commands/tokens unchanged.

### RED test design

- A LanguageStep regression will require explicit direction on each radio row, automatic per-row text alignment, and a full-width locale-directed heading block. Removing or reversing any of those styles should fail the test.
- A PrimaryButton regression will require a right arrow in LTR and a left arrow in RTL.
- An OnboardingShell regression will require locale-directed chrome, Back as the first/start control, Pair Later as the second/end control, and a right-pointing Back arrow in RTL.
- Welcome/Connect rendering regressions will assert the approved Hebrew copy and right-directed connection headings/instructions.

### RED evidence

- I extended the test i18n fixture with the existing Hebrew, Arabic, and Russian onboarding resources so rendered locale tests exercise real translated components instead of English fallback. This is test infrastructure only.
- RED command: focused Jest run for LanguageStep, PrimaryButton, OnboardingShell, WelcomeStep, and ConnectStepManual under Node 24.15.0 with Watchman disabled.
- RED result: 5 suites failed as expected; 13 tests failed and 10 existing tests remained green.
- LanguageStep failed because row styles lacked explicit `direction`, labels still used mirrored physical `left`/`right` alignment instead of `auto`, and headings lacked explicit direction/full width.
- PrimaryButton failed because it still rendered one custom right-arrow SVG with no locale-aware left-arrow branch.
- OnboardingShell failed because it lacked explicit locale-directed chrome/testable Phosphor arrows and still used the existing mirrored-row helper.
- WelcomeStep failed on every newly approved Hebrew phrase, including the plural CTA and Codex mention.
- ConnectStep failed on the old Hebrew copy, missing root direction, old link placement, and missing RTL Back arrow.
- These failures are caused by the requested behavior being absent, not by syntax, module, or environment errors.

### Simulator-discovered heading regression

- I started the existing development client against Metro `8082` and opened review onboarding only on `Threadbase-Clean` (`5D60E5D4-AB5E-4FA4-AA48-E3B4AEE1F496`). Port `8081` and the physical iPhone were not touched.
- The first screenshot showed the language rows fixed physically: English/Russian occupy their own LTR flow and Hebrew/Arabic occupy their own RTL flow.
- The screenshot also showed Hebrew eyebrow/title/body still aligned left. The raw `textAlign: 'right'` value was being swapped by native RTL, despite the explicit direction and width.
- Decision: use `textAlign: 'auto'` with the explicit `direction` and `writingDirection`, the same combination already proven visually on the autonym rows. This delegates physical alignment to each text block's own direction and avoids manual inversion.

### Implementation applied

- `LanguageStep` now assigns each radio row its own `ltr` or `rtl` direction. Its label uses automatic alignment, so English and Russian remain physically left-aligned while Hebrew and Arabic remain physically right-aligned regardless of the active app direction.
- The Language headings now use the active locale direction, `writingDirection`, automatic alignment, and full width. This is the combination that passed both component tests and the native RTL screenshot check.
- `PrimaryButton` now renders a Phosphor `ArrowRight` in LTR and `ArrowLeft` in RTL. The touched onboarding arrow no longer uses a custom SVG.
- `OnboardingShell` now follows the active locale direction without applying the previous mirrored-row helper. Back is the logical-start control, Pair Later is the logical-end control, and the Back arrow points right in RTL.
- `ConnectStep` now gives the connection and QR text blocks explicit locale direction and writing direction. The Back-to-options link uses a Phosphor direction-aware arrow at the logical start.
- The Hebrew Welcome copy is now `הקוד ממשיך לרוץ.` / `גם כשאתם בדרך.` with the body `שליטה מרחוק ב־Claude Code וב־Codex, ישירות מהטלפון.` and the plural CTA `בואו נתחיל`.
- The Hebrew connection and QR copy now uses concise plural imperatives such as `חברו`, `בחרו`, `סרקו`, and `פתחו`; technical commands and product names remain unchanged.
- The English, Arabic, and Russian Welcome bodies now mention Codex alongside Claude Code. No unrelated onboarding flow or styling was changed.

### GREEN and regression evidence

- First focused GREEN command: the five new/extended LanguageStep, PrimaryButton, OnboardingShell, WelcomeStep, and ConnectStepManual suites.
- First focused GREEN result: 5 suites passed, 23 tests passed.
- A broader onboarding run initially exposed one stale test assumption: after the test fixture gained real Hebrew resources, the reload-error assertion still expected English fallback. I updated only that expectation to the actual Hebrew rendering.
- Broader result after that correction: 10 suites passed, 70 tests passed.
- After the simulator exposed the heading-alignment regression, the new `textAlign: 'auto'` assertion first failed in four heading cases and then passed after the production fix; the LanguageStep suite finished with 10 tests passed.
- Final onboarding-focused command covered the end-to-end onboarding flow, ConnectStepManual, OnboardingShell, PrimaryButton, WelcomeStep, OnboardingNavigator, and LanguageStep.
- Final onboarding-focused result: 7 suites passed, 47 tests passed.
- Final localization result: 3 suites passed, 123 tests passed, 1 test skipped.
- `npm run lint:i18n`: passed with zero warnings or errors.
- ESLint on every JS/TS file changed for this RTL task: passed with zero warnings or errors.
- `npm run typecheck`: passed.
- All four `onboarding.json` files parsed successfully.
- Both the staged baseline and the unstaged RTL diff passed `git diff --check`.
- `package.json`, `package-lock.json`, `ios/Podfile.lock`, and the Xcode project remain unchanged.

### Native simulator evidence

- Metro remains on `8082` in this derived worktree. The user's `8081` process was not stopped, reused, or inspected.
- `xcrun simctl list devices booted` reported only `Threadbase-Clean` (`5D60E5D4-AB5E-4FA4-AA48-E3B4AEE1F496`) as booted; no physical device was targeted.
- The final Step 1 screenshot shows the Hebrew breadcrumb, title, and subtitle physically aligned to the right. English is physically left-aligned and Hebrew physically right-aligned in their respective rows, with selection controls on the opposite side.
- Expo's first-run development-client tutorial remains over the lower half of the simulator. It prevents honest visual confirmation of the Step 1 CTA and navigation through Steps 2–4 in this pass.
- Steps 2–4 direction, placement, arrows, and copy are therefore covered by focused component/navigation tests, but remain pending a manual native traversal after the tutorial is dismissed.

### Final self-review correction

- While reviewing the final diff against the native Step 1 finding, I noticed that Step 3/4 text still used raw `textAlign: 'right'`. Native RTL can mirror that value to the physical left just as it did on Step 1.
- I first changed the ConnectStep regression to require `textAlign: 'auto'`; the focused suite failed in the Hebrew connection-copy case with the production value still reported as `right`.
- I then changed the shared LTR/RTL ConnectStep text styles to combine explicit `direction` and `writingDirection` with automatic alignment.
- The focused ConnectStepManual suite returned GREEN with 8 tests passed. This keeps the native-alignment fix consistent across Language, connection-method, and QR screens.

## After implementation

- The requested RTL alignment, arrow direction, navigation placement, and Hebrew copy changes are implemented in the isolated derived worktree.
- Automated focused, localization, lint, type, JSON, and diff checks are green.
- Step 1 header and row direction are visually confirmed on the intended simulator; the remaining native traversal limitation is explicitly recorded above.
- No files were committed, pushed, or newly staged. The copied onboarding-language baseline retains its original staged state, while every RTL-task change remains unstaged or untracked for review.

## Follow-up: RTL directional motion

### Before implementation

- The follow-up asks for directional screen-transition motion to follow the reading direction in Hebrew and Arabic while leaving interactive gestures such as back-swipe unchanged.
- I interpret forward navigation as entering from the physical right in LTR and from the physical left in RTL; backward button navigation is the inverse.
- The onboarding shell currently chooses `SlideInRight` for every forward step and `SlideInLeft` for every backward step, regardless of locale.
- The app has two native stacks: the root stack and the nested session stack. Their default iOS transition follows native semantic direction, while the installed Android default is a direction-neutral fade/scale. For RTL card navigation, an explicit `slide_from_left` is needed to make the spatial model visible and consistent.
- Fade animations, vertical modal slides, pulsing indicators, and the bidirectional indexing beam are direction-neutral and do not need mirroring.
- Modal presentation should retain its platform-default vertical motion. Gesture settings will not be changed.

### Verifiable plan

1. Add rendered-component regressions for LTR and RTL onboarding forward/back entry motion.
2. Add root- and nested-stack regressions requiring `slide_from_left` only in RTL, preserving the LTR default and the root modal default.
3. Observe the RTL expectations fail against the current implementation.
4. Apply the smallest locale-aware animation selection in the onboarding shell and both native stacks.
5. Run focused tests, changed-file ESLint, typecheck, diff checks, and append exact evidence here.

### Motion RED, implementation, and GREEN evidence

- RED covered the rendered onboarding entry builder, root native stack, and nested session stack. RTL forward onboarding motion still used `SlideInRight`, and neither stack selected an RTL-specific card animation.
- `OnboardingShell` now enters forward steps from the physical left in RTL and backward button navigation from the physical right; LTR behavior is unchanged.
- The root and session stacks now select `slide_from_left` only in RTL. Root browse-modal motion stays on the platform `default`, and no gesture direction or gesture-matching option was added.
- Focused motion result: 3 suites passed, 11 tests passed. The broader onboarding/motion result passed 11 suites and 63 tests before the later home-localization work.
- Changed-file ESLint, typecheck, and both staged/unstaged diff checks were clean after the motion slice.

## Follow-up: home localization and RTL filter headings

### Before implementation

- The Hebrew home screenshot exposes two distinct gaps: the connection-state banner is assembled from English template literals, and `FilterSortSheet` stores its layout, sort, order, status, and `All` labels in English option arrays.
- The locale-completeness test is behaving as designed: it compares namespace files and key shapes across locales. It cannot detect a user-facing literal that never goes through `t(...)`. The current ESLint rule also checks rendered JSX/selected attributes, not strings hidden in option objects or message-building branches.
- The empty-session subtitle names only Claude Code in all four locales even though both Claude Code and Codex sessions are supported. Provider-specific diagnostics such as `providerClaude: "Claude Code CLI"` are intentionally Claude-only and must remain unchanged because Codex has its own adjacent key.
- The filter headings in the screenshot have translated text but only intrinsic width, so `sortBy`, `order`, and `provider` remain physically left in RTL. The minimal layout correction is a full-width standalone heading with explicit locale direction, `writingDirection`, and `textAlign: 'auto'`; section headings that share a row with quick actions must retain their existing row layout.
- I will test the rendered Hebrew UI, not only JSON values: the filter should expose translated chips and RTL-aligned standalone headings, the connection banner should render Hebrew rather than its English fallback, and the empty-state copy should name both supported providers.
- The visible live home scope is `app/index.tsx` plus the components it directly renders. Unused legacy sheets will be reported separately instead of being modified speculatively.

### Verifiable plan

1. Add focused rendered regressions for the filter labels/alignment, connection-state banner, and empty-session provider copy.
2. Observe those assertions fail against the current literal strings.
3. Add the smallest shared locale keys to all four locales and route only the live home components through them.
4. Audit remaining home-reachable literals and distinguish user-facing misses from proper names, technical tokens, and unused legacy components.
5. Re-run focused tests, i18n completeness/unused-key checks, i18n lint, changed-file ESLint, typecheck, JSON parsing, and staged/unstaged diff checks.

### RED evidence

- I added rendered Hebrew regressions for `FilterSortSheet`, `ServerStateMessage`, and the classic empty-session state, and extended the test i18n fixture to load the real sessions/settings/servers namespaces for the supported non-English locales.
- RED command: focused Jest run for those three files under Node 24.15.0 with Watchman disabled.
- RED result: 3 suites failed, 4 tests failed, with no setup or syntax failures.
- The filter test rendered Hebrew headings around English `Tree`/`Hub`/`Classic`, sort, order, status, and provider-all labels; its direction assertion also showed that standalone headings lacked width/direction/writing-direction/alignment styles.
- The connection banner rendered the exact English screenshot text instead of the expected Hebrew message.
- The empty-state test rendered the old Hebrew Claude-Code-only subtitle instead of copy naming both Claude Code and Codex.

### Additional live-home audit

- The server-status modal also contained an English singular/plural title, five status labels, and a server-menu accessibility label. A rendered Hebrew regression failed on those exact values before the fix.
- Unmerged Hub cards contained raw `SESSIONS` and `CONVERSATIONS` headings. A rendered Hebrew regression first failed with both raw headings still present.
- Tree drill section headings used raw `Sessions` and `History`; these now reuse the existing sessions namespace keys.
- A final self-review found the Hub activity summary still assembled `N live`, `N today`, and `last <time>` in English. Its new Hebrew assertion failed on the rendered `1 live · last Jul 13 13:01`, then passed after the summary and date formatter received locale keys and the selected app locale.
- The root header's server-status and search accessibility labels and the no-server repository accessibility label were also literal English. They now use locale keys.
- `ServerFilterSheet`, `SortSheet`, and `TimeBucketPills` still contain literal option arrays, but no app/component imports reference them. I left these unused legacy components unchanged instead of mixing dead-code work into a live-home fix.
- Provider-specific health copy such as `providerClaude: "Claude Code CLI"` remains intentionally unchanged beside `providerCodex: "Codex CLI"`; it identifies one provider and should not claim to represent both.

### Implementation applied

- `FilterSortSheet` now reuses the existing settings translations for Tree/Hub/Classic and new servers keys for sort, order, and status choices. Provider `All` uses the existing translated key; Claude and Codex remain proper provider names.
- The sort-order glyphs were replaced with Phosphor `ArrowDown` and `ArrowUp` icons while touching that row.
- Standalone View/Sort by/Order/Provider headings now fill the row and combine the active locale's `direction` and `writingDirection` with `textAlign: 'auto'`. LTR stays physically left and RTL becomes physically right; section headings that share a row with quick controls were not widened.
- Every `ServerStateMessage` branch now uses the servers namespace, including indexing, unreachable, refresh failure, disconnected, connecting, and partial-degradation variants.
- The sessions empty-state subtitle names Claude Code and Codex in English, Hebrew, Arabic, and Russian. The Hebrew imperative is plural (`התחילו`).
- The server-status modal, Hub/Tree section labels, home-header accessibility labels, and no-server repository accessibility label now use locale resources in all four languages.
- Hub activity summaries now translate their live/today/last labels and pass the selected app language plus translated now/yesterday labels into `formatListTime`, so a Hebrew app choice no longer inherits an English date label from an English device locale.

### Common RTL practice decision

- Expo's localization guide says RTL layout follows React Native's `I18nManager`, and React Native documents inherited `direction` plus logical `start`/`end`, `marginStart`/`marginEnd`, and `paddingStart`/`paddingEnd` behavior.
- This repository already has the standard pieces: `expo-localization`, React Native/Yoga layout, `I18nManager`, and `react-i18next`. `react-i18next` translates strings but does not mirror layout.
- No additional RTL npm package is needed for this change. The implementation uses native direction inheritance and logical edges, with explicit locale-aware alignment/animation only where native inference is insufficient.

### Final GREEN evidence

- Home localization focused result: 5 suites passed, 7 tests passed, without the earlier overlapping-`act` warning after awaiting async RNTL cleanup.
- Localization result: 3 suites passed, 123 tests passed, 1 intentionally skipped.
- Full CI result: 202 suites passed; 1,983 tests passed and 1 test was skipped. The suite still printed pre-existing React `act`/timer teardown warnings and force-exited one worker, but reported no failures.
- `npm run lint:i18n`: passed with zero warnings or errors.
- ESLint on all files changed for the home-localization slice: passed with zero warnings or errors.
- `npm run typecheck`: passed.
- All modified sessions/servers locale JSON files parsed successfully, i18n unused-key validation passed, and staged/unstaged diffs passed `git diff --check`.
- `package.json`, `package-lock.json`, `ios/Podfile.lock`, and the Xcode project remain unchanged.

### Native home verification

- Metro is still listening on `8082`; the user's `8081` process was not inspected or touched.
- `xcrun simctl list devices booted` showed only `Threadbase-Clean` (`5D60E5D4-AB5E-4FA4-AA48-E3B4AEE1F496`) booted, and the screenshot targeted that UDID explicitly.
- The live Hebrew home screenshot now shows the unreachable-server banner in Hebrew and the empty-session subtitle naming both Claude Code and Codex.
- The bottom sheet was closed during the final native screenshot. Its Hebrew labels and RTL/LTR heading alignment are covered by the rendered component regression; no Maestro flow or physical device was used.
