const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');

function count(pattern, source = app) {
    return [...source.matchAll(pattern)].length;
}

test('every inline click handler has a JavaScript implementation', () => {
    const handlers = [...html.matchAll(/onclick="([A-Za-z_$][\w$]*)\(/g)]
        .map(match => match[1]);
    const missing = [...new Set(handlers)].filter(name => {
        const declaration = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
        const assignment = new RegExp(`window\\.${name}\\s*=`);
        return !declaration.test(app) && !assignment.test(app);
    });

    assert.deepEqual(missing, []);
});

test('frontend does not call API routes that are absent from the server', () => {
    assert.doesNotMatch(app, /['"`]\/api\/verify\/email/);
    assert.doesNotMatch(app, /['"`]\/api\/sms\/bulk/);
});

test('result tabs are scoped and have a filter implementation', () => {
    assert.match(app, /tabBtns:\s*document\.querySelectorAll\('\.results-tabs \.tab-btn'\)/);
    assert.match(app, /function\s+filterResults\s*\(/);
});

test('campaign result refresh helper exists', () => {
    assert.match(app, /async\s+function\s+loadCampaignResults\s*\(/);
});

test('top-level function declarations are unique', () => {
    const names = [...app.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)]
        .map(match => match[1]);
    const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
    assert.deepEqual(duplicates, []);
});

test('networked controls have exactly one click registration', () => {
    assert.equal(count(/btnSendSms\.addEventListener\('click'/g), 1);
    assert.equal(count(/btnSendEmail\.addEventListener\('click'/g), 1);
    assert.equal(count(/btnSaveSettings\.addEventListener\('click'/g), 1);
    assert.equal(count(/document\.addEventListener\('DOMContentLoaded', initWebSocket\);/g), 0);
    assert.doesNotMatch(html, /id="btnSendSms"[^>]*onclick=/);
});

test('Maps campaign options use the names emitted by the frontend', () => {
    const mapsRoute = fs.readFileSync(path.join(root, 'routes', 'googleMaps.js'), 'utf8');
    assert.match(mapsRoute, /options\.maxResults\s*\?\?/);
    assert.match(mapsRoute, /options\.getDetails\s*!==\s*false/);
    assert.match(mapsRoute, /options\.useUserAgentRotation\s*!==\s*false/);
    assert.match(mapsRoute, /options\.security\?\.delay/);
});
