# Threadbase Mobile

A companion mobile app for monitoring and controlling [Claude Code](https://claude.ai/code) agent sessions running on a remote Threadbase server. Browse live sessions, read conversation history, view terminal output, queue prompts, and get push notifications — all from your phone.

## Features

- **Live session monitoring** — real-time status via WebSocket (running, waiting for input, completed, failed, idle)
- **Terminal viewer** — embedded VT100 emulator, strips Claude Code TUI decorations
- **Prompt queue** — queue and submit prompts to active sessions remotely
- **Conversation history** — infinite-scroll, full-text search across servers
- **Multi-server support** — manage several Threadbase installations at once
- **Push notifications** — alerts for input-needed / completed / failed sessions, with quiet hours
- **QR-code pairing** — add a server by scanning a QR code, or enter URL + API key manually
- **Secure storage** — API keys in iOS Keychain / Android Keystore

## Tech Stack

Expo 55 · React Native 0.83.6 · React 19 · Expo Router · Zustand · TanStack Query · NativeWind 4 · FlashList · Reanimated 4 · TypeScript (strict)

## Prerequisites

- Node.js ≥ 22.13 (Expo SDK 55 needs ≥22.13 or ≥24 — v22.12 breaks Metro path resolution)
- Xcode 16+ and CocoaPods (iOS)
- A running [tb-streamer](https://github.com/RonenMars/tb-streamer) server with an API key

## Setup

```bash
npm install                  # also wires up git hooks
cd ios && pod install && cd ..
cp .env.example .env         # optional dev defaults, see below
```

| Env var | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_DEFAULT_SERVER_URL` | `http://localhost:7070` | Pre-filled URL in onboarding |
| `EXPO_PUBLIC_DEFAULT_API_KEY` | `tb_api_sample` | Pre-filled API key in onboarding |

Runtime server URL/key are entered by the user and stored in SecureStore, not `.env`.

## Running

```bash
npm start        # Metro bundler
npm run ios       # build & launch on simulator
npm run android
```

For physical devices or off-network dev, see `docs/dev-on-physical-device-ios.md`, `docs/dev-on-physical-device-android.md`, and `docs/remote-dev-tunnel.md`.

On first launch, add a server via QR scan or manual entry during Onboarding.

## Project Structure

```
app/            Expo Router screens (file-based routing)
components/     UI components, grouped by feature
stores/         Zustand stores (servers, sessions, settings)
services/       API client, WebSocket manager, VT100 emulator, push, pairing
hooks/          Custom React hooks
types/api.ts    API type definitions
ios/            Native iOS project (CocoaPods)
```

## Architecture

**State** is split three ways: Zustand for app state (servers, queues, settings), TanStack Query for server data (cached in AsyncStorage), and local `useState` for ephemeral UI state. A singleton `wsManager` (`services/ws-client.ts`) pushes WebSocket events straight into the React Query cache, so components re-render automatically.

Every data structure is keyed by `serverId` to support multiple Threadbase servers at once.

Terminal output is rendered by a minimal VT100 emulator (`services/virtual-terminal.ts`): it parses ANSI escape sequences into a character grid, strips Claude Code's TUI decorations, and exposes plain text lines.

## Testing

```bash
npm test               # Jest watch mode
npm run test:ci        # CI mode
npm run test:e2e:mock  # Maestro E2E against a mock server (see e2e/)
```

Maestro E2E needs `brew install maestro` and the app built once via `npm run ios`.

## Code Quality

```bash
npm run lint
npm run typecheck
```

## Shipping

Default path is the `/expo-local-ship` skill (Claude Code): bumps the build number, commits `app.json`, archives, uploads to TestFlight. Always commit `app.json` before archiving.

EAS cloud builds (`eas build` / `eas submit`) are opt-in only — never triggered automatically.

## Roadmap & Backlog

- [docs/ROADMAP.md](docs/ROADMAP.md) — planned features
- [docs/BACKLOG.md](docs/BACKLOG.md) — open bugs
- [docs/IDEAS.md](docs/IDEAS.md) — unprioritized ideas
- [docs/lessons/](docs/lessons/) — hard-won gotchas

## Privacy

Threadbase is a thin client for self-hosted streamers — no analytics, crash reporting, or telemetry of its own. Session content, prompts, and status events go only to the streamer URL you configure. Expo push tokens go to Expo's relay and to each paired streamer (for notification delivery). Removing a server in Settings revokes its push token; uninstalling the app deletes everything stored locally.

Full policy: <https://threadbase.sh/privacy>

## License

[MIT](LICENSE) © 2026 Ronen Mars.
