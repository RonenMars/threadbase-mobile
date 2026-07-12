# Threadbase Mobile Production Test Plan

**Status:** Draft  
**Date:** 2026-07-07  
**Scope:** Production readiness test plan for Threadbase Mobile on iOS and Android.

## 1. Purpose

This plan verifies that Threadbase Mobile is ready for production use as a local-first mobile control plane for AI coding-agent sessions. The app must let a developer pair a phone with one or more `tb-streamer` runtimes, monitor Claude Code and Codex sessions, inspect terminal and conversation output, send follow-up prompts, answer interactive questions, stop sessions, search history, receive notifications, and recover cleanly from network or app lifecycle changes.

The plan is written for production-like builds and production-like infrastructure. Mock tests remain useful for CI smoke coverage, but release acceptance requires real-device or simulator validation against at least one live `tb-streamer` instance.

## 2. Source Baseline

This plan is based on:

- Product positioning and feature surface from `https://threadbase.sh/`: local streamer pairing, mobile session control, multi-server pairing, push notifications, native prompt cards, offline/resume behavior, Claude Code and Codex support.
- `README.md`: local-first privacy, multi-provider support, WebSocket status, terminal viewer, prompt queue, conversation history, multi-server support, QR/manual pairing, push notifications, SecureStore credential storage.
- `CLAUDE.md`: Maestro E2E conventions, release-build testing, lint/typecheck gates, shipping constraints.
- `docs/e2e-testing.md` and `e2e/README.md`: current Maestro setup, release-build requirement, mock/demo/prod E2E scripts, known E2E constraints.
- `docs/server-state-scenarios.md`: current hub connectivity behavior, stale-cache display, loading overlay, status modal, no-server and degraded-server states.
- `docs/conversation-rendering-logic.md` and `docs/single-session-rendering-logic.md`: live vs. historical conversation rendering, structured content blocks, terminal output, question cards, session-detail state machine.
- `docs/superpowers/specs/2026-06-05-onboarding-redesign.md`: onboarding and pairing workflow intent.
- `docs/superpowers/specs/2026-06-19-structured-askuserquestion-design.md`: structured question-card workflow and fallback behavior.
- `docs/superpowers/specs/2026-06-19-stop-session-client.md`: stop-session behavior and acceptance expectations.
- `docs/superpowers/specs/2026-07-02-resume-refetch-indicator-design.md` and `docs/superpowers/specs/2026-07-03-sync-cached-notice-design.md`: app-resume refetch behavior and cached-data notice.
- `docs/app-review-demo-setup.md` and `docs/deployment.md`: store-review demo needs and release pipeline expectations.

## 3. Assumptions

- Production users install a signed release build from TestFlight, Google Play testing, or production store distribution.
- A production-equivalent `tb-streamer` is available on a reachable host through same Wi-Fi, VPN, or another explicitly supported network path.
- Session content is sensitive developer data. Tests must verify local-first routing and credential storage, but must not upload private project content to third-party services except Expo push token relay where explicitly required for notifications.
- Claude Code support is the mature baseline. Codex support must cover history reading and starting new sessions, while any known product gaps should be tested as explicit limitations rather than hidden failures.
- Current hub behavior intentionally uses header cloud dots and `ServerStatusModal` for degraded connectivity instead of inline banners. Acceptance criteria below assert the current behavior unless a linked feature changes it.

## 4. Test Environment

| Area | Requirement |
|---|---|
| Builds | Signed iOS release build and signed Android release build. Debug/dev-launcher builds are not valid for production acceptance. |
| Devices | At least one recent iPhone, one iOS simulator supported by Maestro, one Android physical device or emulator. |
| Streamers | One live macOS streamer, one second streamer on another machine or port, and one deliberately unreachable/stopped streamer. |
| Providers | Claude Code session corpus, Codex CLI session corpus, and one active live session for each provider where supported. |
| Network | Same LAN, VPN or tunnel path, airplane-mode/offline, app background/foreground, and streamer restart scenarios. |
| Test data | Sample projects with short prompts, long-running prompts, tool-use prompts, terminal-heavy output, code blocks, diffs, images/attachments where supported, and conversations with enough history for search and pagination. |
| Accounts | App Store/Play reviewer demo credentials where store submission is in scope. |

## 5. Entry Criteria

- Release build installs and launches on target iOS and Android devices.
- At least one `tb-streamer` instance is running with a valid API key and reachable URL.
- Push notification entitlements and platform credentials are configured for release builds.
- `npm run lint`, `npm run typecheck`, and `npm run test:ci` are green on the release candidate branch.
- `npm run test:e2e:mock` is green on a supported booted iOS simulator.
- Known product limitations are documented in release notes or internal QA notes before exploratory testing starts.

## 6. Exit Criteria

