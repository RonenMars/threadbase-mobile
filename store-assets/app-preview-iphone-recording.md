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

## Preview 1: indie

A weekend booking SaaS: choose the landing-page copy from the couch, check Stripe checkout and approve the launch.
This is the first preview; its Now view and second-5 poster must make sense with the sound off.

```bash
DEMO_PROFILE=indie DEMO_HOST=0.0.0.0 node e2e/marketing/demo-streamer.js
```

Use the pairing links and dark-mode setup above.
All three profiles use Work Mac (:7071), Home Mac (:7072) and Linux Devbox (:7073).
When switching profiles, stop the streamer, start it with the next `DEMO_PROFILE`, then pull to refresh in the app.
The paired servers stay the same because the ports do not change.
Restart the same profile between takes to restore questions, gates and history.
Keep these recordings separate from the original default-profile clips.
Record a longer master take when needed, then trim the four clips to a 15–30 s preview, preserving the readable poster at second 5.

### Clip 1: "Your weekend project needs you."

1. Open **Now** and leave **Build a weekend SaaS homepage** on Work Mac visible.
2. Hold the **Needs you** card and **Use the shorter headline?** question still for 6 s, including second 5.
3. Type nothing; do not open search.

Save as `P1-C1-now.mov`.

### Clip 2: "Keep building from the couch."

1. Tap **Build a weekend SaaS homepage** on Work Mac.
2. Let **Use the shorter headline?** sit for 1 s.
3. Type exactly `Use headline 1.` in the composer and tap Send.
4. Hold while **Working**, `Edit app/page.tsx` and `12 landing page tests passed` stream into the terminal.
5. Do not open search.

Save as `P1-C2-answer.mov`.

### Clip 3: "Three machines. One launch."

1. Restart the indie streamer, return to the hub and select **Projects**.
2. Scroll through Work Mac, Home Mac and Linux Devbox; pause on the **acme-weekend**, **acme-booking** and **acme-launch** project cards.
3. Switch to **Now**, tap **Deploy the booking app** on Home Mac, read the permission card, then tap **Yes** once.
4. Hold while the checkout checks and `Deployed to booking.example.dev in 41s` stream into the terminal.
5. Type nothing; do not open search.

Save as `P1-C3-projects.mov`.
Keep a long master take of the machine scroll and gate; trim the pauses for the final cut.
The deploy is fictional terminal output from the demo, and approval uses the app's real permission card.

### Clip 4: "Find the fix. Pick it up."

1. Return to the hub, tap the magnifier and type exactly `checkout redirect`.
2. Hold the three history results: **Fix the checkout return path** (Work Mac), **Keep bookings after checkout redirects** (Home Mac) and **Test the cancelled checkout redirect** (Linux Devbox).
3. Tap **Keep bookings after checkout redirects** on Home Mac (`sc-indie-hm-conv-redirect`); hold the highlighted old solution.
4. Tap **Resume**, type exactly `Add a return-page reload regression test.` and tap Send.
5. Hold as the resumed Codex conversation becomes **Working** and `Receipt survives reload; 25 tests passed` streams into the terminal.

Save as `P1-C4-search.mov`.
Record the full search-to-resume action; trim typing and pauses while retaining both the old solution and the resumed session.

## Preview 2: oncall

A failed migration, a leaking Postgres connection and flaky CI, handled across three machines.

```bash
DEMO_PROFILE=oncall DEMO_HOST=0.0.0.0 node e2e/marketing/demo-streamer.js
```

Stop the previous streamer before starting this profile, then pull to refresh in the app.
Keep the same three paired servers; the ports and machine names stay the same.
Restart oncall between takes to restore its questions, gates and history.
Use dark mode and the same still seconds before and after each action.

### Clip 1: "The migration needs your call."

1. Open **Now** with **Repair the failed schema migration** on Work Mac visible.
2. Hold **Needs you** and **Roll back or patch forward?** still for 6 s.
3. Type nothing; do not open search.

Save as `P2-C1-now.mov`.

### Clip 2: "Unblock the fix from your phone."

1. Tap **Repair the failed schema migration** on Work Mac.
2. Pause on the recovery question, type exactly `Patch forward in batches of 500.` and tap Send.
3. Hold as the agent becomes **Working**, writes `migrations/043_backfill_order_state.sql` for a batched backfill of 500 rows that resumes from its checkpoint, and streams `32 migration tests passed`.
4. Do not open search.

