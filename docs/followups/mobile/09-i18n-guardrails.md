# 09 — i18n guard-rails

Status: proposed, nothing implemented.
Scanned against `main` @ `00069a03` on 2026-08-21.

## Why this exists

`eslint.config.js` configures `i18next/no-literal-string` with **v5 option names** against the **v6.1.5** plugin that is installed.
The v6 schema has no `additionalProperties: false`, so `markupOnly`, `attributes`, `ignoreAttribute`, `ignoreCallee` and `ignoredFiles` are accepted and then ignored.
Sixty-five lines of configuration do nothing, and nothing reports that they do nothing.

The observable effect is that the rule sees raw JSX text and nothing else.
Every one of these passes a clean lint today:

```tsx
Alert.alert('Discard changes?', 'Your unsaved changes will be lost.')  // callee arg
{ text: 'Keep Editing' }                                              // object property
<TouchableOpacity accessibilityLabel="Close the dialog">              // jsx attribute
<TextInput placeholder="Type your message" />                         // jsx attribute
const label = 'Send input now'                                        // variable
```

The last line matters twice over.
`CLAUDE.md` → "No Inline Conditional Text in JSX" instructs contributors to lift multi-branch strings out of JSX into a named `const`, which is exactly the shape the rule cannot see.
The style guide and the lint rule currently point in opposite directions.

A second gap sits beside it: `__tests__/i18n-completeness.test.ts` checks that every locale has every **key**.
It cannot check that a value was ever **translated**, which is why 25 keys carry verbatim English in `he`, `ar` and `ru`.

## Scope

219 items in five classes.

| Class | What | Count | Caught by Layer 1? |
|---|---|---:|---|
| 1 | String literals in code | 138 | yes |
| 2 | Locale values that are still English | 75 | no — Layer 5 |
| 3 | iOS permission prompts | 5 | no — Layer 7 |
| 4 | Surfaces outside i18n entirely | 9 | partly |
| 5 | RTL-unsafe physical styles | 16 | no — Layer 6 |

Counts are from a tuned probe config; see "Reproducing" below.
An untuned config reports 195 for Class 1, of which ~36% are false positives (i18n key strings such as `'hostPressure.banner.memoryCritical'`, style suffixes in `lib/rtl.ts`, internal `Error` names in `services/sanitize.ts`).
Tuning is not optional — a rule that cries wolf at that rate gets disabled rather than obeyed.

## Design — seven layers

### Layer 1 — fix the ESLint config

Replace the inert v5 block with v6 keys:

```js
"i18next/no-literal-string": ["error", {
  mode: "all",
  "jsx-attributes": { include: ["accessibilityLabel","accessibilityHint","placeholder","title","label","subtitle","description","message","cta","buttonText","confirmText","cancelText","emptyText"] },
  callees:             { include: ["Alert.alert","Alert.prompt","toast","showToast","notify"] },
  "object-properties": { include: ["text","title","message","label","body","subtitle","description","hint","placeholder","cta","buttonText"] },
  words: { exclude: [
    "^[^a-zA-Z]*$",                                   // punctuation, glyphs, numbers
    "^[a-z0-9_:/@-]+$",                               // single lowercase token
    "^[A-Z0-9_]+$",                                   // SCREAMING_CASE
    "^[a-z][A-Za-z0-9]*(\\.[A-Za-z][A-Za-z0-9]*)+$",  // i18n key paths
    "^#[0-9a-fA-F]{3,8}$"                             // hex colours
  ] },
}]
```

`ignoredFiles` was inert but harmless: the flat-config block at `eslint.config.js:111-119` already disables the rule for tests and works correctly.
Non-UI modules (`lib/openTrace.ts`, `services/diagnostics.ts`) get the same flat-config treatment rather than a dead option key.

Land this at `warn` first so it carries no behaviour change, then flip to `error` once Class 1 is handled.

### Layer 2 — burn down Class 1

138 findings across 33 files. See the inventory below.

### Layer 3 — pre-commit hook

`scripts/git-hooks/pre-commit` currently runs only `check-story-coverage.js`.
Add an i18n check in the same shape: run ESLint's i18n rule over staged `.ts`/`.tsx` and block on error.
Local and fast; `--no-verify` bypasses it, which is acceptable because Layer 4 cannot be bypassed.

