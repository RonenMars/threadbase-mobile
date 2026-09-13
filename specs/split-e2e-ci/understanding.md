# What this feature is

Split the GitHub Actions Maestro mock suite so iOS (~70–80 min) and Android (~50–55 min) no longer run as one serial job per platform.

`.github/workflows/e2e.yml` now builds the Release binary **once** per platform, then fans `package.json`'s `test:e2e:mock` flow list across parallel shards (`e2e/mock-suite-shards.js`):

- **Android:** 1 APK job → 3 emulator jobs
- **iOS:** 1 `xcodebuild` job → 2 simulator jobs
- **`flows=` dispatch:** one shard, same build job

Local `npm run test:e2e:mock` is unchanged. Each mock-suite YAML already runs `setup.yaml`, so shards do not share device state.

`chore/android-e2e-diagnosis` is a separate reliability branch (in-process Maestro batching + ADB diagnostics). Do not merge it into this split; cherry-pick diagnostics after both land.

## In scope

- Parallel CI shards for the mock suite on Android and iOS
- One Release build per platform per run, shared via artifacts (+ existing SHA caches)
- Keep `flows`, `ref`, and `platform` dispatch inputs
- Aggregator job so notify-on-failure still has one result

## Out of scope

- Fixing red flows (other session / diagnosis branch)
- Real-streamer E2E
- Running Maestro E2E on every pull request
