# Why opening a conversation looked slow

**2026-08-02: every measurement in the previous version of this document was invalid.** They were taken through a harness that leaked a screen per run, so run order — not any property of the app — drove the timings. On a clean harness the same conversation opens in **~400 ms**, stable across 24 consecutive opens.

**This does not close the original report.** A 14-second open was observed in ordinary use, before any of this rig existed. Nothing here reproduces it and nothing here disproves it; it is **unexplained**, not resolved — and as of 2026-08-03 it has no suspect either: the navigation-stacking candidate that this document previously named was tested and [refuted](#the-navigation-stacking-candidate-is-dead).

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

Tapping the header back button unmounts the conversation screen, so that path does not accumulate. Neither do the app's own navigations — [measured separately](#the-navigation-stacking-candidate-is-dead); only a push to the **root** route duplicates, which is what the harness did and the app never does.

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

What is still known about the original 14-second report, and survives the harness being thrown out: the server log showed two requests totalling 159 ms of server time with an 11-second gap between them, and no client timeout can produce that gap — the two are 8 s (`FIRST_ATTEMPT_TIMEOUT_MS`) and 15 s (`REQUEST_TIMEOUT_MS`), react-query's retry is `0`, and the server answered the first request in 43 ms so nothing timed out.
Whatever the cause is, it blocks the JS thread long enough for timers to fire late.
That constrains the search. It does not name a suspect, and as of 2026-08-03 nothing does.

### The navigation-stacking candidate is dead

An earlier version of this section named `router.push` on notification taps, `session_ready` and cold-start deep links as the leading candidate, on the theory that they stack screens the way the harness did. **Measured 2026-08-03 with `useLiveInstanceCount` on all three screens — they do not.**

| Navigation | Live instances |
| --- | --- |
| Same session deep link ×5 | 1 mount total — identical URL is deduped |
| Four *different* session ids | 1 mount total — params swap on the existing screen, 4 re-renders |
| Conversation ↔ session, 8 alternations (16 navigations) | oscillates 1↔2, never higher |
| **Control:** root `threadbase://` ↔ conversation, ×5 | **1 → 5, zero unmounts** |

Only the last one grows, and it is the harness's own pattern. The distinguishing factor is the **root** route: pushing `/` while already deep in the stack duplicates the hub instead of returning to it. Leaf routes reconcile — same URL dedupes, different params swap in place, and alternating leaf patterns hold at depth ≤ 2.

That kills the candidate on two counts. All three `router.push` call sites target `/session/<id>`, a leaf route, so they do not accumulate. And the harm mechanism was never "a stacked screen" in the abstract — it was *N live `ProjectsHub` instances each re-rendering 605 sessions on every update*. None of the three paths targets `/`, so none of them can reproduce it even if a session screen did stack.

**What this test did not cover:** the pushes were driven through deep links, which enter expo-router through linking reconciliation, whereas the notification listener calls `router.push` imperatively. Both end in the same navigator, but they are not the same entry point, and the imperative one could not be exercised unattended — a foreground notification renders no tappable banner. So the leaf-route result is strong evidence, not proof. The second argument above does not depend on it.

### So the 14-second open is unexplained, with no suspect

It is still an open bug. What is now excluded: the message list, row rendering, row count, the merge memo, parse/adapt, the server, the network, cached page count, conversation length, and navigation stacking on any path the app itself takes. What remains unexamined is whatever else can hold the JS thread for seconds. The idle freeze looked like the one reproduced instance of that shape and has since been [retracted](#second-open-thread--the-idle-freeze-retracted), so there is currently no measured instance of the app's own work holding the thread at all.

## Second open thread — the idle freeze, RETRACTED

An earlier version of this section reported that an idle app with a single hub mounted "saturates for ~2.8–3.0 s on a recurring basis", and attributed it to `flushAggregate` firing `setAggregateProgress` once per fetched sessions page.
**Both halves are withdrawn as of 2026-08-03.** The attribution is refuted, and the underlying measurement is not trustworthy.

### The attribution is refuted

Six minutes of a fully-loaded idle app (617 sessions, one live `ProjectsHub`, no navigation), with `flushAggregate` instrumented to log every execution:

- **`flushAggregate` ran 0 times.**
- 100 stalls were recorded, median 1,806 ms, max 18,021 ms.

The mechanism did not execute while the freezes happened, so it cannot be the cause.
The coalescing A/B that was supposed to settle this was never worth running: throttling a function that executes zero times cannot change anything.

### The measurement is not trustworthy either

The watchdog in [`lib/openTrace.ts`](../lib/openTrace.ts) measures `setInterval` lateness, and **that cannot distinguish a busy JS thread from one starved of CPU.**
Both produce identical output.
Every number the watchdog has ever produced carries this limitation, including the retracted 2.8–3.0 s.

The run above was taken on a machine at load 7.5–9.9 across 10 cores, and the JS thread was starved rather than busy.
**The starvation was the apparatus running the investigation**: the box was hosting several concurrent agent sessions, a terminal rendering their output, a bundler and a simulator.
The evidence is the process census — **57 `claude`, 218 `CoreSimulator`, 148 leftover `node`/`vitest`** — and those counts are what carry the argument, because they are stable facts rather than instantaneous readings.

Two things it is *not*, both of which an earlier draft of this section asserted and neither of which survived checking:

- **Not the server.** The streamer's `list` statement, timed in isolation against a copy of the same 22 MB cache on an idle box, runs p50 0.38 ms / p99 0.85 ms with `idx_meta_last_activity` present and `EXPLAIN QUERY PLAN` showing `SCAN … USING INDEX` and no temp b-tree — indistinguishable from the 0.87 ms documented in `CLAUDE.md`. The 118.7 ms median seen under load is ~312× that on identical data with an optimal plan, which places the difference outside the query. `#355`'s tripwire measures wall time, so it correctly reported scheduling delay rather than SQL. There is no server defect here to chase.
- **Not this app's polling.** The streamer's steady state is roughly nothing: six consecutive samples two seconds apart read 0.0, 0.0, 0.8, 1.0, 0.0, 0.3%.

### A single reading catches a peak and reads it as a level

Worth naming, because it is what produced the "pathological server" claim that this section had to withdraw, and because **both parties made it independently within the same hour on the same process**.

One side sampled the streamer twice, got 60% and 72.2%, and built a server-defect argument partly on them.
The other sampled three times, got 87.5% / 10.2% / 10.0%, and published the peak as the level — with its own contradicting samples already in hand.
Neither noticed until a third round of sampling returned near-zero.

The lesson is not "sample more", it is that **a percentage is a measurement and a count is a fact**.
Percentages quoted here without a stated sample size and window should be assumed to be peaks.
That is why the paragraph above leads with process counts and why the re-run block asks for a census rather than a CPU figure.

### What this costs the mobile side

Nothing above this section changes: the conversation-open figures are comparisons of a build against itself, taken in a single arm-to-arm sequence, and CPU contention affects both arms.
What is lost is the standalone claim that the app freezes while idle.
There is currently **no measured instance** of the JS thread being held for seconds by the app's own work.

### Before re-running

- **Count processes, not just load average.** 7.5 on 10 cores reads as unremarkable until you notice that 218 of the runnable things are one simulator. `ps -Ao comm | sort | uniq -c | sort -rn | head` before and after.
- Close the other sessions, terminals, bundlers and simulators first — on this box the apparatus, not the app, was the load.
- Kill the simulator app between arms rather than leaving it resident.
- Prefer counts to percentages. If you must quote CPU, sample repeatedly during the window and state the sample size — a single reading catches a peak and reads it as a level, which is how this section acquired a server defect that did not exist.
- Throw the run out if anything moved. Do not average over it.

## Caveats

- **Debug build.** React dev mode, the React Compiler and the Metro dev bundle all inflate the ~400 ms figure; a release build will be faster. The finding is a comparison of a build against itself, so the shape transfers even though the absolute number does not.
- A second, unreachable server (`localhost:7071`, left from an e2e run) was configured throughout, producing a continuous WebSocket reconnect-backoff loop. It was present in both arms of every comparison, which controls it *for comparisons between arms* — it was never excluded as a cause of any absolute number, and an earlier version of this document treated the two as the same thing. They are not.
- **CPU contention was not controlled at all** until it invalidated a finding. Load average and the streamer's CPU were never recorded alongside the timings, so any absolute figure here could be inflated by machine load. The arm-to-arm comparisons survive, since contention hits both arms; standalone magnitudes do not carry the same weight.

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

The environment traps that go with these (a symlinked `node_modules`, a second bundler on the default port, profiling the debugger UI, and now a deep link to the ROOT route, which duplicates the hub instead of returning to it) are in [`troubleshooting.md`](./troubleshooting.md) → "Measuring the wrong thing", with the specific remedy for each.

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
