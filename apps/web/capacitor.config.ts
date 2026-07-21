import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Reverse-domain of epaysmart.live. Change before first App Store /
  // Play Console submission if a different identifier is preferred —
  // it's cheap to change now, effectively permanent after publishing.
  appId: 'live.epaysmart.app',
  appName: 'ePay Smart',
  webDir: 'dist',
  server: {
    // Android defaults to http://localhost, iOS to capacitor://localhost —
    // pinning both explicitly so the API's CORS allowlist has a fixed,
    // known origin instead of guessing platform defaults.
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  plugins: {
    SplashScreen: {
      // Kept visible until main.tsx explicitly hides it once React has
      // mounted — avoids a blank/white flash between the OS launch
      // screen and the first paint.
      launchAutoHide: false,
      backgroundColor: '#0f0f1a',
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#0f0f1a',
    },
  },
};

export default config;
