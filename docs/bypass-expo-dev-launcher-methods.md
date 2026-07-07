# Methods to Bypass Expo Dev Launcher in Debug Mode

Here are the four primary methods to bypass or skip the Expo Dev Launcher screen without switching to a production Release build.

> This project uses **Method 1** — see [`expo-dev-launcher.md`](./expo-dev-launcher.md) for how it applies to tb-mobile specifically and why it was chosen over the alternatives below.

---

## Method 1: Change the Launch Mode Configuration
You can configure the Dev Client to completely skip its home menu UI and immediately launch your last-opened development bundle.

1. Open your `app.json` file.
2. Add the `expo-dev-client` plugin object with the `"launchMode": "most-recent"` property:

```json
{
  "expo": {
    "name": "My App",
    "slug": "my-app-slug",
    "plugins": [
      [
        "expo-dev-client",
        {
          "launchMode": "most-recent"
        }
      ]
    ]
  }
}
```

3. Regenerate your native folders to apply the changes to the native code:
   ```bash
   npx expo prebuild --clean
   ```

*Note: `most-recent` automatically bypasses the launcher screen and attempts to load your last active local development bundle directly.*

---

## Method 2: Bypass via Direct Deep Link
You can force your device or emulator to completely skip the Dev Launcher UI by triggering a deep link command from your computer terminal. 

1. Ensure your local Metro bundler is running (`npx expo start`).
2. Execute the platform-specific terminal command (replace `my-app-slug` with your project's scheme/slug from `app.json`):

### iOS Simulator
```bash
xcrun simctl openurl booted "exp+my-app-slug://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

### Android Emulator / Connected Device
```bash
adb shell am start -a android.intent.action.VIEW -d "exp+my-app-slug://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"
```

---

## Method 3: Temporarily Remove the Dev Client Package
If you want a pure, bare-metal React Native runtime experience without any Expo Dev UI code injected into your debug app, you can build without the library entirely.

1. Uninstall the package:
   ```bash
   npm uninstall expo-dev-client
   ```
2. Wipe the existing native directories:
   ```bash
   rm -rf android ios
   ```
3. Generate pure native directories:
   ```bash
   npx expo prebuild
   ```
4. Run your debug build:
   ```bash
   npx expo run:android
   # OR
   npx expo run:ios
   ```

The app will now look for the Metro bundle immediately on startup without any launcher interface intervening.

---

## Method 4: Build a Local Release (Production) Variant
If you change your mind and want to see exactly how the app runs outside of a development environment, you can run a release build locally. This disables the debug overlay completely.

1. Clean old debug directories:
   ```bash
   npx expo prebuild --clean
   ```
2. Build for your target platform:
   * **iOS (Simulator):** `npx expo run:ios --configuration Release`
   * **Android (Emulator):** `npx expo run:android --variant release`
   * **Physical Device:** Add the `--device` flag to either command.
