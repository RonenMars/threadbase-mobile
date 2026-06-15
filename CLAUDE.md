# Threadbase Mobile — Claude Instructions

## E2E Testing (Maestro)

Maestro flows live in `e2e/`. Run the full mock suite with:

```bash
npm run test:e2e:mock
```

This checks for a booted iOS simulator, starts `e2e/mock-server.js` on port 7071, runs `03_hub.yaml` + `04_session_detail.yaml`, then kills the server.

**Prerequisites (one-time):** `brew install maestro` + `npm run ios` to get the app on the sim.

When adding new Maestro flows:
- Use `testID` props (not text) for elements without stable visible text — see `e2e/03_hub.yaml` for examples
- Add new flows to the relevant `test:e2e:*` script in `package.json`
- Fixtures are in `e2e/fixtures/` — extend them if the new flow needs additional data

---

## Icons

**Never use emojis in the app UI.** All icons must come from the [Phosphor Icons](https://phosphoricons.com/) library (`phosphor-react-native`). Use the appropriate Phosphor component (e.g. `<Star />`, `<Clock />`, `<Fire />`, `<GearSix />`, `<PencilSimple />`). This applies to all new code and any code you touch.

---

## Shipping / Release Pipeline

**Default ship tool: `/expo-local-ship`**

Always use `/expo-local-ship` when the user says "ship", "TestFlight", "build the app", "submit", or anything release-related.

**Always commit `app.json` before shipping:** After bumping the build number (and version if changed), stage and commit `app.json` *before* running the archive/upload step. Never ship with an uncommitted `app.json`.

**Branch & commit naming after a ship:** The version-bump commit produced by a `ship-*` script (`scripts/ship-ios.sh` / `scripts/ship-android.sh`, via `scripts/post-deploy-commit.sh`) follows a fixed convention. Use these patterns for any manual bump too:

- **Branch:** `chore/bump-<platform>-version-<N>` — where `<N>` is the new iOS build number or Android version code. E.g. `chore/bump-ios-version-140`, `chore/bump-android-version-20`.
- **Commit (iOS):** `chore(ios): bump build number to <N> [skip-ci]`
- **Commit (Android):** `chore(android): bump version code to <N> [skip-ci]`

The `[skip-ci]` suffix keeps CI from re-triggering on the bump-only commit. The bump always lands on its own branch (never `main`) and opens via PR.

**`/ship-expo-cloud` (EAS cloud builds) is opt-in only:**
- Only invoke it when the user explicitly types `/ship-expo-cloud`
- Before running any EAS build or submit command, stop and ask the user to confirm — do not proceed automatically
- Never trigger it as a side-effect of a "ship" or "commit and ship" request
