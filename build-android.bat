@echo off
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot
set ANDROID_HOME=C:\Android
set PATH=%PATH%;C:\Android\cmdline-tools\latest\bin;%JAVA_HOME%\bin
call npx cap sync android
cd android
call gradlew assembleDebug
