# Getting a New Build Out to TestFlight

Here is the full end-to-end walkthrough for getting your merged fixes from `main` onto TestFlight, using the CLI as much as possible.

---

## Prerequisites (one-time, skip if already done)

1. **Install the EAS CLI** (if you haven't already):

   ```bash
   npm install -g eas-cli
   ```

   Your `eas.json` requires `>= 18.6.0`. You can verify with `eas --version`.

2. **Log in to your Expo account:**

   ```bash
   eas login
   ```

3. **Apple credentials:** EAS will prompt you for your Apple Developer account credentials (or an App Store Connect API key) the first time you build for iOS. It handles provisioning profiles and certificates for you. If you have not set up an API key yet, you can do so at [App Store Connect > Users and Access > Integrations > Team Keys](https://appstoreconnect.apple.com/access/integrations/api) and then run `eas credentials` to configure it. This avoids repeated interactive login prompts.

---

## Step 1: Make sure you are on the latest `main`

```bash
git checkout main
git pull origin main
```

Verify the fixes you merged are present:

```bash
git log --oneline -5
```

---

## Step 2: Build for iOS (production profile)

Your `eas.json` has a `production` build profile with `autoIncrement: true` and the iOS image set to `latest`. This is the profile you want for TestFlight. Run:

```bash
eas build --platform ios --profile production
```

**What happens here:**
- EAS uploads your project to Expo's cloud build service.
- It auto-increments the build number (since `autoIncrement: true` is set and `appVersionSource` is `remote`).
- It builds an `.ipa` signed for App Store / TestFlight distribution.
- The build takes roughly 10-20 minutes. You can monitor progress in the terminal or at the URL it prints.

You do NOT need to open Xcode or manage certificates manually -- EAS handles all of that.

---

## Step 3: Submit to App Store Connect (TestFlight)

Once the build completes, submit it to App Store Connect. Your `eas.json` already has the submit config with your App Store Connect App ID (`6762130307`):

```bash
eas submit --platform ios --latest
```

The `--latest` flag picks up the most recent successful iOS build. Alternatively, if you want to submit a specific build, you can use:

```bash
eas submit --platform ios --id <build-id>
```

(The build ID is printed at the end of the `eas build` output.)

**Or do both in one shot:** You can combine build + submit into a single command:

```bash
eas build --platform ios --profile production --auto-submit
```

This kicks off the build and automatically submits to App Store Connect when it finishes.

---

## Step 4: Wait for Apple's processing (website required)

After submission, Apple processes the build. This typically takes 5-30 minutes. **You will need to go to the App Store Connect website for the following:**

1. **Go to [App Store Connect](https://appstoreconnect.apple.com)** > Apps > Threadbase.
2. **TestFlight tab** -- once processing completes, the build appears here.
3. **Compliance / Export Regulations** -- Apple may ask you to confirm encryption compliance. Your `app.json` already sets `ITSAppUsesNonExemptEncryption: false`, so this should be auto-answered, but occasionally Apple still shows the prompt on the web. If it does, confirm "No" and proceed.
4. **Test groups** -- If you have not already set up a test group (internal or external), create one and add your testers' Apple IDs. Internal testers (up to 100, must be App Store Connect users) get builds immediately. External testers (up to 10,000) require a brief Apple review on the first build.

> **Note:** Managing test groups and adding testers must be done through the App Store Connect website or the App Store Connect app on iOS. There is no CLI equivalent for this.

---

## Step 5: Notify your testers

Once the build is available in TestFlight (you will get an email from Apple), your testers will receive a notification through the TestFlight app if they are already in a test group. If they are new testers, send them the TestFlight invite link from App Store Connect.

---

## Summary: Commands in order

```bash
# 1. Ensure you're on latest main
git checkout main && git pull origin main

# 2. Build and auto-submit in one command
eas build --platform ios --profile production --auto-submit

# 3. (Alternative) Build and submit separately
eas build --platform ios --profile production
eas submit --platform ios --latest
```

**When you need the website:**
- App Store Connect for TestFlight processing status, compliance prompts, and managing test groups/testers.

**Everything else is CLI.** The build, signing, submission, and version incrementing are all handled by `eas build` and `eas submit`.
