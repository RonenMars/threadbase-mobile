# Why opening a conversation is slow

Measured 2026-08-02 against the real streamer on `localhost:8766`, iPhone 17 Pro simulator, debug build over Metro, using the `EXPO_PUBLIC_OPEN_TRACE=1` probe in [`lib/openTrace.ts`](../lib/openTrace.ts).

## The short version

The server is never the bottleneck, and the client is not slow because of the data. **The JS thread is blocked for essentially the entire duration of a conversation open**, and every stage boundary lands late as a result. Whichever `await` happens to be outstanding while the thread is busy absorbs the time, which is why the delay appears in a different stage on each run.

## What was ruled out, and how

| Suspect | Verdict | Evidence |
| --- | --- | --- |
| Server response time | Not the cause | `curl` for the exact request paths: 50–110 ms. Worst in-app `request → response` for the same bytes: 4,173 ms. |
| Missing pagination | Not the cause | Every first open sends `msg_limit=80` (`hooks/useConversations.ts:459`). Anchored windows send `msg_limit=120&anchor_index=N`; back-pages `before_index`; deltas `after_index`. Confirmed in the traces: every `request` mark reads `msg_limit=80`. |
| List virtualisation | Not the cause | `components/conversation/ConversationHistoryList.tsx` is FlashList v2 with `drawDistance={2000}` and `getItemType` recycling pools. Only 80 messages are ever loaded on open, and the list windows those. |
| JSON parse / merge / adapt | Not the cause | On real fixture shape (1,887 B/message): `JSON.parse` of a 560-message payload is 1.0 ms, `reuseMessageIdentities` 1.6 ms, `JSON.stringify` of a 20-conversation persisted cache 12.9 ms. Single-digit-to-low-tens of ms against multi-second stalls. |
| Syntax highlighting | Not the dominant cost | `Prism.tokenize` over all 80 code blocks of the code-heaviest fixture: 24.9 ms total, 0.31 ms/block. |
| Payload size | Not the cause | A warm-cache open that fetched **no new messages** still took 14.4 s (see below). |
| Cloudflare tunnel | Not a factor | `https://tb.rbv1000.win` warm: 53–79 ms for the same request, i.e. indistinguishable from `localhost`. Only the first cold hit costs ~1 s. |

## Measured stage split — cold opens, `localhost:8766`

Times are milliseconds from screen mount. `(+n)` is the delta from the previous stage.

| messages | page KB | request | response | parsed | merged | listDrawn | total | JS blocked |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 519 | 63 | 1 | 4174 (+4173) | 5009 (+835) | 5900 (+891) | 8947 (+3047) | **8,947** | 8,915 |
| 968 | 76 | 0 | 575 (+575) | 896 (+321) | 7391 (+6495) | 7803 (+412) | **7,803** | 7,769 |
| 1946 | 106 | 0 | 211 (+211) | 736 (+525) | 8570 (+7834) | 17872 (+9302) | **17,872** | 17,840 |
| 2017 | 121 | 0 | 2077 (+2077) | 10508 (+8431) | — | — | **>30,000** | 28,966 |
| 4780 | 148 | 1 | 1362 (+1361) | 2032 (+670) | 21381 (+19349) | — | **>30,000** | 32,690 |

`—` means the stage was not reached inside the 30 s trace window. The 2,017 and 4,780 cases never painted.

Note the last column: **blocked time ≈ total time on every single row.** The thread is not waiting on the network, it is busy.

## The decisive control

Re-opening the 968-message conversation with its data already in cache — the only request issued was a no-op delta (`msg_limit=80&after_index=968`):

```
mount             0 ms
request         240 ms  msg_limit=80&after_index=968
response       1471 ms  (+ 1231 ms)  HTTP 200
parsed         1471 ms  (+    0 ms)
merged        14113 ms  (+12642 ms)  80 msgs from 1 page(s)
listDrawn     14373 ms  (+  260 ms)
JS-thread stalls (1, 14357 ms total):
  at +14373 ms — JS thread blocked 14357 ms
```

No new data, nothing to download, nothing to parse — and still **12.6 seconds between having the messages and producing the merged list**, inside a single 14.4 s block. Whatever is consuming the thread is not proportional to the conversation.

Run-to-run variance is large: the same kind of open of the 1,946-message conversation, moments later, drew in 1,790 ms. That variance points at contention with concurrent work rather than a fixed per-open cost.

## What this explains about the original report

The 14-second open whose server log showed two requests totalling 159 ms of server time, with an 11-second gap between them, needs no client timeout to explain it. The two client timeouts are 8 s (`FIRST_ATTEMPT_TIMEOUT_MS`) and 15 s (`REQUEST_TIMEOUT_MS`), react-query's retry is `0`, and neither produces an 11 s gap — the server answered the first request in 43 ms, so nothing timed out. A blocked JS thread does produce exactly that shape: timers fire late, so the freshness drain that would normally follow within ~3–6 s arrives 11 s later instead, and the screen stays on the skeleton the whole time.

The same pathology shows up outside the conversation screen. During this session the pairing handshake against the tunnel sat on "…connecting" for over 90 seconds while `curl` against the same host returned in 53 ms.

## Caveats

- **Debug build.** React dev mode, the React Compiler, and the Metro dev bundle all inflate these numbers; a release build will be materially faster. The *shape* — fast server, saturated thread, late timers — is what transfers, not the absolute milliseconds.
- A second, unreachable server (`localhost:7071`, left over from an e2e run) was configured for part of the session; its failing requests cost 8 s + 15 s timeouts each. The decisive control above was taken with that server answering, so it is not the explanation.
- The 4,780-message case used a synthetic JSONL built by concatenating a real 2,093-message conversation; it was deleted after the run.
- The in-app tunnel ladder was **not** completed — the tunnel server could not be paired (see the handshake note above). The tunnel comparison here rests on direct HTTP timing only.

## Reproducing

```bash
cp -Rc ../../tb-mobile/node_modules ./node_modules   # Metro follows a symlink to the wrong root
EXPO_PUBLIC_OPEN_TRACE=1 npx expo start --port 8081 --clear
xcrun simctl openurl <SIM> "threadbase://conversation/<id>?server=<serverId>"
```

The trace prints to the Metro console. `serverId` is `serverIdFromUrl()` from `types/api.ts` — deterministic from the server URL.

## Not yet answered

What actually occupies the thread. The probe localises the block to the window between "response body parsed" and "FlashList drew its rows" but does not attribute it to a call site. The next step is a sampling profile (Hermes CPU profiler via the dev menu, or `react-devtools` profiler) over one open, which will name the function.
