# Threadbase features

Each line is tagged `[shipped]` (works out of the box), `[operator-enabled]` (needs the streamer operator to turn on a flag or supply credentials), `[server-only]` (implemented on the streamer with no mobile UI yet), or `[partial]` (limited, incomplete, or provider-specific). This list describes `main` as of 2026-09-05.

## Mobile app

- [shipped] Live session view — watch a running Claude Code or Codex session in real time, in raw terminal or parsed chat view.
- [shipped] Live working indicator — the chat view shows a working scanner for every live turn, on Claude Code as well as Codex.
- [shipped] Real-viewport terminal — the terminal decodes at the session's actual viewport height, so a session resized from an attached terminal still renders correctly.
- [shipped] Remote prompt input — send prompts, slash commands, and interrupts to a live session from the phone.
- [shipped] Remote keyboard controls — send Esc, Tab, Shift+Tab, and arrow-key navigation to a live session, with a hold-to-confirm Enter.
- [shipped] Resume a conversation into a live session — continue a past conversation live, with take-over/fork/force handling if it's already busy elsewhere.
- [partial] Fork a session — clone a conversation into a new session; Codex only, not available for Claude Code.
- [shipped] Forked-session history — a fork shows the conversation it continues, with a marked seam where the inherited history ends; needs streamer 1.84 or newer.
- [shipped] Open the conversation a fork continues — jump from a fork to its parent as it stands now, not just the inherited prefix.
- [shipped] Adopt an externally started session — take over and control a session that was launched from a normal terminal.
- [partial] Tool approval and permission prompts — approve single-select gates and questions from the phone; multi-question and multi-select forms aren't answerable yet.
- [shipped] Cross-session search — full-text search across a server's conversations with highlighted matches.
- [shipped] In-conversation search — search within an open conversation with next/previous match stepping.
- [shipped] Session and project browsing — grouped hub views, directory drill-down, and new-session creation from any folder.
- [shipped] Multi-server pairing — pair with multiple streamers by QR code, deep link, or manual entry, and switch between them.
- [shipped] Multi-provider support — Claude Code and Codex CLI sessions side by side, with per-provider health and capability differences shown.
- [shipped] Session rename — rename manually, or auto-name a session from its first message.
- [shipped] Favorites and quick access — pin sessions, conversations, or project chats for one-tap access.
- [shipped] Export conversation — share a full transcript as Markdown.
- [shipped] Prompt queue — queue additional prompts while the agent is busy.
- [shipped] Draft persistence — unsent composer text is saved per session.
- [shipped] Attach photos and files to a prompt — camera, photo library, or file picker, with HEIC converted to JPEG.
- [shipped] Voice dictation — on-device speech-to-text for composing prompts.
- [shipped] Diff review — view file changes from a session and send a review note back into it.
- [operator-enabled] iOS Live Activities — lock-screen/Dynamic Island session status; requires the streamer operator to enable a flag and configure APNs.
- [shipped] Android session notification — ongoing notification showing live session status.
- [shipped] Push notifications — alerts when an agent is waiting for input, completes, or fails.
- [shipped] Resilient sessions — leaving or backgrounding the app parks the session instead of killing it.
- [shipped] Claude CLI flag configuration — set model, permission mode, add-dir, and allowed/disallowed tools per server.
- [shipped] Backup and restore — export a server's session/project metadata and restore it elsewhere, with a dry-run preview.
- [shipped] Cache-integrity alerts — get notified and resolve drift between the local cache and disk.
- [shipped] Host-pressure indicator — see when a paired machine is under CPU/memory pressure.
- [shipped] Server health and diagnostics — per-server connectivity/provider/cache checks with shareable reports.
- [shipped] Notification health — see push-token delivery status and re-register.
- [shipped] Paired-device management — view and revoke devices paired to a server, by capability scope.
- [shipped] Biometric app lock — require Face ID, Touch ID, or Android biometrics to unlock the app.
- [shipped] In-app feedback — submit bug reports and feature requests with an optional screenshot and diagnostics.
- [shipped] Localization — English, Hebrew, Arabic, and Russian, with reload-free RTL switching.
- [shipped] Display customization — themes and layout/density preferences for sessions and conversations.

## Streamer

- [shipped] Self-hosted daemon — runs on your own machine and streams sessions to the phone; no Threadbase-hosted relay in between.
- [shipped] Automatic session discovery — finds Claude Code and Codex sessions on the machine, including ones started outside the app.
- [shipped] Named CLI (`tb-streamer`) — serve, pair, identity, device management, cache maintenance, and update commands.
- [shipped] Install via npm or Homebrew — runs as a background service on macOS, Linux, or Windows.
- [shipped] Self-update — checks GitHub Releases and installs updates, deferring while sessions are active.
- [shipped] Session rehydration after restart — previously running sessions are seeded back into the session list automatically.
- [operator-enabled] Auto-resume on boot — resumes eligible sessions automatically at streamer startup; off by default.
- [operator-enabled] Separate PTY host process — keeps live terminals running across a streamer restart; off by default.
- [shipped] Remote access tunnel helper — a bundled Cloudflare quick-tunnel script and terminal UI for reaching the streamer off your LAN.
- [shipped] Live model / reasoning-effort switching — change the model or effort of a running Claude session from the phone.
- [shipped] Claude CLI flag registry — allowlisted per-server flag configuration (model, permission mode, tool allow/deny, budget).
- [shipped] Automatic cache backups — WAL-safe snapshots of the local session cache taken before repairs.
- [partial] Menubar tray app — a separate Electron app showing streamer health and a log viewer; not installed or launched by the streamer itself.

## Security & privacy

- [shipped] End-to-end encryption — a Noise-protocol handshake (X25519 + ChaCha20-Poly1305) secures phone-to-streamer traffic by default, with a downgrade lock once paired.
- [shipped] No hosted relay — session traffic goes directly to your own streamers; nothing routes through a Threadbase-run server.
- [shipped] Per-device credentials and capability scopes — each paired device gets its own token limited to specific permissions, viewable and revocable from the phone.
- [shipped] Out-of-band identity verification — compare a server's key fingerprint to confirm you're pairing with the right machine.
- [shipped] Secure credential storage — API keys and encryption keys are stored in the iOS Keychain or Android Keystore.
- [shipped] Minimal push payloads — ordinary notifications carry only a project name and session identifiers, never prompts or output.
- [shipped] Anonymous diagnostics — opt-in crash reports and stability data with a random installation ID; off by default. A JS-layer sanitizer strips prompts, output, credentials, hostnames, and paths before anything is sent.
- [shipped] Disabling anonymous diagnostics deletes the anonymous install ID.
- [shipped] No advertising, tracking, or product-analytics SDKs — no automatic capture of screens, console output, or network requests.
- [shipped] Screenshots are never automatic — feedback screenshots are user-picked, re-encoded, and stripped of metadata.
- [shipped] Cleartext-traffic policy — plain HTTP is only permitted to local/private-network addresses, never the open internet.

## Platform support

- [shipped] iOS app — distributed via TestFlight.
- [shipped] Android app — distributed via Google Play closed testing.
- [shipped] macOS streamer — runs as a launchd service; installable via Homebrew or npm.
- [shipped] Linux streamer — runs as a systemd service; the Homebrew bottle is x86_64 only.
- [shipped] Windows streamer — runs via Task Scheduler.

## Known caveats

The Electron, VS Code, and IntelliJ surfaces mentioned elsewhere are not part of the mobile or streamer repos.
iOS Live Activities require the streamer operator to enable a feature flag and supply APNs credentials.
Multi-question and multi-select approval forms cannot be answered from the phone yet.
