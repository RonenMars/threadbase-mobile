# Voice-to-Text Mic — Implementation Progress

**Date:** 2026-05-27
**Plan:** `~/.claude/plans/write-an-implementation-plan-sparkling-wolf.md`
**Research:** `docs/research/voice-to-text-2026-05-26.md`
**Status:** All gates pass — typecheck, lint, 362/362 unit tests, 8/8 new tests

## Files changed / created

| File | Type | One-line |
|---|---|---|
| `package.json` | edit | Pinned `expo-speech-recognition: 56.0.0` + wired `voice_dictation.yaml` into `test:e2e:mock` |
| `app.json` | edit | Added `expo-speech-recognition` plugin between `expo-secure-store` and `expo-font` with mic + speech permission strings |
| `locales/en/terminal.json` | edit | Added `voice` block (`start`, `stop`, `permissionDeniedTitle`, `permissionDeniedBody`) |
| `hooks/useVoiceInput.ts` | new | Owns speech recognition lifecycle: `listening` state, `start`/`stop`, 30s silence safety timer, throws `PERMISSION_DENIED` |
| `app/session/[id].tsx` | edit | Five surgical edits: phosphor import + hook import + `useVoiceInput` call + `handleToggleMic` + mic `TouchableOpacity` reusing `attachBtn` style |
| `jest.setup.js` | edit | Added `expo-speech-recognition` module mock (module methods + `useSpeechRecognitionEvent` stub) |
| `__tests__/unit/hooks/useVoiceInput.test.ts` | new | 8 tests: permission grant/deny, start/stop, result/end events, unmount cleanup, 30s silence timer auto-stop, timer reset on each result |
| `e2e/voice_dictation.yaml` | new | Maestro flow asserting mic toggle UI state via deep-link to PTY session |

## Verification gates run

- ✅ `npm install` — 1 new package, 1246 audited
- ✅ `cd ios && pod install` — 125 pods total (was 124)
- ✅ `npm run typecheck` — clean
- ✅ `npm run lint` — clean (only pre-existing eslintrc deprecation warning)
- ✅ `npx jest --ci useVoiceInput` — 8/8 passed in 1.25s
- ✅ `npm run test:unit` — 362/362 passed across 30 suites
- ⏭️ `expo run:ios` — NOT run (per instructions: do not run on device, do not ship, do not commit until user reviews)
- ⏭️ Maestro flow — NOT run (requires booted sim + mock server, deferred to user)

## Implementation notes / deviations from the plan

1. **Hook call placement.** The plan said to place `useVoiceInput(...)` "after the `useTranslation` at line 400". That would have referenced `setInputText` before its `useState` declaration (temporal dead zone on `const`). Placed it immediately after `const [inputText, setInputText] = useState('')` instead so the call sits with related state — preserves the plan's intent.
2. **Style.** The plan offered `micBtn` or reusing `attachBtn`. Reused `attachBtn` directly since the shape (52w × 44h, card bg, border) is identical for both buttons. No new style key.
3. **Hook import.** Added `import { useVoiceInput } from '@/hooks/useVoiceInput'` alongside `useSessionActions` for symmetry — the plan didn't name a precise import location.
4. **Maestro flow.** Followed `e2e/pty_turn_divider.yaml` pattern (deep-link → assert session detail → assert/tap mic) rather than tapping into the hub, since hub project-row tap is "iOS-undrivable" per `e2e/README.md`.

## Hard constraints honored

- No emojis anywhere (Phosphor icons only — `Microphone`, `MicrophoneSlash`).
- No drive-by refactors — `git diff app/session/\[id\].tsx` is five tight edit hunks.
- No `Co-Authored-By` trailer (none added; no commit made).
- No `git commit` run — awaiting user review.
- No `gh pr` commands run.
- No `/expo-local-ship` or `/ship-expo-cloud` invoked.

## What's next (out of scope this PR; per the plan)

- Manual device verification on physical iPhone (`expo run:ios --device 00008150-00115DEA1A40401C`) for both permission flows + interim-result streaming. Deferred to user.
- Android device check (uses Google cloud STT, needs `com.google.android.googlequicksearchbox`).
- Cloud "Accurate mode" (Deepgram / OpenAI) — research tier 2.
- On-device Whisper (`whisper.rn`) — research tier 3.
- Auto-send on silence (intentionally not implemented — current behavior is auto-stop only).
- Localization beyond `en-US`.
