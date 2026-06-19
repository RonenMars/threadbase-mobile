# Threadbase Mobile

A companion mobile app for monitoring and controlling [Claude Code](https://claude.ai/code) agent sessions running on a remote Threadbase server. Browse live sessions, read conversation history, view terminal output, queue prompts, and receive push notifications — all from your phone.

---

## Features

- **Live session monitoring** — real-time status updates (running, waiting for input, completed, failed, idle) via persistent WebSocket connections
- **Terminal output viewer** — embedded VT100 emulator that renders ANSI escape sequences and strips Claude Code TUI decorations
- **Prompt queue** — queue, reorder, and submit prompts to active sessions without waiting at your desk
- **Conversation history** — infinite-scroll browser with full-text search across all servers and past sessions
- **Multi-server support** — manage and aggregate data from multiple Threadbase installations simultaneously
- **Push notifications** — receive alerts when a session needs input, completes, or fails; configurable with quiet hours and per-type toggles
- **QR-code pairing** — add a new server by scanning a QR code; falls back to manual URL + API key entry
- **Secure credential storage** — API keys stored in iOS Keychain / Android Keystore via Expo SecureStore

---

## Roadmap & Backlog

Forward-looking and in-progress work lives in two living docs:

- **[docs/ROADMAP.md](docs/ROADMAP.md)** — planned features (15 entries — original five plus a multi-agent / multi-project orchestration cluster: Mission Control, cross-session search, Live Activities, scheduled prompts, tagging, saved views, snippets, workspace sync, voice prompts, split view) plus an index of historical shipped features with links to their archived implementation plans.
- **[docs/BACKLOG.md](docs/BACKLOG.md)** — open bug tickets with file pointers, recommended fixes, and a suggested next-up order. Shipped bugs stay listed for traceability.
- **[docs/IDEAS.md](docs/IDEAS.md)** — staging ground for unprioritized feature ideas before they're promoted into ROADMAP.
- **[docs/lessons/](docs/lessons/)** — hard-won findings from working on tb-mobile (root causes, platform gotchas, recurring traps). Add an entry whenever a non-obvious problem cost real time to diagnose.

Historical implementation plans (one per shipped feature) are archived under [`docs/superpowers/plans/archive/`](docs/superpowers/plans/archive/) — useful when revisiting an area.

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Expo 55 · React Native 0.83.6 · React 19 |
| Routing | Expo Router (file-based, like Next.js) |
| State — app | Zustand 4 (servers, queue, settings) |
| State — server | TanStack Query 5 with AsyncStorage persistence |
| Real-time | WebSocket manager (singleton per server) |
| Styling | NativeWind 4 (Tailwind CSS for React Native) |
| Lists | Shopify FlashList |
| Animation | React Native Reanimated 4 + Gesture Handler |
| Bottom sheets | @gorhom/bottom-sheet |
| Cryptography | TweetNaCl (pairing key exchange) |
| Testing | Jest 29 + Testing Library + jest-expo |
| Language | TypeScript (strict) |

---

## Project Structure

```
tb-mobile/
├── app/                    # Expo Router screens (file-based routing)
│   ├── _layout.tsx         # Root layout: AuthGate, WebSocket setup, notifications
│   ├── index.tsx           # Redirect → /onboarding or /(tabs)/sessions
│   ├── onboarding.tsx      # First-launch server setup
│   ├── browse.tsx          # Project directory picker for new sessions
│   ├── (tabs)/
│   │   ├── sessions.tsx    # Active sessions list with filters & sorting
│   │   ├── history.tsx     # Conversation history browser
│   │   └── settings.tsx    # App preferences and server management
│   ├── session/[id].tsx    # Session detail: terminal, prompt queue, metadata
│   └── conversation/[id].tsx  # Conversation thread with diffs & tool use
│
├── components/
│   ├── onboarding/         # Onboarding flow steps
│   ├── servers/            # Server connection, QR scanner, server picker
│   ├── sessions/           # Session cards, status badges
│   ├── conversation/       # Message thread, code diffs, content renderers
│   ├── terminal/           # Terminal output display
│   ├── queue/              # Prompt queue UI
│   ├── pair/               # Pairing flow screens
│   ├── shared/             # Shared modals, buttons, overlays
│   └── ui/                 # Primitive UI components (buttons, cards, loaders)
│
├── stores/
│   ├── servers.ts          # Multi-server list; persisted to SecureStore
│   ├── sessions.ts         # Per-session prompt queue state
│   └── settings.ts         # Notification prefs, display options, theme
│
├── services/
│   ├── api-client.ts       # REST HTTP client with Bearer auth
│   ├── ws-client.ts        # WebSocket manager (one connection per server)
│   ├── virtual-terminal.ts # VT100 emulator (ANSI parsing → char grid)
│   ├── query-client.ts     # React Query + AsyncStorage persist setup
│   ├── push.ts             # Push notification registration
│   ├── pair-exchange.ts    # NaCl-based server pairing protocol
│   └── uploads.ts          # File upload handling
│
├── hooks/                  # Custom React hooks (useSession, useConversations, …)
├── types/api.ts            # TypeScript interfaces for all API models
├── constants/theme.ts      # Design tokens (colors, spacing, fonts)
│
├── ios/                    # Native iOS project (CocoaPods)
├── app.json                # Expo app config (permissions, plugins, build numbers)
├── eas.json                # EAS Build profiles
├── tailwind.config.js      # Tailwind theme extension
└── tsconfig.json           # TypeScript strict mode, @/* path alias
```

---

## Prerequisites

- **Node.js** ≥ 22.13 (Expo SDK 55 requires ≥ 22.13 or ≥ 24; v22.12 silently breaks Metro path resolution)
- **Xcode** 16+ (iOS development)
- **CocoaPods** (iOS native dependencies)
- A running [tb-streamer](https://github.com/RonenMars/tb-streamer) server with an API key

---

## Local Setup

```bash
# 1. Install JS dependencies (also wires up git hooks via the `prepare` script)
npm install

# If you skip `npm install`, point git at the committed hooks manually:
#   git config core.hooksPath scripts/git-hooks
# (commit-msg hook auto-tags non-CI-significant commits — see docs/ci-significant-paths.md)

# 2. Install iOS native dependencies
cd ios && pod install && cd ..

# 3. Copy environment template
cp .env.example .env
# Edit .env if needed — runtime server URLs/keys are stored in SecureStore, not .env
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_DEFAULT_SERVER_URL` | `http://localhost:7070` | Pre-filled URL shown during onboarding |
| `EXPO_PUBLIC_DEFAULT_API_KEY` | `tb_api_sample` | Pre-filled API key shown during onboarding |

These are convenience defaults for development. In production, users enter (or scan) their own server URL and API key, which are then stored securely in Keychain/Keystore.

---

## Running the App

```bash
# Start Metro bundler (Expo dev server)
npm start

# Build & launch on iOS simulator
npm run ios

# Build & launch on Android emulator
npm run android
```

On first launch the app redirects to **Onboarding** if no server is configured. Add a server by:
1. Scanning the QR code displayed in the Threadbase web UI, **or**
2. Entering the server URL and API key manually

---

## Architecture

### State management (three tiers)

| Tier | Technology | What it owns | Persistence |
|---|---|---|---|
| App state | Zustand | Server list, prompt queues, user settings | SecureStore (servers), AsyncStorage (settings) |
| Server state | TanStack Query | API responses (sessions, conversations, details) | AsyncStorage (24 h max age) |
| UI state | useState / useRef | Filters, sort order, scroll position | None — ephemeral |

WebSocket events live outside both layers: the `wsManager` singleton fires events that directly update the React Query cache.

### Real-time data flow

```
Threadbase server
  └─ WebSocket (one per server)
       └─ wsManager (singleton, services/ws-client.ts)
            ├─ session_list  → React Query cache (invalidate sessions query)
            └─ session_update → React Query cache (patch single session)
                   └─ Components re-render automatically
```

### Multi-server design

Every data structure is keyed by `serverId` (a hash of the server URL). Compound keys like `serverId::sessionId` prevent collisions across servers. The `displayedServerIds` setting lets users show/hide individual servers in the sessions and history tabs without removing them.

### Terminal rendering

Raw ANSI terminal data from WebSocket → `VirtualTerminal` (a minimal VT100 emulator):

1. Parses CSI / SGR escape sequences
2. Maintains a 2-D character grid with per-cell color attributes
3. Strips Claude Code TUI decorations (spinner frames, box-drawing borders, status bars)
4. Exposes clean text lines that map directly to React Native `<Text>` elements

---

## Key Screens

| Screen | Route | Purpose |
|---|---|---|
| Sessions | `/(tabs)/sessions` | Live grid of all active sessions across servers; filterable by status, sortable by recency or start time |
| History | `/(tabs)/history` | Infinite-scroll conversation browser with full-text search, aggregated across servers |
| Settings | `/(tabs)/settings` | Notification preferences, display options, server list management |
| Session Detail | `/session/[id]` | Terminal output stream, prompt queue, session metadata, status badge |
| Conversation | `/conversation/[id]` | Full message thread with code diffs, tool-use blocks, and message tree |
| Browse | `/browse` | File-system picker to select a project directory when starting a new session |
| Onboarding | `/onboarding` | First-launch server setup via QR scan or manual entry |

---

## Testing

### Unit & Integration (Jest)

```bash
npm test              # Jest watch mode (all tests)
npm run test:ci       # CI mode (no watch, exits with code)
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
npm run test:e2e      # Jest-based e2e tests
```

### E2E (Maestro)

Maestro flows live in `e2e/`. A Node mock server (`e2e/mock-server.js`) serves static JSON fixtures so tests run without a live Threadbase server.

**Prerequisites:**
- [Maestro CLI](https://maestro.mobile.dev): `brew install maestro`
- App built and installed on the simulator: `npm run ios` (once after any native changes)
- A booted iOS simulator (the script checks for this automatically)

**Run the full mock suite:**
```bash
npm run test:e2e:mock
```

This starts the mock server on port 7071, runs `e2e/03_hub.yaml` (Sessions Hub) and `e2e/04_session_detail.yaml` (Session Detail), then kills the server.

**Run individual flows:**
```bash
node e2e/mock-server.js &
maestro test e2e/03_hub.yaml
kill %1
```

**Flows:**

| File | What it tests |
|---|---|
| `00_setup.yaml` | Reusable onboarding helper (called by other flows via `runFlow`) |
| `01_onboarding.yaml` | Onboarding against a real server (`THREADBASE_SERVER_URL` + `THREADBASE_API_KEY`) |
| `02_sessions.yaml` | Tab navigation against a real server |
| `03_hub.yaml` | Sessions Hub: project card expansion, session rows, navigate to detail |
| `04_session_detail.yaml` | Session detail: terminal output, message input |

**Fixtures** (`e2e/fixtures/`): static JSON returned by the mock server — `sessions.json`, `session-detail.json`, `terminal-output.json`, `conversations.json`.

---

## Code Quality

```bash
npm run lint          # ESLint (expo config)
npm run typecheck     # tsc --noEmit (strict)
```

---

## Building for Release

### Local build → TestFlight (default)

Use the `/expo-local-ship` skill inside Claude Code. It:

1. Bumps the build number in `app.json`
2. Commits `app.json`
3. Archives the app with Xcode
4. Uploads the IPA to TestFlight

> **Required:** always commit `app.json` before archiving — never ship with an uncommitted build number.

> This is the canonical ship path. Do not open Xcode Organizer or App Store Connect manually — the entire flow is CLI-driven.

### Cloud build with EAS (opt-in)

```bash
eas build --profile production --platform ios
eas submit --platform ios
```

EAS build profiles live in `eas.json`. Cloud builds are opt-in and require EAS account authentication (`eas login`).

> Per project convention, cloud builds must be explicitly requested — they are never triggered automatically as part of a "ship" or "commit" request.

---

## Design System

The app uses a dark-first theme inspired by GitHub's color palette:

| Token | Value | Usage |
|---|---|---|
| Background | `#0d1117` | Screen backgrounds |
| Surface | `#161b22` | Cards, sheets |
| Border | `#30363d` | Dividers |
| Accent | `#58a6ff` | Links, active states |
| Success | green | Running sessions |
| Warning | amber | Waiting-for-input sessions |
| Error | red | Failed sessions |
| Info | blue | Completed sessions |

Design tokens are defined in `constants/theme.ts` and surfaced as Tailwind classes via `tailwind.config.js`.

---

## Secure Credential Storage

API keys are stored in the platform Keychain (iOS) / Keystore (Android) via Expo SecureStore — they are **never** written to AsyncStorage or logged. The server list (URLs and labels) is also stored in SecureStore. A one-time migration runs on first launch to move any legacy AsyncStorage entries to SecureStore.

---

## Push Notifications

Expo push tokens are registered at app launch and sent to each configured server. Supported notification types:

- Session waiting for input
- Session completed
- Session failed
- New session started

Preferences (per type, quiet hours, badge count) are configured in **Settings → Notifications**.

Notification deep links open directly to the relevant session: `/session/:id?server=:serverId`.

---

## Privacy

Threadbase is a thin client for self-hosted Threadbase streamers. It does not run any analytics, crash-reporting, or telemetry service of its own.

**What stays on your device**

- Server URLs and API keys (Keychain / Keystore via SecureStore)
- Session display names, draft prompts, UI settings, quick-access list, React Query cache
- All Claude Code session content fetched from your streamer

**What leaves your device, and where it goes**

| Data | Destination | Purpose |
|------|-------------|---------|
| Session content, prompts, files, status events | The Threadbase streamer URL you configured | Show your sessions in the app |
| Expo push token (`ExponentPushToken[…]`) | (a) Expo's push relay; (b) every streamer you've paired with, via `POST /api/push/register` | Deliver session notifications |
| Pairing handshake | The streamer URL encoded in the pair QR you scan | Exchange API key during setup |

**What we do not collect**

The app makes **no network calls to any developer-operated backend** — there is no Threadbase analytics server, no crash-reporting endpoint, no advertising or tracking SDK. Apart from the Expo push relay (used solely to deliver notifications you opted into) and the streamer URLs you yourself enter, the app talks to nothing.

**Permissions used**

| Permission | Why |
|------------|-----|
| Camera | Scan pairing QR codes; attach photos to sessions |
| Photo library | Attach photos to sessions |
| Microphone + speech recognition | Dictate prompts (speech-to-text is on-device) |
| Notifications | Deliver session status alerts from your streamers |

**Your control**

- Remove a server in Settings to revoke its push token and stop all traffic to it
- Disable notifications system-wide in iOS Settings → Threadbase
- Uninstalling the app deletes every byte stored locally; nothing persists off-device

A canonical web version of this notice is published at <https://threadbase.sh/privacy>.

---

## License

[MIT](LICENSE) © 2026 Ronen Mars.
