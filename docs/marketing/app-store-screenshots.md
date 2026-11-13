# Recreating the App Store screenshots

The raw app screens behind the store art come from four scripted demo flows (`e2e/marketing/0{1..4}-*.yaml`) that run against a fake three-machine streamer (`e2e/marketing/demo-streamer.js`: Work Mac on 7071, Home Mac on 7072, Linux Devbox on 7073).
The captioned Poster boards, the product page header and the search-results art are composed from those screens in the Figma file's "App Store Assets" page.

## Sizes

| Set | Device | Points | Scale | Pixels | Captured with |
|---|---|---|---|---|---|
| iPhone 6.9" | iPhone 17 Pro | 402x874 | @3x | 1206x2622 | Simulator + Maestro |
| iPad 13" | iPad Pro 13-inch (M5) | 1032x1376 | @2x | 2064x2752 | Simulator + Maestro |
| Product page header | composed | | | 3840x1646 | Figma |
| Search results | composed | | | 3840x2560 | Figma |

App Store Connect scales the 6.9" and 13" sets down for the smaller devices, so only these two are uploaded.

## How the screens look

- Dark appearance, `en-US`.
- Session screens in the chat view (bubbles), which is the default since #1447.
- Search shots show hits from more than one session and machine.
- Text is large and bold.
  The app-wide type ramp is +3pt with every weight one step heavier (tokens `xs` 14, `sm` 16, `base` 17, `lg` 20, `xl` 23, `xxl` 27; 400→600, 500→700, 600→700).
  On the simulator, also turn Bold Text on, and on iPad set Dynamic Type to XXXL (below).
  iPhone stays at the default text size: at XXXL the phone truncates card titles and pushes the third machine below the fold.

## Before you capture: the tree has to carry these changes

Until they merge, capture from a branch that has all of them, or the shots will not match the store art:

- #1459, the chip view.
- #1478, which stops list markers wrapping on web.
- #1479, the server-chip tap fix.
- `feat/bigger-bolder-text`, the type ramp above.

Three spots also need hand fixes on top of the bigger type ramp: the ShelfBubble badge at 24, the help-feedback `lineHeight` at 24, and `questionLarge` skipped in QuestionCard.

## iPhone: simulator + Maestro

Same as iPad below, with an iPhone 17 Pro and without the `content_size` line:

```bash
U=$(xcrun simctl create "Marketing iPhone 17 Pro" \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro \
  com.apple.CoreSimulator.SimRuntime.iOS-26-5)
xcrun simctl boot "$U"
xcrun simctl spawn "$U" defaults write com.apple.Accessibility EnhancedTextLegibilityEnabled -bool YES  # Bold Text
xcrun simctl shutdown "$U" && xcrun simctl boot "$U"

MAESTRO_UDID="$U" MARKETING_SCREENSHOT_DIR=artifacts/marketing/threadbase-maestro/iphone npm run test:e2e:marketing

xcrun simctl shutdown "$U"
```

On a phone, Maestro's `scrollUntilVisible` swipes from the screen centre, which lands on a Working session card and never moves the list.
Flows 02 and 03 therefore swipe from the history rows on the left in a `repeat` loop instead.

## iPhone fallback: web build + Playwright (about 2 minutes, no simulator)

The shots differ from the simulator set (no status bar, web fonts), so use this only to preview a flow quickly.

```bash
npx expo export --platform web
node e2e/marketing/web-capture.mjs            # writes artifacts/marketing/threadbase-maestro/<flow>/<shot>.png
node e2e/marketing/web-capture.mjs /tmp/shots # or anywhere else
```

The script starts the demo streamer and `expo serve dist` itself, seeds the three paired servers into `localStorage`, plays each flow, and stops everything at the end.
A failed flow writes `<out>/<flow>-FAILED.png` and the script exits 1.

Web-only differences to know about:

- No iOS status bar. The Poster frames crop above the app header, so nothing shows.
- Two search rows (`conv-wm-auth-callback`, `conv-ld-search`) do not appear on web; both back a session that is live in the demo.
  The script logs them as `soft` and continues, and the shots still span two machines.
- The web build keeps stacked screens mounted, so every locator filters to visible elements and "back" pops until the hub shows.
- The splash overlay fades several seconds after the first screen mounts; each flow waits 8 s before its first step.

## iPad: simulator + Maestro

The web build gives a 1032pt-wide viewport the desktop layout, with small text and wide empty margins, so iPad stays on the simulator.
Use iOS 26.x; `e2e/check-sim.js` refuses iOS 27.

```bash
U=$(xcrun simctl create "Marketing iPad Pro 13" \
  com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M5-12GB \
  com.apple.CoreSimulator.SimRuntime.iOS-26-5)
xcrun simctl boot "$U"
xcrun simctl spawn "$U" defaults write com.apple.Accessibility EnhancedTextLegibilityEnabled -bool YES  # Bold Text
xcrun simctl ui "$U" content_size extra-extra-extra-large
xcrun simctl shutdown "$U" && xcrun simctl boot "$U"   # Bold Text applies after a reboot

MAESTRO_UDID="$U" MARKETING_SCREENSHOT_DIR=artifacts/marketing/threadbase-maestro/ipad npm run test:e2e:marketing

xcrun simctl shutdown "$U"
```

`run.sh` installs a Release build (rebuilding a stale one), sets dark appearance and a 9:41 status bar, and copies the shots out.
Use a dedicated simulator like the one above, so the text-size changes never land on a device another session uses.

## After capturing

1. Review the shots before anything else.
2. Re-run the Figma Poster jobs so the boards pick up the new screens, then export the store sizes into `store-assets/apple/`.
3. Upload to App Store Connect by hand.
