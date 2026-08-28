# Threadbase Mobile — Codex Instructions

Keep this file to repository-specific behavior and safeguards. Agent tooling is documented in [docs/agents/tooling.md](docs/agents/tooling.md); operational diagnosis belongs in [docs/troubleshooting.md](docs/troubleshooting.md).

## Verification

- Standard checks are `npm run lint`, `npm run typecheck`, `npm run test:ci`, and `npm run test:scripts`.
- Before committing JavaScript or TypeScript, run `npx eslint` on the staged JS/TS files. Errors block; warnings do not.
- `i18next/no-literal-string` is an error. Put user-facing copy in translations. For technical literals, use a narrowly scoped disable with a reason; never exclude a mixed-copy file.
- Keep finite translation choices statically visible: state, props, helpers, and option metadata carry semantic values, while the nearest presentation boundary maps them through literal `t('namespace:key')` calls. Do not pass translation keys as application data or hide them with `preservePatterns` or artificial usage manifests; `npm run test:i18n` uses `i18next-cli status` and `status --unused` to reject missing, incomplete, and stale keys.

## E2E testing

- Maestro flows and fixtures live in `e2e/`; `npm run test:e2e:mock` is the authoritative mock suite. Add new flows to the relevant `test:e2e:*` script and prefer `testID` over unstable visible text.
- On iOS 26.x, never use Maestro `hideKeyboard`; scroll instead, or use Enter only for safe single-line inputs. XCTest/SpringBoard automation crashes are simulator failures, not app crashes. See [docs/troubleshooting.md](docs/troubleshooting.md).
- Shut down any iOS simulator or Android emulator you booted before the session ends (`xcrun simctl shutdown <UDID>` and quit Simulator.app once nothing is booted; `adb emu kill` for Android). Never erase a device; leave one that was already booted as found, and only if you recorded it as booted at the start.

## UI and components

- Never use emoji as UI icons. Use `phosphor-react-native` in all new or touched UI.
- Every new `components/**/*.tsx` file requires a colocated `*.stories.tsx` in the same commit. Rare exemptions require a reason in `scripts/git-hooks/story-exempt.txt`. Add a story when modifying an existing component if the change is small. See [docs/storybook.md](docs/storybook.md).

## Native dependencies and builds

- When `package.json` or `package-lock.json` changes, run `pod install` in `ios/` and keep `package.json`, `package-lock.json`, and `ios/Podfile.lock` together.
- Treat checksum-only drift for `ExpoModulesCore`, `ExpoWidgets`, `hermes-engine`, and `RNSentry` as path noise; use `scripts/reset-podfile-lock-path-noise.sh` rather than committing it.
- Every physical iOS device build/install must use `scripts/dev-device.sh`. Never call `npx expo run:ios --device` directly or introduce another device-build path. The script supplies the per-target App Groups signing profiles. Simulator builds are unaffected.

## Shipping

- Use `/expo-local-ship` for ordinary ship, TestFlight, build, submit, and release requests.
- Commit the `app.json` build/version bump before archive or upload.
- Version bumps land through `scripts/admin-merge-pr.sh`, never by pushing directly to `main`. Follow the branch and commit formats in [docs/deployment.md](docs/deployment.md).
- `/ship-expo-cloud` is opt-in only. Invoke it only when the user explicitly types that command, and obtain confirmation before any EAS build or submit command.

## Server compatibility

The mobile client absorbs streamer evolution: a newer server may degrade a screen but must not crash the app.

- Treat every response as untrusted input. Narrow unknown statuses and fall back to `idle`; do not rely on TypeScript exhaustiveness at the wire boundary.
- Missing optional fields omit only the affected UI.
- Probe `GET /api/info` and `GET /api/config/feature-flags`; hide or explain unsupported features instead of throwing. A failed probe means the feature is off.
- Report malformed data while keeping the rest of the screen alive. Do not invent client-side repair shims or pin a minimum server version.

## Repository workflows

- PR titles use `type(scope)?: imperative summary` with `feat`, `fix`, `chore`, `docs`, `test`, `ci`, `perf`, or `refactor`; branches use the matching `type/kebab-case-summary`. Work explicitly targeting `integration-merge-354-355-376` uses that branch as its base and rebases onto its latest tip.
- Before squash-merging with `--delete-branch`, verify no open PR uses that branch as its base; preserve a non-leaf branch until dependents are retargeted or merged.
- GitHub issue and triage conventions are delegated to [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) and [docs/agents/triage-labels.md](docs/agents/triage-labels.md). Domain documentation uses one root `CONTEXT.md` plus `docs/adr/`; see [docs/agents/domain.md](docs/agents/domain.md).

## Headless Linux agents

Headless Linux cannot run native builds, CocoaPods, shipping scripts, Maestro, or device/simulator tooling. It can run the JS checks and Expo Web.

For browser smoke tests, start the bundled mock streamer from `e2e/mock-server.js`; because it has no CORS headers, front it with a development-only CORS proxy outside the repository. Expo Web is an early spike with expected native-only gaps; see [docs/expo-web-support.md](docs/expo-web-support.md).