### Layer 4 — CI

ESLint already runs in the `Lint` job, which is a required check, so Layer 1 is enforced in CI the moment the rule is `error`.
Add the Layer 5 and Layer 7 checks to `npm run test:i18n` so every locale gate sits behind the one required `i18n` job in `.github/workflows/test.yml:186`.

### Layer 5 — locale value freshness

Two checks sharing one walker. Neither can be expressed as key parity.

1. **Source-hash freshness.** `locales/.source-hashes.json` records a hash of each `en` value at the time translations were last confirmed. If an `en` value changes and a locale is not re-confirmed, the check fails. `npm run i18n:bless` updates the file. This catches a term rename applied to some locales and not others — the `fingerprint` → `identity code` case below.
2. **Identical-to-`en` detector.** Fails when a non-`en` value equals its `en` counterpart and reads as prose (three or more alphabetic words). Needs an allowlist for legitimate cases: `servers.json:health.checks.providerClaude`, `servers.json:health.checks.providerCodex`, `feedback.json:form.emailPlaceholder`, `onboarding.json:notifications.previewBrand`.

Source-hash alone is not sufficient: for a key that was never translated, the recorded hash matches `en` correctly from day one and the check stays green forever. That is the entire `settings.backup.*` class.

### Layer 6 — RTL physical properties

A lint rule banning `marginLeft`/`marginRight`/`paddingLeft`/`paddingRight`/`borderLeftWidth`/`borderRightWidth` and `textAlign: 'left' | 'right'` in style objects, in favour of `marginStart`/`marginEnd`/`paddingStart`/`paddingEnd` and `textAlign: 'auto'`.
`no-restricted-syntax` covers this without a new plugin.

### Layer 7 — native permission strings

A script asserting every `*UsageDescription` and `*Permission` value in `app.json` has a matching key in `ios/<target>/<lang>.lproj/InfoPlist.strings` for each supported locale.
Nothing else in the toolchain can see these strings.

### Layer 8 — documentation

Two amendments, both correcting active harm:

- `CLAUDE.md` → "No Inline Conditional Text in JSX": state that the extracted `const` must hold `t()` calls, not literals. As written the rule steers contributors into the blind spot this document exists to close.
- `CLAUDE.md` → "Lint Before Commit": name the i18n rule alongside the existing `npx eslint <staged-files>` instruction.

Mirror both in `AGENTS.md`.

## Sequencing

Classes 2–5 are 105 mechanical, self-contained items — fix them outright, no baseline, roughly three PRs.
Class 1 is 138 items across 33 files touching nearly every screen; a baseline lets Layer 1 flip to `error` immediately and blocks new violations while the existing ones burn down.

1. Layer 1 at `warn`, plus exclusions. No strings touched.
2. Classes 3, 4, 5 (30 items). Native strings, widget, physical styles.
3. Class 2 (75 values). Translate `settings.backup.*` and `notificationHealth.*`.
4. Layer 5 + Layer 7 checks, wired into `test:i18n`.
5. Class 1 burn-down, in whatever order suits; baseline shrinks each PR.
6. Layer 1 to `error`; Layers 3, 6, 8.

## Verified state

Every item below was produced by the probe described in "Reproducing", run on `main` @ `00069a03`, 2026-08-21.

### Known leftovers not caught by any current gate

- `locales/ru/pair.json:44` — `confirm.fingerprintLabel` is `"Отпечаток (хеш)"`; `en` says `"Identity code"`. The rename in #804 covered `en`/`he`/`ar` and missed `ru`.
- `locales/ru/pair.json:59` — `confirm.noSpkBody` still says `"нет отпечатка (хеша)"`.
- `locales/{en,he,ar,ru}/servers.json:23` — `form.hint` still says `tb pair`; #804 renamed the command to `tb-streamer pair` everywhere else.
- `__tests__/e2e/onboarding-flow.test.tsx:75` — `expect(getByText(/tb pair/))` is green for the wrong reason. The suite mocks `useLocalSearchParams: () => ({ mode: 'add' })`, so it renders `AddServerScreen` and matches `servers:form.hint` above, not the onboarding pairing copy. Completing that rename breaks this test in a file that looks unrelated.
- `onboarding:tooltip.dismiss` is translated into all four languages and used by `components/onboarding/components/InfoTooltip.tsx:39`, while `components/onboarding/components/TokenTooltip.tsx:30`, `components/tour/FirstShowBanner.tsx:35` and `components/tour/TourOverlay.tsx:95` each hardcode the same word behind an `eslint-disable`.

