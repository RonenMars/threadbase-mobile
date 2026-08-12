# Demo Video Kit

Everything needed to record a 10–20s marketing video of the app on a real device: a scripted demo server plus three scenario options optimized for hook rate, hold rate, and CTR.

## Running the demo server

```bash
node demo/demo-server.js
```

Run from the repo root. It prints your Mac's LAN IPs on startup:

```
Demo server on port 7071. Connect the app to:
  http://192.168.68.125:7071   (any api key)
```

1. Phone and Mac on the same Wi-Fi.
2. In the app: connect a server with the printed URL and **any** non-empty api key.
3. Restart the server between takes to reset state.
4. Port override if 7071 is busy: `DEMO_PORT=7080 node demo/demo-server.js`.

## What the demo shows

The hub renders 4 sessions across 2 machines:

| Session | Project | Status | Role in the demo |
|---|---|---|---|
| `sess-checkout` | `threadbase-shop` | waiting for approval | **The star** — Claude asks "Apply the fix?" |
| `sess-darkmode` | `threadbase-web` | running | Ambient — card updates every 2.5s |
| `sess-billing` | `billing-api` | running | Ambient — card updates every 2.5s |
| `sess-docs` | `docs-site` | idle | "Finished work" card (42 tests passed, PR opened) |

**The money shot:** open `threadbase-shop` — the conversation history ends with Claude presenting a plan and asking *"Apply the fix?"*. Type anything and send. A scripted ~11s live response streams in:

thinking → `Edit` tool call → `Bash` running tests 20× → "20 passed, 0 flaky" → final summary → status flips back to waiting.

Both the chat view and the terminal view animate during the script.

## Scenario options

### Option A — "I approve my AI's plan from my phone"

**Best for: TikTok / IG Reels / LinkedIn.**

| Time | Beat |
|---|---|
| 0–2s | Open already inside the session, Claude's question visible. Overlay text: **"My AI found the bug while I was at lunch"**. The hook is an AI *asking permission* — unresolved tension, viewers wait for the answer. |
| 2–5s | Type "yes, go" and send. Human moment; hold rate spikes on typed input because viewers read along. |
| 5–15s | The live stream: thinking → file edit → tests running 20× → green. Tool calls appearing one-by-one is the retention engine. |
| 15–18s | Swipe back to the hub — three *other* sessions still working. The "wait, there's more" beat drives rewatches and comments — your CTR moment. End card: app name + "Claude Code, in your pocket." |

### Option B — "Mission control"

**Best for: LinkedIn / Reddit / X.**

| Time | Beat |
|---|---|
| 0–3s | Open on the hub, 4 sessions live-updating. Overlay: **"I'm running 4 coding agents right now. From my phone."** The hook is the *count* — parallelism is the status-flex angle for dev audiences. |
| 3–8s | One card flips to "waiting for approval". Tap it. |
| 8–16s | Approve → compressed live stream → back to hub, everything green. Sells orchestration, not chat. |

**Reddit note:** post as a raw screen recording with a plain title ("I built a mobile client to babysit my Claude Code sessions") — zero overlay text, no music. Reddit's conversion gate is comments, not CTR, and marketing polish kills it there.

### Option C — "The silent loop"

**Best for: README gif / X header.**

No typing, no cuts: open the session, the stream plays start-to-green (~12s), status flips to "Fix verified — 20/20 green". Loops cleanly because start state ≈ end state (calm chat → calm chat). Under 15s keeps the gif small; record at ~60% zoom so tool-call rows stay legible at README width.

### Option D — "Zero to control in 30 seconds" (first-user angle)

**Best for: README / Reddit / Product Hunt-style evaluator audiences. Not TikTok — the hook is too slow.**

Onboarding is a weak *hook* (watching setup is a reason to scroll past) but a strong *trust* beat: it answers the first objection every dev has — "how painful is setup?". Use it where viewers are already evaluating, not where you're fighting for the thumb-stop.

| Time | Beat |
|---|---|
| 0–2s | Overlay: **"Setup took 25 seconds. Watch."** Start on tapping the Welcome CTA — never on a static logo. |
| 2–8s | Connect step. **QR path (best visual):** point the phone at the QR in your terminal — instant connect. Requires a real streamer; the demo server only supports manual entry. **Manual path:** type the demo server URL + key, then speed-ramp 4× in the edit. |
| 8–12s | The reveal: hub pops in with 4 live sessions already working. This is the payoff — setup was nothing, look what you get. |
| 12–18s | Tap `threadbase-shop` → Claude asking "Apply the fix?" → send approval → first seconds of the live stream. |
| 18–20s | End card: app name + install link. |

Skip the notifications step on camera (tap "later") or cut it in the edit — permission prompts are dead air.

## Recording tips

- Shoot once in portrait at max brightness using the phone's built-in screen recorder — not a camera pointed at the phone — for Options A and C.
- Option B benefits from one hand-held over-the-shoulder shot as the first frame for authenticity on LinkedIn.
- First frame must never be a splash screen — thumb-stop dies on logos.
- For the README gif: convert with `ffmpeg` and cap at ~10MB so GitHub renders it inline.
