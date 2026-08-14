# Threadbase — Main Disadvantages and Pain Points

This document consolidates the full list of disadvantages and pain points identified when comparing Threadbase with Tactic Remote and Orca.

## Top 10 disadvantages

### 1. Live sessions are not durable enough

Threadbase-managed PTYs live inside the streamer process. Restarting the streamer drops them, and when the final WebSocket subscriber disconnects, the default behavior may interrupt the session after a grace period and place it on hold.

This conflicts with the main remote-agent use case: start a long task, leave the computer, lose connectivity, and trust that it continues.

**User pain:** “Will my agent keep working when my phone sleeps, changes networks, or disconnects?”

---

### 2. Core mobile workflows still feel beta-quality

The current experience includes unresolved problems around:

- Starting new sessions
- Returning from the file browser
- Sessions becoming interaction-locked
- “Session not found” errors
- QR scanner actions
- Directory-loading failures
- Multi-attachment behavior
- Long-list performance

Several of these affect the main path from browsing a project to starting, monitoring, and reopening a session.

**User pain:** “I cannot fully trust the main workflow without encountering confusing states or restarting the app.”

---

### 3. Threadbase is weaker as an immediate, polished product

Tactic Remote and Orca provide more coherent out-of-the-box experiences.

Threadbase currently requires users to understand more about:

- The streamer
- Public URLs
- Tunnels or VPNs
- API keys
- Pairing
- Server availability
- Provider behavior

**User pain:** “Why do I need to understand the infrastructure before I can remotely control my agent?”

---

### 4. The product position is unclear

Threadbase overlaps several categories:

- Remote terminal
- Mobile agent controller
- Conversation-history browser
- Search engine for agent sessions
- Multi-server control plane
- Orchestration platform
- Multi-agent system
- IDE companion ecosystem

The risk is becoming broad without being the best at one clearly defined job.

Threadbase’s strongest position is likely: **discover, index, search, and control sessions regardless of where they started**.

**User pain:** “Why should I use Threadbase instead of Orca, Tactic, tmux, or remote desktop?”

---

### 5. Terminal fidelity is limited

Threadbase Mobile uses a minimal VT100-style terminal reconstruction optimized for agent output. This creates compatibility risk with:

- Full-screen TUIs
- Interactive selectors
- Complex cursor movement
- Rich ANSI rendering
- New Claude or Codex interface changes
- Unsupported CLI agents
- General terminal tools

**User pain:** “The terminal works until the agent displays something Threadbase’s parser does not understand.”

---

### 6. Provider support is narrow compared with Orca

Threadbase has meaningful provider-aware support for Claude Code and Codex, but Orca supports virtually any CLI agent at the terminal level.

Threadbase therefore risks being perceived as a specialized Claude/Codex utility rather than universal infrastructure.

**User pain:** “I like Threadbase, but the next agent I adopt may not work with it.”

A practical direction is a generic terminal fallback plus deep semantic adapters for major providers.

---

### 7. It lacks a strong mobile code-review workflow

Tactic Remote and Orca support combinations of:

- Browsing source files
- Reviewing Git diffs
- Staging and committing changes
- Annotating changed lines
- Sending review notes back to agents
- Managing worktrees
- Inspecting project structure

Threadbase is focused more heavily on sessions, history, output, and prompts. Users may still need to return to their computer to verify what the agent changed.

**User pain:** “The agent says it finished, but Threadbase cannot yet give me enough confidence to approve its work from my phone.”

---

### 8. Existing-session discovery is promising but incomplete

Threadbase can detect external sessions and read their native history, but it cannot necessarily attach to the original PTY of a process it did not launch.

This means it may be able to observe an external session without fully controlling that exact live terminal.

**User pain:** “Threadbase found my session, but I cannot necessarily continue interacting with the original live process.”

The UI should clearly distinguish:

- Fully controlled managed session
- Live externally detected session
- Historical session with growing history
- Completed historical conversation

---

### 9. Multi-server support adds complexity before single-server UX is fully polished

Multi-server support creates difficult states:

- One server is offline
- Server URLs change
- Tunnel addresses expire
- Histories overlap
- Projects have similar names
- Notification tokens need revocation
- Search results need server identity
- Session IDs may collide
- Connectivity quality differs per server

