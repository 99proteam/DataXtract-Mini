// tests/integration-status.test.js
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');

test('settings status route never returns raw secret values', () => {
    const source = fs.readFileSync(path.join(root, 'routes', 'settings.js'), 'utf8');
    const statusRoute = source.match(/router\.get\('\/status'[\s\S]*?\}\);/)[0];
    // status block should only build booleans, never echo settings.smtp.pass / authToken / apiKey directly
    assert.doesNotMatch(statusRoute, /res\.json\(settings\)/);
    assert.match(statusRoute, /configured:\s*Boolean\(/);
});

test('dashboard has an integration status container with a render function', () => {
    const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');
    assert.match(html, /id="integrationStatusList"/);
    assert.match(app, /async\s+function\s+loadIntegrationStatus\s*\(/);
});