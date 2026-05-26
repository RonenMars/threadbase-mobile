# Voice-to-Text for Threadbase Mobile — Research Synthesis

**Date:** 2026-05-26
**Stack:** Expo SDK 56, RN 0.85.3, React 19.2.3, TypeScript 6, Fabric (new arch), `expo-dev-client`
**Goal:** Let the user speak their prompt to the Claude agent. The chat input is a `TextInput` in `app/session/[id].tsx:849`.

---

## TL;DR — Recommendation

**Ship `expo-speech-recognition@56.0.0` as the default.** It's the only library with an explicit SDK 56 release this month (2026-05-17), built as a real Expo Module (Fabric-native), has a config plugin for clean `expo prebuild` with `expo-dev-client`, supports interim results, and on iOS can run **fully on-device for free** via `requiresOnDeviceRecognition: true`. Zero backend work, zero per-minute cost, zero new infra.

Add a **"high-accuracy mode" toggle** later that proxies audio through `tb-streamer` to **OpenAI `gpt-4o-transcribe`** or **Deepgram Nova-3 with Keyterm Prompting** — only if telemetry shows the native STT struggles with code identifiers.

Skip on-device Whisper (whisper.rn) entirely for now: 75–500 MB model downloads, 250–500 MB RAM, and *worse* accuracy on code identifiers than the OS-bundled options. It's a future "true offline" mode at best.

---

## Three viable tiers

| Tier | Tech | Quality | Cost | Effort | Verdict |
|---|---|---|---|---|---|
| **1. OS-native (default)** | `expo-speech-recognition` → SFSpeechRecognizer (iOS) + Android SpeechRecognizer | Good for English; weak on code identifiers but `contextualStrings` helps | $0 | ~1 day | ✅ ship this |
| **2. Cloud (premium)** | Deepgram Nova-3 WS (live) or `gpt-4o-transcribe` (batch) via backend proxy | Best-in-class, esp. with keyterm hints | $0.003–0.006/min | 3–5 days incl. backend route | Add later, behind setting |
| **3. On-device Whisper** | `whisper.rn` 0.6.0 + ggml tiny/base + CoreML | Worse than tier 1 on jargon; tiny/base only viable models | $0 + 75–500 MB DL | 1–2 weeks | Skip |

---

## Tier 1 — `expo-speech-recognition` (recommended default)

### Why it fits this exact stack

