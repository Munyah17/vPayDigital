import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA install/offline behavior is a web-only concept — inside the native
// app shell, updates ship through the App Store / Play Store instead.
if (!Capacitor.isNativePlatform()) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
} else {
  // Hide the native splash screen once React has taken over, and match
  // the status bar to the app's dark shell so there's no white flash/bar
  // between the OS launch screen and the rendered UI.
  Promise.all([import('@capacitor/splash-screen'), import('@capacitor/status-bar')])
    .then(([{ SplashScreen }, { StatusBar, Style }]) => {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#0f0f1a' }).catch(() => {});
      SplashScreen.hide();
    });
}
