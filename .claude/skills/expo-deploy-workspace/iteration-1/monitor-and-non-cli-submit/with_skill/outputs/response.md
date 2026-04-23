# Checking Your EAS Build Status

## Finding and monitoring your build

The quickest way to find your in-flight build without the URL is to run:

```bash
eas build:list
```

This lists your recent builds with their status, profile, platform, and build ID. Your build from 20 minutes ago will be near the top. Build statuses progress through: `new` -> `in-queue` -> `in-progress` -> `finished` (or `errored` / `cancelled`).

If you want to check just the latest iOS build specifically:

```bash
eas build:list --platform ios --limit 1
```

To view the full details of a specific build once you have its ID:

```bash
eas build:view <build-id>
```

**Without the terminal**, you can also check from the web dashboard:

1. Go to [expo.dev](https://expo.dev) and sign in as `ronenmars`
2. Open the **threadbase-mobile** project
3. Click **Builds** in the sidebar
4. You will see all recent builds with real-time status, logs, and duration

Each build entry shows whether it is queued, in progress, or finished. Once it is done, you can click into it to download the `.ipa` or view the full build logs.

---

## Getting the build to testers without the terminal

Once your build finishes, you have several non-CLI options for distributing it to testers:

### Option 1: Submit to TestFlight via the Expo web dashboard

1. Go to **Builds** on [expo.dev](https://expo.dev) for the threadbase-mobile project
2. Click on the finished production build
3. Click the **Submit to App Store** button (if available on that build)
4. This sends the `.ipa` to App Store Connect, and after Apple processes it (5-30 minutes), it appears in TestFlight
5. In [App Store Connect](https://appstoreconnect.apple.com), open **Threadbase** (App ID: `6762130307`) -> **TestFlight** tab
6. Add internal testers (your team) or set up external test groups
7. Share the TestFlight link with your testers

### Option 2: Upload manually via Transporter

1. Download the `.ipa` file from the finished build page on expo.dev
2. Open the **Transporter** app (free from the Mac App Store)
3. Drag the `.ipa` into Transporter and click **Deliver**
4. Wait for Apple processing (5-30 minutes)
5. The build then appears in TestFlight in App Store Connect, same as above

### Option 3: Direct download for preview/development builds

If this was a **preview** build (internal distribution profile, not App Store), the build page on expo.dev provides a direct download link or QR code. You can share that link directly with testers who have registered devices -- no App Store Connect or TestFlight needed.

---

**Summary**: Run `eas build:list` or check expo.dev -> Builds to find your build and its status. Once finished, use the Expo dashboard's "Submit to App Store" button or download the `.ipa` and upload via Transporter to get it into TestFlight for testers -- no terminal required after that point.
