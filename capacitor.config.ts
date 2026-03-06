import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovmatch.app',
  appName: 'LoveMatch',
  webDir: 'dist',
  server: {
    url: 'https://lovemtch.shop',
    cleartext: true
  }
};

export default config;
