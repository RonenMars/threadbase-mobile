# Native Liquid Glass visual references

These are committed visual references for the native Liquid Glass migration.

The checked path starts at the language screen, completes onboarding without a
server, opens Settings, selects the Nord palette, and opens the Add Server
sheet. The matching automated capture flow is
[`e2e/native-liquid-glass-visual.yaml`](../../native-liquid-glass-visual.yaml).

| Reference | State |
| --- | --- |
| `01-onboarding-language.png` | First-run language selection |
| `02-no-server-home.png` | Empty home after choosing to pair later |
| `03-settings-nord.png` | Settings with the Nord palette selected |
| `04-add-server-sheet.png` | Add Server sheet over the Settings backdrop |

Captured September 1, 2026 on an iPhone 17e simulator running iOS 26.4, which
supports the native `expo-glass-effect` API.

Regenerate Maestro artifacts with:

```bash
node e2e/run-maestro.js test e2e/native-liquid-glass-visual.yaml
```

The flow writes fresh captures to the ignored
`e2e/_artifacts/screenshots/` directory. Review those captures against these
references and intentionally replace the committed PNGs when the visual design
changes. A pixel-diff runner is not wired yet; this layout makes that a
contained follow-up rather than mixing baselines with disposable artifacts.

Use a fresh release-style app state for the full first-run route. Do not use
`clearState: true` with an Expo development client: that intentionally clears
its saved Metro-server choice and returns Maestro to the development launcher
instead of Threadbase.
