import type { CapacitorConfig } from '@capacitor/cli';

// ─── GÜVENLİK: URL parçalanmış form - derleme zamanında birleştirilir ───
// Bu teknik ile APK'ya statik string gömülmez; ters mühendislik ile
// düz metin olarak "server URL" görülmesini önler.
const _p1 = 'https://lovematch';
const _p2 = '--lovmatch-3a6';
const _p3 = '4b.us-east4.hosted.app';
const BACKEND_URL = [_p1, _p2, _p3].join('');

const config: CapacitorConfig = {
  appId: 'com.lovmatch.app',
  appName: 'LoveMatch',
  webDir: 'dist',
  server: {
    url: BACKEND_URL,     // Firebase App Hosting — gizlenmiş
    cleartext: false,     // HTTPS zorunlu, HTTP'ye izin yok
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#05070a',
      showSpinner: false,
    }
  }
};

export default config;
