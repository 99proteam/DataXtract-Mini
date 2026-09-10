const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getBrowserExecutablePath,
    withBrowserExecutable
} = require('../services/browserExecutable');

test('browser-backed tools resolve an existing executable when one is available', () => {
    const executablePath = getBrowserExecutablePath();

    if (executablePath) {
        assert.equal(fs.existsSync(executablePath), true);
        assert.equal(withBrowserExecutable({ headless: true }).executablePath, executablePath);
    } else {
        assert.deepEqual(withBrowserExecutable({ headless: true }), { headless: true });
    }
});

test('browser options are preserved while adding an executable', () => {
    const options = withBrowserExecutable({ headless: 'new', args: ['--no-sandbox'] });
    assert.equal(options.headless, 'new');
    assert.deepEqual(options.args, ['--no-sandbox']);
});

test('every Puppeteer launch uses the shared executable resolver', () => {
    const root = path.join(__dirname, '..');
    const files = [
        'routes/tools.js',
        'services/extractor.js',
        'services/googleMapsExtractor.js',
        'services/linkedinExtractor.js',
        'services/visualExtractor.js',
        'services/whatsappWebService.js'
    ];

    for (const relativeFile of files) {
        const source = fs.readFileSync(path.join(root, relativeFile), 'utf8');
        const launches = [...source.matchAll(/puppeteer\.launch\(([^\n]+)/g)];
        assert.ok(launches.length > 0, `${relativeFile} should launch Puppeteer`);
        for (const launch of launches) {
            assert.match(launch[1], /withBrowserExecutable\(/, relativeFile);
        }
    }
});

test('Maps and domain extraction retry directly when a proxy is unavailable', () => {
    const root = path.join(__dirname, '..');
    const maps = fs.readFileSync(path.join(root, 'services', 'googleMapsExtractor.js'), 'utf8');
    const domains = fs.readFileSync(path.join(root, 'services', 'extractor.js'), 'utf8');

    assert.match(maps, /isProxyConnectionError\(error\)/);
    assert.match(maps, /useProxies:\s*false/);
    assert.match(domains, /isProxyConnectionError\(error\)/);
    assert.match(domains, /launchBrowser\(null\)/);
});
