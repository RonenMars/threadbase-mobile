# Running tb-mobile on Android Emulator (Mac)

## Prerequisites

- Android Studio installed with at least one AVD configured
- Available AVDs: `Medium_Phone_API_36.1`, `Pixel_9`

## One-time setup: build and install the dev client APK

The project uses `expo-dev-client`, so plain Expo Go won't work. You need to build and install a debug APK once.

### 1. Generate the Android native project

```bash
cd tb-mobile
npx expo prebuild --platform android
```

If prebuild regenerates `android/app/src/main/res/values/styles.xml` and re-adds the missing `splashscreen_logo` reference, remove this line from that file:

```xml
<item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
```

### 2. Build the debug APK

```bash
cd android
./gradlew assembleDebug
cd ..
```

### 3. Install on the emulator

Make sure the emulator is running first (launch from Android Studio or via CLI), then:

```bash
~/Library/Android/sdk/platform-tools/adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Running day-to-day

Once the APK is installed, you only need to do this each session:

### 1. Start the emulator

Launch `Pixel_9` or `Medium_Phone_API_36.1` from Android Studio's AVD Manager.

### 2. Start Metro

```bash
cd tb-mobile
npx expo start --android
```

### 3. Connect the dev client

If the dev client launcher asks for a server URL, enter:

```
http://10.0.2.2:8081
```

`10.0.2.2` is the Android emulator's alias for the Mac host (`localhost`). Do **not** enter a bare IP or hostname — the full `http://` scheme is required.

## Rebuilding the APK

Only needed when native dependencies change. JS/UI changes hot-reload without a rebuild.

```bash
cd tb-mobile/android
./gradlew assembleDebug
~/Library/Android/sdk/platform-tools/adb install ../android/app/build/outputs/apk/debug/app-debug.apk
```
