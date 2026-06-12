# Prompt — Fix Maestro session screenshot flow

Hand this to a fresh Claude Code (or any AI coding agent) session opened in `~/Desktop/dev/ai-tools/tb-mobile`.

---

## What this is

We're capturing App Store screenshots via Maestro flows under `e2e/shots-*.yaml`. Shot 02 (live session view) is broken: when the flow taps a session card and screenshots the session detail screen, the screen shows the **"Counting to a trillion really fast, nearly done…"** waking-up overlay instead of the real terminal content. The expected behaviour is the terminal showing a `$ claude` banner, a few lines of Claude output, and a `>` prompt — that content IS being sent by the demo server, but the screen never paints it.

This blocks App Store submission of v1.0 (we need a credible session screenshot).

## What works

- **Demo server** (Fly-hosted, URL in `.env.demo`) serves the right contract. Already deployed and tested:
  - `GET /api/info`, `/api/profiles`, `/api/sessions`, `/api/sessions/:id`, `/api/sessions/:id/output`, `/api/conversations`, `/api/conversations/:id`, plus stubs for `names`, `recents`, `popular`, `count`
  - `WSS /ws?key=<anything>` accepts `{type: 'auth', token}` and `{type: 'subscribe_session', sessionId}` and replies with `{type: 'terminal_replay', sessionId, lines: [...]}` after a 150ms delay (workaround for an app-side race condition documented in `demo-server/server.js`).
  - Returns per-session status by matching the request ID against `e2e/fixtures/sessions.json`. So `session-def456` returns `status: waiting_input` (the one we want for the shot), `session-abc123` returns `status: running` (which triggers the wake-up overlay).
  - WS keepalive ping every 25s so Fly's edge proxy doesn't drop idle connections.
- **Maestro flow** `e2e/shots-02-session-waited.yaml` runs `setup-demo.yaml` (which pairs against the Fly server, walks the 7-step onboarding) then taps a session card by accessibility-label regex `"Session my-project, status waiting_input.*"`.
- **Setup flow** `e2e/setup-demo.yaml` correctly lands on `hub-screen` (verified — the assert passes).
- WSS replay confirmed working via `node -e "const ws = new WebSocket(...)"` curl-style probe — server sends 30-line `terminal_replay` payload.

## Confirmed via Fly logs (2026-06-01 04:21:16 UTC)

When the Maestro flow taps the session card matching `"Session my-project, status waiting_input.*"`, the Fly server logs show **TWO consecutive `GET /api/sessions/...` requests in the same second**:

```
04:21:16 GET /api/sessions/session-def456    ← initial fetch (correct, def456 has waiting_input)
04:21:16 GET /api/sessions/session-abc123    ← then immediately abc123 is also fetched
```

The screen ends up rendering `session-abc123` (status: running → triggers wake-up overlay). This is a **double-fetch / route-replacement** bug, not a Maestro selector bug. Maestro IS tapping the right card. Something in the app code is causing a second navigation to `session-abc123` right after the first navigation completes.

**Hypotheses to investigate first (in priority order):**

1. **`useSession.ts:74`** rewrites `serverId` on every list refetch. If the list refetches while on the detail screen, the navigation params may get rewritten, causing a re-mount. Check `staleTime` / `refetchOnMount` for the sessions query.
2. **WebSocket `session_list` push from the server.** Our demo doesn't send one currently, but maybe the client sends `subscribe_session` and the server's `terminal_replay` response is being misrouted to a different handler.
3. **`session_update` WS handling.** Look at how the app processes incoming `session_update` events — they may overwrite the current detail. Our demo doesn't send these; if the app expects them with the latched session ID, it might be substituting one randomly.
4. **Index 0 in a list** — when `useSessionDetail` is called with serverId+id, does it search the cached sessions list by some other field and accidentally return position 0 (abc123)?

## Symptom

After Maestro taps the session card, the session detail screen shows:
- Header: `my-project`
- Status row: **`Running 12s 3 prompts`** ← this proves the session that loaded was `session-abc123`, NOT `session-def456` (which has 45s elapsed and 7 prompts and status `waiting_input`)
- The 3 placeholder lines (`$ claude .`, `Starting session…`, `Waiting for input`) at top from the HTTP `/output` fixture
- Big "Counting to a trillion really fast, nearly done…" wake-up overlay
- Disabled input bar with placeholder "Starting up…"

