# Full App Store Release: 1.0.0 -> 1.1.0

Congrats on a successful TestFlight week! Here's the full rundown for shipping 1.1.0 to the App Store.

---

## 1. Bump the Version

You need to update the version in two places:

**app.json** -- change `expo.version` from `"1.0.0"` to `"1.1.0"`:

```json
"version": "1.1.0",
```

**package.json** -- change `version` from `"1.0.0"` to `"1.1.0"`:

```json
"version": "1.1.0",
```

Note: Your `eas.json` has `"appVersionSource": "remote"` and `"autoIncrement": true` on the production profile, which means EAS manages the `buildNumber` (iOS) / `versionCode` (Android) automatically. You only need to bump the user-facing `version` string yourself.

## 2. Run Tests and Checks

Before building, make sure everything is clean:

```bash
npm run typecheck
npm run lint
npm run test:ci
```

Fix anything that fails before proceeding.

## 3. Commit the Version Bump

```bash
git add app.json package.json
git commit -m "chore: bump version to 1.1.0 for App Store release"
git push origin main
```

## 4. Build for Production

Kick off a production build through EAS:

```bash
# iOS
eas build --platform ios --profile production

# Android (if you're also releasing to Google Play)
eas build --platform android --profile production
```

This will queue builds on Expo's servers. The iOS build will produce an `.ipa` and the Android build an `.aab`. The `autoIncrement: true` setting in your production profile will automatically bump the `buildNumber`/`versionCode` on the remote.

Wait for the builds to complete. You can monitor them at https://expo.dev or with:

```bash
eas build:list
```

## 5. Submit to the App Store

Once the iOS build succeeds, submit it to App Store Connect:

```bash
eas submit --platform ios --profile production
```

Your `eas.json` already has the `ascAppId` configured (`6762130307`), so EAS knows which App Store Connect app to target. This will upload the build to App Store Connect.

For Android/Google Play (if applicable):

```bash
eas submit --platform android --profile production
```

(This requires a Google Play service account key to be configured -- if you haven't set that up yet, you'll need to add it to `eas.json` under `submit.production.android`.)

## 6. Configure the Release in App Store Connect

After the build is uploaded and processed (can take 10-30 minutes):

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select the Threadbase app
3. Go to the **App Store** tab
4. If there isn't already a version 1.1.0 prepared, click **+ Version or Platform** and create iOS version 1.1.0
5. Select the uploaded build under the **Build** section
6. Fill in / update:
   - **What's New in This Version** -- release notes for users
   - **Screenshots** -- update if the UI has changed since 1.0.0
   - **Description** -- update if needed
   - **Keywords** -- update if needed
   - **App Review Information** -- make sure contact info and any demo credentials are current
7. Under **App Review**, verify that the encryption declarations are correct (you already have `ITSAppUsesNonExemptEncryption: false` in your Info.plist, which is good)

## 7. Submit for App Review

In App Store Connect:

1. Click **Add for Review**
2. Choose your release method:
   - **Manual release** -- you control exactly when it goes live after approval
   - **Automatic release** -- goes live as soon as Apple approves it
   - **Scheduled release** -- goes live at a specific date/time after approval
3. Click **Submit to App Review**

Apple review typically takes 24-48 hours, though it can be faster.

## 8. Release

- If you chose **manual release**: once approved, go back to App Store Connect and click **Release This Version**
- If you chose **automatic**: it will go live on its own after approval
- If you chose **scheduled**: it will go live at your chosen time

## 9. Post-Release

- **Tag the release in git**:
  ```bash
  git tag v1.1.0
  git push origin v1.1.0
  ```
- **Monitor for crashes** via App Store Connect analytics or any crash reporting service you have integrated
- **Check reviews** in App Store Connect for user feedback on the new version

---

## Quick Reference: Command Summary

```bash
# 1. Version bump (manual edits to app.json and package.json)
# 2. Verify
npm run typecheck && npm run lint && npm run test:ci

# 3. Commit
git add app.json package.json
git commit -m "chore: bump version to 1.1.0 for App Store release"
git push origin main

# 4. Build
eas build --platform ios --profile production

# 5. Submit
eas submit --platform ios --profile production

# 6-8. App Store Connect (manual steps in the web UI)

# 9. Tag
git tag v1.1.0
git push origin v1.1.0
```

## Things to Watch Out For

- **Build number conflicts**: Since you've been doing TestFlight builds at 1.0.0, your remote build number has been incrementing. The `autoIncrement: true` setting should handle this, but if you hit a conflict, you can manually set it with `eas build:version:set`.
- **App Review rejection**: The most common reasons are missing privacy policy, broken links, or incomplete metadata. Double-check these before submitting.
- **Phased release**: For your first public release after TestFlight, you might want to consider enabling phased release in App Store Connect, which rolls out to users gradually over 7 days. This gives you time to catch issues before 100% of users get the update.