- **`expo-speech-recognition@56.0.0`** released 2026-05-17. devDeps pin `expo: ^56.0.0-preview.12`, `@types/react: ~19.2.14`, `typescript: ~6.0.3` — matches our `package.json` exactly.
- Built with `expo-module-scripts` → Fabric-native, no opt-in flags.
- Config plugin handles both iOS `Info.plist` keys (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`) and Android `RECORD_AUDIO` + `<queries>`.
- `requiresOnDeviceRecognition: true` on iOS → free, offline, private. Falls back to Google's speech service on Android.
- Active project (622 stars, last commit 2026-05-25).
- Major version tracks Expo SDK cadence (v56 = SDK 56, v55 = SDK 55, etc.).

### Integration into `app/session/[id].tsx`

The chat input is at line 849. Add a mic Phosphor icon next to the existing attach button (line 838), wire it to start/stop and write into `setInputText`:

```tsx
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { Microphone, MicrophoneSlash } from 'phosphor-react-native';

const [listening, setListening] = useState(false);
useSpeechRecognitionEvent('result', (e) => setInputText(e.results[0]?.transcript ?? ''));
useSpeechRecognitionEvent('end', () => setListening(false));

const toggleMic = async () => {
  if (listening) return ExpoSpeechRecognitionModule.stop();
  const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!granted) return;
  setListening(true);
  ExpoSpeechRecognitionModule.start({
    lang: 'en-US',
    interimResults: true,
    continuous: true,
    requiresOnDeviceRecognition: true,  // iOS: free + private
    contextualStrings: ['React', 'TypeScript', 'useEffect', 'Expo', 'TSX'],
  });
};
```

`app.json` plugin config:

```json
"plugins": [
  ["expo-speech-recognition", {
    "microphonePermission": "Threadbase needs the microphone to dictate prompts.",
    "speechRecognitionPermission": "Threadbase converts your speech to text on-device."
  }]
]
```

After install: `cd ios && pod install` (per saved feedback memory on Expo iOS projects), then `npx expo run:ios --device 00008150-00115DEA1A40401C` to test on the iPhone 17 Pro.

### Gotchas

- **iOS 17 vs 18+ behavior:** with `continuous: false`, iOS ≤17 ends after 3 s silence; iOS 18+ runs until a final result. Use explicit stop button.
- **Android emulator:** needs `com.google.android.googlequicksearchbox` installed; works on real devices.
- **Punctuation on Android:** requires API 33+ and on-device recognition.
- **Audio session conflicts:** if PTY/terminal audio is ever added, set `iosCategory: 'playAndRecord'`.

### Alternatives in this tier — all rejected

- **`@react-native-voice/voice`**: archived in early 2026, last release 2022-05-11. RN 0.85/Fabric compat unknown. Avoid.
- **`react-native-voice` (old fork)**: abandoned since 2019.
- **`@react-native-community/voice` / `react-native-speech-to-text-google` / `react-native-android-voice`**: all stale, no new-arch work.

---

## Tier 2 — Cloud STT (add later, behind a setting)

All prices accessed 2026-05-26 from vendor docs. RN can open `fetch` (multipart) and `WebSocket` directly with no native module — every provider below works with `expo-dev-client`.

### Top picks

**1. Deepgram Nova-3 + Keyterm Prompting** — best for live dictation

- Streaming WS, sub-1 s partial results, $0.0048/min ($0.0043/min batch)
- Keyterm Prompting (+$0.0013/min) explicitly boosts domain terms — best-in-class for code/jargon
- **Temporary tokens (30 s TTL)** — RN opens WS directly with a mint from a tiny backend endpoint; audio bytes never touch our servers
- Cost ceiling: a heavy user dictating 5 min/day = $0.025/day, $0.75/month per user

```ts
const { token } = await fetch(`${TB_BACKEND}/deepgram/token`).then(r => r.json());
const ws = new WebSocket(
  `wss://api.deepgram.com/v1/listen?model=nova-3&keyterm=React&keyterm=Expo&keyterm=useEffect`,
  ['token', token]
);
ws.onmessage = e => setText(JSON.parse(e.data).channel.alternatives[0].transcript);
// pipe expo-audio PCM chunks via ws.send(chunk)
```

**2. OpenAI `gpt-4o-transcribe`** — best for high-accuracy batch fallback

- WER ~4.1% (lowest on the market for technical English)
- $0.006/min (`gpt-4o-mini-transcribe`: $0.003/min)
- Batch only on `/v1/audio/transcriptions`; live partials require the separate Realtime API
- Max 25 MB file. Formats: m4a, mp3, wav, webm, mp4
- `prompt` param (≤224 tokens) accepts a hint string — perfect for seeding code/library names
- **Backend proxy required** — API key cannot ship to device

```ts
const fd = new FormData();
fd.append('file', { uri: audioUri, name: 'p.m4a', type: 'audio/m4a' } as any);
fd.append('model', 'gpt-4o-transcribe');
fd.append('prompt', 'TypeScript, React Native, Expo, useEffect');
const r = await fetch(`${TB_BACKEND}/stt/openai`, { method: 'POST', body: fd });
const { text } = await r.json();
```

### Others surveyed

| Provider | Model | Price | Streaming | Token model | Verdict |
|---|---|---|---|---|---|
| **AssemblyAI** | Universal-2 / Universal-Streaming | $0.0025/min batch, $0.0025/min stream | WS | One-shot temp tokens | Solid #3, similar shape to Deepgram |
| **Groq Whisper-large-v3-turbo** | $0.00067/min | Batch only | Backend proxy | Cheapest but WER ~10.3% — too weak for code English |
| **Google Cloud Speech v2** | $0.016/min | gRPC only | JWT, must proxy | Awkward fit, 3× pricier, skip |
| **ElevenLabs Scribe v2** | ~$0.25/min realtime | WS | API key | 50× Deepgram cost, overkill |

### Security

- **Backend proxy required:** OpenAI, Groq, Google
- **Ephemeral token (device-direct):** Deepgram (30 s TTL), AssemblyAI (one-shot) — cheaper infra path

### When to add tier 2

**Only if** real users report transcription mangling code identifiers. The path:

1. Add `POST /stt/deepgram-token` to `tb-streamer` (mints 30 s ephemeral tokens).
2. RN opens `wss://api.deepgram.com/v1/listen?model=nova-3&keyterm=React&keyterm=Expo...` directly.
3. Surface as "Accurate mode" in settings; default stays on-device.

