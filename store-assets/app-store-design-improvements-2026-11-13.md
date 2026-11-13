# App Store visual design improvements: Threadbase iOS

Written 2026-11-13, following `app-store-media-review-2026-11-13.md`.
Illustrations and render sources are in `apple/proposals/`.
Nothing was uploaded to App Store Connect or Figma.

## Sources and how sure each number is

- **App icon:** HIG App icons, read from its JSON data, and the Icon Composer page.
- **Header, search results and universal asset:** the creative-assets specifications page.
  - The safe areas came from a summarised part of that page.
  - They were then measured on Apple's template (`design-apple/creative_assets-templates.fig`), and they match within a few pixels.
  - The template is titled "OLD Creative Assets Templates" and was exported 2026-08-05, so check developer.apple.com for a newer one before final production.
- **Screenshots and previews:** the screenshot and preview specifications, App previews, and Asset best practices.
- **Testing and variants:** Discoverability, Custom product pages, Create a test, and WWDC21 session 10295.
- Some spec tables came from summaries, not the page text. Those are marked *(summary)*.

## 1. App icon

### What's wrong now

- **Corners are baked in.** The shipped `ios/.../App-Icon-1024x1024@1x.png` has rounded corners filled with white; the diagonal inset is 56 px. `assets/icon.png` has transparent corners instead.
  - HIG: "Produce appropriately shaped, unmasked layers." Pre-masked layers "negatively impacts specular highlight effects and makes edges look jagged."
- **Effects are baked in.** The icon has glows and blurs on the bars and a vignette.
  - HIG: "there's no need to include specular highlights, drop shadows between layers, beveled edges, blurs, glows."
- **Detail too fine for small sizes.** The background grid, the dots, the two hairline underlines and the thin vertical spine all vanish below 80 pt.
  - HIG warns against "extremely thin line weights."
  - See `apple/proposals/icon-compare.png`: at 40 and 29 pt the current icon reads as four smudges.
- **It's a single bitmap.** iOS has to guess the layers, and HIG says Liquid Glass then applies only to "large, simple shapes."

### Suggestions

1. **Rebuild it in Icon Composer as a layered `.icon` file.** HIG: "Provide your icon in the Icon Composer format."
   - **Background:** a solid or gradient fill made in Icon Composer, going from `#16212f` to `#0b0f15`. It must be full-bleed and square, with no corners.
   - **Foreground group 1:** three blue thread bars at 100%, 70% and 45% opacity, made from the same blue. HIG: "Vary opacity in foreground layers."
   - **Foreground group 2:** the amber bar, which is the "needs you" thread and the brand's signal colour.
   - **Remove:** grid, dots, hairlines and node rings. Make the spine a wide bar or drop it.
   - **Export:** vector (SVG/PDF) layers.
   - The draft is `apple/proposals/icon-v2.svg`. It's a sketch of the layer plan, not final art.
2. **Leave every effect to the system.** Add refraction and specular highlights per layer in Icon Composer, and keep them on the amber bar only, so that bar becomes the focal layer.
3. **Supply the appearance variants** rather than letting the system generate them: default, dark, clear light and dark, tinted light and dark.
   - The bars-on-dark design already works as the dark variant.
   - For a light default, use a pale background with the same bars, since HIG says to keep "core visual features the same."
   - The tinted and clear variants work because the shapes are simple solid fills.
4. **Watch one risk.** Four left-aligned bars on a spine can read as the letter "E." Uneven bar lengths, and starting the bars slightly off the spine, keep it reading as threads.
5. **Before release:** preview it in Icon Composer and on a device at Home Screen, Spotlight and Settings sizes.
   - Requires Xcode with Icon Composer, which needs macOS Tahoe 26.4 or later.

## 2. Product page header (3840×1646, 21:9)

### What's wrong now

- Apple only guarantees the safe area: 1646×661 at (1097, 493), centred horizontally.
- The current header is laid out left to right instead.
  - Its text starts at x=260, so most of the left-hand text sits outside the safe area.
  - The phones fill the right half.
