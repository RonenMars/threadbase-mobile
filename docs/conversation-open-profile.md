# Why opening a conversation is slow

Measured 2026-08-02 against the real streamer on `localhost:8766`, iPhone 17 Pro simulator, debug build over Metro, using the `EXPO_PUBLIC_OPEN_TRACE=1` probe in [`lib/openTrace.ts`](../lib/openTrace.ts).

## The short version

The server is never the bottleneck, and the client is not slow because of the data. The time sits **between having the messages in hand and FlashList reporting that it drew them** — React render and native row layout — and it varies by 4x between consecutive runs of the same open, which points at contention rather than a fixed per-open cost.

Everything else on the path has been excluded by measurement: the network, JSON parsing, page merging, message adaptation, identity reuse, the number of cached pages, and the conversation's own length.

> **Two corrections to earlier versions of this document.** Both were measurement errors on my side and both inflated the picture.
>
> 1. The original figures (8-30 s per open) came from a long-running session with heavily accumulated per-conversation caches. A freshly launched app opens the same conversations in **0.4-9 s**. Do not quote the old range as the cost of an open.
> 2. The probe originally started in a `useEffect`, which runs *after* the first render — while `useConversation`'s merge memo runs *during* it. On a warm open the memo therefore finished before the trace existed and its timings were dropped, which made a later memo execution look like the whole gap. The probe now starts during render.

## What was ruled out, and how

| Suspect | Verdict | Evidence |
| --- | --- | --- |
| Server response time | Not the cause | `curl` for the exact request paths: 50–110 ms. Worst in-app `request → response` for the same bytes: 4,173 ms. |
| Missing pagination | Not the cause | Every first open sends `msg_limit=80` (`hooks/useConversations.ts:459`). Anchored windows send `msg_limit=120&anchor_index=N`; back-pages `before_index`; deltas `after_index`. Confirmed in the traces: every `request` mark reads `msg_limit=80`. |
| List virtualisation | Not the cause | `components/conversation/ConversationHistoryList.tsx` is FlashList v2 with `drawDistance={2000}` and `getItemType` recycling pools. Only 80 messages are ever loaded on open, and the list windows those. |
| JSON parse / merge / adapt | Not the cause | On real fixture shape (1,887 B/message): `JSON.parse` of a 560-message payload is 1.0 ms, `reuseMessageIdentities` 1.6 ms, `JSON.stringify` of a 20-conversation persisted cache 12.9 ms. Single-digit-to-low-tens of ms against multi-second stalls. |
| Syntax highlighting | Not the dominant cost | `Prism.tokenize` over all 80 code blocks of the code-heaviest fixture: 24.9 ms total, 0.31 ms/block. |
| Payload size | Not the cause | A warm-cache open that fetched **no new messages** still took seconds. |
| Cloudflare tunnel | Not a factor | `https://tb.rbv1000.win` warm: 53–79 ms for the same request, i.e. indistinguishable from `localhost`. Only the first cold hit costs ~1 s. |

## Measured stage split

Measured on a freshly launched app with the corrected (render-started) probe, against the real streamer on `localhost:8766`.

| conversation | messages | cached | memo runs | memo total | open |
| --- | ---: | --- | ---: | ---: | ---: |
| 11b58c01 | 968 | 80 msgs / 1 page | 1 | 0 ms | 4,525 / 2,192 / 2,904 ms |
| 019edbc1 | 519 | 519 msgs / 8 pages | 1 / 4 / 1 | 0 / 18 / 0 ms | 2,155 / 9,200 / 7,379 ms |

Read the last two columns together. The merge memo — `mergeConversationPages` plus `adaptRawMessage` plus `reuseMessageIdentities` — runs **one to four times per open and costs 0-18 ms in total**, while the open costs thousands. Whatever holds the thread is not in that memo.

Nor is it proportional to what is cached: the conversation holding 8 pages and 519 messages opened in 2,155 ms, while the one holding a single 80-message page took 4,525 ms. An earlier draft of this document claimed cached page count was the driver; three alternating runs of each refuted it.

