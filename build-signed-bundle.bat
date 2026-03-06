@echo off
setlocal
:: LoveMatch Google Play Bundle Build Script (Premium Edit)
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot
set ANDROID_HOME=C:\Android
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%PATH%

echo [1/4] Web Projesi Derleniyor...
call npm run build

echo [2/4] Capacitor Dosyalari Senkronizasyon...
call npx cap sync android

echo [3/4] Android Gradle Bundle Release (Play Store)...
cd android
call gradlew bundleRelease

echo [4/4] Bundle (AAB) Hazir Oldu!
echo Konum: android\app\build\outputs\bundle\release\app-release.aab
pause