- All P0 and P1 test cases in this plan pass on iOS.
- All P0 test cases and platform-relevant P1 cases pass on Android.
- No open P0/P1 defects remain unresolved or untriaged.
- Store-review demo path is verified from a clean install using exactly the credentials and instructions that will be provided to reviewers.
- Privacy/security checks confirm session content, prompts, history, provider metadata, and configured API keys are only sent to configured streamer endpoints, except push token delivery through Expo relay.
- Release candidate has a documented sign-off with build number, platform, devices, streamer version, and test date.

## 7. Requirements

| ID | Requirement |
|---|---|
| R1 | Users can complete first-run onboarding and pair a streamer by QR scan or manual URL/token entry. |
| R2 | Credentials and configured servers persist locally and survive app relaunch without exposing secrets in UI or logs. |
| R3 | Users can monitor live Claude Code and Codex sessions with accurate running, waiting, idle, failed, and loading states. |
| R4 | Users can browse projects, sessions, and conversation history across one or more streamers. |
| R5 | Users can start a new session from mobile in a selected project/directory and selected provider where supported. |
| R6 | Users can send prompts and follow-ups to an active session and see optimistic and streamed updates without duplicate or reordered messages. |
| R7 | Terminal output renders readable VT100 output, code blocks, diffs, tool calls, thinking blocks, and long output without layout corruption. |
| R8 | Users can answer interactive prompt cards reliably, with structured questions preferred and PTY fallback still functional. |
| R9 | Users can stop or cancel live sessions with correct confirmation, in-flight state, and status refresh. |
| R10 | Multi-server users can switch, filter, and inspect server health, including partial outage states and hidden-server behavior. |
| R11 | Offline, reconnect, app resume, and background refresh states preserve cached data and show the correct loading or cached-data signals. |
| R12 | Push notifications arrive for input-needed, completed, and failed sessions, respecting quiet-hours/settings behavior. |
| R13 | Search and history browsing return relevant conversation/session data and navigate to the correct detail view. |
| R14 | Store-review and public demo flows allow a reviewer to connect, create a session, send a message, and inspect output from a clean install. |
| R15 | Release builds meet production quality gates: no crash on core flows, no obvious performance regressions, accessible tap targets, and no app UI emojis in newly touched surfaces. |
| R16 | Local-first privacy is preserved: no analytics/telemetry, no unintended content relay, and server removal revokes push registration where supported. |

## 8. Test Suites

| Suite | Name | Priority | Coverage |
|---|---|---|---|
| TS1 | Onboarding and Pairing | P0 | R1, R2, R14 |
| TS2 | Hub, Server State, and Multi-Server | P0 | R3, R4, R10, R11 |
| TS3 | Session Lifecycle and Control | P0 | R3, R5, R6, R8, R9 |
| TS4 | Conversation, Terminal, and Rendering | P0 | R6, R7, R13 |
| TS5 | Offline, Resume, and Recovery | P0 | R10, R11 |
| TS6 | Notifications | P1 | R12, R16 |
| TS7 | Search, History, and Navigation | P1 | R4, R13 |
| TS8 | Privacy, Security, and Data Handling | P0 | R2, R16 |
| TS9 | Release, Store Review, and Cross-Platform | P0 | R14, R15 |
| TS10 | Non-Functional Production Quality | P1 | R15 |

## 9. Test Cases

Detailed test cases are split into suite-level files. Start with the [production test suites index](production-test-suites/index.md), or open a suite directly below. Each suite file includes a test-case table followed by detailed preconditions, steps, expected results, and acceptance criteria.

| Suite | Name | Priority | Coverage | Test cases |
|---|---|---|---|---|
| TS1 | Onboarding and Pairing | P0 | R1, R2, R14 | [Open suite](production-test-suites/ts1-onboarding-and-pairing.md) |
| TS2 | Hub, Server State, and Multi-Server | P0 | R3, R4, R10, R11 | [Open suite](production-test-suites/ts2-hub-server-state-and-multi-server.md) |
| TS3 | Session Lifecycle and Control | P0 | R3, R5, R6, R8, R9 | [Open suite](production-test-suites/ts3-session-lifecycle-and-control.md) |
| TS4 | Conversation, Terminal, and Rendering | P0 | R6, R7, R13 | [Open suite](production-test-suites/ts4-conversation-terminal-and-rendering.md) |
| TS5 | Offline, Resume, and Recovery | P0 | R10, R11 | [Open suite](production-test-suites/ts5-offline-resume-and-recovery.md) |
| TS6 | Notifications | P1 | R12, R16 | [Open suite](production-test-suites/ts6-notifications.md) |
| TS7 | Search, History, and Navigation | P1 | R4, R13 | [Open suite](production-test-suites/ts7-search-history-and-navigation.md) |
| TS8 | Privacy, Security, and Data Handling | P0 | R2, R16 | [Open suite](production-test-suites/ts8-privacy-security-and-data-handling.md) |
| TS9 | Release, Store Review, and Cross-Platform | P0 | R14, R15 | [Open suite](production-test-suites/ts9-release-store-review-and-cross-platform.md) |
| TS10 | Non-Functional Production Quality | P1 | R15 | [Open suite](production-test-suites/ts10-non-functional-production-quality.md) |