**User pain:** “One broken or unavailable machine makes the whole interface harder to reason about.”

---

### 10. The project carries too much scope for its current resources

Threadbase includes or plans:

- Streamer
- Scanner
- Mobile app
- Electron app
- VS Code extension
- IntelliJ plugin
- Shared UI and core packages
- Multiple providers
- Push notifications
- Search and indexing
- Pairing and tunnels
- Multi-agent orchestration

This increases integration costs, platform-specific bugs, release overhead, protocol drift, and maintenance burden.

**User pain:** “The project has many impressive components, but the primary experience still needs refinement.”

---

## Additional disadvantages and strategic pain points

### 11. No obvious zero-configuration remote-access path

Users still need to understand which address the phone should use and whether it remains reachable.

- LAN access only works on the same network.
- Quick tunnels may use temporary addresses.
- Stable tunnels require configuration.
- VPN solutions add another product and account.

**User pain:** “It worked at home, but now I’m outside and the server is unreachable.”

---

### 12. Heavy dependence on unstable provider internals

Threadbase relies on native provider behavior such as:

- JSONL file locations and schemas
- Process arguments
- Session identifiers
- Prompt markers
- Terminal layouts
- Resume behavior
- Authentication behavior

These are not necessarily stable public interfaces.

**User pain:** “Claude or Codex updated, and now Threadbase no longer detects or renders sessions correctly.”

---

### 13. Session-status detection can be unreliable

States such as running, waiting for input, idle, completed, failed, and on hold may be inferred from terminal output, native history, markers, and timers.

These heuristics can produce false positives or stale state.

**User pain:** “Threadbase notified me that the task finished, but the agent was actually waiting for approval.”

Because notifications and remote supervision depend on accurate state, this is a correctness problem rather than a cosmetic one.

---

### 14. Session and conversation concepts may confuse users

Threadbase distinguishes between:

- Managed live sessions
- Externally discovered processes
- Historical conversations
- Resumed conversations
- On-hold sessions
- Projects
- Servers
- Providers

These distinctions are technically justified but difficult to communicate.

**User pain:** “Why do I see two entries for what feels like the same conversation?”

Threadbase needs a clear mental model and consistent terminology.

---

### 15. No strong conflict or concurrency model

Multiple clients may interact with the same session:

- Mobile
- Electron
- VS Code
- IntelliJ
- Another mobile device
- The original terminal

Unresolved questions include:

- Who owns keyboard input?
- What happens when two clients send prompts simultaneously?
- How are queued messages ordered?
- Can one client interrupt while another is typing?
- Which client controls terminal dimensions?
- What happens when local input races with a queued remote prompt?

**User pain:** “My phone sent a queued prompt after I had already answered from my computer.”

---

### 16. Security exposure is inherently high

The streamer can potentially:

- Start shell processes
- Send terminal input
- Browse directories
- Upload files
- Read conversation history
- Resume agents
- Expose paths and project metadata

A compromised endpoint could provide substantial access to the development machine.

Important risks include:

- Authentication accidentally disabled
- Leaked tunnel URLs or API keys
- Excessively broad filesystem access
- Insufficient rate limiting
- Weak revocation UX
- Forgotten paired devices
- Sensitive logs
- Upload or browse vulnerabilities

**User pain:** “Am I exposing remote shell-like control over my laptop to the internet?”

---

### 17. No granular permission model

A paired client is effectively highly trusted. Users may want permissions such as:

- Read-only monitoring
- Prompt submission without shell control
- Access to one project only
- History access without file browsing
- Notifications only
- Temporary guest access
- Per-device permissions

**User pain:** “I want to monitor a session from another device without granting it full control.”

---

### 18. Notification reliability is outside Threadbase’s full control

Push delivery depends on:

- Correct status detection
- The host remaining online
- Network connectivity
- Push relay availability
- APNs or FCM
- Mobile OS delivery policies
- Valid push tokens

**User pain:** “The main reason I installed the app was to know when the agent needed me, but the notification arrived late or not at all.”

The app needs delivery-health visibility, test notifications, and clear fallback behavior.

---

### 19. Local-first can also be operationally fragile

The host machine must remain:

- Powered on
- Awake
- Connected
- Running the streamer
- Running the agent CLI
- Reachable through the configured network method

