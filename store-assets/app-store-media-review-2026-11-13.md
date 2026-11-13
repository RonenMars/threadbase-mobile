# App Store media review: Threadbase iOS 1.0

Checked 2026-11-13 in App Store Connect (version 1.0, "Prepare for Submission", locale English (U.S.)).
Nothing in App Store Connect was changed during this review.

## Status

The version is rejected and needs attention.
The banner names **2.2.0 Performance: Beta Testing**.

## Where the existing header came from

The header was designed on 2026-10-10.

- The HTML source is `apple/header/header.html`.
- The render is `apple/header/threadbase-header-3840x1646.png`, 3840×1646.
- It was rendered with headless Chrome at a device scale factor of 1.

## New: Search Results asset (not uploaded yet)

| | |
|---|---|
| File | `apple/search-results/threadbase-search-results-3840x2560.png` |
| Source | `apple/search-results/search-results.html` |
| Size | 3840×2560 (3:2, the maximum size), RGB PNG, no alpha channel |

- **Design:** the same design as the header. It has the dark `#0d1117` background, the "// AMBIENT CODING" label, "Pull a thread. / Watch it weave.", and the line "A remote control for Claude Code, OpenAI Codex and GitHub Copilot, on the device you actually carry." It uses the same two iPhone screenshots, `02` and `05`.
- **Safe area:** Apple's safe area for Search Results is 2168×1030 at offset (836, 765). The text and both phones sit inside it. Cropping the render to exactly that rectangle keeps all the text, and loses only the outer edges of the phone frames.
- **Outer area:** the space around the safe area holds faint blue and amber thread lines only. Apple calls this the auxiliary art area, and it may be cropped on some devices.
- **To upload:** App Store Connect → Product Page → Header and Search Results → Search Results → Upload. Then check the crop with **Preview**.

## Apple's specs for these assets

Sources: [Asset best practices](https://developer.apple.com/app-store/asset-best-practices/) and [Creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications).
The specifications page was only partly read word for word, and the rest was summarised.
The safe-area numbers below come from the summarised part, so confirm them with the Preview tool.

| | Product page header | Search results | Universal (both slots) |
|---|---|---|---|
| Aspect ratio | 21:9 | 3:2 | 16:9 |
| Size | 3840×1646 | 1920×1280 up to 3840×2560 | 5244×2950, PNG only |
| Art safe area | 1646×661 at (1097, 493) | 2168×1030 at (836, 765) | 1402×962 at (1921, 660) |

- **Not allowed:** alpha channels or transparency, prices, URLs, logos of other platforms, and Apple awards.
- **Video in search results:** muted, with no way to unmute.
- **Fallback:** without a Search Results asset, the App Store shows your screenshots or app previews in search results.
- **Which OS shows them:** creative assets appear in search results on iOS and iPadOS 27 and later.

### Possible problem with the current header

If the header safe area really is 1646×661 at (1097, 493), the header's text falls outside it.
The text starts at x=260, so a narrow crop could cut off the left side of "Pull a thread."
Check the Header with **Preview** before changing anything.

## App Previews and Screenshots: current state

### Version page tab

| Device | Previews | Screenshots |
|---|---|---|
| iPhone with Dynamic Island (medium display) | 0/3 | 6/10 |
| iPhone Duo | 0/3 | 0/10 |
| iPad 13" | 0/3 | 4/10 |
| Apple Watch | none | 0/10 |

### Media Manager (every size)

File names come from each image's accessibility label in App Store Connect.

**iPhone**

- **Dynamic Island, medium display (required), 6 screenshots.** This is the October launch set, `apple/iphone/01–06`:
  1. `01-welcome`: "Pull a thread. Watch it weave.", "A remote control for Claude Code and Codex…", and a "Get started" button.
  2. `02-all-machines-all-agents`: the Now tab with the "Only what needs me" filter, one card that needs you, two working, and a Work Mac group.
  3. `03-waiting-for-input`: the "Summarize session persistence" session, which needs you, with its answer.
  4. `04-agent-resumed-remotely`: the same session while it's working, after a second prompt.
  5. `05-search-engineering-memory`: a search for "Auth0 localhost callback multiple environments".
  6. `06-hero-projects`: the Projects tab across Work Mac, Home Mac and Linux Devbox.
- **Face ID, large display (optional, 6.5"), 5 screenshots.** This is an older set of real-device captures:
  1. `01-hub-tree-view`: a tree of folders on the dev machine.
  2. `02-search-results`: a search for "Deploy" with the keyboard open.
  3. `03-conversation-view`: a session conversation.
  4. `04-settings-multiserver`: the Settings screen with the list of servers.
  5. `05-loading-state`: a loading spinner only.
- **Other sizes:** Dynamic Island large, iPhone Duo, Face ID medium, and the four Home Button sizes are all empty.

**iPad**

- **13" display (required), 4 screenshots**, from an older simulator round dated 2026-06-01:
  1. `shots-02-session-waited`: a chat about resuming a Claude Code session with bookmarks. Its status bar reads 17:58, not 9:41.
  2. `Simulator Screenshot - iPad Pro 13-inch (M5) - 2026-06-01 at 06.46.49`: an empty "my-project" session with a loading state.
  3. `Simulator Screenshot - … at 06.47.18`: the Settings screen, with theme, servers and notifications.
  4. `Simulator Screenshot - … at 06.54.05`: Settings with the "Add Server" sheet and the on-screen keyboard open.
- **Optional sizes:** iPad Pro (2nd Gen) 12.9", 11", 10.5" and 9.7" are all empty.
- **Not uploaded:** the newer set in `apple/ipad/01–06` (welcome, all machines and agents, waiting for input, agent resumed remotely, search, projects).

**Apple Watch and iMessage App:** empty.
They only matter if the app ships a Watch app or an iMessage extension.

## Findings

1. **The large-iPhone set exposes personal data.**
   The 5 Face ID large-display screenshots show the home folder path, private machine and server names, a real server URL, and names of other repos.
   Two of them are weak marketing: one has the keyboard covering half the screen, and one is only a spinner.
   Their status bars read 23:08–23:30 instead of 9:41.
   Because they sit in a size-specific slot, they likely replace the main set on large-screen iPhones.
   This fallback behaviour is unconfirmed.
2. **The iPad set is old.**
   It doesn't match the current iPhone set, two of its four shots are Settings screens, one is a loading state, and the newer `apple/ipad/` set was never uploaded.
3. **The welcome screenshot copy is out of date.**
   `01-welcome` says "Claude Code and Codex".
   The header and the Search Results image say "Claude Code, OpenAI Codex and GitHub Copilot".
4. **No app previews** (videos) exist for any device.
5. **The Search Results slot is empty.**
   The new asset above is ready for it.

## Recommended actions

- [ ] Remove the 5 screenshots under iPhone with Face ID (large display), so large iPhones fall back to the main 6-image set.
- [ ] Replace the 4 iPad 13" screenshots with `apple/ipad/01–06`.
- [ ] Upload `apple/search-results/threadbase-search-results-3840x2560.png` to the Search Results slot and check it with Preview.
- [ ] Check the Header crop in Preview against the 1646×661 safe area.
- [ ] Optionally, regenerate `01-welcome` with the Copilot wording on both iPhone and iPad.
- [ ] Optionally, add an app preview video for the iPhone medium display, 886×1920.
- [ ] Resolve the 2.2.0 Beta Testing rejection before resubmitting.
