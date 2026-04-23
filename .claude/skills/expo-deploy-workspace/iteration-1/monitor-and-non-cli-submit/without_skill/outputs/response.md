# Checking Your EAS Build Status and Distribution Options

## Finding Your In-Progress Build

The quickest way to check on a build you kicked off earlier without touching the terminal is to go to the Expo dashboard in your browser:

**https://expo.dev/accounts/ronenmars/projects/threadbase-mobile/builds**

That URL is specific to your project (owner `ronenmars`, slug `threadbase-mobile` from your app.json). The builds page will show all recent builds with their status (in progress, completed, failed, cancelled), the profile used (development, preview, or production), the platform (iOS/Android), and a direct download link once it finishes.

If you want to use the terminal instead, you would run:

```
eas build:list
```

This lists your recent builds with their status and URLs. You can also run `eas build:list --status=in-progress` to filter to active builds only.

---

## Getting the Build to Testers Without the Terminal

Once your build finishes, you have several non-CLI options depending on which build profile you used:

### 1. Direct Link from Expo Dashboard (Any Profile)

On the builds page linked above, every completed build has a download/install link. You can copy that URL and share it directly with testers via Slack, email, etc. For `internal` distribution builds (which your `development` and `preview` profiles use), testers will need their devices registered first.

### 2. Expo Dashboard "Internal Distribution" (development / preview profiles)

Your `development` and `preview` profiles in eas.json are configured with `"distribution": "internal"`. This means:
- **iOS**: Builds are ad-hoc provisioned. Testers must have their device UDIDs registered in your Apple Developer account. You can invite testers from the Expo dashboard, and they register their devices by visiting a link on their phone.
- **Android**: Testers can install the APK directly from the download link -- no special registration needed.

From the Expo dashboard you can manage which team members and testers have access.

### 3. EAS Update (Over-the-Air Updates -- No New Build Needed)

If you only changed JavaScript/assets (not native code), you can push updates to existing builds using EAS Update. This does require the terminal (`eas update`), but it is worth knowing about because it avoids a full rebuild cycle for JS-only changes.

### 4. App Store / TestFlight Submission (production profile)

Your eas.json has a `submit.production.ios` config with an ASC App ID (`6762130307`). Once a production build finishes, you can submit it to the App Store / TestFlight from the Expo dashboard -- there is a "Submit to store" button on the completed build page. You can also do this from the terminal with `eas submit`, but the dashboard option means you do not need the CLI.

For TestFlight specifically:
- Submit the production build from the Expo dashboard
- Go to App Store Connect, add testers to your TestFlight group
- Apple sends them an invite to install via the TestFlight app

For Google Play:
- Submit the production build from the Expo dashboard (or upload the AAB manually to Google Play Console)
- Set up an internal test track or closed test track in Google Play Console
- Add testers by email

### 5. QR Code from Expo Dashboard

For development builds, the Expo dashboard provides a QR code on the build detail page. Testers with the development client already installed can scan it to install/launch.

---

## Summary

| Method | Profile | Requires Terminal? | Best For |
|---|---|---|---|
| Expo dashboard download link | Any | No | Quick sharing with a few people |
| Internal distribution (device registration) | development, preview | No (dashboard) | Team testing with registered devices |
| TestFlight (via App Store Connect) | production | No (dashboard submit) | iOS beta testing at scale |
| Google Play internal track | production | No (dashboard submit) | Android beta testing at scale |
| EAS Update (OTA) | Any existing build | Yes (`eas update`) | JS-only hotfixes |

Your immediate next step: open **https://expo.dev/accounts/ronenmars/projects/threadbase-mobile/builds** and check if the build is done. If it is, grab the link or hit "Submit to store" depending on what you need.
