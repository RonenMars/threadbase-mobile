# 08 — `threadbase://pair` deep links hit "Unmatched Route"

**Repo:** tb-mobile · **Base:** `main` · independent of the ADR work
**Owns:** a new Expo Router route · reads `services/pair-exchange.ts`

## The bug

`tb pair` prints a link of the form:

```
threadbase://pair?url=http%3A%2F%2F192.168.68.125%3A8766&token=pt_…&exp=…
```

and the onboarding screen tells users they can paste "the full `threadbase://` link". Opening it as an actual deep link lands on Expo Router's **Unmatched Route** screen — no route is registered for `pair`.

Reproduced directly:

```bash
xcrun simctl openurl <udid> "threadbase://pair?url=…&token=…&exp=…"
# → "Unmatched Route — Page could not be found."
```

## Why it's small

The parsing and the exchange already exist and are already correct — `parsePairUri` and `classifyPairCredential` in `services/pair-exchange.ts` handle exactly this URI shape (`classifyPairCredential` returns `'pair-uri'` for anything starting `threadbase:`). They are simply only reachable from the in-app paste field and the QR scanner.

The work is a route that receives the URI and hands it to the same exchange path onboarding uses, then routes onward to the hub.

## Things to get right

- **Expired links.** `parsePairUri` surfaces `PairUriError` with an `'expired'` code — the deep-link entry needs a visible failure state, not a silent bounce to Unmatched Route by another name.
- **Cold start vs warm.** A deep link can arrive before the router is ready. `lib/coldStartDeepLink.ts` already handles this pattern for `session/<id>` links — follow it rather than inventing a second mechanism.
- **Already paired.** Opening a pair link for a server that is already configured should be idempotent, not a duplicate entry.

## Done when

`xcrun simctl openurl` with a freshly printed `tb pair` link adds the server and lands on the hub, an expired link shows a real error, and a repeat of the same link doesn't duplicate the server.
