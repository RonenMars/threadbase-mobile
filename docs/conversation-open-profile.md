# Why opening a conversation looked slow

**2026-08-02: every measurement in the previous version of this document was invalid.** They were taken through a harness that leaked a screen per run, so run order — not any property of the app — drove the timings. On a clean harness the same conversation opens in **~400 ms**, stable across 24 consecutive opens.

**This does not close the original report.** A 14-second open was observed in ordinary use, before any of this rig existed. Nothing here reproduces it and nothing here disproves it; it is **unexplained**, not resolved. The leading candidate is in ["Where to look next"](#where-to-look-next) below — the app reaches `router.push` on notification taps, `session_ready` events and cold-start deep links, which is the same never-popped push the harness made, on a real device with no test rig involved. It is untested.

What this document can now say: the message list, the merge memo, the parse path, the server and the network are all excluded, and any remaining cost is not paid per-open on the tail path.

Measured against the real streamer on `localhost:8766`, iPhone 17 Pro simulator, debug build over Metro, using the `EXPO_PUBLIC_OPEN_TRACE=1` probe in [`lib/openTrace.ts`](../lib/openTrace.ts).

## What the harness was doing

Every open in the earlier measurements was triggered by two deep links in sequence — `xcrun simctl openurl threadbase://` to return to the hub, then `threadbase://conversation/<id>` to open the conversation.
**Both of those push a new screen. Neither ever unmounts.**
After six measured opens the router stack held six live `ProjectsHub` instances and six live `ConversationDetail` instances.

Each stacked `ProjectsHub` stays subscribed to `sessions-eager` and re-renders its 605 sessions on every query and store update.
N stacked hubs means N times the render work on every update, the JS thread saturates, and the newest conversation's FlashList `onLoad` waits behind all of it.
So in every one of those runs the open was not slow — it was queued behind screens that should not have existed. That is a statement about these measurements, not about the app in the field.

`useLiveInstanceCount` in [`lib/openTrace.ts`](../lib/openTrace.ts) is the instrument that catches this — it logs a `[live]` line per mount and unmount with the running count.

## The proof, both directions

One build, one conversation (`11b58c01`, 968 messages), same session, only the navigation method changed.

| Harness | Live `ProjectsHub` | Opens (ms) |
| --- | --- | --- |
| Deep link to hub, then to conversation (screens accumulate) | 1 → 6 | 398, 920, 2650, 5088, 2517, 3893 |
| Deep link to conversation, then header back (screens unmount) | 1 throughout | 616, 386, 402, 392, 400, 393, 412, 399 |

Extended to 24 consecutive opens on the clean harness, twice: max 629 ms and max 855 ms (both first-of-run), median ~400 ms, no multi-second outliers in either.
The `[live]` log confirms `unmount ConversationDetail — 0 live` after every one.

Tapping the header back button unmounts the conversation screen, so *that* path does not accumulate. Nothing here tests the other ways the app navigates — see ["Where to look next"](#where-to-look-next).

## What the bisection ruled out

Two tests were run against the *stacked* harness and both came back negative, which is what proved the cost was outside the message list.

| Test | Result | Reading |
| --- | --- | --- |
| Replace the row renderer with `<Text>{item.id}</Text>` | 600 / 1,154 / 1,344 / 3,674 ms — unchanged | Not per-row rendering |
| Trivial rows **and** slice the array to 10 messages | 310 / 334 / 2,634 / 5,514 / 3,201 / 3,761 ms | Not row count either — identical work swinging 17× |

Ten trivial `<Text>` rows cannot cost 5.5 seconds.
That result is worth dwelling on, because the useful move was refusing to explain it away: it is not a surprising number, it is an impossible one, so the premise had to be wrong rather than the measurement noisy.
Both tests coming back negative is what proved the cost was outside the list at all — which is what sent the search to an always-on stall watchdog, and from a 2.8 s freeze on a completely idle app to the live-instance counter that named the leak in one run.

These sit on top of the earlier eliminations, all of which still hold and none of which were ever the cause: server response time (50–110 ms by `curl`), pagination (`msg_limit=80` on every first open), FlashList virtualisation, JSON parse / merge / adapt (single-digit ms), `reuseMessageIdentities`, syntax highlighting (24.9 ms for 80 code blocks), the Cloudflare tunnel (53–79 ms warm), cached page count, and conversation length.

## Where to look next

**This is the leading candidate for the original 14-second report, and it is untested.**

What is still known about that report, and survives the harness being thrown out: the server log showed two requests totalling 159 ms of server time with an 11-second gap between them, and no client timeout can produce that gap — the two are 8 s (`FIRST_ATTEMPT_TIMEOUT_MS`) and 15 s (`REQUEST_TIMEOUT_MS`), react-query's retry is `0`, and the server answered the first request in 43 ms so nothing timed out. Whatever the cause is, it is something that blocks the JS thread long enough for timers to fire late. That constrains the search; it does not name a suspect.

The harness leaked screens because a deep link pushes and expo-router does not collapse a push onto a route already in the stack. The app reaches `router.push` on three paths that need no test rig:

- Notification taps — `router.push(target.path)` in [`app/_layout.tsx`](../app/_layout.tsx), on every `addNotificationResponseReceivedListener` fire.
- `session_ready` auto-navigation — `router.push` on a WebSocket event, which arrives with no user action at all.
- Cold-start deep links and launch URLs — `router.push(target.path)` in the cold-start resolver.

These target `/session/<id>`, not the hub, so they would stack session screens rather than the `ProjectsHub` instances the harness accumulated — a different population with different subscriptions, and the per-instance cost is unmeasured. What carries over is the shape: a push that nothing pops, repeated, leaving live screens that keep re-rendering on every query and store update. That shape is what turned a 400 ms open into a 5,000 ms one here.

**Nobody has measured any of this.** The test is cheap now that the instrument exists: add `useLiveInstanceCount` to `app/session/[id].tsx`, run with `EXPO_PUBLIC_OPEN_TRACE=1`, fire each of the three paths a few times, and read the `[live]` count. If it climbs past 1 and stays there, the original report has a candidate explanation and the fix is at those three call sites, not in the conversation screen. If it returns to 0, this thread is dead and the 14-second open still needs one.

Either way, treat that open as an open bug with a named suspect — not as something this document ruled out.

## Second open thread — the idle freeze, plausible and unconfirmed

With a **single** hub mounted and the app completely idle, the JS thread still saturates for **~2.8–3.0 s** on a recurring basis, on top of a steady ~260 ms block every 30 s.
This is a real, reproduced observation, and it is separate from anything above.

Logging every react-query cache event shows what fills the 2.8 s: a burst of ~28 `sessions-eager` observer updates spaced ~85–130 ms apart, bracketed exactly by one `conversations-eager` fetch going `fetching` → `idle`.
It is not one long synchronous function — it is ~28 consecutive hub renders at ~100 ms each, which starves the 16 ms watchdog timer and reads as a single block.

The count matches `useEagerSessions`: `fetchAllPagesForServer` calls `onProgress` once per fetched page, and each call runs `flushAggregate()` → `setAggregateProgress` → a full hub re-render.
605 sessions ÷ `DEFAULT_PAGE_SIZE` 50 = 13 pages, across 2 servers ≈ 14 state updates, and each produces 2 observer events.

**The attribution is not proven, and the test that would have settled it does not count.**
Coalescing `flushAggregate` to one flush per 250 ms was tried and did not change the open series — but that series was still running on the stacked harness, where leaked screens dominated every number, so the A/B could not have shown a difference either way.
It has not been re-run on the clean harness.
Treat this as a named suspect awaiting a valid test, not as a finding.

None of the 24 clean opens was inflated by one of these storms, so whatever the residual is, it did not reach the conversation screen in ~3 minutes of continuous open/back cycling.

## Caveats

- **Debug build.** React dev mode, the React Compiler and the Metro dev bundle all inflate the ~400 ms figure; a release build will be faster. The finding is a comparison of a build against itself, so the shape transfers even though the absolute number does not.
- A second, unreachable server (`localhost:7071`, left from an e2e run) was configured throughout, producing a continuous WebSocket reconnect-backoff loop. It was present in both arms of every comparison.

## How this was arrived at

Recorded because the failures were more informative than the successes, and because each one produced a plausible result rather than an error.

Five hypotheses died in sequence — conversation size, message content shape, cached page count, the merge memo, and finally the row renderer.
Each fit the data available when it was formed and was refuted by data that did not exist yet.
The last two are the instructive pair.
The page-count hypothesis explained every anomaly in its dataset and was killed by a single conversation holding *more* cached pages opening ~27× faster.
The row-renderer hypothesis survived until a substitution test replaced every row with `<Text>` and the number did not move.

The trap underneath all five was the same one, and it is the reason this document was wrong for three sessions: **the harness created the phenomenon it was built to measure.**
Every number in the "measured stage split" table of the previous version was a reading of the app plus N leaked screens, and the leak count was correlated with run order — so run order masqueraded as whatever hypothesis was current.
Confounded columns are not evidence.

Worth being precise about where that came from, because the lesson is weaker without it.
The `openurl`-driven loop was a deliberate design choice, made for a good reason — it is the one way to drive repeated opens unattended — and it was specified by the same person who wrote the rule about verifying what you are measuring.
The rig was never itself tested.
That is the whole failure: an unattended harness is code, and code nobody ran a check against measures whatever it happens to do, not what it was meant to do.
Having the right rule and supplying the rig that violates it are not in tension; the rule is about the thing under test, and the rig is not usually thought of as being under test.
It should be.

Four separate times, correct work was applied outside the window that decides the outcome, and none of the four raised an error:

- The probe started in a `useEffect`, which runs after the render it was measuring.
- A commit was retyped while the PR title — which is what a squash merge takes — kept the old type.
- A profiler was pointed at the React Native DevTools tab, producing a real profile of the wrong subject.
- Opens were driven by a deep link that pushed the screen it was meant to return to, producing real timings of an app state no user reaches.

The general form worth carrying: name the window that decides the outcome, then confirm the change is inside it.
*Is this right* and *where does this land* are different questions, and only the second fails quietly.
Extend it to the apparatus: before comparing runs, give the harness one invariant that must hold on every run — live screen count, open handles, cache size — so drift announces itself instead of being absorbed by whichever hypothesis is current.

The environment traps that go with these (a symlinked `node_modules`, a second bundler on the default port, profiling the debugger UI, and now a stacking deep link) are in [`troubleshooting.md`](./troubleshooting.md) → "Measuring the wrong thing", with the specific remedy for each.

## Reproducing

```bash
cp -Rc ../../tb-mobile/node_modules ./node_modules   # Metro follows a symlink to the wrong root
EXPO_PUBLIC_OPEN_TRACE=1 npx expo start --port 8082 --clear   # check 8081 isn't another session's
maestro test -e CONVERSATION_ID=<id> -e SERVER_ID=<serverId> e2e/perf/conversation-open-loop.yaml
```

The trace prints to the Metro console.
`serverId` is `serverIdFromUrl()` from `types/api.ts` — deterministic from the server URL.

Drive repeated opens with the Maestro flow, never with a bare `openurl` loop: the flow pops each conversation with the header back button, so exactly one hub and one conversation are live for every measurement.
Watch the `[live]` lines — if the count climbs past 1, everything measured under it is the harness.
