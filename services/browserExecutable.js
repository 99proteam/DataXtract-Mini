/**
 * Resolve a usable Chrome-family browser for Puppeteer.
 *
 * The application may run on a machine where Puppeteer's downloaded Chromium
 * is unavailable or broken, so installed Chrome-family browsers are supported.
 */
const fs = require('fs');
const path = require('path');

function existingPath(candidates) {
    return candidates.find(candidate => candidate && fs.existsSync(candidate));
}

function getBrowserExecutablePath() {
    const projectDir = path.join(__dirname, '..');
    const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_PATH,
        path.join(projectDir, 'chrome-win64', 'chrome.exe'),
        path.join(projectDir, 'chrome-win', 'chrome.exe'),
        path.join(projectDir, 'chromium', 'chrome.exe'),
    ];

    if (process.platform === 'win32') {
        const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
        const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
        const localAppData = process.env.LOCALAPPDATA;

        candidates.push(
            path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
            path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
            localAppData && path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
            path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
            path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
        );
    } else if (process.platform === 'darwin') {
        candidates.push(
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        );
    } else {
        candidates.push(
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/microsoft-edge'
        );
    }

    return existingPath(candidates);
}

function withBrowserExecutable(options = {}) {
    const executablePath = getBrowserExecutablePath();
    return executablePath ? { ...options, executablePath } : options;
}

module.exports = { getBrowserExecutablePath, withBrowserExecutable };