Save as `P2-C2-answer.mov`.

### Clip 3: "Keep the whole team in view."

1. Restart the oncall streamer, return to the hub and select **Projects**.
2. Scroll through Work Mac, Home Mac and Linux Devbox, pausing on the **acme-orders**, **acme-jobs** and **acme-worker** project cards.
3. Switch to **Now**, tap **Run the migration recovery suite** on Home Mac and tap **Yes** on its permission card.
4. Hold while `32 recovery tests passed` and `Interrupted batches resume without duplicate rows` stream into the terminal.
5. Type nothing; do not open search.

Save as `P2-C3-projects.mov`.
Keep the full machine scroll and approval in the master take, then trim pauses for the final cut.

### Clip 4: "That timeout has a history."

1. Return to the hub, tap the magnifier and type exactly `connection pool timeout`.
2. Hold the three results: **Recover after a pool timeout** (Work Mac), **Release connections on failed queries** (Home Mac) and **Bound the worker database fanout** (Linux Devbox).
3. Tap **Release connections on failed queries** on Home Mac (`sc-oncall-hm-conv-pool-fix`) and hold the highlighted `release in finally` solution.
4. Tap **Resume**, type exactly `Add the pool-release regression case.` and tap Send.
5. Hold the resumed session as it becomes **Working** and streams `10/10 pool slots available after failure`.

Save as `P2-C4-search.mov`.
Trim the full take to retain the old solution and the resumed conversation within the preview's 15–30 s total.

## Preview 3: mixed

A weekend mobile app release on Home Mac, with flaky upload CI on Work Mac and Postgres feed tuning on Linux Devbox.

```bash
DEMO_PROFILE=mixed DEMO_HOST=0.0.0.0 node e2e/marketing/demo-streamer.js
```

Stop the previous streamer, start mixed and pull to refresh in the app.
The same paired servers remain valid because the ports and machine names stay the same.
Restart mixed between takes to reset questions, gates and resumed sessions.
Keep dark mode and the still seconds used for the other previews.

### Clip 1: "Your side project. Your call."

1. Open **Now** and keep **Prepare the weekend app release** on Home Mac visible.
2. Hold **Needs you** and **Include offline mode in this build?** still for 6 s.
3. Type nothing; do not open search.

Save as `P3-C1-now.mov`.

### Clip 2: "Choose the scope from anywhere."

1. Tap **Prepare the weekend app release** on Home Mac.
2. Pause on the question, type exactly `Ship streaks only. Leave offline mode out.` and tap Send.
3. Hold while **Working**, `Edit release-notes.md` and `21 streak tests passed` appear in the streamed reply.
4. Do not open search.

Save as `P3-C2-answer.mov`.
The agent prepares the release scope; this action does not upload or submit a mobile build.

### Clip 3: "Work and weekends, together."

1. Restart the mixed streamer, return to the hub and select **Projects**.
2. Scroll through all three machines, pausing on the **acme-storage**, **acme-pocket** and **acme-feed** project cards.
3. Switch to **Now**, open **Run the storage regression suite** on Work Mac and tap **Yes** on the permission card.
4. Hold as `68 storage tests passed` streams into the terminal.
5. Type nothing; do not open search.

Save as `P3-C3-projects.mov`.
Record the full sequence as a master take; trim navigation and pauses for the final preview.

### Clip 4: "Find an old fix. Continue it."

1. Return to the hub, tap the magnifier and type exactly `duplicate webhook`.
2. Hold the three results: **Reject the duplicate webhook delivery** (Work Mac), **Handle the duplicate webhook receipt** (Home Mac) and **Make webhook writes idempotent** (Linux Devbox).
3. Tap **Make webhook writes idempotent** on Linux Devbox (`sc-mixed-ld-conv-webhook`) and hold the highlighted solution about the unique event constraint.
4. Tap **Resume**, type exactly `Add the concurrent webhook regression test.` and tap Send.
5. Hold as the resumed Codex session becomes **Working** and streams `20 concurrent deliveries produce one activity row`.

Save as `P3-C4-search.mov`.
Keep both finding the old answer and resuming it in the final cut, trimming typing and pauses to fit the 15–30 s preview.

For all three previews, transfer the twelve uniquely named `.mov` files to the source-footage folder named above.
Watch every take for personal data and notifications before composing the previews.