**Reading the trace output:** on a warm open the memo completes before the network stages, so `merged` can carry a negative delta relative to `parsed`. The probe prints stages in a fixed order; a negative number means "this happened earlier than the stage above it", not a bad measurement.

## What is left

The window between the merge memo finishing and FlashList's `onLoad` — React render and native layout of the rows. That is the one stage the probe brackets but cannot attribute, and it is what a Hermes sampling profile would name.

The attempts to capture one, and why each failed, are recorded in [`troubleshooting.md`](./troubleshooting.md) under "Measuring the wrong thing". Driving the Hermes profiler over CDP does not work here — the inspector proxy accepts the socket and then never answers `Runtime.enable` or `Profiler.enable`. The working route is RN DevTools attached to the device, opened with `j` in the Metro terminal.

## What this explains about the original report

The 14-second open whose server log showed two requests totalling 159 ms of server time, with an 11-second gap between them, needs no client timeout to explain it. The two client timeouts are 8 s (`FIRST_ATTEMPT_TIMEOUT_MS`) and 15 s (`REQUEST_TIMEOUT_MS`), react-query's retry is `0`, and neither produces an 11 s gap — the server answered the first request in 43 ms, so nothing timed out. A blocked JS thread does produce exactly that shape: timers fire late, so the freshness drain that would normally follow within ~3–6 s arrives 11 s later instead, and the screen stays on the skeleton the whole time.

The same pathology shows up outside the conversation screen. During this session the pairing handshake against the tunnel sat on "…connecting" for over 90 seconds while `curl` against the same host returned in 53 ms.

## Caveats

- **Debug build.** React dev mode, the React Compiler, and the Metro dev bundle all inflate these numbers; a release build will be materially faster. The *shape* — fast server, saturated thread, late timers — is what transfers, not the absolute milliseconds.
- A second, unreachable server (`localhost:7071`, left over from an e2e run) was configured for part of the session; its failing requests cost 8 s + 15 s timeouts each. Runs were also taken with that server answering, and the picture did not change, so it is not the explanation.
- The 4,780-message case used a synthetic JSONL built by concatenating a real 2,093-message conversation; it was deleted after the run.
- The in-app tunnel ladder was **not** completed — the tunnel server could not be paired. The tunnel comparison rests on direct HTTP timing only.

## How these measurements were arrived at

Recorded here because the failures were more informative than the successes, and because each one produced a plausible result rather than an error.

Four hypotheses died in sequence — conversation size, then message content shape, then cached page count, then the merge memo. Each fit the data available when it was formed and was refuted by data that did not exist yet. The page-count one is the instructive case: it explained every anomaly in the dataset and was killed by a single test, a conversation holding *more* cached pages opening ~27x faster — 019edbc1 at 519 messages across 8 pages in 474 ms, against 11b58c01 at 450 messages across 7 pages in 12,971 ms. That ratio is not stable across runs (11b58c01 has since opened in 2-4 s), which is itself part of why the hypothesis was wrong. Running the discriminating test cost two minutes; reasoning about the hypothesis would have kept it alive another round.

Three separate times, correct work was applied outside the window that decides the outcome, and none of the three raised an error:

- The probe started in a `useEffect`, which runs after the render it was measuring.
- A commit was retyped while the PR title — which is what a squash merge takes — kept the old type.
- A profiler was pointed at the React Native DevTools tab, producing a real profile of the wrong subject.

The environment traps that go with these (a symlinked `node_modules`, a second bundler on the default port, profiling the debugger UI) are in [`troubleshooting.md`](./troubleshooting.md) → "Measuring the wrong thing", with the specific remedy for each.

The general form worth carrying: name the window that decides the outcome, then confirm the change is inside it. *Is this right* and *where does this land* are different questions, and only the second fails quietly.

## Reproducing

```bash
cp -Rc ../../tb-mobile/node_modules ./node_modules   # Metro follows a symlink to the wrong root
EXPO_PUBLIC_OPEN_TRACE=1 npx expo start --port 8082 --clear   # check 8081 isn't another session's
xcrun simctl openurl <SIM> "threadbase://conversation/<id>?server=<serverId>"
```

The trace prints to the Metro console. `serverId` is `serverIdFromUrl()` from `types/api.ts` — deterministic from the server URL.
