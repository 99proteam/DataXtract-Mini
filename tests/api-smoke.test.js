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

const postJson = (route, body) => fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
});

test('do-not-contact list can be added to, searched and cleared', async () => {
    const added = await postJson('/api/suppression', { text: 'one@example.com\n+1 555 010 4444\nnope', reason: 'asked us' });
    assert.equal(added.status, 200);
    const result = await added.json();
    assert.equal(result.added, 2);
    assert.equal(result.invalidCount, 1);

    const list = await (await fetch(`${baseUrl}/api/suppression?channel=phone`)).json();
    assert.equal(list.total, 1);
    assert.equal(list.items[0].value, '15550104444');
    assert.equal(list.items[0].reason, 'asked us');

    const check = await (await postJson('/api/suppression/check', { values: ['ONE@example.com', 'two@example.com'] })).json();
    assert.deepEqual(check.suppressed, ['ONE@example.com']);

    const removed = await fetch(`${baseUrl}/api/suppression/${list.items[0].id}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    assert.equal((await fetch(`${baseUrl}/api/suppression/${list.items[0].id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await postJson('/api/suppression', { text: '' })).status, 400);
});

test('unsubscribe links only act on POST and only with a valid token', async () => {
    // A bad token is rejected (this also makes the server create its signing secret).
    const invalid = await fetch(`${baseUrl}/unsubscribe?e=reader%40example.com&t=forged`);
    assert.equal(invalid.status, 400);

    // The server signs links with the secret it keeps in its data folder.
    const secret = fs.readFileSync(path.join(tempDir, 'unsubscribe.secret'), 'utf8').trim();
    const token = require('node:crypto')
        .createHmac('sha256', secret)
        .update('unsubscribe:reader@example.com')
        .digest('base64url')
        .slice(0, 32);
    const query = `e=${encodeURIComponent('reader@example.com')}&t=${token}`;

    const confirm = await fetch(`${baseUrl}/unsubscribe?${query}`);
    assert.equal(confirm.status, 200);
    assert.match(await confirm.text(), /<form method="post"/);
    let list = await (await fetch(`${baseUrl}/api/suppression?q=reader`)).json();
    assert.equal(list.total, 0, 'opening the link must not unsubscribe');

    const tampered = await fetch(`${baseUrl}/unsubscribe?e=other%40example.com&t=${token}`, { method: 'POST' });
    assert.equal(tampered.status, 400);

    // RFC 8058 one-click: mail clients POST to the List-Unsubscribe URL.
    const oneClick = await fetch(`${baseUrl}/unsubscribe?${query}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click'
    });
    assert.equal(oneClick.status, 200);
    list = await (await fetch(`${baseUrl}/api/suppression?q=reader`)).json();
    assert.equal(list.total, 1);
    assert.equal(list.items[0].source, 'unsubscribe');
});

test('list cleaner returns stats, a preview and a clean CSV', async () => {
    const response = await postJson('/api/tools/clean-list', { text: 'email\nA@x.io\na@x.io\nbad' });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.stats, { input: 3, invalid: 1, duplicates: 1, suppressed: 0, output: 1 });
    assert.equal(body.csv, 'email\r\na@x.io\r\n');
    assert.equal((await postJson('/api/tools/clean-list', {})).status, 400);
});
