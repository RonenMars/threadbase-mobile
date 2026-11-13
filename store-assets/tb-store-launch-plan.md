# Threadbase — store launch plan (steps 1–3)

Nothing here has been uploaded or entered in any console. Step 4 starts only after you approve the picks below.

## Facts the copy must respect

- Threadbase is a **remote control for Claude Code and Codex** running on machines you own. The phone pairs with a self-hosted `tb-streamer`.
- Android is on Google Play closed testing and iOS on TestFlight, so both listings are for a beta. Say so, and point to `threadbase.sh/betas`.
- **Contradiction to settle before publishing.** `docs/no-hosted-service.md` says there is no hosted service, but the recent commit `e6b23399 feat(servers): reach a paired server through the Threadbase relay (#1265)` suggests a relay now exists. The copy below avoids "no cloud", "no relay" and "nothing leaves your machine". Confirm which is true, then add the privacy claim if it still holds.
- Screenshots use demo data from a scripted streamer, not real agents. That is fine for stores, but never caption them as live model output.

---

## 1. Launch copy

### App Store (iOS)

| Field | Limit | Text |
|---|---|---|
| Name | 30 | `Threadbase` |
| Subtitle | 30 | `Remote for Claude Code & Codex` (30) |
| Promotional text | 170 | `Your coding agent doesn't stop when you leave the desk. See what needs you, answer it from your phone, and pick up any session from any machine.` (146) |
| Keywords | 100 | `claude code,codex,ai agent,terminal,remote,ssh,developer,coding,session,cli,devops,monitor` (91) |
| Category | | Developer Tools (primary), Productivity (secondary) |

**Description**

```
Your coding agent is still working. Now you can be too.

Threadbase is a remote control for Claude Code and Codex. It connects your phone to the machines where your agents run, so a question or a finished task never waits for you to get back to your desk.

SEE WHAT NEEDS YOU
The hub shows every agent across every machine at a glance: who is blocked on a question, who is working, who is done. Get a notification the moment an agent needs input.

ANSWER FROM YOUR POCKET
Open the live session, read exactly what the agent asked, and reply. Send prompts, slash commands and interrupts, with Esc, Tab and arrow keys for the moments a terminal needs them.

START ANYWHERE, CONTINUE ANYWHERE
Sessions you started in a plain terminal show up automatically. Take one over from your phone, or resume an old conversation into a live session.

SEARCH EVERYTHING YOUR AGENTS EVER DID
Full-text search across every machine, project and provider. Search by the problem you remember, not the session name, and jump to the exact match.

ONE CONTROL PLANE
Pair as many machines as you like by QR code, with Claude Code and Codex side by side. Every pairing is encrypted end to end and every phone gets its own revocable credential.

BUILT FOR DEVELOPERS
- Raw terminal view and parsed chat view
- Review diffs and send a note back into the session
- Queue prompts while the agent is busy
- Voice dictation, photo and file attachments
- Face ID or biometric app lock
- English, Hebrew, Arabic and Russian, with full RTL

HOW IT WORKS
Install the open streamer on your computer (npm or Homebrew), run the pairing command, scan the QR code. Threadbase has no ad or analytics SDKs, and crash reports are opt-in.

Threadbase is in beta. Get the streamer and join at threadbase.sh/betas.
```

**What's New (first release):** `First public beta: pair your machines, see which agent needs you, and answer from your phone.`

### Google Play

| Field | Limit | Text |
|---|---|---|
| App name | 30 | `Threadbase` |
| Short description | 80 | `Remote control for Claude Code & Codex. Answer your agents from your phone.` (75) |
| Category | | Tools or Productivity (Developer tools is not a Play category; Tools is the closest fit) |
| Full description | 4000 | The App Store description above, unchanged. Play allows basic formatting, so keep the capitalised headers. |

### Shared assets still missing
- Play **feature graphic** 1024×500 and a 512×512 icon (check `assets/` for the icon).
- App Store **support URL** and Play **contact email**.
- Privacy URL `https://threadbase.sh/privacy-policy`, which `docs/store-console-wording.md` says must be updated before submitting.

---

## 2. Screenshot picks

Source: `artifacts/marketing/threadbase-maestro/` on `main` (28 images per device, captured 2026-10-06, clock pinned to 9:41). Both worktrees hold the same set, so `promo-screenshot-scripts` adds only the capture scripts, not new images.

### iPhone, 6 shots, in story order

| # | File | Caption |
|---|---|---|
| 1 | `03-control-plane/01-all-machines-all-agents.png` | Every agent. Every machine. One screen. |
| 2 | `01-start-anywhere-continue-anywhere/03-waiting-for-input.png` | Your agent asked. Answer from anywhere. |
| 3 | `01-start-anywhere-continue-anywhere/05-agent-resumed-remotely.png` | Reply, and it keeps working. |
| 4 | `02-agent-memory/02-search-engineering-memory.png` | Search by the problem you remember. |
| 5 | `03-control-plane/07-hero.png` | Machines, projects, sessions. |
| 6 | `04-onboarding/02-welcome.png` | Pull a thread. Watch it weave. |

