# Threadbase Mobile

Threadbase Mobile is a local-first mobile control plane for AI coding agents. It connects to your own `tb-streamer` instance so you can monitor live Claude Code and Codex sessions, view terminal output, queue prompts, search conversation history, and receive push notifications from anywhere.

Threadbase does not host or inspect your session content. Your prompts, terminal output, history, and provider metadata go only to the streamer URL you configure.

🌐 **Learn more:** https://threadbase.sh

## 🚀 Install

Download the latest beta of Threadbase Mobile for iOS and Android:

👉 https://threadbase.sh/betas

## ⚡ Quick Start

1. Install Threadbase Mobile from https://threadbase.sh/betas
2. Install and start [`tb-streamer`](https://github.com/RonenMars/threadbase-streamer) on the machine running your AI coding agents.
3. Run:

```bash
tb-streamer pair
```

4. Scan the QR code from the app
5. Monitor and control your AI coding agents

## ✨ Features

- 📡 **Live session monitoring** — real-time status via WebSocket (running, waiting for input, completed, failed, idle)
- 🤖 **Multi-provider support** — monitor, search, and control AI coding-agent sessions across supported providers, including Claude Code and Codex.
- 🖥️ **Terminal viewer** — embedded VT100 emulator, strips Claude Code TUI decorations
- 💬 **Prompt queue** — queue and submit prompts to active sessions remotely
- 🔍 **Conversation history** — browse and full-text search indexed history from connected streamers
- 🗂️ **Multi-server support** — manage multiple Threadbase streamer instances from one mobile app
- 🔔 **Push notifications** — alerts for input-needed / completed / failed sessions, with quiet hours
- 📷 **QR-code pairing** — add a server by scanning a QR code, or enter URL + API key manually
- 🔒 **Local-first privacy** — no product analytics or behavioral telemetry, opt-in crash reporting that's off by default, and credentials stored locally in SecureStore

## 🛠️ Tech Stack

Expo 57 · React Native 0.83.6 · React 19 · Expo Router · Zustand · TanStack Query · NativeWind 4 · FlashList · Reanimated 4 · TypeScript (strict)

## 📋 Prerequisites

- Node.js ≥ 22.13
- Xcode 16+ and CocoaPods (iOS)
- A running `tb-streamer` instance on your own machine, with an API key configured

## ⚙️ Setup

```bash
npm install                  # also wires up git hooks
cd ios && pod install && cd ..
cp .env.example .env         # optional dev defaults, see below
```

| Env var | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_DEFAULT_SERVER_URL` | `http://localhost:8766` | Pre-filled URL in onboarding. For the easiest setup (local or production), run `tb-streamer pair` and use the URL it prints, or scan the QR code it displays from your device. |
| `EXPO_PUBLIC_DEFAULT_API_KEY` | `tb_api_sample` | Pre-filled API key in onboarding |

Runtime server URL/key are entered by the user and stored in SecureStore, not `.env`.

## 📱 Running

```bash
npm start        # Metro bundler
npm run ios       # build & launch on simulator
npm run android
```

For physical devices or off-network dev, see `docs/dev-on-physical-device-ios.md`, `docs/dev-on-physical-device-android.md`, and `docs/remote-dev-tunnel.md`.

**Web (early spike, not full parity):** `npx expo start --web`. See [docs/expo-web-support.md](docs/expo-web-support.md) for status and known blockers.

On first launch, add a server via QR scan or manual entry during Onboarding.

## 📁 Project Structure

```
app/            Expo Router screens (file-based routing)
components/     UI components, grouped by feature
stores/         Zustand stores (servers, sessions, settings)
services/       API client, WebSocket manager, VT100 emulator, push, pairing
hooks/          Custom React hooks
types/api.ts    API type definitions
ios/            Native iOS project (CocoaPods)
```

## 🏗️ Architecture

**State** is split three ways: Zustand for app state (servers, queues, settings), TanStack Query for server data (cached in AsyncStorage), and local `useState` for ephemeral UI state. A singleton `wsManager` (`services/ws-client.ts`) pushes WebSocket events straight into the React Query cache, so components re-render automatically.

Every data structure is keyed by `serverId` to support multiple Threadbase servers at once.

Threadbase treats coding-agent sessions through a provider-aware API. The mobile app keys data by `serverId` and displays normalized session/history data from providers supported by the connected streamer. Provider metadata is surfaced in the UI where relevant, so users can distinguish Claude Code, Codex, and future agent sessions.

Terminal output is rendered by a minimal VT100 emulator (`services/virtual-terminal.ts`): it parses ANSI escape sequences into a character grid, strips Claude Code's TUI decorations, and exposes plain text lines.

Threadbase Mobile stores configured servers locally on the device. Multi-server support means one mobile device can connect to multiple streamer instances.

## 🌐 Threadbase Ecosystem

Threadbase Mobile is one client in the Threadbase ecosystem:

- [`threadbase-streamer`](https://github.com/RonenMars/threadbase-streamer) — local runtime, REST API, WebSocket streaming, pairing, session control
- [`threadbase-scanner`](https://github.com/RonenMars/threadbase-scanner) — local conversation indexing and full-text search
- [`threadbase-mobile`](https://github.com/RonenMars/threadbase-mobile) — iOS/Android client for monitoring and controlling sessions
- [`threadbase-electron`](https://github.com/RonenMars/threadbase-electron), [`threadbase-vscode`](https://github.com/RonenMars/threadbase-vscode), [`threadbase-intellij`](https://github.com/RonenMars/threadbase-intellij) — desktop and IDE clients

## 🧪 Testing

```bash
npm test               # Jest watch mode
npm run test:ci        # CI mode
npm run test:e2e:mock  # Maestro E2E against a mock server (see e2e/)
```

Maestro E2E needs `brew install maestro` and the app built once via `npm run ios`.

## ✅ Code Quality

```bash
npm run lint
npm run typecheck
```


## 🗺️ Roadmap & Backlog

- [docs/ROADMAP.md](docs/ROADMAP.md) — planned features
- [docs/BACKLOG.md](docs/BACKLOG.md) — open bugs
- [docs/IDEAS.md](docs/IDEAS.md) — unprioritized ideas
- [docs/lessons/](docs/lessons/) — hard-won gotchas
- [docs/expo-web-support.md](docs/expo-web-support.md) — web platform status and known blockers

## 🔐 Privacy

Threadbase is a thin client for self-hosted streamers, with no product analytics, tracking, or behavioral telemetry. Session content, prompts, provider metadata, and status events go only to the streamer URL you configure. Expo push tokens go to Expo's relay and to each paired streamer (for notification delivery). Removing a server in Settings revokes its push token; uninstalling the app deletes everything stored locally.

Optional, opt-in crash reporting (Sentry) is **off by default**. When you enable it in Settings, only sanitized technical metadata and scrubbed error traces are sent — never prompts, terminal output, source code, credentials, server addresses, or session content. IP addresses are excluded both in the app and at the reporting service. User-initiated feedback (with an optional screenshot and diagnostics you choose to include) is sent only when you submit it. See the full policy for details.

Full policy: <https://threadbase.sh/privacy> · Proposed update: [`docs/privacy-policy/proposed-privacy-policy.md`](docs/privacy-policy/proposed-privacy-policy.md)

## 📄 License

[MIT](LICENSE) © 2026 Ronen Mars.
