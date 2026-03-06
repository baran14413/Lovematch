@echo off
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot
set ANDROID_HOME=C:\Android
set PATH=%PATH%;C:\Android\cmdline-tools\latest\bin;%JAVA_HOME%\bin
node -e "setInterval(() => console.log('y'), 10);" | sdkmanager.bat "platform-tools" "platforms;android-34" "build-tools;34.0.0"
node -e "setInterval(() => console.log('y'), 10);" | sdkmanager.bat --licenses
