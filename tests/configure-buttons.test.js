const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer');
const { withBrowserExecutable } = require('../services/browserExecutable');

const root = path.join(__dirname, '..');
const TEST_PORT = 3998;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let serverProcess;
let browser;

function waitForServer(url, retries = 30) {
    return new Promise((resolve, reject) => {
        const attempt = (n) => {
            fetch(url)
                .then(() => resolve())
                .catch((err) => {
                    if (n <= 0) return reject(err);
                    setTimeout(() => attempt(n - 1), 300);
                });
        };
        attempt(retries);
    });
}

test.before(async () => {
    serverProcess = spawn('node', ['server.js'], {
        cwd: root,
        env: { ...process.env, PORT: String(TEST_PORT) },
        stdio: 'ignore'
    });
    await waitForServer(`${BASE_URL}/api/settings/status`);

    browser = await puppeteer.launch(withBrowserExecutable({ headless: 'new' }));
});

test.after(async () => {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
});

test('clicking the AI Configure link opens the AI settings tab (not API Keys)', async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // wait for integration badges to render
    await page.waitForSelector('.integration-badge');

    // find and click the "Configure" link inside the AI badge
    const clicked = await page.evaluate(() => {
        const badges = Array.from(document.querySelectorAll('.integration-badge'));
        const aiBadge = badges.find(b => b.textContent.includes('AI'));
        if (!aiBadge) return false;
        const link = aiBadge.querySelector('a');
        if (!link) return false; // already configured, nothing to click
        link.click();
        return true;
    });

    assert.ok(clicked, 'expected an AI integration badge with a Configure link');

    // goToSettingsTab has a 50ms setTimeout before switching tabs
    await new Promise(r => setTimeout(r, 300));

    const aiTabState = await page.evaluate(() => {
        const tab = document.getElementById('settingsTabAi');
        return tab ? { exists: true, hidden: tab.classList.contains('hidden') } : { exists: false };
    });

    assert.equal(aiTabState.exists, true, 'settingsTabAi element should exist in the DOM');
    assert.equal(aiTabState.hidden, false, 'AI settings tab should be visible after clicking Configure');

    // API Keys tab should NOT be the one shown
    const apiKeysTabState = await page.evaluate(() => {
        const tab = document.getElementById('settingsTabApikeys');
        return tab ? tab.classList.contains('hidden') : true;
    });
    assert.equal(apiKeysTabState, true, 'API Keys tab should remain hidden when AI Configure is clicked');

    await page.close();
});