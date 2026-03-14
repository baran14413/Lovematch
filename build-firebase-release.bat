@echo off
setlocal enabledelayedexpansion
title LoveMatch v1.6 - Otomatik Build + Imzali AAB

:: ─── JAVA & ANDROID ORTAM ───────────────────────────────────────────────
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot
set ANDROID_HOME=C:\Android
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%PATH%

:: ─── IMZA BİLGİLERİ ─────────────────────────────────────────────────────
set KEYSTORE=C:\Users\Administrator\Desktop\release.keystore
set KEY_ALIAS=Gunahbenim09
set STORE_PASS=Gunahbenim09
set KEY_PASS=Gunahbenim09

:: ─── ÇIKTI HEDEFI ───────────────────────────────────────────────────────
set OUTPUT_APK=C:\Users\Administrator\Desktop\ilkuretim.apk
set OUTPUT_AAB=C:\Users\Administrator\Desktop\ilkuretim.aab

echo.
echo ============================================================
echo  LoveMatch v1.6 - Firebase App Hosting Build Basladi
echo  Backend: Firebase App Hosting (gizlenmis)
echo ============================================================
echo.

echo [1/5] Vite Build (React Uygulama Derleniyor)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo HATA: Vite build basarisiz!
    pause
    exit /b 1
)
echo [1/5] Vite Build TAMAM!
echo.

echo [2/5] Capacitor Sync (Android guncellemesi)...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo HATA: Capacitor sync basarisiz!
    pause
    exit /b 1
)
echo [2/5] Capacitor Sync TAMAM!
echo.

echo [3/5] Android Gradle - Imzali AAB derleniyor...
cd android
call gradlew bundleRelease
if %ERRORLEVEL% NEQ 0 (
    echo HATA: Gradle bundle basarisiz!
    cd ..
    pause
    exit /b 1
)
cd ..
echo [3/5] AAB TAMAM!
echo.

echo [4/5] Android Gradle - Imzali APK derleniyor...
cd android
call gradlew assembleRelease
if %ERRORLEVEL% NEQ 0 (
    echo HATA: Gradle APK basarisiz!
    cd ..
    pause
    exit /b 1
)
cd ..
echo [4/5] APK TAMAM!
echo.

echo [5/5] Imzali dosyalar masaustune kopyalaniyor...
:: APK kopyala
copy /Y "android\app\build\outputs\apk\release\app-release.apk" "%OUTPUT_APK%"
:: AAB kopyala
copy /Y "android\app\build\outputs\bundle\release\app-release.aab" "%OUTPUT_AAB%"

echo.
echo ============================================================
echo  BUILD BASARILI! v1.6 - Firebase Backend
echo  APK: %OUTPUT_APK%
echo  AAB: %OUTPUT_AAB%
echo ============================================================
echo.
pause
