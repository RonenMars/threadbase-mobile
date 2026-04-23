Sure, here is the full pipeline to get your fixes from main out to TestFlight. Everything below is CLI-first; I will flag the one spot where you need a browser.

---

## Step 1: Make sure you are on main with the latest code

```bash
git checkout main
git pull origin main
```

You said you just merged, so you should be good, but worth confirming the working tree is clean:

```bash
git status
```

---

## Step 2: Kick off a production build

This is the command that compiles the app on EAS servers and produces the `.ipa` that can go to TestFlight:

```bash
eas build --platform ios --profile production --message "Post-merge fixes for TestFlight"
```

A few notes on this:

- The `production` profile in your `eas.json` has `autoIncrement: true`, so the build number will bump automatically -- you do not need to manage it manually.
- Version source is `remote` (EAS-managed), so EAS tracks the current build number server-side.
- If you want to skip waiting in the terminal, add `--no-wait`. But I would recommend letting it run so you can see if it errors out.

When the build starts, EAS will print a URL like:

```
https://expo.dev/accounts/ronenmars/projects/threadbase-mobile/builds/<build-id>
```

Save that URL in case you need it later.

---

## Step 3: Monitor the build

If you stayed attached (no `--no-wait`), the CLI streams logs until the build finishes. If you detached, you can check status with:

```bash
eas build:list --platform ios --limit 1
```

Build statuses progress through: `new` -> `in-queue` -> `in-progress` -> `finished` (or `errored`).

You can also view a specific build:

```bash
eas build:view <build-id>
```

Wait until the status is `finished` before proceeding.

---

## Step 4: Submit to TestFlight

Once the build is finished, submit it to App Store Connect:

```bash
eas submit --platform ios --profile production --latest
```

The `--latest` flag grabs the most recent successful production iOS build, so you do not need to copy-paste a build ID.

Your `eas.json` already has the App Store Connect App ID configured (`ascAppId: 6762130307`), so EAS knows where to send it.

**Pro tip for next time:** You can combine steps 2 and 4 into a single command:

```bash
eas build --platform ios --profile production --auto-submit
```

This automatically submits to App Store Connect as soon as the build finishes.

---

## Step 5: Wait for Apple processing (you need the website here)

After EAS submits the `.ipa`, Apple processes it on their end. This takes 5-30 minutes and there is no CLI way to check the status. You need to go to:

**[appstoreconnect.apple.com](https://appstoreconnect.apple.com)** -> open **Threadbase** -> go to the **TestFlight** tab.

The build will appear there once Apple finishes processing. You will also get an email from Apple when it is ready.

---

## Step 6: Distribute to testers (website)

Still in App Store Connect under the TestFlight tab:

1. The new build should show up under your app's builds list.
2. If you have internal testers already set up, they will automatically get the new build.
3. For external test groups, select the build, assign it to your test group, and add any test notes.
4. External testing requires a brief Apple review the first time (~24 hours), but subsequent builds to the same group are usually instant.
5. Share the TestFlight link with your testers if they do not already have it.

---

## Summary

| Step | Tool | Command |
|------|------|---------|
| Build | CLI | `eas build --platform ios --profile production` |
| Monitor | CLI | `eas build:list --platform ios --limit 1` |
| Submit | CLI | `eas submit --platform ios --profile production --latest` |
| Apple processing | Website | appstoreconnect.apple.com -> TestFlight tab |
| Distribute to testers | Website | App Store Connect -> TestFlight -> manage test groups |

The only parts that require a website are checking Apple's processing status and managing your TestFlight tester groups. Everything else is CLI.

Want me to kick off the build now?
