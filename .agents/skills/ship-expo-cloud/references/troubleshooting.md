# Troubleshooting

Common issues encountered during the EAS build/submit pipeline and how to resolve them.

## Table of Contents

1. [Build Failures](#build-failures)
2. [Submission Issues](#submission-issues)
3. [TestFlight Problems](#testflight-problems)
4. [App Store Review Rejections](#app-store-review-rejections)
5. [Version Conflicts](#version-conflicts)

---

## Build Failures

### Provisioning / Signing Errors

**Symptom:** Build fails with "No matching provisioning profile" or "Code signing" errors.

```bash
# Let EAS manage credentials (recommended)
eas credentials

# Reset iOS credentials entirely
eas credentials --platform ios
# Select "Remove" then re-run the build — EAS will re-generate
```

If using manual signing, verify in Apple Developer Portal that:
- The provisioning profile matches the bundle ID `com.ronenmars.threadbase`
- The certificate hasn't expired
- The profile includes the correct devices (for development/ad-hoc)

### Native Dependency Errors

**Symptom:** Build fails during `pod install` or Gradle sync.

```bash
# Force clean build (clears EAS cache)
eas build --platform ios --profile production --clear-cache

# Locally verify pods resolve
cd ios && pod install --repo-update && cd ..
```

### Out of Memory / Timeout

**Symptom:** Build killed or timed out on EAS servers.

- Check if `image: "latest"` is set in eas.json for the profile (uses a more powerful build machine)
- For very large apps, consider `resourceClass: "m-build"` in eas.json

---

## Submission Issues

### "No builds found" When Submitting

```bash
# List available builds to verify one exists
eas build:list --platform ios --profile production --status finished

# Submit a specific build by ID instead of --latest
eas submit --platform ios --profile production --id <build-id>
```

### Apple Credentials Error During Submit

**Symptom:** "Authentication failed" or "Invalid API key" during `eas submit`.

EAS uses an App Store Connect API key for submissions. If it fails:
1. Run `eas credentials --platform ios`
2. Select "App Store Connect API Key"
3. Follow prompts to create or update the key
4. Verify the key has "App Manager" or "Admin" role in App Store Connect

### "App ID does not match" Error

Verify the `ascAppId` in eas.json matches the app in App Store Connect:
- Current config: `6762130307`
- Check at appstoreconnect.apple.com -> App Information -> Apple ID

---

## TestFlight Problems

### Build Stuck in "Processing"

Apple processing usually takes 5-30 minutes but can occasionally take hours.

- Wait at least 1 hour before investigating
- Check [Apple Developer System Status](https://developer.apple.com/system-status/) for outages
- If stuck >2 hours, the build may have failed silently — re-submit

### "Missing Compliance" Warning

The app has `ITSAppUsesNonExemptEncryption: true` in app.json, so the build declares non-exempt encryption and TestFlight expects App Encryption Documentation on file in App Store Connect. Apple must approve that document before any build can carry it. If TestFlight still shows a compliance warning:

1. Go to App Store Connect -> TestFlight -> select the build
2. Click "Manage Missing Compliance"
3. Select "None of the algorithms mentioned" (since we only use HTTPS)

### External Testers Not Receiving Build

For external testing groups:
- First submission requires Apple review (~24h)
- Subsequent builds to the same group are usually auto-approved
- Verify the tester's email matches their Apple ID

---

## App Store Review Rejections

### Common Rejection Reasons

1. **Crashes / Bugs** — Always smoke test via TestFlight before submitting
2. **Incomplete Metadata** — Screenshots, description, and support URL must all be filled
3. **Login Required** — If the app needs a server connection, provide a demo account in review notes
4. **Privacy Policy Missing** — Required for apps that collect any user data

### Responding to Rejections

1. Go to App Store Connect -> Resolution Center
2. Read the specific rejection reason
3. Fix the issue, rebuild if needed, and resubmit
4. Reply in Resolution Center explaining what changed

---

## Version Conflicts

### Build Number Already Exists

**Symptom:** "The build number has already been used" during submission.

```bash
# Check current build number
eas build:version:get --platform ios

# Increment manually if auto-increment failed
eas build:version:set --platform ios --build-number <N+1>
```

### Version Source Conflicts

The project uses `"appVersionSource": "remote"` — EAS manages the version server-side.
Do NOT manually change `version` in app.json for build numbers. Only change it for
marketing version bumps (e.g., 1.0.0 -> 1.1.0).

```bash
# Sync local version with what EAS has
eas build:version:sync --platform ios
```