---

## Tier 3 — On-device Whisper (skip for now)

### `whisper.rn` 0.6.0 (released 2026-05-14)

- Wraps whisper.cpp via JSI native module; runs in Fabric
- iOS: Metal GPU + CoreML encoder on by default (iOS 15+, ANE acceleration)
- Android: CPU/NEON only, no first-class NNAPI path
- Models (ggml `.bin`): tiny ~75 MB, base ~142 MB, small ~466 MB, medium ~1.5 GB. Plus CoreML `.mlmodelc` of similar size.
- Built-in `RealtimeTranscriber` with VAD + partial-result callbacks
- No official Expo config plugin; requires `expo prebuild` + CocoaPods + `metro.config.js` tweak for `.bin`/`.mil` assets

### Why skip

- **75–142 MB model download** (tiny/base) just to ship a feature
- **250–500 MB peak RAM** — risky on iPhone 12
- **Worse** at "useEffect", "TSX", "TS6133" than SFSpeechRecognizer with `contextualStrings` or Deepgram with keyterm prompting
- **No OTA updates** (binary `.bin` ships in app or downloads at runtime)
- Apple ANE/CoreML setup is fiddly under Expo prebuild

### Other on-device options surveyed

- **Direct whisper.cpp wrap** via Expo Modules API — 1–2 weeks of work to reach `whisper.rn` parity, then maintain it forever. Not worth it.
- **`onnxruntime-react-native` + Whisper ONNX** — exists but audio plumbing is DIY and brittle; production reports of empty output. Not ready.
- **Apple SFSpeechRecognizer with `requiresOnDeviceRecognition`** — already covered by `expo-speech-recognition`. Free, instant, iOS-only.
- **Android `createOnDeviceSpeechRecognizer()` (API 31+)** — also covered by `expo-speech-recognition`. Quality depends on OEM language pack.

### On-device Whisper: verdict

**Nice optional mode, not a sane default.** Reserve `whisper.rn` tiny/base for a future "true offline" tier *if* telemetry shows users actually need it.

---

## Next steps (suggested order)

1. `npm i expo-speech-recognition@56` → add plugin to `app.json` → `npx expo prebuild --clean` → `cd ios && pod install`.
2. Add mic button + dictation handler to `app/session/[id].tsx` next to the attach button.
3. Add a Maestro flow that taps mic, verifies UI state changes (can't assert on simulator transcription, but can assert state).
4. Ship to TestFlight via `/expo-local-ship`, gather feedback on code-identifier quality.
5. If quality is insufficient → spec out the Deepgram cloud tier.

---

## Sources

- [expo-speech-recognition (jamsch)](https://github.com/jamsch/expo-speech-recognition)
- [OpenAI audio transcription docs](https://platform.openai.com/docs/guides/speech-to-text)
- [Deepgram Nova-3 + keyterm prompting](https://developers.deepgram.com/docs/keyterm)
- [AssemblyAI Universal-2](https://www.assemblyai.com/docs)
- [whisper.rn GitHub (v0.6.0, May 2026)](https://github.com/mybigday/whisper.rn)
- [whisper.cpp CoreML 6× ANE speedup discussion](https://github.com/ggml-org/whisper.cpp/discussions/548)
- [iOS 2026 STT playbook: SpeechAnalyzer + WhisperKit](https://www.forasoft.com/blog/article/speech-recognition-with-neural-networks-on-ios-1621)
- [SFSpeechRecognizer accuracy vs newer Apple API](https://www.argmaxinc.com/blog/apple-and-argmax)
- [Android createOnDeviceSpeechRecognizer (API 31+)](https://stackoverflow.com/questions/64708403/android-speech-recognizer-no-longer-working-offline)