Sleep, router changes, tunnel crashes, operating-system updates, and service restarts can all make the system unavailable.

**User pain:** “The app is paired, but my Mac went to sleep, so nothing works.”

---

### 20. Limited observability and troubleshooting for normal users

A failure might be caused by:

- Stopped streamer
- Incorrect API key
- Expired tunnel
- Firewall
- Missing provider CLI
- Expired provider authentication
- Changed JSONL paths
- PTY failure
- WebSocket disconnection
- Invalid push token
- Database migration failure

**User pain:** “It says the server is unavailable, but I do not know whether the problem is the phone, network, tunnel, streamer, or agent.”

A proper diagnostics screen should test every layer and provide specific remediation.

---

### 21. Search quality may degrade as history grows

Simple full-text search may eventually struggle with:

- Thousands of sessions
- Repeated boilerplate
- Huge tool outputs
- Generated code
- Similar errors
- Multiple providers
- Multiple machines
- Renamed repositories

Users may need:

- Filters by provider, project, branch, and date
- Search in user messages only
- Search in assistant output only
- Semantic ranking
- Deduplication
- Context snippets
- Saved searches

**User pain:** “I know I discussed this error before, but search returns hundreds of nearly identical results.”

---

### 22. No clear backup and migration story

Threadbase stores valuable local state, including:

- Indexed history
- Server configurations
- Credentials
- Favorites
- Settings
- Future tags and saved views
- Prompt templates or snippets

Important scenarios include:

- Moving to a new phone
- Moving to a new computer
- Restoring after SQLite corruption
- Migrating server identity
- Rotating keys
- Synchronizing devices
- Preserving metadata after repository paths change

**User pain:** “I changed laptops or phones and lost the organization I built around my sessions.”

---

### 23. Mobile is not always an adequate control surface

Coding-agent output may contain:

- Large diffs
- Long stack traces
- Tables
- Logs
- Interactive prompts
- Thousands of lines of generated code

A phone is excellent for monitoring, triage, small interventions, and handoff, but not always for confident technical review.

**User pain:** “I can send ‘continue,’ but I cannot confidently understand or approve what the agent changed.”

Threadbase should avoid implying that mobile can fully replace a desktop development environment.

---

### 24. Small-team sustainability and bus-factor risk

Threadbase spans:

- Native mobile development
- Node.js services
- PTYs
- Windows, macOS, and Linux behavior
- Databases
- Networking
- Provider compatibility
- Security
- Push notifications
- Multiple IDE clients

Users adopting infrastructure tools care about:

- Release cadence
- Security response
- Provider compatibility updates
- Store maintenance
- Documentation
- Backward compatibility
- Long-term ownership

**User pain:** “Will this still work after the next major Claude, Codex, iOS, Android, or operating-system update?”

---

## Most urgent priorities

### 1. Durable sessions

Sessions must survive phone disconnection, app suspension, network changes, and streamer restarts without being interrupted.

### 2. Core-flow reliability

Starting, opening, resuming, monitoring, and returning from sessions must work predictably every time.

### 3. Clear product positioning

Threadbase should focus on universal session discovery, history, search, and remote control rather than becoming a smaller version of Orca.

### 4. Provider compatibility resilience

Provider integrations need explicit versioning, compatibility tests, fallback behavior, and fast detection of breaking upstream changes.

### 5. Trustworthy status and notifications

Session state must be accurate enough that users can rely on alerts for completion, failure, and input requests.

### 6. Security and permissions

Threadbase needs strong defaults, device revocation, narrower filesystem scopes, granular capabilities, and transparent security documentation.

### 7. Better diagnostics

Users need a single health screen that distinguishes host, network, tunnel, authentication, provider, PTY, database, and push-notification problems.

---

## Strategic conclusion

Threadbase’s central problem is not a lack of features.

Its most differentiated capabilities—external-session discovery, provider-aware history, cross-session search, multi-server access, and open infrastructure—are hidden behind a runtime and mobile experience that are currently less dependable and less polished than the strongest alternatives.

The strongest long-term position is:

> **Threadbase is the open-source session layer for AI coding agents: discover, search, monitor, and continue sessions from any terminal, IDE, or machine.**

To defend that position, Threadbase should prioritize durability, reliability, compatibility, security, and clear product boundaries before expanding into more orchestration or IDE-like features.
