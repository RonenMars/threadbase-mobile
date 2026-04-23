Great, congrats on a clean TestFlight run. Here is the full end-to-end plan for bumping to 1.1.0 and releasing to the App Store.

---

## Step 1 -- Bump the marketing version in app.json

The project uses `"appVersionSource": "remote"` in eas.json, which means EAS manages the build number automatically. But the **marketing version** (the "1.0.0" users see on the App Store) lives in `app.json` and needs a manual bump.

I would change `app.json` line 4:

```diff
-    "version": "1.0.0",
+    "version": "1.1.0",
```

That is the only file change needed. The build number (the integer Apple uses to distinguish builds within a version) will auto-increment on the EAS side since `"autoIncrement": true` is set in eas.json for the production profile.

## Step 2 -- Commit the version bump

```bash
git add app.json
git commit -m "chore: bump version to 1.1.0 for App Store release"
git push
```

## Step 3 -- Run a production build

```bash
eas build --platform ios --profile production --message "1.1.0 App Store release"
```

This will:
- Use the `production` profile from eas.json (which has `autoIncrement: true` and `image: "latest"`)
- Auto-increment the build number on EAS's remote version source
- Queue a build on EAS servers

Save the build URL it prints -- you will need it to track progress.

**Optional shortcut:** If you want to skip the separate submit step later, add `--auto-submit`:
```bash
eas build --platform ios --profile production --auto-submit --message "1.1.0 App Store release"
```

## Step 4 -- Monitor the build

Watch for it to reach `finished` status:

```bash
eas build:list --platform ios --profile production --limit 1
```

Or open the build URL from step 3 in a browser to see real-time logs. Typical production builds take 10-20 minutes.

If the build fails, check the logs. Common issues:
- **Provisioning/signing errors** -- run `eas credentials --platform ios` to reset
- **Native dependency errors** -- retry with `--clear-cache`
- **Timeout** -- the `"image": "latest"` setting in eas.json should give you a capable build machine, but if it still times out, add `"resourceClass": "m-build"` under the production profile

## Step 5 -- Submit to App Store Connect

If you did not use `--auto-submit` in step 3:

```bash
eas submit --platform ios --profile production --latest
```

This sends the `.ipa` to App Store Connect using the ASC App ID `6762130307` configured in eas.json. EAS uses your App Store Connect API key for authentication -- if that fails, run `eas credentials --platform ios` and update the API key.

After submission, Apple processes the build (typically 5-30 minutes). You can track processing status at [appstoreconnect.apple.com](https://appstoreconnect.apple.com).

**If processing gets stuck:** Wait at least 1 hour. Check [Apple Developer System Status](https://developer.apple.com/system-status/) for outages. If stuck over 2 hours, re-submit.

## Step 6 -- Verify in TestFlight (smoke test)

Once Apple finishes processing, the build will appear in TestFlight. Even though you already tested 1.0.0 for a week, do a quick smoke test of the 1.1.0 build to confirm nothing broke in the version bump:

1. Install the new build from TestFlight on a physical device
2. Walk through core flows (connect to server, browse conversations, search, settings)
3. Confirm the version number shows as 1.1.0 in the app

The `ITSAppUsesNonExemptEncryption: false` flag in app.json should auto-fill the export compliance question. If TestFlight still shows a "Missing Compliance" warning, go to App Store Connect > TestFlight > select the build > "Manage Missing Compliance" > select "None of the algorithms mentioned."

## Step 7 -- Create the new version in App Store Connect

This part must be done manually in App Store Connect -- there is no CLI path for it.

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Open **Threadbase** (App ID: `6762130307`) > **App Store** tab
3. Click **"+" Version or Platform** in the left sidebar and create version **1.1.0**
4. Fill in the required fields:
   - **What's New** -- Write release notes describing what changed since 1.0.0
   - **Screenshots** -- Required on the first release; update them if the UI changed since your initial submission
   - **Description** -- Update if needed
   - **Keywords** -- Update if needed
   - **Support URL** -- Must be filled
   - **Build** -- Click the **"+"** next to Build and select the 1.1.0 build you just submitted
5. Under **App Review Information**, verify your contact info and add a demo account/notes if the app requires a server connection for review
6. Choose your release preference:
   - **Automatic release** -- goes live as soon as Apple approves
   - **Manual release** -- you click "Release This Version" yourself after approval (gives you control over timing)

## Step 8 -- Submit for App Review

Click **Submit for Review** in App Store Connect.

Apple review typically takes 24-48 hours. You will get an email when the review is complete.

**If rejected:** Go to App Store Connect > Resolution Center, read the specific reason, fix the issue, rebuild if necessary, and resubmit. Common rejection reasons:
- Crashes or bugs (that is why step 6 matters)
- Incomplete metadata (screenshots, description, support URL)
- Privacy policy missing
- Login/server connection required without demo account in review notes

## Step 9 -- Release

- If you chose **Automatic Release**: nothing to do -- it goes live when approved.
- If you chose **Manual Release**: go back to App Store Connect after approval and click **Release This Version**.

---

## Quick Reference Checklist

1. [ ] Bump `version` in app.json from `1.0.0` to `1.1.0`
2. [ ] Commit and push the version bump
3. [ ] `eas build --platform ios --profile production --message "1.1.0 App Store release"`
4. [ ] Monitor build until `finished`
5. [ ] `eas submit --platform ios --profile production --latest`
6. [ ] Wait for Apple processing (5-30 min)
7. [ ] Smoke test the build in TestFlight
8. [ ] Create version 1.1.0 in App Store Connect, fill metadata, attach build
9. [ ] Submit for App Review
10. [ ] After approval: release (manual or automatic)

Want me to start by making the version bump in app.json?
