import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.murali.trackerlio',
  appName: 'Trackerlio',
  webDir: 'www',
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f101a',
      overlaysWebView: true,
    },
  },
};

export default config;
