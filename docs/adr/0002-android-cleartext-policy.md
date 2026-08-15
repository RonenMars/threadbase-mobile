# ADR 0002 — Android cleartext: open the platform gate, enforce the local-network rule in the app

- Status: Accepted
- Date: 2026-08-15
- Related: #727 (the defect, with on-device evidence), #723 (earlier duplicate, carries the policy discussion), #698 and RonenMars/threadbase-streamer#590 (application-layer encryption), `docs/archive/2026-08-15-android-loopback-cleartext-attempt.md` (an unlanded narrower attempt)

## Context

An Android **release** build could not open a plain-HTTP connection to any host.
Pairing to `http://192.168.x.x:8766` — the app's primary documented flow, and the example both `components/onboarding/steps/ConnectStep.tsx` and `components/servers/AddServerScreen.tsx` give — failed with a generic "could not reach that server", and no request reached the server at all.
`versionCode 54` shipped to the Play alpha track carrying it.

Confirmed on a physical Xiaomi 11 Lite on 2026-08-15, not inferred: in the same two minutes Chrome fetched `http://192.168.68.102:8766/healthz` and the server logged a 200, the app's pair exchange against that same address produced nothing server-side, and `https://tb.rbv1000.win` worked with `okhttp/4.9.2` requests logged.
The only variable was the scheme.

The mechanism: `android:usesCleartextTraffic="true"` was set only in `android/app/src/debug/AndroidManifest.xml` and `src/debugOptimized/AndroidManifest.xml`, both **build-type source sets** that never merge into a release build.
`src/main/AndroidManifest.xml` set neither that nor `networkSecurityConfig`, and at `targetSdkVersion` 36 the platform default is cleartext denied.
Every developer build permitted cleartext, which is why this survived months of development.

Two facts constrain the fix.

**iOS already enforces the policy we want, declaratively.**
`ios/Threadbase/Info.plist` sets `NSAllowsArbitraryLoads=false` with `NSAllowsLocalNetworking=true` — cleartext to the local network, TLS to everything else.

**Android cannot express that.**
`usesCleartextTraffic` is a single boolean on `<application>`, and `network-security-config`'s `<domain>` matching is hostname-based with no CIDR support, so "permit 192.168/16" has no declarative form.
Emulating it natively needs a runtime trust manager, which is a larger hazard than the thing it would guard.

## Decision

Open the Android platform gate blanket, and enforce the local-network rule one layer up, in the app.

**The gate** is `usesCleartextTraffic: true` under `expo-build-properties`' `android` block in `app.json`.
That plugin is already registered, so this needs no new config plugin, and `expo prebuild` rewrites the attribute into `android/app/src/main/AndroidManifest.xml` on every run — the durability problem a hand edit under `android/` would have had.
It is deliberately **not** a `network_security_config.xml`: such a config overrides `usesCleartextTraffic` entirely, so one placed in `src/main/` would silently revoke the blanket cleartext `src/debug/` and `src/debugOptimized/` rely on and break local development in a way that looks unrelated.

**The rule** is `services/cleartext-policy.ts`: `isCleartextAllowed(url)` permits `http://` and `ws://` only to loopback, RFC1918, CGNAT/Tailscale (100.64/10), IPv4 link-local, IPv6 loopback / link-local / unique-local, `*.local`, and unqualified hostnames.
Every other cleartext destination is refused before a socket is opened.
It is applied at all three places this app builds a URL to a streamer, because covering fewer would make the parity claim false:

- `services/authed-fetch.ts` — the one authenticated HTTP seam since #701; throws `CleartextBlockedError`.
- `services/ws-client.ts` — the WebSocket carries terminal output, replay and every prompt typed, which is the most sensitive traffic the app has; it refuses to connect and logs `cleartext_blocked` rather than throwing, since the same URL is refused at `authedFetch`, which has a render site.
- `services/pair-exchange.ts` — builds its own `fetch` because there is no credential to present until it returns one; throws `PairExchangeError('cleartext', …)`, which both pairing resolvers already map to a translated string by kind.

The addresses are parsed rather than prefix-matched, and the parse is deliberately stricter than the resolver.
`/^192\.168\./` accepts the registrable public domain `192.168.0.1.example.com` and `/^10\./` accepts `10.example.com`, so prefixes are out.
Beyond that, any host the policy and a resolver could read differently is denied rather than investigated: `inet_aton` accepts a bare 32-bit integer, so `134744072` is 8.8.8.8 while a single-label rule reads it as a local name, and a leading zero makes an octet octal, so `010.0.0.1` is 8.0.0.1 to the platform and 10.0.0.1 to `Number()`.
Whether Android's resolver actually accepts those forms is a platform detail that cannot be settled from here; a policy that disagrees with the resolver in the *permissive* direction is the thing to remove, not to measure.

## Why not the alternatives

**Require HTTPS.**
Defensible on its face, and it is what the platform default already does.
But it deletes the primary flow rather than hardening it: reaching a machine on the user's own desk would need TLS with a self-signed certificate and a user-added trust anchor, and most users would take the tunnel instead — which routes their conversations through a third party that holds them in plaintext by design.
The strict-looking option makes the actual threat model worse.
It would also diverge from iOS, which permits the LAN today.

**Blanket cleartext with no app-layer rule** — #727's own recommendation.
Simplest, and it fixes the defect.
Rejected because it is a wider posture than iOS ships: it would also permit `http://` to any public host, and nothing in the product needs that.

**Permit private ranges natively.**
Not expressible; see Context.

## Consequences

- `http://192.168.x.x:8766`, Tailscale addresses and `*.local` work again on Android release builds, matching iOS.
- A plain-HTTP request to a **public** host is now refused on both platforms, with a specific message naming the remedy rather than the generic unreachable error that cost two sessions of misdiagnosis. A user who was reaching a public `http://` server on Android is newly blocked — no such configuration is known, and the app has never worked that way on iOS.
- The rule is **advisory**. It constrains the three URL builders above, not the platform: a native module opening its own socket is not covered and cannot be. That is the cost of the platform having no expressible middle ground, not a gap to close in JS — and not an open action item. The question is not whether a dependency does its own networking but whether one does it in *cleartext*, and those that network here talk to their own HTTPS endpoints.
- **Do not "fix" `usesCleartextTraffic` back to false, and do not add a `network_security_config.xml`.** Both are load-bearing decisions recorded here. `__tests__/unit/scripts/android-cleartext-policy.test.js` fails if either half drifts.

## What is not verified

The reasoning above, the unit tests and the generated manifest are all source-level.
As of this ADR the change has **not** been exercised on a physical Android device against a LAN address — which is the only thing that closes #727, since the Maestro suite pairs against `http://10.0.2.2:7071` and would go green under a fix that helps no real user.
