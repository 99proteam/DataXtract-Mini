const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const root = path.join(__dirname, '..');
const TEST_PORT = 3999;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let serverProcess;

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
});

test.after(() => {
    if (serverProcess) serverProcess.kill();
});

test('GET /api/settings/status returns readiness booleans for every integration', async () => {
    const res = await fetch(`${BASE_URL}/api/settings/status`);
    assert.equal(res.status, 200);

    const body = await res.json();
    for (const key of ['proxy', 'smtp', 'twilio', 'zerobounce', 'ai']) {
        assert.ok(key in body, `status response should include "${key}"`);
        assert.equal(typeof body[key].configured, 'boolean', `${key}.configured should be boolean`);
        assert.equal(typeof body[key].settingsTab, 'string', `${key}.settingsTab should be a string`);
    }
});

test('GET /api/settings/status maps the AI integration to the AI settings tab', async () => {
    const res = await fetch(`${BASE_URL}/api/settings/status`);
    const body = await res.json();
    assert.equal(body.ai.settingsTab, 'ai');
});

test('GET /api/settings/status never leaks raw secret values', async () => {
    const res = await fetch(`${BASE_URL}/api/settings/status`);
    const text = await res.text();

    // These are the example/test secrets that should never be committed or returned
    assert.doesNotMatch(text, /test123/);
    assert.doesNotMatch(text, /test@gmail\.com/);
    // Status endpoint should only contain booleans + tab names, never long key-like strings
    assert.doesNotMatch(text, /sk-[a-zA-Z0-9]{10,}/);
});