The wake-up overlay is gated by (`app/session/[id].tsx:677-680`):

```ts
const isWakingUp =
  session?.status === 'running' &&
  !isStreaming &&
  !hasReachedPrompt
```

So **the session loaded had `status: 'running'`** — meaning either:
1. Maestro tapped `session-abc123` (running) not `session-def456` (waiting_input), even though the regex says waiting_input.
2. Some other code path overwrote the session state after the detail loaded.

## What you need to figure out

**Primary investigation:** why does the Maestro tap land on the wrong session?

The hub renders session cards with composite accessibility labels of the form `"Session my-project, status running, 12s"`, `"Session my-project, status waiting_input, 45s"`, etc. (verified via `maestro hierarchy` earlier). Maestro's `tapOn: text: "Session my-project, status waiting_input.*"` should match the second card. But the screen we land on shows `session-abc123` data.

**Hypotheses to verify, in order:**

1. **Stacked text nodes:** the accessibility label may be on a non-tappable text overlay while the actual tappable `Pressable` is a sibling. Maestro tapping the text node may not propagate to the press handler. Look at `components/sessions/SessionCard.tsx` — the `<Pressable onPress={handlePress}>` may not own the same node as the accessibility text. If so, the tap could be falling through to the card *behind* it in z-order, or to the FlatList row at that y-coordinate, which may be a different session.

2. **List sort order at runtime:** verify the hub renders sessions in the same order as the fixture. The hub may be sorting by `lastActivity` or `status` priority. Run the flow, dump `maestro hierarchy`, list every node containing `"Session "` and their bounds, and compare against the fixture. The first `waiting_input` card's bounds tell you what to tap.

3. **`index: 0` ambiguity:** Maestro defaults to the first match. If there are TWO `waiting_input` matches (e.g. one in the LIVE strip at top, one in the project list below), Maestro picks the first. The screen-2 shot earlier showed two waiting_input cards in the LIVE strip — both labeled `Session my-project, status waiting_input, ...`. Try the second one (`index: 1`).

4. **App-side race on session detail load:** maybe the hub passes a session ID to the detail route, but the detail screen briefly shows a different session from cache (e.g. `useSessionDetail` returns the most recent successful query while the new one loads). Inspect `hooks/useSession.ts` for stale-while-revalidate behaviour.

5. **Selector matching the WRONG kind of node:** Maestro's `text:` matches against `text`/`accessibilityText`/`title`. The hub status pills (the "Running" / "Active" / "Idle" green dot+label inside each card) might have their own accessibility labels containing `"waiting_input"` literally. Tapping one of those could resolve to a parent tappable. Worth checking.

## How to debug

1. **Run the flow once to land on hub:**

   ```bash
   cd ~/Desktop/dev/ai-tools/tb-mobile
   # Make sure ONLY iPhone Pro Max sim is booted (shut down iPad if you don't want Maestro picking it):
   xcrun simctl list devices booted | grep -i ipad | awk '{print $NF}' | tr -d '()' | xargs -I{} xcrun simctl shutdown {}
   xcrun simctl boot D360EA42-7485-4C23-93E0-0D099946ED9C 2>/dev/null
   open -a Simulator

   # Make sure the Release build is installed (the build dir is preserved between sessions):
   xcrun simctl install D360EA42-7485-4C23-93E0-0D099946ED9C \
     ~/Library/Developer/Xcode/DerivedData/Threadbase-cpejntowhbdbrteeqjxgzxyenblh/Build/Products/Release-iphonesimulator/Threadbase.app

   # Status bar to the standard demo state:
   xcrun simctl status_bar D360EA42-7485-4C23-93E0-0D099946ED9C override \
     --time "9:41" --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4 --cellularMode active

   # Drive the onboarding flow:
   export PATH=~/.maestro/bin:$PATH
   maestro test e2e/setup-demo.yaml
   ```

2. **Dump the hub hierarchy:**

   ```bash
   # Maestro emits "None: \n" before JSON. Strip the first line.
   maestro hierarchy 2>/dev/null | tail -n +2 > /tmp/hub-hier.json
   # Find all session nodes + their bounds and what they say:
   python3 -c "
   import json
   data = json.load(open('/tmp/hub-hier.json'))
   def walk(n):
       a = n.get('attributes', {})
       txt = a.get('accessibilityText', '')
       if 'Session ' in txt:
           print(a.get('bounds', '?'), '→', txt)
       for c in n.get('children', []):
           walk(c)
   walk(data)
   "
   ```

