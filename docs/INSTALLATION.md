# Installation Guide

## 📋 System Requirements

- **OS**: Windows, macOS, or Linux
- **Node.js**: Version 18.x or higher (Recommended: 20.x LTS)
- **RAM**: Minimum 4GB (8GB recommended for heavy concurrency)
- **Browser**: Google Chrome or Microsoft Edge installed

---

## 💻 Localhost Installation (Windows/Mac/Linux)

### 1. Extract Files
Extract the `DataXtract Mini` folder to your desired location.
- **Example Windows Path**: `C:\Users\YourName\Documents\Data Extractor`
- **Example Mac/Linux Path**: `/home/user/data-extractor`

### 2. Install and Start
Open your terminal or command prompt, navigate to the project folder, and run:

```bash
cd "path/to/Data Extractor"
npm run deploy
```

> **Note**: If you see errors related to `puppeteer`, try: `npm install puppeteer --save`

### 3. Configure Integrations
Open **Settings** in the application and add the SMTP, Twilio, proxy, ZeroBounce, or AI credentials required for the tools you use.

### 4. Later Starts
After the first installation, start the application with:

```bash
npm start
```
Or use the development command:
```bash
npm run dev
```

### 5. Access the App
Open your web browser and go to:
**http://localhost:3007**

---

## Chrome and Edge browser setup

DataXtract Mini automatically looks for a usable Chrome-family browser whenever a browser-backed tool starts. Discovery uses the first existing executable in this order:

1. `PUPPETEER_EXECUTABLE_PATH`
2. `CHROME_PATH`
3. A browser bundled inside this project (`chrome-win64`, `chrome-win`, or `chromium`)
4. Standard Google Chrome and Microsoft Edge installation paths for the current operating system
5. Puppeteer's managed browser, when one was installed with the package

You normally do not need to configure a path. Use `PUPPETEER_EXECUTABLE_PATH` only when Chrome or Edge is installed in a non-standard location.

### Windows (PowerShell)

```powershell
$env:PUPPETEER_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm start
```

For Microsoft Edge, use `C:\Program Files\Microsoft\Edge\Application\msedge.exe` instead. To keep the variable for later terminals, set it through **System Properties → Environment Variables** and then reopen PowerShell.

### macOS (zsh/bash)

```bash
export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
npm start
```

For Microsoft Edge, use `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge` instead. Add the export line to your shell profile only if you want it to persist.

### Linux (bash)

```bash
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome-stable"
npm start
```

Common alternatives are `/usr/bin/google-chrome`, `/usr/bin/chromium`, `/usr/bin/chromium-browser`, and `/usr/bin/microsoft-edge`. Confirm an executable with `command -v google-chrome-stable` (or the relevant browser command).

### Browser troubleshooting

- **Browser executable not found / Could not find Chrome:** install current Chrome or Edge, confirm the executable exists, then set `PUPPETEER_EXECUTABLE_PATH` using the matching platform example above.
- **Permission denied on Linux or macOS:** confirm the current account may execute the browser (`chmod +x /path/to/browser` when appropriate) and that every parent directory is accessible. Do not run the whole application as root to work around file permissions.
- **Failed to launch because a shared library is missing on Linux:** install the browser's required system libraries using your distribution package manager; the Debian/Ubuntu package list below covers common dependencies.
- **Browser blocked by Windows security software:** allow the installed Chrome/Edge executable and the Node.js process, then retry. Do not disable security software globally.
- **A configured path stopped working after an update:** remove the override so automatic discovery can run again, or update it to the browser's new executable path.

---

## ☁️ VPS / Server Installation (Ubuntu/Debian)

### 1. Prepare Server
Update your system packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install curl git unzip -y
```

### 2. Install Node.js (v18+)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. Install Chrome Dependencies (for Puppeteer)
Puppeteer requires certain system libraries to run headless Chrome on Linux:
```bash
sudo apt install -y ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils
```

### 4. Upload & Install Project
Upload the project files to `/var/www/data-extractor` (or similar).
```bash
cd /var/www/data-extractor
npm install
```

### 5. Process Management (PM2)
Use PM2 to keep the app running in the background.
```bash
sudo npm install -g pm2
pm2 start server.js --name "data-extractor"
pm2 save
pm2 startup
```

---

## 🔧 Post-Installation Configuration

### Proxy Setup
- Navigate to **Settings > Proxies**.
- Add your proxies (Webshare or Custom) to enable features like **Website Traffic Testing** and **Anti-Blocking** extraction.

### Third-Party Keys (Optional)
- **OpenAI/Gemini**: For AI analysis options.
- **Twilio**: For SMS campaigns.
- **SMTP**: For Email campaigns.
Add these on the Settings page.

---

## ❓ Common Issues

### "Puppeteer failed to launch"
Usually missing system dependencies. ensure you ran Step 3 in the VPS guide. On Windows, ensure Chrome is not blocked by antivirus.

### "Port 3007 already in use"
Stop the other application using port 3007, or set a different `PORT` environment variable before starting DataXtract Mini.

### "SQLite database is locked"
Ensure you don't have the database file open in another viewer while writing heavy data.