Alternates: `02-agent-memory/05-cross-provider-memory.png` (Codex and Claude in one search), `01-.../01-session-discovered.png` ("Observed" sessions started in a terminal).

### Android phone, same 6 files from `android-phone/`

Two problems to fix first:
1. **Aspect ratio.** The captures are 1080×2424 (2.24:1). Google Play rejects phone screenshots whose long side is more than twice the short side. They need a 1080×2160 re-frame, ideally on a caption canvas rather than a crop that cuts the composer or the "New session" button.
2. **Status bar shows "3G".** The demo-mode clock is right but the network icon reads 3G. Re-capture or mask it.

### Skip
- iPad and Android tablet sets: the app has no tablet layout, so these are the phone UI stretched. The iPad portrait session screens are mostly empty. Upload them only if a store requires them.
- iPhone size: the captures are 1206×2622 (iPhone 17 Pro, 6.3"). It is unconfirmed that App Store Connect accepts that size for the 6.9" slot. If it asks for 1320×2868, the captions canvas below fixes it too.

### Recommended build
Frame each picked screenshot on a 1320×2868 (iOS) / 1080×2160 (Play) canvas with the caption above the device, using the HyperFrames or Remotion stack already in `tb-marketing`. This solves the ratio, the 3G icon and the missing captions in one pass, and it keeps the unframed originals untouched.

---

## 3. Marketing videos

### What already exists

| Project | Output | Notes |
|---|---|---|
| `tb-marketing` | `out/threadbase-demo.mp4`, `videos/threadbase-pairing` | Remotion "bookends" (needs a real screen recording at `public/demo-raw.mov`; today's clip uses a placeholder) plus the HyperFrames pairing promo, 1080×1080, 21s |
| `tb-marketing-mobile-feature-demo` | `threadbase-mobile-features-audio.mp4` | HyperFrames, 1080×1080, 18s, shows terminal, queue and search after pairing |
| `tb-promo` | `threadbase-mobile-promo/renders/video.mp4` | HyperFrames, 1080×1080, 49s, with SCRIPT, STORYBOARD and captions |
| `tb-mobile/docs/marketing/linkedin-video-flows.md` | shot lists | Three candidate flows; Flow 1 "The agent asked a question. You were at lunch." is the primary |

All three renders are square. None has been reviewed for publishing yet.

### Plan per channel

| Channel | Format | Length | Angle | Source |
|---|---|---|---|---|
| **Hacker News** | No video in the post. Link `threadbase.sh` and put the clip on the page. HN rewards the thing itself, not a trailer. | 30–45s clip on the site | Show HN: "Remote control for Claude Code / Codex from your phone". Lead with how pairing and end-to-end encryption work | `tb-promo` render, trimmed |
| **Reddit** (r/ClaudeAI, r/ChatGPTCoding, r/selfhosted, r/LocalLLaMA) | Native video or GIF, 1:1 or 4:5, no sound needed, captions burned in | 15–25s | Developer voice, no hype. The self-hosted angle for r/selfhosted, "I kept losing my agent's question while away" for the Claude subs. Read each sub's self-promotion rules first | Pairing promo cut to a GIF (`README gif variant` in the `tb-marketing` README) |
| **LinkedIn** | 4:5 or 1:1, captions, hook in the first 2s | 20–30s | Flow 1: "The agent asked a question. You were at lunch." CTA `threadbase.sh/betas` | New shoot from `linkedin-video-flows.md` Flow 1, reusing the hub and waiting-for-input screens |
| **Facebook** | 4:5, captions, muted autoplay | 15–20s | Shortest cut of LinkedIn Flow 1. Facebook is the weakest fit for this audience, so reuse and don't invest | Cut-down of the LinkedIn video |

### How to make them
1. **One master, three cuts.** Build the LinkedIn Flow 1 story once in HyperFrames in `tb-marketing-mobile-feature-demo`, then re-render at 1:1, 4:5 and 9:16 from the same composition.
2. **Footage.** Drive Maestro against `e2e/marketing/demo-streamer.js`, so the waiting-for-input state is deterministic. Push notifications can't come from the mock server, so fire them with `xcrun simctl push` and time them by hand. Record with `npm run test:e2e:ts1:record`.
3. **Reuse.** Take the pairing promo (`tb-marketing`) unchanged for the "60 seconds to paired" story, which answers the setup objection on Reddit and HN.
4. **Captions and no voiceover** for Reddit, LinkedIn and Facebook. Keep the music-and-voice version from `tb-promo` for the website.
5. **Honesty line.** If the demo uses scripted agent output, say "demo data" in the description of each post.

### Open items
- Watch the three existing renders and decide which to keep.
- `tb-marketing/TODO.md` item 2: the Bookends clip on the deployed demo page is still a placeholder.
- `CAPTURE-IPHONE.md` is stale against the current 6-frame cut.

---

## 4. Approval gate and the upload step

Before upload, sign off on:
1. The six screenshots per store, and the caption-canvas approach for the Play ratio and 3G fix.
2. The copy above, once the relay question is settled.

Upload happens in App Store Connect and Google Play Console.
"Submit for Review" and "Send for review" stay manual.
