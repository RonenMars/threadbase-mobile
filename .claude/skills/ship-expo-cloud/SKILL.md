---
name: ship-expo-cloud
description: >
  Build, monitor, and publish the Threadbase mobile app via Expo EAS. Covers
  the full pipeline: EAS Build (dev/preview/production), monitoring build
  progress, submitting to TestFlight, and releasing to the App Store. Provides
  both CLI commands and web-dashboard walkthroughs. Use this skill whenever the
  user mentions building the app, pushing to Expo, checking build status,
  submitting to TestFlight, publishing to the App Store, or anything related to
  EAS build/submit workflows. Also trigger when the user asks about app
  versioning, build profiles, or release management for the mobile app.
---

# Expo Deploy

End-to-end build and release pipeline for the Threadbase iOS app using EAS (Expo Application Services).

## Project Quick Reference

| Key | Value |
|-----|-------|
| Bundle ID | `com.ronenmars.threadbase` |
| ASC App ID | `6762130307` |
| EAS Project ID | `35430e75-2718-4261-a46c-d6f6ff1e27c3` |
| Owner | `ronenmars` |
| Slug | `threadbase-mobile` |
| Version source | Remote (EAS-managed) |
| Auto-increment | Production builds only |

## Workflow Overview

There are four main workflows, each available via CLI or web dashboard:

1. **Build** — compile the app on EAS servers
2. **Monitor** — track build progress and retrieve artifacts
3. **Submit to TestFlight** — send a build to App Store Connect for beta testing
4. **Release to App Store** — promote a TestFlight build to production

The typical release flow is: **Build** -> **Monitor** -> **Submit to TestFlight** -> test -> **Release to App Store**.

---

## 1. Build

### CLI

```bash
# Production build (App Store / TestFlight)
eas build --platform ios --profile production

# Preview build (internal distribution, no App Store)
eas build --platform ios --profile preview

# Development build (dev client with hot reload)
eas build --platform ios --profile development

# Android production build
eas build --platform android --profile production
```

After running `eas build`, EAS prints a build URL like:
```
https://expo.dev/accounts/ronenmars/projects/threadbase-mobile/builds/<build-id>
```
Save this URL — it's how you track the build.

**Flags worth knowing:**
- `--auto-submit` — automatically submit to the App Store when the build finishes
- `--no-wait` — start the build and return immediately (don't block the terminal)
- `--message "description"` — attach a note to the build for your team
- `--clear-cache` — force a clean build (useful when native deps change)

### Web Dashboard

1. Go to [expo.dev](https://expo.dev) -> sign in as `ronenmars`
2. Open project **threadbase-mobile**
3. Click **Builds** in the sidebar
4. Click **Build from GitHub** or trigger manually
5. Select platform (iOS) and profile (production/preview/development)

---

## 2. Monitor Build

### CLI

```bash
# List recent builds (shows status, profile, platform)
eas build:list

# View a specific build by ID
eas build:view <build-id>

# Stream build logs in real time (blocks until complete)
# The URL printed by `eas build` opens the log viewer in browser
```

Build statuses: `new` -> `in-queue` -> `in-progress` -> `finished` (or `errored`/`cancelled`).

**Polling a build until it finishes:**
```bash
# Check status of the most recent iOS production build
eas build:list --platform ios --status finished --limit 1
```

### Web Dashboard

1. Go to [expo.dev](https://expo.dev) -> **threadbase-mobile** -> **Builds**
2. Each build shows real-time status, logs, and duration
3. Once finished, click the build to download the `.ipa` (iOS) or `.apk`/`.aab` (Android)

---

## 3. Submit to TestFlight

Submitting sends the built `.ipa` to App Store Connect. From there, Apple processes it (5-30 minutes), and it appears in TestFlight for beta testers.

### CLI

```bash
# Submit the most recent production iOS build
eas submit --platform ios --profile production --latest

# Submit a specific build by ID
eas submit --platform ios --profile production --id <build-id>

# Submit a specific build by URL
eas submit --platform ios --profile production --url <build-url>
```

The `--latest` flag grabs the most recent successful build for the given profile and platform.

**Combine build + submit in one step:**
```bash
eas build --platform ios --profile production --auto-submit
```

After submission, Apple processes the build. Track processing status in App Store Connect (see web workflow below).

### Web Dashboard

**Option A — Via Expo Dashboard:**
1. Go to **Builds** -> click the finished production build
2. Click **Submit to App Store** (if the button is available)

**Option B — Via App Store Connect (manual upload):**
1. Download the `.ipa` from the Expo build page
2. Open **Transporter** app (free from Mac App Store)
3. Drag the `.ipa` into Transporter and click **Deliver**
4. Wait for Apple processing (5-30 min)

**Option C — Via App Store Connect web:**
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Open **Threadbase** (App ID: `6762130307`)
3. Go to **TestFlight** tab
4. The build will appear once Apple finishes processing

**After the build arrives in TestFlight:**
- Add internal testers (your team) or external test groups
- For external testing, Apple requires a brief review (~24h first time, faster after)
- Share the TestFlight link with testers

---

## 4. Release to App Store (Production)

There is no fully-automated CLI path to the App Store — Apple requires manual metadata review and submission through App Store Connect. Here's the full process:

### Pre-submission (CLI can help)

```bash
# Verify the build exists and is in "finished" state
eas build:list --platform ios --profile production --status finished --limit 1

# If not already submitted to ASC, submit it
eas submit --platform ios --profile production --latest
```

### App Store Connect (required for all releases)

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Open **Threadbase** -> **App Store** tab
3. Click **"+" Version or Platform** in the sidebar to create a new version (e.g., 1.1.0)
4. Fill in / update:
   - **What's New** — release notes for this version
   - **Screenshots** — required on first release, update if UI changed
   - **Description, Keywords, Support URL** — update if needed
   - **Build** — click the "+" next to Build and select the submitted build
5. Under **App Review Information**, verify contact info and demo account if needed
6. Click **Submit for Review**

Apple review typically takes 24-48 hours. You'll get an email when approved.

**After approval:**
- If you chose **Manual Release**, go back to App Store Connect and click **Release This Version**
- If you chose **Automatic Release**, it goes live as soon as it's approved

### Version Management

EAS handles version auto-increment for production builds (configured in `eas.json`). The version source is `remote`, meaning EAS tracks the current build number server-side.

```bash
# Check current version info
eas build:version:get --platform ios

# Manually set version (rarely needed)
eas build:version:set --platform ios --build-number <N>
```

---

## Troubleshooting

Read `references/troubleshooting.md` for common issues like:
- Build failures (provisioning, signing, native deps)
- Submission rejections (metadata, compliance, screenshots)
- TestFlight processing stuck
- Version/build-number conflicts

---

## Full Release Checklist

Use this checklist when doing a production release:

1. [ ] All tests pass locally and in CI
2. [ ] Version bump (if needed beyond auto-increment)
3. [ ] `eas build --platform ios --profile production`
4. [ ] Monitor build until `finished`
5. [ ] `eas submit --platform ios --profile production --latest`
6. [ ] Wait for Apple processing in App Store Connect
7. [ ] Verify build in TestFlight — install and smoke test
8. [ ] Create new version in App Store Connect
9. [ ] Write release notes, attach build, update screenshots if needed
10. [ ] Submit for App Review
11. [ ] After approval: release (manual or automatic)
