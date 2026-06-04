# Terminal autoscroll + Resume Session double-navigation fix

**Shipped:** 2026-06-05
**Branch:** `feat/terminal-flashlist-autoscroll`

## What shipped

Two related fixes to the session experience:

1. **Streaming terminal autoscroll** — `components/terminal/TerminalOutput.tsx` now uses FlashList v2 with `maintainVisibleContentPosition` instead of `Animated.FlatList`. The list follows live PTY output when the user is at the bottom, freezes when they scroll up, and offers a jump-to-bottom pill to re-engage follow.
2. **Resume Session double-slide** — `lib/sessionNavGuard.ts` introduces a short-lived suppress-set so the global `session_ready` listener in `app/_layout.tsx` does not duplicate the explicit `router.push` already performed by the resume mutation in `app/conversation/[id].tsx`.

## Why it matters

### Terminal autoscroll

The terminal previously short-circuited auto-scroll while `isStreaming` was true (`onContentSizeChange` early-returned). The view only caught up after 1.5 s of idle, so a long agent reply scrolled into a frozen viewport — the opposite of "follow the agent's typing." The conversation screen had already adopted FlashList v2's `maintainVisibleContentPosition` (PR sequence around the SDK 56 upgrade); this brings the terminal to parity with the same pattern:

- `startRenderingFromBottom: true` — first paint is at the bottom of the backlog, no flash.
- `autoscrollToBottomThreshold: 0.2` — mVCP follows new content when the user is within 20% of the bottom, freezes the anchor otherwise.
- Manual `scrollToEnd` calls only fire when the user taps the jump-to-bottom pill or sends their own message.

### Resume Session double-navigation

Tapping **▶ Resume Session** on a conversation pushed `/session/<id>` twice onto the stack. The first slide was the user's explicit navigation; the second was the global `session_ready` listener in `app/_layout.tsx` reacting to the PTY-ready event for the same session. The two pushes used slightly different query-param strings, so Expo Router treated them as distinct stack entries — Back returned to the same session screen before reaching the conversation.

Proven via `console.log` instrumentation streamed off the simulator:

```
[NAV] conversation.resumeSession.onSuccess -> push /session/f7f2f5d7  (t=0.00s)
[NAV] _layout.global.session_ready FIRED type=session_ready          (t=3.86s)
[NAV] _layout.global.session_ready -> push /session/f7f2f5d7         (t=3.86s)
```

## Architecture

`lib/sessionNavGuard.ts` exports two functions:

- **`markNavigatedToSession(id)`** — explicit caller stamps the id with `Date.now()` right before `router.push`.
- **`shouldSkipAutoNav(id)`** — global listener checks the stamp; returns `true` only if the id was marked within the last 10 s. Stale entries are evicted on read.

The 10 s TTL is wide enough to cover slow PTY attaches (the streamer can take 3–5 s to emit `session_ready`) and narrow enough that a *later*, legitimate `session_ready` for the same id (e.g. after a streamer reconnect) is not accidentally suppressed.

The global listener's original purpose — auto-jump to a session that becomes ready while the user is on a different screen (push notification, hub button, background reconnect) — is preserved. Only the duplicate case is suppressed.

## User-visible behavior

- **Terminal:** opens a long session at the bottom of the backlog. Live tokens follow the bottom as long as the user is within ~20% of it. Scrolling up freezes the view and reveals a caret-down pill; tapping it animates back to the bottom and re-engages follow.
- **Resume Session:** a single slide animation, a single stack entry. One Back press returns to the conversation.

## Files changed

- `components/terminal/TerminalOutput.tsx` — FlashList v2 swap, plain JS `onScroll` (the Reanimated `useAnimatedScrollHandler` raised `undefined is not a function` inside FlashList's `RecyclerView.js:171`, see Decisions).
- `lib/sessionNavGuard.ts` — new file, 24 lines, no dependencies.
- `app/_layout.tsx` — single guard call in the global `session_ready` listener.
- `app/conversation/[id].tsx` — single `markNavigatedToSession` call before `router.push` in the resume mutation.

No native code, no dependency changes, no API contract changes.

## Decisions

- **FlashList v2 `maintainVisibleContentPosition` over inverted FlatList.** Conversation screen already proved the pattern works. Inverted-FlatList would require reversing data, breaks Android `RefreshControl`, and reverses accessibility reading order.
- **Plain JS `onScroll` over Reanimated worklet.** FlashList v2 invokes `props.onScroll.call(props, event)` inside its own animated event listener. `useAnimatedScrollHandler` returns a worklet wrapper whose `.call(...)` invocation pattern yields `undefined`, throwing `undefined is not a function` at `RecyclerView.js:171:102`. Plain `useCallback` reading `e.nativeEvent` matches the conversation screen and is the documented FlashList pattern.
- **TTL-based suppress-set over a route-aware check.** `usePathname()` only reports the active route, not the full stack — a session that is on the stack but covered by a modal would not be detected. The TTL approach is invariant to navigation depth.
- **Centralized helper over inline boolean.** The guard logic lives in `lib/sessionNavGuard.ts` so future callers (notification handler, hub buttons, deep links) can opt in with one line.

## Tests

- **TypeScript** — `tsc --noEmit` clean.
- **Jest** — full suite (489 tests across 47 suites) passes locally. `TerminalOutput.test.tsx` exercises the message-row rendering and was unchanged by the swap; the FlashList mock in `jest.setup.js` continues to stub `useRecyclingState` / `useLayoutState`.
- **Manual on iPhone 17 simulator (iOS 26.2)** — the red-screen crash from the first FlashList swap (`undefined is not a function` inside `RecyclerView.js`) is gone; the Resume Session double-slide is gone (verified by reproducing with `[NAV]` console logs streamed via `xcrun simctl spawn booted log stream`).

## Breaking changes

None.

## Related work

- [PR — terminal autoscroll + Resume Session fix](https://github.com/RonenMars/threadbase-mobile/pull/__PR__)
- Plan file: `~/.claude/plans/investigate-in-any-relevant-streamed-kitten.md` (kept for design rationale; not in repo).