### Out of scope, noted in passing

`CLAUDE.md` forbids emoji in the UI and requires Phosphor icons. These predate this work and are not part of it:
`app/session/[id].tsx:318` (⚠️), `app/session/new.tsx:104` (🤖), `components/conversation/MessageBubble.tsx:339` (🔧), `components/conversation/ToolCard.tsx:13-19` (an emoji map).

## Class 1 — string literals in code (138)

### expression literal — 57

- `app/browse.tsx:339` — `isRecentsOpen ? 'Hide recent directories' : 'Show recent directories'`
- `app/browse.tsx:417` — `error instanceof Error && error.message ? error.message : 'Unknown error'`
- `app/conversation/[id].tsx:678` — `isFavorite ? 'Remove from favorites' : 'Add to favorites'`
- `app/session/[id].tsx:838` — `isSessionFavorite ? 'Remove from favorites' : 'Add to favorites'`
- `app/session/[id].tsx:946` — `session.provider === 'codex-cli' ? 'Codex' : 'Claude'`
- `components/SlowQueryBanner.tsx:23` — `{'Fetching sessions is taking longer than expected.\nHold still…'}`
- `components/conversation/LiveConversationView.tsx:295` — `sendInput.error instanceof Error       ? sendInput.error.message       : 'Failed to send'`
- `components/conversation/ThinkingCard.tsx:32` — `expanded ? 'Collapse reasoning' : 'Expand reasoning'`
- `components/servers/AddServerScreen.tsx:338` — `showApiKey ? 'Hide' : 'Show'`
- `components/servers/ServerEditModal.tsx:199` — `isEditMode ? 'Edit Server' : 'Add Server'`
- `components/servers/ServerErrorModal.tsx:46` — `server.label || 'Server'`
- `components/servers/ServerListCard.tsx:81` — `server.label || 'Server'`
- `components/servers/ServersStatusModal.tsx:126` — `statusLabel = 'Unreachable'`
- `components/servers/ServersStatusModal.tsx:127` — `statusLabel = 'Fetch failed'`
- `components/servers/ServersStatusModal.tsx:128` — `statusLabel = 'Connected'`
- `components/servers/ServersStatusModal.tsx:129` — `statusLabel = 'Connecting…'`
- `components/servers/ServersStatusModal.tsx:130` — `statusLabel = 'Disconnected'`
- `components/servers/ServersStatusModal.tsx:293` — `activeServerIds.length === 1 ? 'Server Status' : 'Servers Status'`
- `components/sessions/NameSessionModal.tsx:36` — `mode === 'create' ? 'Name this session?' : 'Name this session before you go?'`
- `components/sessions/NameSessionModal.tsx:37` — `mode === 'create' ? 'Start' : 'Save'`
- `components/sessions/NameSessionModal.tsx:38` — `cancelLabel = 'Cancel'`
- `components/sessions/hub/types.ts:28` — `import('./useProjectGroups').ProjectGroup`
- `components/sessions/shared/ConversationListItem.tsx:318` — `provider === 'codex-cli' ? 'Codex' : 'Claude'`
- `components/sessions/tree/treeUtils.ts:17` — `['(unknown)']`
- `components/terminal/TerminalView.tsx:134` — `sendInput.error instanceof Error       ? sendInput.error.message       : 'Failed to send'`
- `hooks/useConversations.ts:275` — `match?.name ?? 'Tool'`
- `hooks/useConversations.ts:408` — `first.meta.session_name?.trim() || first.meta.project_name || 'Conversation'`
- `hooks/useSession.ts:28` — `s === 'lastActivity' ? 'lastActivityAt' : s`
- `hooks/useSession.ts:125` — `args.sort?.sortBy ?? 'lastActivity'`
- `lib/conversationHref.ts:27` — `href += '&openSearch=1'`
- `lib/openTrace.ts:197` — `['  none over 250 ms']`
- `lib/openTrace.ts:205` — `['  none recorded']`
- `lib/reviewFromConversation.ts:206` — `[     'Mobile review note (conversation-derived, may be incomplete vs git status):',     `Files: ${summary.fil`
- `lib/rtl.ts:29` — `isRTL ? 'Right' : 'Left'`
- `lib/rtl.ts:36` — `isRTL ? 'Left' : 'Right'`
- `services/diagnostics.ts:231` — `['Threadbase diagnostics', '']`
- `services/live-activity.android.ts:55` — `state.status === 'waiting_input' ? 'Finished' : 'Running'`
- `services/pair-exchange.ts:282` — `err instanceof Error ? err.message : 'Could not start the encrypted pairing'`
- `services/pair-exchange.ts:337` — `err instanceof Error ? err.message : 'Network error'`
- `services/sanitize.ts:380` — `typeof rec.name === 'string' ? truncateString(rec.name) : 'Error'`
- `services/sentry.ts:418` — `BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'`
- `services/ws-client.ts:134` — `url.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws?key='`
- `types/backup.ts:188` — `typeof body.error === 'string' ? body.error : 'Restore has unresolved conflicts'`

### a11y label/hint — 22

- `app/conversation/[id].tsx:705` — `accessibilityLabel="Conversation info"`
- `app/index.tsx:419` — `accessibilityLabel="Server status"`
- `app/index.tsx:431` — `accessibilityLabel="Search"`
- `app/session/[id].tsx:845` — `accessibilityLabel="More options"`
- `app/session/[id].tsx:879` — `accessibilityLabel="Rename session"`
- `components/conversation/ChatComposer.tsx:137` — `accessibilityLabel="Attach file"`
- `components/conversation/ChatComposer.tsx:206` — `accessibilityLabel="Expand input"`
- `components/conversation/ChatComposer.tsx:232` — `accessibilityLabel="Expand input"`
- `components/conversation/ChatComposer.tsx:277` — `accessibilityLabel="Minimize input"`
- `components/queue/PromptQueueSheet.tsx:116` — `accessibilityLabel="Add prompt to queue"`
- `components/servers/AddServerScreen.tsx:251` — `accessibilityLabel="Scan pairing QR"`
- `components/servers/NoServersWelcome.tsx:32` — `accessibilityLabel="tb-streamer repository"`
- `components/servers/NoServersWelcome.tsx:41` — `accessibilityLabel="Add Server"`
- `components/servers/ServerListCard.tsx:89` — `accessibilityLabel="View connection error"`
- `components/servers/ServerListCard.tsx:98` — `accessibilityLabel="Delete server"`
- `components/servers/ServerListCard.tsx:106` — `accessibilityLabel="Edit server"`
- `components/servers/ServerListCard.tsx:114` — `accessibilityLabel="Refresh server info"`
- `components/servers/ServersStatusModal.tsx:172` — `accessibilityLabel="Server options"`
- `components/shared/InfoModal.tsx:67` — `accessibilityLabel="Close"`
- `components/shared/SlashCommandArgModal.tsx:79` — `accessibilityLabel="Cancel"`
- `components/shared/SlashCommandArgModal.tsx:107` — `accessibilityLabel="Cancel"`
- `components/ui/AvatarMenu.tsx:15` — `accessibilityLabel="Settings"`

### JSX text prop — 17

- `app/browse.tsx:407` — `title="Browsing not configured"`
- `app/browse.tsx:408` — `subtitle="Set browseRoot on your server to enable file browsing."`
- `app/browse.tsx:416` — `title="Unable to load directories"`
- `app/browse.tsx:420` — `subtitle="No files or folders here."`
- `app/browse.tsx:420` — `title="Empty directory"`
- `app/conversation/[id].tsx:920` — `title="Conversation Info"`
- `app/session/[id].tsx:741` — `title="Session Info"`
- `app/settings.tsx:656` — `label="Merge sessions & history as Chats"`
- `app/settings.tsx:887` — `label="Require Face ID / Fingerprint"`
- `components/browse/BrowseSlowBanner.tsx:14` — `title="That's a heavy file tree…"`
- `components/browse/BrowseSlowBanner.tsx:15` — `message="Didn't think it'd be this big. Give us just a moment."`
- `components/servers/ServerErrorModal.tsx:56` — `label="API Key"`
- `components/servers/ServerErrorModal.tsx:57` — `label="Machine"`
- `components/servers/ServerErrorModal.tsx:58` — `label="Platform"`
- `components/servers/ServerErrorModal.tsx:59` — `label="Version"`
- `components/sessions/SessionDetailSlowBanner.tsx:14` — `title="Session details are taking their time…"`
- `components/sessions/SessionDetailSlowBanner.tsx:15` — `message="Fetching the details — shouldn't be long."`

### object property — 17

- `app/settings.tsx:1100` — `label: 'Ask'`
- `app/settings.tsx:1101` — `label: 'Add'`
- `app/settings.tsx:1102` — `label: 'Replace'`
- `app/settings.tsx:1103` — `label: 'Keep'`
- `components/servers/ServerEditModal.tsx:94` — `text: 'Keep Editing'`
- `components/servers/ServerEditModal.tsx:95` — `text: 'Discard'`
- `components/servers/ServerFilterSheet.tsx:27` — `label: 'Running'`
- `components/servers/ServerFilterSheet.tsx:28` — `label: 'Idle'`
- `components/sessions/shared/TimeBucketPills.tsx:39` — `label: 'Custom'`
- `components/sessions/tree/DrillView.tsx:132` — `title: 'Sessions'`
- `components/sessions/tree/DrillView.tsx:133` — `title: 'History'`
- `hooks/useComposerState.ts:210` — `text: 'Take Photo'`
- `hooks/useComposerState.ts:211` — `text: 'Choose from Gallery'`
- `hooks/useComposerState.ts:212` — `text: 'Choose Files'`
- `hooks/useComposerState.ts:213` — `text: 'Cancel'`
- `hooks/useComposerState.ts:230` — `text: 'Cancel'`
- `hooks/useComposerState.ts:231` — `text: 'Open Settings'`

### placeholder — 11

- `app/browse.tsx:443` — `placeholder="Folder name"`
- `components/conversation/ConversationList.tsx:204` — `placeholder="Search conversations…"`
- `components/queue/PlanPreviewSheet.tsx:103` — `placeholder="Edit the prompt before proceeding..."`
- `components/queue/PromptQueueSheet.tsx:107` — `placeholder="Add a prompt to queue..."`
- `components/servers/AddServerScreen.tsx:295` — `placeholder="192.168.x.x:8766"`
- `components/servers/AddServerScreen.tsx:311` — `placeholder="Work Mac, Home Server…"`
- `components/servers/AddServerScreen.tsx:325` — `placeholder="Paste your API token here"`
- `components/servers/ServerClaudeFlagsSection.tsx:192` — `placeholder="--bare --agent reviewer"`
- `components/servers/ServerFormFields.tsx:108` — `placeholder="e.g. Work Mac, Home Server"`
- `components/servers/ServerFormFields.tsx:183` — `placeholder="Paste your API token here"`
- `components/sessions/NameSessionModal.tsx:61` — `placeholder="e.g. Fix auth bug"`

### Alert.alert — 9

- `components/conversation/LiveConversationView.tsx:238` — `Alert.alert('Not connected', 'Waiting for connection — try again in a moment.')`
- `components/conversation/LiveConversationView.tsx:255` — `Alert.alert('Send failed', err instanceof Error ? err.message : String(err))`
- `components/servers/ServerEditModal.tsx:93` — `Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [         { text: 'Keep Editing', style:`
- `components/terminal/TerminalView.tsx:94` — `Alert.alert('Send failed', err instanceof Error ? err.message : String(err))`
- `hooks/useComposerState.ts:209` — `Alert.alert('Attach', undefined, [       { text: 'Take Photo', onPress: () => runUpload('camera') },       { t`
- `hooks/useComposerState.ts:229` — `Alert.alert('Microphone access needed', 'Enable microphone access in Settings to dictate.', [           { text`

### return literal — 5

- `app/settings.tsx:46` — `return 'Ask each time'`
- `app/settings.tsx:47` — `return 'Add to displayed'`
- `app/settings.tsx:48` — `return 'Display only new'`
- `app/settings.tsx:49` — `return 'Keep current'`
- `hooks/useConversations.ts:273` — `return 'Tool'`

## Class 2 — locale values still in English (75)

These pass `i18n-completeness` because the keys exist. The values were copied from `en` and never translated.

**25 keys untranslated; 75 values total.**


**`locales/*/settings.json`**

- `backup.applied` (he/ar/ru) — "Restore applied ({{count}} projects written)."
- `backup.applyBody` (he/ar/ru) — "This rewrites project identity on the server. Conversations are not imported from the archive."
- `backup.conflict` (he/ar/ru) — "Restore has path conflicts — resolve them before applying."
- `backup.conflictDetail` (he/ar/ru) — "A path is claimed by a different project id. Applying would break one side’s links."
- `backup.conflictRow` (he/ar/ru) — "Conflict {{path}} (incoming {{incoming}} vs existing {{existing}})"
- `backup.copied` (he/ar/ru) — "Archive copied to clipboard."
- `backup.copyFailed` (he/ar/ru) — "Could not copy archive."
- `backup.dryRunReady` (he/ar/ru) — "Dry-run complete — review the plan, then apply."
- `backup.emptyBody` (he/ar/ru) — "Pair a server first, then export or restore metadata here."
- `backup.emptyTitle` (he/ar/ru) — "No servers yet"
- `backup.invalidArchive` (he/ar/ru) — "JSON is not a recognized backup archive."
- `backup.invalidJson` (he/ar/ru) — "Paste is not valid JSON."
- `backup.pasteHint` (he/ar/ru) — "Paste an archive JSON below, then dry-run before applying."
- `backup.pasteRequired` (he/ar/ru) — "Paste an archive JSON first."
- `backup.pathFrom` (he/ar/ru) — "From path prefix"
- `backup.pathMapHint` (he/ar/ru) — "Optional path rewrite for a machine move (prefix from → to)."
- `backup.pathTo` (he/ar/ru) — "To path prefix"
- `backup.planSummary` (he/ar/ru) — "Create {{create}} · update {{update}} · conflict {{conflict}}"
- `backup.shareFailed` (he/ar/ru) — "Could not share archive."
- `backup.subtitle` (he/ar/ru) — "Export and restore Threadbase project metadata for this server."
- `backup.unexpectedApply` (he/ar/ru) — "Unexpected apply response from dry-run."
- `notificationHealth.hintDelivery` (he/ar/ru) — "Delivery failures are accumulating on the server — re-register or check Expo credentials."
- `notificationHealth.hintHealthy` (he/ar/ru) — "Recent deliveries succeeded."
- `notificationHealth.hintNeverDelivered` (he/ar/ru) — "Registered, but no successful delivery yet (detection vs delivery)."
- `notificationHealth.hintRevoked` (he/ar/ru) — "This token was revoked on the server."

## Class 3 — iOS permission prompts (5)

No `InfoPlist.strings` exists anywhere under `ios/`, so these render in English on every device regardless of language, in system dialogs.

- `expo.ios.infoPlist.NSFaceIDUsageDescription` — "Threadbase uses Face ID to protect access to your conversations."
- `expo.plugins[3][1].cameraPermission` — "Used for QR code scanning during server setup and for attaching photos to your Claude Code sessions."
- `expo.plugins[4][1].photosPermission` — "Used to attach photos from your library to your Claude Code sessions."
- `expo.plugins[7][1].microphonePermission` — "Threadbase needs the microphone to dictate prompts."
- `expo.plugins[7][1].speechRecognitionPermission` — "Threadbase converts your speech to text on-device."

`cameraPermission` and `photosPermission` also say "Claude Code sessions" — stale copy now that the app supports Codex.

## Class 4 — surfaces outside i18n (9)

- `widgets/SessionLiveActivity.tsx:57` — `const statusLabel = isFinished ? 'Finished' : 'Running'`. The file imports no i18n at all, and this renders on the Lock Screen.
- `services/live-activity.android.ts:39` — `name: 'Live sessions'`, the Android notification channel name shown in system Settings.
- `components/sessions/shared/TimeBucketPills.tsx:18-21,39` — `label: 'All' | 'Today' | '7d' | '30d' | 'Custom'`.
- `components/servers/ServerIndexingBanner.tsx:163-164` — `.toLocaleString()` with no locale argument, so the number follows the device locale rather than the app's.

## Class 5 — RTL-unsafe physical styles (16)

Physical properties do not mirror under `I18nManager`, so these stay left-anchored in Hebrew and Arabic.

- `components/quick-access/QuickAccessChip.tsx:112` — `      marginLeft: 2,`
- `components/quick-access/QuickAccessStrip.tsx:223` — `    tabRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', paddingRight: spacing.sm },`
- `components/servers/ServerListCard.tsx:238` — `      paddingLeft: 16,`
- `components/servers/ServerListCard.tsx:244` — `      paddingLeft: 16,`
- `components/servers/ServersStatusModal.tsx:441` — `      marginRight: spacing.md,`
- `components/sessions/SessionCard.tsx:246` — `    marginLeft: 'auto',`
- `components/sessions/tree/TreeRow.styles.ts:10` — `    paddingRight: spacing.md,`
- `components/sessions/tree/TreeRow.styles.ts:27` — `    marginRight: spacing.xs,`
- `components/sessions/tree/TreeRow.styles.ts:59` — `    marginLeft: spacing.xs,`
- `components/sessions/tree/TreeRow.styles.ts:81` — `    marginRight: 4,`
- `components/sessions/tree/TreeRow.tsx:45` — `        { paddingLeft: spacing.md + indentLevels * 16 },`
- `components/shared/HeaderOverflowMenu.tsx:75` — `      marginRight: spacing.sm,`
- `components/shared/SlashCommandBoard.tsx:219` — `      marginLeft: spacing.xs,`
- `app/diagnostics.tsx:182` — `    rowValue: { color: theme.text.primary, fontSize: font.xs, fontFamily: 'monospace', flexShrink: 1, textAlign: 'right' },`
- `components/feedback/DiagnosticsPreview.tsx:104` — `      textAlign: 'right',`
- `components/sessions/tree/TreeRow.styles.ts:77` — `    textAlign: 'right',`

## Reproducing

```bash
# from a worktree with node_modules present
cat > probe.eslint.config.js <<EOF
const i18next = require("eslint-plugin-i18next");
const tsparser = require("@typescript-eslint/parser");
module.exports = [
  {
    files: ["**/*.tsx", "**/*.ts"],
    ignores: ["**/*.test.ts","**/*.test.tsx","**/*.stories.tsx","__tests__/**","__mocks__/**","test-utils/**",".storybook/**"],
    plugins: { i18next },
    languageOptions: { parser: tsparser, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      "i18next/no-literal-string": ["error", {
        mode: "all",
        "jsx-attributes": { include: ["accessibilityLabel","accessibilityHint","placeholder","title","label","subtitle","description","message","cta","buttonText","confirmText","cancelText","emptyText"] },
        callees: { include: ["Alert.alert","Alert.prompt","toast","showToast","notify"] },
        "object-properties": { include: ["text","title","message","label","body","subtitle","description","hint","placeholder","cta","buttonText"] },
        words: { exclude: [
          "^[^a-zA-Z]*$",
          "^[a-z0-9_:/@-]+$",
          "^[A-Z0-9_]+$",
          "^[a-z][A-Za-z0-9]*(\\.[A-Za-z][A-Za-z0-9]*)+$",
          "^#[0-9a-fA-F]{3,8}$"
        ] },
      }],
    },
  },
];
EOF
npx eslint --no-config-lookup -c ./probe.eslint.config.js \
  app components hooks lib services stores constants contexts utils types widgets \
  -f json -o /tmp/i18n.json
```

Class 2 is reproduced by walking `locales/en/*.json` and comparing each value with the same key in `he`/`ar`/`ru`, keeping matches with three or more alphabetic words.