- On a tight crop you'd see "ead. / weave." and half a phone. See `apple/proposals/header-current-safe-area.png`.

### Suggestions

1. **Centre the composition.** Apple's template shows it: the key subject in the safe area, with atmosphere spilling into the auxiliary area.
   - Proposal `apple/proposals/header-v2-3840x1646.png`, from `header-v2.html`.
     - The full tagline and line sit centred inside the safe area.
     - The two phones move to the far left and right as auxiliary art, so losing them costs nothing.
     - The glow is centred.
   - Check: `apple/proposals/header-v2-safe-area.png`.
2. **Keep text short.** Creative-asset text has to be localised for each locale. A shorter line, or the tagline alone, is less work and survives smaller crops.
3. **Consider one universal asset** (5244×2950, PNG only, safe area 1402×962 at (1921, 660)) instead of separate header and search art. It's one file for both slots, and PNG is required for hero placements on the App Store and Games tabs.
   - The trade-off: the universal safe area is smaller than the search-results one, so the phones shrink.
4. **Optional video header:** 5–30 s, 30 or 60 fps, loops, viewers can unmute it.
   - A slow "thread weaving" loop, with the threads moving between the phones, fits the brand.
   - Do this only after the stills are right.

## 3. Search results (3:2, up to 3840×2560)

### Where it stands

- `apple/search-results/threadbase-search-results-3840x2560.png` already sits inside the 2168×1030 safe area.
- It isn't uploaded. Creative assets in search show on iOS and iPadOS 27 and later.
- Earlier OS versions, and any time the slot is empty, fall back to the first three screenshots (part 5).

### Suggestions

1. **Upload it as is**, then check it with Preview in App Store Connect.
2. **Shrink the text.** The asset is a small card in a scrolling list, and video there is muted with no way to unmute. Show two things only: the headline and the phone with the amber "Needs you" card. Drop the long line, which is unreadable at card size anyway.
3. **Keep it consistent with the header.** If the header moves to the centred layout, use the same centred layout here so the two assets read as one campaign.
   - Apple: keep a "consistent palette, fonts, and tone."
4. **No prices, URLs, other-platform logos or Apple awards.** The current art has none.

## 4. App previews (videos): none exist

### Spec

- Up to 3 per device size and language, 15–30 s *(summary)*.
- Sizes: iPhone 886×1920 and iPad 1200×1600 portrait, max 30 fps.
- Formats: H.264 .mov/.m4v/.mp4, or ProRes 422 HQ.
- Previews autoplay muted and appear before screenshots.
- The default poster frame is 5 s in *(summary)*.

### Suggestions

1. **Make one 20–25 s iPhone preview** first. The iPhone set scales to every modern size.
2. **Storyboard.** It must work with no sound; one caption line per beat. Rules that apply:
   - Apple: "Start strong."
   - Only footage captured in the app. No hands, no device frames: "Don't film people interacting with a device."
   - Use "dissolves and fades"; avoid quick cuts.
   - Beats:
     - **0–4 s:** the Now tab, with the amber "Needs you" card pulsing. Caption: "Your agent needs you."
     - **4–11 s:** tap in and answer, so the session flips to Working. Caption: "Answer from anywhere."
     - **11–18 s:** the Projects tab across Work Mac, Home Mac and Linux Devbox. Caption: "Every machine. Every agent."
     - **18–24 s:** search hits. Caption: "Search every session you ran."
     - **End frame:** say "Requires the free Threadbase streamer on your computer." Apple asks you to disclose required logins or setup "within the footage or in the end frame."
     - **Loop:** cut back to the opening frame.
3. **Poster frame:** set it on the 0–4 s "Needs you" beat. Changing it after approval needs a new submission.
4. **Capture:** QuickTime screen recording from a device or simulator at native resolution, then scale to 886×1920.
   - Use the same seeded mock data as the screenshots, so no real paths or server names appear.
   - Finding 1 in the media review shows why that matters.