3. **Decide which card to tap based on bounds.** The bounds string is `[x1,y1][x2,y2]` in *display points* (440x956 for iPhone 17 Pro Max). The card you want is the highest-y `waiting_input` one in the LIVE strip (top of screen).

4. **Either:**
   - Adjust `e2e/shots-02-session.yaml` to use `index:` to pick the right match, OR
   - Tap by exact coordinate (`tapOn: point: "50%, <calc>%"`), OR
   - Tap by a more unique substring (e.g. `text: "feature/auth"` if that's only on session-def456).

5. **Re-run `e2e/shots-02-session-waited.yaml`** (already has an 8-second wait built in for the WS replay to land):

   ```bash
   maestro test e2e/shots-02-session-waited.yaml
   open e2e/_artifacts/screenshots/shots-02-session-waited.png
   ```

6. **Confirm success criteria:**
   - Header shows the project name (e.g. `my-project`)
   - Status row shows `Active 45s 7 prompts` (or any non-`Running`)
   - Body shows a terminal box with `$ claude`, `╭───…╮` banner, `Welcome to Claude Code`, the `> Take a look at the README…` prompt, and the readme summary text
   - No "Counting to a trillion…" or "Brewing a fresh pot of tokens…" overlay
   - Input bar shows `Send input to session…` placeholder (not `Starting up…`)
   - Send button is enabled (not greyed)

## Available tooling on this Mac

Read this carefully before reaching for new tools — there's a lot already configured.

### Skills (`Skill` tool)

- `superpowers:systematic-debugging` — use this for the diagnosis loop. The whole point of systematic-debugging is to identify hypotheses one at a time and test each cheaply before moving on. Perfect fit here.
- `superpowers:test-driven-development` — if you end up changing app code (e.g. fixing a SessionCard testID or the `useSessionDetail` race), wrap it in TDD.
- `chrome-devtools-mcp:chrome-devtools` — irrelevant; this is a native flow not a web app.
- `claude-md-management:claude-md-improver` — if you discover a recurring Maestro footgun, propose adding it to `CLAUDE.md`.
- The `Explore` agent is great for "find every place SessionCard is mounted / find every component reading `useSessionDetail`."

### MCP servers configured

- `plugin:serena:serena` — symbol-aware code navigation. Use `find_symbol`, `find_referencing_symbols`, `replace_symbol_body` instead of grep + Edit for any non-trivial code change in this repo. Serena needs `initial_instructions` called once at the start.
- `claude.ai Context7` / `plugin:context7:context7` — for React Native / Expo / Maestro documentation. **Use this** if you need to look up Maestro selectors, RN accessibility behaviour, or Expo Router navigation.
- `claude-in-chrome` and `playwright`, `chrome-devtools-mcp` — irrelevant for this task.
- `plugin_github_github` — for opening an issue or PR if you want to track the fix.
- `plugin_oh-my-claude_sequential-thinking` — useful if the bug turns out to be in app code rather than the Maestro flow and you need to reason through the data flow.

### Subagents to consider dispatching

- `Explore` for "where is `useSessionDetail` invoked, and is there any stale-while-revalidate behavior?"
- `oh-my-claude:advisor` for "before I patch this, are there other call sites that could be affected?"
- `oh-my-claude:critic` to stress-test your fix plan before writing code.
- `fullstack-dev-skills:react-native-expert` skill — relevant if the bug turns out to be RN-side (touch handling, accessibility, FlatList rendering order).

### Project conventions to follow

- Read `CLAUDE.md` in the repo root. Key rules:
  - Commit message format: conventional commits (`fix(e2e): …`, `feat(demo-server): …`)
  - NEVER add `Co-Authored-By` trailer
  - Show diff + explanation + message and wait for approval before committing
  - Run `npm run lint` and `npm run test` before declaring done (project has Jest + ESLint + TS strict)
- The Maestro suite is invoked via `npm run test:e2e:mock` for the local-mock variant. Don't break that.
- Don't change `e2e/mock-server.js` or `e2e/fixtures/*` — those drive the local Jest E2E. If you need to test against the live demo server, the parallel files are `e2e/setup-demo.yaml` and `demo-server/` (deployed to Fly).
- If you patch the app to fix this, write a Jest test that proves the bug is fixed.

### What NOT to do

- Don't rebuild the iOS app from scratch unless you actually changed native code. The DerivedData Release artifact at the path above is fine — reinstall with `xcrun simctl install`.
- Don't redeploy the demo server unless you change `demo-server/`. Use `flyctl logs --no-tail -a threadbase-demo` to debug what the live server is seeing.
- Don't add code paths or test variants that only fix this screenshot. The bug, if real, will affect actual users — fix it for real or document it as a known issue. No screenshot-only `__DEV__` guards.
- Don't add new `wait` calls to mask the issue. If a wait is needed, it should be a `waitUntilVisible` on the actual content (e.g. wait for "$ claude" text to appear).
- Don't bump versions, ship to TestFlight, or run any `expo run:ios --configuration Release` archive flow without explicit approval. The shipping pipeline (`/expo-local-ship`) is separate and not part of this task.

### Update — what I learned debugging this for ~30 minutes

I (the previous Claude) verified the following while live with the user:

1. **Maestro IS tapping the correct card.** The Fly logs show `GET /api/sessions/session-def456` fires when the `waiting_input` regex matches. So the tap dispatch is right.
2. **The detail screen then triggers a SECOND fetch** for `session-abc123` (the first card in the LIVE strip, status: running) within the same second. The screen ends up rendering abc123.
3. **`session-abc123` has `status: 'running'`** in the fixture. The wake-up overlay gate is `session?.status === 'running' && !isStreaming && !hasReachedPrompt`. So even if the WS replay landed perfectly, the running session would *correctly* show the wake-up overlay (since the user has not "reached the prompt" yet).
4. **Demo server is working correctly.** Verified by direct curl + WSS probe:
   - `GET /api/sessions/session-def456` returns `{status: "waiting_input", ...}` ✓
   - `GET /api/sessions/session-abc123` returns `{status: "running", ...}` ✓
   - `WSS /ws` accepts subscribe_session and replays 30 lines with 150ms delay ✓
5. **`hooks/useSession.ts:74`** does `collected.push({ ...s, serverId, serverLabel })` — overwriting the fixture's `serverId: "server-one"` with the paired serverId (`Srv_Ure6X8`). So the hub list shows the paired serverId, but the URL navigation passes whatever ID the SessionCard sees.

**The real question** is *why* the second `GET /api/sessions/session-abc123` fires. The most likely culprit is React Query's `staleTime` on the sessions list (`hooks/useSession.ts` `useSessionsList` or similar). When the detail mounts, the list re-renders, the rewrite at line 74 runs again, and somehow the wrong sessionId ends up in the route.

Verify with:

```bash
# Stream Fly logs while reproducing the bug
cd ~/Desktop/dev/ai-tools/tb-mobile/demo-server
flyctl logs -a <demo-app-name> &
# In another shell:
cd ~/Desktop/dev/ai-tools/tb-mobile
maestro test e2e/shots-02-session-waited.yaml
# Watch the Fly log output — look for the GET /api/sessions/<id> pattern.
```

If you see `session-def456` followed by `session-abc123`, the bug is in the app code (re-render after navigation). If you only see `session-def456`, the screen is rendering def456 but with wrong data — that would point at the API response shape.

**Alternative quick win:** if you can't fix the double-fetch, just **swap the fixture so `session-abc123` is the waiting_input one**. Edit `demo-server/fixtures/sessions.json` to put a `waiting_input` session as id `session-abc123`, redeploy. Then even with the double-fetch bug, the screen renders a `waiting_input` session and the wake-up overlay doesn't show. This is a workaround, not a fix — but it would unblock the screenshot.

### Deliverable

When done, leave:

1. A working `e2e/shots-02-session-waited.yaml` (or rename — your call) that lands on a session detail screen showing real terminal content, captured at 1320×2868.
2. The screenshot file at `e2e/_artifacts/screenshots/shots-02-session.png` (or the *-waited.png variant if you keep both).
3. A brief diagnosis writeup at the bottom of this file (or as a new `docs/lessons/` entry if it was non-trivial) explaining what the actual bug was.
4. If you patched app code: a test that fails on `main` and passes with your patch.
5. NO commits unless I (the user) explicitly approves them.

Good luck.
