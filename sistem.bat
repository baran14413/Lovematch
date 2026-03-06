@echo off
:: Turkish characters support
chcp 65001 >nul
:: Set color to Light Purple/Magenta (Premium look)
color 0D
cls
title LOVEMATCH ULTIMATE - SYSTEM CONTROLLER
:: Set window size
mode con: cols=100 lines=35

:MENU
cls
echo.
echo    ██╗      ██████╗ ██╗   ██╗███████╗███╗   ███╗ █████╗ ████████╗ ██████╗██╗  ██╗
echo    ██║     ██╔═══██╗██║   ██║██╔════╝████╗ ████║██╔══██╗╚══██╔══╝██╔════╝██║  ██║
echo    ██║     ██║   ██║██║   ██║█████╗  ██╔████╔██║███████║   ██║   ██║     ███████║
echo    ██║     ██║   ██║╚██╗ ██╔╝██╔══╝  ██║╚██╔╝██║██╔══██║   ██║   ██║     ██╔══██║
echo    ███████╗╚██████╔╝ ╚████╔╝ ███████╗██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╗██║  ██║
echo    ╚══════╝ ╚═════╝   ╚═══╝  ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝
echo.
echo    ════════════════════════════════════════════════════════════════════════════════════
echo             [ PREMIUM VDS CONTROL INTERFACE ]  -  [ OWNER: VDS ADMIN ]
echo             [ STATUS: ONLINE                ]  -  [ PROJECT: LOVEMATCH ]
echo    ════════════════════════════════════════════════════════════════════════════════════
echo.
echo    [1] 🚀 TÜM SİSTEMLERİ BAŞLAT (Watchdog)  - Servisler otomatik izlenir ve canlandırılır.
echo    [2] 🖥️ SADECE BACKEND BAŞLAT            - Node.js API sunucusunu çalıştırır.
echo    [3] 🌐 SADECE FRONTEND BAŞLAT           - Vite React arayüzünü geliştirme modunda açar.
echo    [4] 📦 KÜTÜPHANELERİ GÜNCELLE           - Eksik bağımlılıkları yükler (npm install).
echo    [5] 🧹 SİSTEMİ TEMİZLE VE ONAR          - Node_modules siler ve tertemiz kurulum yapar.
echo    [6] 📊 SUNUCU DURUMUNU KONTROL ET       - (Watchdog üzerinden önerilir)
echo    [7] ❌ ÇIKIŞ
echo.
echo    ════════════════════════════════════════════════════════════════════════════════════
set /p opt="    ➤ Lütfen yapmak istediğiniz işlemi seçin: "

if "%opt%"=="1" goto START_ALL
if "%opt%"=="2" goto START_BACKEND
if "%opt%"=="3" goto START_FRONTEND
if "%opt%"=="4" goto INSTALL
if "%opt%"=="5" goto CLEANUP
if "%opt%"=="6" goto START_ALL
if "%opt%"=="7" exit

goto MENU

:START_ALL
cls
echo.
echo    [ BİLGİ ] Watchdog sistemi devreye giriyor...
echo    [ BİLGİ ] Tüm servisler (PocketBase, API, Web) otomatik yönetilecek.
echo    ════════════════════════════════════════════════════════════════════════════════════
echo.
node watchdog.js
pause
goto MENU

:START_BACKEND
cls
echo.
echo    [ BİLGİ ] API Sunucusu başlatılıyor...
echo    ════════════════════════════════════════════════════════════════════════════════════
echo.
node server.js
pause
goto MENU

:START_FRONTEND
cls
echo.
echo    [ BİLGİ ] Frontend arayüzü başlatılıyor...
echo    ════════════════════════════════════════════════════════════════════════════════════
echo.
npm run dev
pause
goto MENU

:INSTALL
cls
echo.
echo    [ BİLGİ ] Bağımlılıklar taranıyor ve yükleniyor...
echo    ════════════════════════════════════════════════════════════════════════════════════
echo.
npm install
echo.
echo    [ TAMAM ] Yükleme işlemi başarıyla bitti!
pause
goto MENU

:CLEANUP
cls
echo.
echo    [ UYARI ] Sistem temizliği başlatılıyor. Bu işlem tüm kütüphaneleri silip yeniden yükler.
echo    [ UYARI ] Lütfen bekleyin...
echo    ════════════════════════════════════════════════════════════════════════════════════
echo.
rmdir /s /q node_modules
del package-lock.json
echo.
echo    [ BİLGİ ] Temiz kurulum yapılıyor (npm install)...
npm install
echo.
echo    [ TAMAM ] Sistem tazelendi ve kullanıma hazır!
pause
goto MENU