## 10. Automation Strategy

| Layer | Command or Tool | Purpose | Release Gate |
|---|---|---|---|
| Static quality | `npm run lint` | ESLint on TypeScript/React Native code | Required |
| Types | `npm run typecheck` | Strict TypeScript validation | Required |
| Unit/integration | `npm run test:ci` | Jest coverage for hooks, stores, rendering, parser behavior | Required |
| Mock E2E | `npm run test:e2e:mock` | Fast Maestro smoke on release build with local mock server | Required for iOS RC |
| Production E2E | `npm run test:e2e:prod` | Maestro against production-equivalent server credentials | Required before store review when env is available |
| Demo E2E | `npm run test:e2e:demo` | Reviewer/demo credential validation | Required before App Review / Play review |
| Exploratory | Manual device matrix | Push, camera QR, network loss, real PTY, store build behavior | Required |
| Traffic audit | Proxy/router/device logs | Local-first and privacy validation | Required for production release |

## 11. Requirements Traceability Matrix

| Requirement | Primary test cases | Automation target | Acceptance owner |
|---|---|---|---|
| R1 Pairing | TC-TS1-001, TC-TS1-002, TC-TS1-003, TC-TS9-001 | Maestro demo/prod | QA + Product |
| R2 Credential persistence | TC-TS1-001, TC-TS1-002, TC-TS8-002 | Manual + Jest store tests | QA |
| R3 Session monitoring | TC-TS2-001, TC-TS2-003, TC-TS3-001, TC-TS3-002 | Maestro mock/prod | QA |
| R4 Browse projects/history | TC-TS2-001, TC-TS7-001, TC-TS7-002 | Maestro mock | QA |
| R5 Start session | TC-TS3-001, TC-TS3-002, TC-TS9-001 | Maestro prod/demo | QA + Product |
| R6 Send prompts | TC-TS3-003, TC-TS4-001, TC-TS5-002 | Maestro prod + manual | QA |
| R7 Rendering | TC-TS4-001, TC-TS4-002, TC-TS4-003, TC-TS10-001 | Jest + manual | QA |
| R8 Prompt cards | TC-TS3-004, TC-TS4-002 | Jest + live manual | QA + Engineering |
| R9 Stop session | TC-TS3-005, TC-TS5-003 | Manual + future Maestro | QA |
| R10 Multi-server resilience | TC-TS2-003, TC-TS2-004, TC-TS5-003 | Manual + future Maestro | QA |
| R11 Offline/resume/cache | TC-TS5-001, TC-TS5-002, TC-TS2-003 | Manual + Jest AppState tests | QA |
| R12 Notifications | TC-TS6-001, TC-TS6-002 | Manual device test | QA + Product |
| R13 Search/history | TC-TS7-001, TC-TS7-002, TC-TS4-003 | Maestro mock/prod | QA |
| R14 Store-review demo | TC-TS9-001, TC-TS1-002 | Maestro demo/prod | Release owner |
| R15 Production quality | TC-TS9-002, TC-TS9-003, TC-TS10-001, TC-TS10-002 | CI + manual | Release owner |
| R16 Privacy/security | TC-TS8-001, TC-TS8-002, TC-TS6-001 | Manual audit | Release owner |

## 12. Defect Severity

| Severity | Definition | Examples |
|---|---|---|
| P0 Blocker | Prevents production release or exposes sensitive data. | Pairing cannot complete, session prompts go to wrong server, app crashes on launch, unintended telemetry of session content. |
| P1 Critical | Core workflow degraded with no acceptable workaround. | Live session cannot send prompts, stop-session leaves UI stuck, push deep links open wrong session. |
| P2 Major | Important workflow issue with workaround or limited scope. | Hidden-server loading label confusion, stale data lacks clear notice in one layout, search ordering confusing. |
| P3 Minor | Polish, copy, or low-risk usability issue. | Non-blocking animation glitch, minor copy mismatch, redundant loading indicator. |

## 13. Production Sign-Off Template

Use this template for each release candidate:

```markdown
## Release Candidate QA Sign-Off

- App version:
- iOS build number:
- Android version code:
- Commit SHA:
- Streamer version:
- Test date:
- iOS devices/simulators:
- Android devices/emulators:
- Test suites completed:
- P0 defects:
- P1 defects:
- Waivers / known limitations:
- Store-review demo credentials verified: yes/no
- Privacy traffic audit completed: yes/no
- Sign-off:
```
