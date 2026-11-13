# Threadbase features

Each line is tagged `[shipped]` (works out of the box), `[operator-enabled]` (needs the streamer operator to turn on a flag or supply credentials), `[server-only]` (implemented on the streamer with no mobile UI yet), or `[partial]` (limited, incomplete, or provider-specific). This list describes `main` as of 2026-09-05.

## Mobile app

- [shipped] Live session view — watch a running Claude Code or Codex session in real time, in raw terminal or parsed chat view.
- [shipped] Live working indicator — the chat view shows a working scanner for every live turn, on Claude Code as well as Codex.
- [shipped] Real-viewport terminal — the terminal decodes at the session's actual viewport height, so a session resized from an attached terminal still renders correctly.
- [shipped] Remote prompt input — send prompts, slash commands, and interrupts to a live session from the phone.
- [shipped] Session board — switch the Home list to columns of session states, answer a session's pending question from its card, and open its sub-agents.
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
- [shipped] Favorites sync — saved sessions, conversations, and project chats are also kept on the streamer, so every phone paired with it shows the same list; needs a streamer that serves `/api/saved-items`.
- [shipped] Export conversation — share a full transcript as Markdown.
- [shipped] Draft persistence — unsent composer text is saved per session.
- [shipped] Attach photos and files to a prompt — camera, photo library, or file picker, with HEIC converted to JPEG.
- [shipped] Voice dictation — on-device speech-to-text for composing prompts.
- [shipped] Diff review — view file changes from a session and send a review note back into it.
- [operator-enabled] iOS Live Activities — lock-screen/Dynamic Island session status; requires the streamer operator to enable a flag and configure APNs.
- [shipped] Android session notification — ongoing notification showing live session status.
- [shipped] Push notifications — alerts when an agent is waiting for input, completes, or fails. Android delivery has not been verified on a device yet ([BACKLOG.md](./BACKLOG.md#leftovers-from-partly-shipped-features)).
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

- [shipped] Self-hosted daemon — runs on your own machine and streams sessions to the phone, with no Threadbase-run server in between unless the optional relay is on.
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
- [operator-enabled] Threadbase relay — stable streamer releases keep it off, and session traffic then goes directly to your own streamers. With the streamer's `relay` flag on, the app uses the relay when your own addresses cannot be reached, end-to-end encrypted, and a per-server switch turns it off.
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

### GitHub Copilot CLI

Select **Copilot** when starting a session on a streamer that advertises the installed `copilot` CLI. Live terminal input/output and native resume are supported; trust and permission prompts are handled in the terminal. Copilot stays unavailable on older streamers. Bulk Copilot history indexing, structured question cards, and model/effort controls are not included in this integration.

## Completed roadmap and backlog items

Items moved here from [ROADMAP.md](./ROADMAP.md) and [BACKLOG.md](./BACKLOG.md) once they shipped, re-verified against `main` on 2026-11-02.
One line each; the full original entry is in git history (`git show 500e37e3:docs/ROADMAP.md`, `git show 500e37e3:docs/BACKLOG.md`).
For a partly shipped feature, the unfinished part is in [BACKLOG.md](./BACKLOG.md#leftovers-from-partly-shipped-features).

### Roadmap features

- 2026-04-23 to 2026-05-11 — Splash animation, Projects Hub redesign, server list redesign, adopt discovered session, CardShell, Maestro E2E setup, NativeWind wave 1, server headers (Hub, Classic, Tree), i18n, PTY turn divider, Quick Access strip, session naming, theming, server drag-and-drop reordering. Plans in [`superpowers/plans/archive/`](./superpowers/plans/archive/).
- Feature 1 — Tree view pre-fills the new-session path with the drilled directory (PR #11, `9835ecf`).
- Feature 2 — Export moved from the history bottom bar into the info shelf (PR #11, `9835ecf`).
- Feature 3 — Several files attached to one message (`services/uploads.ts`, `hooks/useComposerState.ts`).
- Feature 4 — Store deploy workflow for the App Store and Google Play (`.github/workflows/deploy.yml`, fastlane; started by hand) ([#602](https://github.com/RonenMars/threadbase-mobile/issues/602)).
- Feature 5 — Onboarding polish, including the `tb pair` exchange (`hooks/useTBPair.ts`) and the notifications step (`NotificationsStep.tsx`) ([#605](https://github.com/RonenMars/threadbase-mobile/issues/605)).
- Feature 6 (part) — Cross-session search with two-line snippet previews (PR #778) and tap-to-jump to the matching message (`lib/conversationHref.ts`, [anchored-search runbook](./anchored-search-runbook.md)).
- Feature 12 — Live Activities and Dynamic Island (iOS ActivityKit) with an Android ongoing-notification fallback ([#636](https://github.com/RonenMars/threadbase-mobile/issues/636)).
- Feature 13 — Mission Control, shipped as the Session Board: web `/board` (PR #1275) and the mobile home-screen board (PR #1322), with Needs you / Working / External / Earlier columns, per-column counts (`components/sessions/board/BoardChips.tsx`), answering a question from a card (`BoardQuestionModal.tsx`) and the row menu on long-press.
- Feature 14 (part) — Voice dictation in the composer (`expo-speech-recognition`, `e2e/voice_dictation.yaml`).
- Feature 17 (part) — Maestro suite grown to 19 flows.
- Feature 18 — Expo SDK 56 upgrade (TestFlight build 104; React Compiler re-enabled in 106). The app has since moved to SDK 57.
- Feature 20 (part) — Reference screenshots for visual regression.
- Feature 21 — Tree drill rows render as full Hub/Classic rows (`components/sessions/tree/DrillView.tsx`).
- Feature 22 — Settings gear on the Filter & Sort bar (`components/servers/FilterSortSheet.tsx`, PR #298).
- Feature 24 — "Add to favorites" call to action on the empty Manage Favorites screen (`app/manage-favorites.tsx`).
- Feature 25 (part) — Zero react-hooks v5 lint warnings in CI.
- Feature 26 (part) — Precompiled XCFrameworks enabled.
- Feature 30 (part) — Native modules bumped for the ship-121 warnings.
- Feature 32 — Batched `conversation_events` WebSocket frame handled (`hooks/useConversationStream.ts`).
- Feature 33 — Stale `demo-server-*.yaml` flows repaired (#538, #541).
- Feature 34 (part) — Structured prompt cards for Codex, streamer side (threadbase-streamer PR #1050).
- Feature 35 — Crash-reporting consent model: one-shot reports self-init and tear down (`services/sentry.ts`).
- Feature 36 (part) — 13 of 34 privacy checklist items done ([#601](https://github.com/RonenMars/threadbase-mobile/issues/601)).
- Sentry Mobile Builds — size tracking adopted: `sentry-cli build upload` in `scripts/archive-and-upload.sh` and `scripts/ship-android.sh`; build distribution stays with TestFlight and Play.

### Backlog bugs

- Bug 1 — Loader on conversation open stops the flicker (`7e197ab`).
- Bug 3 — Quick Access strip loads its items (`eea502d`).
- Bug 4 — Smooth scroll-to-end on long conversations (`78218fb`).
- Bug 5 — Multi-attachment send escapes paths (`hooks/useComposerState.ts`).
- Bug 6 — Conversation content no longer hidden under the bottom bar (PR #11, `9835ecf`).
- Bug 7, Bug 9, Bug 26, Bug 29 — Quick Access became a Favorites-only strip; the pencil shows only when expanded and non-empty; no chevron (`c43e9a1`, `QuickAccessStrip.tsx`).
- Bug 8 — Manage Favorites has a single native header.
- Bug 10, Bug 11 — Top and Bottom scroll buttons appear only when useful (`384790c`).
- Bug 12 — MessageBubble bleed and code-fence collapse fixed (recorded as `cdf0303`, `d3aec11`, `f58d74d`, `1a020fb`; those commits are not in the current history).
- Bug 13 — Replaced: the create and exit name modals were removed (`6c138c8`).
- Bug 14, Bug 15 — New session no longer leaves the file browser in the stack (`0909404`).
- Bug 16 — Replaced by the session leave policy (`hooks/useSessionLeaveGuard.ts`, `lib/sessionLeavePolicy.ts`).
- Bug 17 (part) — Scroll-to-bottom uses `maintainVisibleContentPosition` (`LiveConversationView.tsx`, `ConversationHistoryList.tsx`).
- Bug 18 — `server_drag_reorder` flow wired into the mock suite.
- Bug 19 — Closed: the flow was deleted as unrun.
- Bug 21 — Recents removed; stale favorites are evicted on 404 with a recovery action.
- Bug 22 — Settings QR scanner button opens the scanner (`app/settings.tsx`, `e2e/settings_qr_scanner.yaml`).
- Bug 23, Bug 24 — Obsolete: the Popular tab was removed.
- Bug 25 — Moved to the roadmap as Feature 22, now shipped.
- Bug 27 — Moved to the roadmap as Feature 23 (still planned).
- Bug 28 — Pull-to-refresh modal falls back to IP and port (`components/sessions/shared/serverDisplayName.ts`).
- Bug 30 — Add, remove and reorder favorites, persisted (`stores/quickAccess.ts`).
- Bug 32 — One unavailable server no longer hides every server's conversations (`1ec1686`).
- Bug 33 — Browse-to-session navigation simplified (`app/browse.tsx`).
- Issue 1 — Cached Hub list shows a refresh indicator instead of flashing (`2a3e6d8`, #326).
