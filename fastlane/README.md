# Fastlane

Vanilla fastlane setup for shipping iOS builds to TestFlight.

```bash
cp fastlane/.env.example fastlane/.env   # fill in APP_BUNDLE_ID, APP_SCHEME, ASC_*
bundle install
bundle exec fastlane beta
```

Full documentation — including how this compares to `./scripts/ship.sh`, EAS
cloud builds, and manual Xcode — lives in [`../docs/deployment.md`](../docs/deployment.md).
