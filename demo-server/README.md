# Threadbase demo server

A throwaway mock of the Threadbase streamer API, deployed to Fly so Apple App Review (and curious people who haven't installed a real streamer yet) can pair the iOS app and walk through the UI end to end.

## What it is

A copy of `tb-mobile/e2e/mock-server.js` with the same fixtures, listening on the port Fly injects, plus a minimal `/ws` WebSocket that replays a canned Claude Code transcript on `subscribe_session`. **No database, no real Claude Code, no persistence.** Auth: any non-empty Bearer token / WS key is accepted.

## Push notifications when reviewers pair

The server posts to **ntfy.sh** when someone hits `/api/sessions` or subscribes to a session over WS. To get those alerts on your phone:

1. Install the [ntfy iOS app](https://ntfy.sh/app)
2. Subscribe to topic: `threadbase-demo-3e8e6ff52142`
3. Pushes throttled to 1 per 30s to avoid reconnect-loop spam

Override the topic at deploy time:

```bash
flyctl secrets set NTFY_TOPIC=your-custom-topic
flyctl deploy
```

Set `NTFY_TOPIC=off` to silence pushes entirely.

## Deploy

```bash
cd demo-server
flyctl deploy
```

First time only:

```bash
flyctl launch --copy-config --name threadbase-demo --region iad --no-deploy
flyctl deploy
```

## Pair the iOS app against it

In tb-mobile onboarding:

1. Tap **Enter URL manually**
2. URL: `https://threadbase-demo.fly.dev`
3. API key: anything 8+ characters (e.g. `demo-12345678`)
4. Tap **Open handshake**

## Drift risk

If `e2e/mock-server.js` or `e2e/fixtures/` change, this copy goes stale. Re-sync with:

```bash
cp ../e2e/mock-server.js server.js
cp -R ../e2e/fixtures fixtures
flyctl deploy
```
