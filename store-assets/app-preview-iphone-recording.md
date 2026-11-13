# App preview: what to record on the iPhone

Four short screen recordings for the App Store app preview, recorded on a real iPhone.
The final preview (886×1920, about 28 s, captions and dissolves) is composed afterwards from these clips.
Apple accepts only footage captured in the app: no hands, no device frames, no mock-ups.

## Before recording (one time, about 10 minutes)

### 1. Run the demo machines on the Mac

The phone must show demo data only.
Real machine names, paths and hostnames must never appear in the footage.

```bash
cd ~/dev/ai-tools/tb-mobile-worktrees/app-store-assets   # or tb-mobile once this PR is merged
npm ci                                                   # first time only
DEMO_HOST=0.0.0.0 node e2e/marketing/demo-streamer.js
```

- This starts three demo machines: **Work Mac** (port 7071), **Home Mac** (7072) and **Linux Devbox** (7073).
- `DEMO_HOST=0.0.0.0` lets the phone reach them over Wi-Fi. If macOS asks whether `node` may accept incoming connections, allow it.
- The phone and the Mac must be on the same Wi-Fi network.
- Find the Mac's address with `ipconfig getifaddr en0`. It is `<MAC_IP>` below.

### 2. Clear real servers from the app

Use the TestFlight or App Store build of **Threadbase**, so the footage is the app that ships.

- Settings: remove every real server from the server list. Re-pair them after recording.
- Theme: dark. Language: English.

### 3. Pair the three demo machines

Open each link on the phone (paste into Notes and tap it, or tap it in the email that came with this file):

```
threadbase:///pair?url=http%3A%2F%2F<MAC_IP>%3A7071&token=pt_demo
threadbase:///pair?url=http%3A%2F%2F<MAC_IP>%3A7072&token=pt_demo
threadbase:///pair?url=http%3A%2F%2F<MAC_IP>%3A7073&token=pt_demo
```

- Allow **Local Network** access when iOS asks.
- Confirm each pairing. The Now view should then show Work Mac, Home Mac and Linux Devbox.

### 4. Prepare the phone

- Turn on **Do Not Disturb**, so no notification banner lands in a clip.
- Charge the battery above 80%, or keep it on the charger.
- Add **Screen Recording** to Control Center if it isn't there (Settings → Control Center).
- Turn microphone audio **off** in the Screen Recording control. The preview plays muted.

### Resetting between takes

Answering the agent (clip 2) changes the demo state.
To retake a clip, stop the demo streamer with Ctrl-C and start it again.
The app reconnects on its own; pull down on the Now view if it doesn't.

## The four clips

Start each recording, wait about **1 s without touching anything**, do the action, then wait another **1 s** before stopping.
Those still seconds become the dissolves.
Move slowly: one action, a pause, then the next.
The recording indicator in the status bar doesn't matter, because a caption band covers the status bar.

### Clip 1: "Your agent needs you." (about 8 s)

1. Open the app on the **Now** view.
2. Do nothing. Let the **Needs you** card on Work Mac pulse for about 6 s.
   - This is the poster frame. Apple shows second 5 of the preview before it plays.

Save as `C1-now`.

### Clip 2: "Answer from anywhere." (about 9 s)

1. Start on the Now view.
2. Tap the **Needs you** card ("Fix authentication callback", Codex, Work Mac).
3. Let the question show for about 2 s: *"Two options for the callback fix — which should I take?"*
4. Tap the composer and type a short answer, for example `Go with option 1`.
5. Send it. Wait until the status flips to **Working** and the reply starts streaming, about 2 s.

Save as `C2-answer`.

### Clip 3: "Every agent. Every machine." (about 8 s)

1. Restart the demo streamer first (see "Resetting between takes"), so the Needs you card is back.
2. Switch to the **Projects** view.
3. Scroll slowly from top to bottom so Work Mac, Home Mac and Linux Devbox each pass on screen.
4. Make sure the Codex provider mark is visible on at least one row.
   - The app marks only rows whose provider differs from the majority, so the Claude Code rows stay unmarked. That is expected.
   - This demo data has Claude Code and Codex only. Copilot is named in the captions, not shown here.

Save as `C3-projects`.

### Clip 4: "Search every session you ran." (about 8 s)

1. Tap the search (magnifier) icon.
2. Type exactly `callback per environment`, at a normal typing pace.
   - Search matches the words literally. Another query may open the result without the highlight, so keep to this one.
3. Let the results sit for about 1 s.
4. Tap the first result. It opens at the match, with the words highlighted. Hold for about 2 s.

Save as `C4-search`.

## After recording

1. Watch each clip once and check that none shows a real machine name, path, email or hostname, or a notification.
2. AirDrop the four clips to the Mac.
3. Put them in `~/dev/ai-tools/tb-marketing-app-preview/compositions/threadbase-app-preview/source-footage/`, named `C1-now.mov` to `C4-search.mov`. That folder is gitignored.
4. The end frame (icon, "Pull a thread. Watch it weave.", "Requires the Threadbase streamer on your computer.") is composed afterwards. Nothing needs recording for it.
5. Re-pair your real servers.

## Rules from Apple that shaped these clips

- Footage must be captured in the app. No hands, devices or invented UI.
- Show only what the app actually does. That is why the search query is fixed, and why the caption never calls search "smart".
- Disclose required setup. The end frame names the streamer.
- No prices, so the end frame doesn't say "free".
- 15–30 s in total. These clips cut to about 28 s.
