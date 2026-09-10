@echo off
echo ==========================================
echo      DataXtract Pro - Build Script
echo ==========================================

echo.
echo [1/4] Clean up dist folder...
if exist dist rmdir /s /q dist
mkdir dist

echo.
echo [2/4] Building executable with pkg...
call npm run build-exe

echo.
echo [3/4] Creating required directories...
if not exist "dist\data" mkdir "dist\data"
if not exist "dist\uploads" mkdir "dist\uploads"
if not exist "dist\exports" mkdir "dist\exports"

echo.
echo [4/4] Copying native modules...
:: Copy better_sqlite3.node if not present (generates warning if skipped, that is fine)
if not exist "dist\better_sqlite3.node" copy "node_modules\better-sqlite3\build\Release\better_sqlite3.node" "dist\" >nul

echo.
echo [4.5/4] Creating debug script...
echo data-extractor-pro.exe > dist\debug.bat
echo pause >> dist\debug.bat

echo.
echo ==========================================
echo            BUILD SUCCESSFUL
echo ==========================================
echo.
echo The executable is located in the 'dist' folder.
echo.
echo IMPORTANT:
echo 1. You MUST copy a 'chrome-win' or 'chromium' folder into 'dist' for Google Maps scraping to work.
echo    (You can copy it from your local Puppeteer cache or download it).
echo 2. The 'data' folder will store your database.
echo.
pause
