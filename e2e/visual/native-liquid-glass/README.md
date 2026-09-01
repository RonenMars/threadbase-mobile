# Native Liquid Glass visual references

These are committed visual references for the native Liquid Glass migration.

Two Maestro flows produce the captures. Neither is in `npm run test:e2e:mock`.
A pixel-diff runner is not wired yet: the flows write disposable PNGs under the
gitignored `e2e/_artifacts/screenshots/` directory (Maestro also nests a copy
under `~/.maestro/tests/<run>/`). Review those against the committed files here
and replace the baselines only when the visual design changes.

Requires an iOS 26+ simulator (captured on iPhone 17e / iOS 26.4) and a
**Release** build of Threadbase. `clearState: true` is mandatory for a known
first-run route; do not use it with an Expo development client, because that
clears the remembered Metro server and Maestro lands in the development
launcher instead of the app.

```bash
# First-run path (four frames, Nord + Add Server)
node e2e/run-maestro.js test e2e/native-liquid-glass-visual.yaml

# Settings viewport for every retained palette
node e2e/run-maestro.js test e2e/native-liquid-glass-settings-themes.yaml
```

`e2e/ensure-release-build.js` refuses a build stamped for a different HEAD. A
YAML-only change does not invalidate the JS bundle; set
`E2E_ALLOW_STALE_BUILD=1` in that case rather than rebuilding.

## First-run path

[`e2e/native-liquid-glass-visual.yaml`](../../native-liquid-glass-visual.yaml)
starts at the language screen, completes onboarding without a server, opens
Settings, selects Nord, and opens the Add Server sheet.

| Reference | State |
| --- | --- |
| `01-onboarding-language.png` | First-run language selection |
| `02-no-server-home.png` | Empty home after choosing to pair later |
| `03-settings-nord.png` | Settings with the Nord palette selected |
| `04-add-server-sheet.png` | Add Server sheet over the Settings backdrop |

## Settings palette gallery

[`e2e/native-liquid-glass-settings-themes.yaml`](../../native-liquid-glass-settings-themes.yaml)
opens Settings and screenshots every retained palette (9 dark, 7 light). That
matches `THEME_LABELS` in `app/settings.tsx`, excluding `system`.

Committed baselines live in `themes/`. Maestro still writes fresh captures to
`e2e/_artifacts/screenshots/`; copy over these files when the design changes.

| Reference | Palette |
| --- | --- |
| `themes/native-liquid-glass-settings-dark.png` | Dark |
| `themes/native-liquid-glass-settings-dracula.png` | Dracula |
| `themes/native-liquid-glass-settings-catppuccin.png` | Mocha |
| `themes/native-liquid-glass-settings-nord.png` | Nord |
| `themes/native-liquid-glass-settings-one-dark.png` | One Dark |
| `themes/native-liquid-glass-settings-primer-dark.png` | Primer Dark |
| `themes/native-liquid-glass-settings-solarized-dark.png` | Solarized Dark |
| `themes/native-liquid-glass-settings-rose-pine.png` | Rosé Pine |
| `themes/native-liquid-glass-settings-tokyo-night.png` | Tokyo Night |
| `themes/native-liquid-glass-settings-light.png` | Light |
| `themes/native-liquid-glass-settings-latte.png` | Latte |
| `themes/native-liquid-glass-settings-one-light.png` | One Light |
| `themes/native-liquid-glass-settings-primer-light.png` | Primer Light |
| `themes/native-liquid-glass-settings-solarized-light.png` | Solarized Light |
| `themes/native-liquid-glass-settings-rose-pine-dawn.png` | Rosé Pine Dawn |
| `themes/native-liquid-glass-settings-tokyo-night-light.png` | Tokyo Night Light |

## Failures found while capturing (2026-09-01)

### Accessibility-visible is not painted

`extendedWaitUntil` on `onboarding-language-cta` succeeded while the first
`takeScreenshot` was still a near-empty dark frame (a thin blue line, ~53 KB
instead of the ~200 KB language screen). The CTA was already in the
accessibility tree; native glass chrome had not painted.

**Fix:** `waitForAnimationToEnd` immediately before every `takeScreenshot` in
both flows. Re-running after that produced a full language screen.

### Unpaired `launchApp` is not a hub session

`AuthGate` in `app/_layout.tsx` sends a route with **no paired servers** back to
`/onboarding`, regardless of `threadbase_onboarded` in AsyncStorage.
`shouldRedirectToOnboarding` keys off `activeServerIds`, not the onboarded
flag. So:

1. Walk skip-onboarding to the empty hub in flow A.
2. Start flow B with `launchApp: clearState: false` (or `simctl terminate` +
   launch).
3. Maestro reports `hub-screen` visible (often a leftover hierarchy from the
   previous flow), then `hub-settings-btn` is missing. The failure screenshot is
   the language step.

Running the two YAML files back-to-back in one Maestro invocation does **not**
avoid this: the gallery's own `launchApp` remounts JS and AuthGate redirects.

**Fix:** the gallery YAML walks the same skip path itself (`clearState: true`,
language → welcome → pair-later → done → hub) and only then taps
`hub-settings-btn`. Do not assume an unpaired hub survives a relaunch.

The complementary pairing fact is already documented: a **paired** SecureStore
token survives `clearState`, so a sim that was paired to a real streamer skips
onboarding the other way. Uninstall or `simctl erase` if that happens.
