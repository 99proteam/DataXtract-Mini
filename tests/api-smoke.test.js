const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const root = path.join(__dirname, '..');
// Test files run concurrently under `node --test`; use a per-process high port
// so this isolated server cannot collide with the browser integration suite.
const testPort = 43000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${testPort}`;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dataxtract-api-'));
let serverProcess;

async function waitForServer(retries = 60) {
    for (let attempt = 0; attempt < retries; attempt += 1) {
        try {
            const response = await fetch(`${baseUrl}/api/health`);
            if (response.ok) return;
        } catch (_) {
            // Server is still starting.
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('Test server did not become ready');
}

test.before(async () => {
    serverProcess = spawn(process.execPath, ['server.js'], {
        cwd: root,
        env: {
            ...process.env,
            PORT: String(testPort),
            DATAXTRACT_DATA_DIR: tempDir,
            DATAXTRACT_SETTINGS_FILE: path.join(tempDir, 'settings.json')
        },
        stdio: 'ignore'
    });
    await waitForServer();
});

test.after(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
        await new Promise(resolve => {
            serverProcess.once('exit', resolve);
            serverProcess.kill();
        });
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('health endpoint reports startup readiness', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptimeSeconds, 'number');
});

test('read-only campaign, settings, proxy and metrics routes respond without third-party calls', async () => {
    const routes = ['/api/campaigns', '/api/settings/status', '/api/proxies', '/api/metrics/visitors'];
    for (const route of routes) {
        const response = await fetch(`${baseUrl}${route}`);
        assert.equal(response.status, 200, route);
    }
});

test('representative validation and missing-resource failures are stable', async () => {
    const missingCampaign = await fetch(`${baseUrl}/api/campaigns/not-a-real-campaign`);
    assert.equal(missingCampaign.status, 404);

    const invalidProxy = await fetch(`${baseUrl}/api/proxies`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
    });
    assert.equal(invalidProxy.status, 400);

    const invalidVisitor = await fetch(`${baseUrl}/api/metrics/visitors`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visitorId: 'short' })
    });
    assert.equal(invalidVisitor.status, 400);
});
