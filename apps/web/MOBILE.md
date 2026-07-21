# Mobile apps (Capacitor)

The Android and iOS apps are the same React/Vite web app (`apps/web`), wrapped
by [Capacitor](https://capacitorjs.com) into native shells. There is no
separate mobile codebase — UI, state, API calls, and business logic are 100%
shared with the website. Native projects live in `ios/` and `android/`, committed to git (Capacitor
convention — `cap sync` only updates web assets and plugin registration, so
anything hand-customized later — permissions, signing config, native code —
would be lost on a fresh clone if these were gitignored). Only the build
output *inside* them (`android/build/`, `ios/App/Pods/`, etc.) is ignored.

## One-time setup (already done on this machine)

- JDK 17 (Microsoft build) — required by the Android Gradle build.
- Android SDK command-line tools, installed to `C:\Android`, with
  `ANDROID_HOME` set.
- `npx cap add ios` / `npx cap add android` — generates the native projects.

## Day-to-day workflow

Any time web source changes and you want to see them natively:

```bash
npm run cap:sync        # vite build + copy dist/ + plugins into both native projects
npm run cap:android     # sync, then open the Android project in Android Studio
npm run cap:android:run # sync, then build + install + launch on a connected device/emulator
npm run cap:ios         # sync, then open the Xcode project (macOS only)
```

`apps/web/.env.production` holds the production `VITE_*` values used for
native builds (gitignored, same convention as every other `.env*` file in
this repo — see `.env.example` for the shape). Native builds always use
`vite build`'s default production mode, so this file must exist locally
before running `cap:sync`.

## iOS — needs a Mac

Xcode only runs on macOS; there is no way around this from Windows. The
`ios/` project Capacitor generated is complete and ready to open — to
actually build/run it:

- **Own a Mac**: install Xcode, run `npm run cap:ios`, open `ios/App/App.xcworkspace`
  (not the `.xcodeproj`), pick a simulator or device, hit Run.
- **No Mac available**: a cloud Mac build service can build/sign/upload without
  you owning hardware — e.g. Codemagic, Ionic Appflow, or GitHub Actions'
  `macos-latest` runner (free minutes on public/some private repos). All of
  them just need this same `ios/` project and your Apple Developer account
  credentials/certificates.

## Android

Fully buildable/runnable from this machine.

- **Emulator**: `npx cap run android` picks a running emulator automatically,
  or launch one first via Android Studio's Device Manager / `emulator -avd <name>`.
- **Physical device**: enable Developer Options + USB debugging on the phone,
  plug in via USB, `adb devices` should list it, then `npx cap run android`.
- **Release build**: open in Android Studio (`npm run cap:android`) →
  Build > Generate Signed Bundle/APK. Needs a signing keystore (not created
  yet — required before a real Play Store upload).

## App identity

Set in `capacitor.config.ts`:
- `appId`: `live.epaysmart.app` (reverse-DNS of epaysmart.live) — this becomes
  the Android package name / iOS bundle ID. **Change before first store
  submission if a different identifier is wanted** — trivial to change now,
  effectively permanent once published to either store.
- `appName`: `ePay Smart` — the name shown under the home-screen icon.

## Native-only behavior differences

- **Service worker / PWA install prompts**: skipped entirely inside the
  native shell (`Capacitor.isNativePlatform()` guard in `main.tsx`) — app
  updates ship through the App/Play Store, not a browser service worker.
- **Splash screen + status bar**: native-only, configured in
  `capacitor.config.ts` under `plugins.SplashScreen` / `plugins.StatusBar`,
  wired up in `main.tsx`.
- **CORS**: the API (`apps/api/src/app.ts`) explicitly allows the fixed
  origins Capacitor serves the app from (`https://localhost` on Android,
  `capacitor://localhost` on iOS) — already deployed.

## Icons & splash images

Capacitor uses the web app's existing PWA icons (`public/icons/`) as a
starting point but native apps want their own properly-sized icon sets per
platform. Not generated yet — use `@capacitor/assets` (`npx capacitor-assets generate`)
pointed at a 1024×1024 source icon + splash image once final artwork exists;
it writes every required size into both `ios/` and `android/` automatically.

## Adding native-only features later

Biometric login, native push notifications (APNs/FCM), and camera-based KYC
capture are the obvious next additions a WebView-based web app can't do on
its own — all available as Capacitor plugins. Each one needs a
`Capacitor.isNativePlatform()` guard around its usage so the same component
still works correctly in the plain browser.