## 5. Screenshots

### What's wrong now

- **The first slot is the onboarding screen.** It has a Back link, a "Get started" call-to-action and outdated copy that leaves out Copilot.
  - Apple: show "what people can expect," not "calls to action."
  - With no creative asset, the first three screenshots are what search shows.
- **No captions.** At search-thumbnail size the raw UI can't be read. See the top row of `apple/proposals/search-row-compare.png`.
  - Apple: "a short phrase that enhances your visual rather than describes it."
- **Two shots are mostly empty space.** `03-waiting-for-input` shows a large empty chat with the answer at the bottom, and `05-search-engineering-memory` shows one hit and a blank screen.
- **The large-iPhone and iPad sets are a problem** (media review findings 1 and 2):
  - Personal data in the 6.5" set.
  - An outdated iPad set.

### Suggestions

1. **Reorder:** lead with `02` (needs you), then `03` (answer), then `05` (search) or `06` (projects). Move `01-welcome` to the end or drop it.
2. **Add a caption band** above a framed screenshot, in the same type and colours as the header.
   - Mocks: `apple/proposals/shot-*-captioned.png`, from `shot-*.html`.
   - Each caption is two lines of two to four words, with the second line in accent blue.
   - All captions are localised.
3. **Recapture `03` and `05` with denser seed data.** For `03`, show a full question-and-answer exchange; for `05`, five to six search hits. The phone frame then has content all the way down.
4. **Delete the 6.5" Face ID set.** The 6.1"/6.3" set (1206×2622) is the only required iPhone size and scales to the others.
   - If the art should be sharper on the largest phones, add a 6.9" set (1320×2868) rendered from the same HTML.
5. **Replace the iPad 13" set** with `apple/ipad/01–06`, captioned and ordered the same way (2064×2752).
6. **Format:** PNG with no alpha (the mocks are RGB), status bar at 9:41, and no prices, URLs or other-platform logos.

## Testing and variants: after launch, not now

- **Product page optimization tests:** the app must be "live on the App Store," so this waits for the 2.2.0 rejection to be fixed and the app released.
  - Up to 3 treatments, for up to 90 days.
  - Icon, screenshots and previews can be tested.
  - An alternate icon must ship in the live binary first, in all sizes, including 1024×1024.
  - **First test worth running:** the current icon against the flat layered icon (`icon-v2`), plus captioned against uncaptioned screenshots, each with a written hypothesis.
- **Custom product pages:** up to 70. Each can change screenshots, previews and promotional text, and gets its own keywords.
  - Header and search art aren't listed as varying per page.
  - **Natural split:** one page per agent ("Claude Code", "Codex", "Copilot"), with that agent's sessions in the screenshots and the matching keywords.
  - Use names in text only. No third-party logos in the marketing art.

## Figma

- Apple's template can't be used directly: it is a guide, holding only silhouettes and green safe-area boxes.
- The HTML pipeline already renders pixel-exact files, and its safe areas now match the template.
- Best use of Figma: import `creative_assets-templates.fig` into a personal Figma team (Drafts; drag the file into Figma) and place the final renders over its frames as one review board.
- The Starter plan allows about 20 MCP calls a month, so keep Figma for that final board rather than iterating there.

## Proposals produced (`apple/proposals/`)

| File | What |
|---|---|
| `header-current-safe-area.png` | Current header with the safe area drawn; everything outside it is dimmed |
| `header-v2-3840x1646.png`, `header-v2.html` | Centred header proposal, ready to upload |
| `header-v2-safe-area.png` | The same proposal with the safe area drawn |
| `icon-v2.svg` | Flat layered-icon sketch |
| `icon-compare.png` | Current and proposed icon at 240, 120, 80, 60, 40 and 29 pt |
| `shot-*-captioned.png`, `shot-*.html` | Captioned screenshot mocks for 02, 03 and 05, at 1206×2622 |
| `search-row-compare.png` | The first three screenshots at search size, before and after |
