const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('direct campaign input normalizes and deduplicates domains', () => {
    const { normalizeDomains } = require('../services/inputList');
    assert.deepEqual(
        normalizeDomains([
            'https://Example.com/contact',
            'example.com',
            'www.bundlewp.com/products?ref=test',
            'not a domain'
        ]),
        ['example.com', 'bundlewp.com']
    );
});

test('URL imports accept newline and spreadsheet-style cell values', () => {
    const { normalizeUrls } = require('../services/inputList');
    assert.deepEqual(
        normalizeUrls(['bundlewp.com', 'https://example.com/a', 'bundlewp.com', 'javascript:alert(1)']),
        ['https://bundlewp.com/', 'https://example.com/a']
    );
});

test('integration readiness uses red, orange and green states without exposing secrets', () => {
    const { buildIntegrationStatus, fingerprintIntegration } = require('../services/integrationReadiness');
    const settings = {
        proxy: { webshareApiKey: 'secret-key' },
        smtp: { host: '', user: '', pass: '' },
        twilio: { accountSid: 'AC123', authToken: 'token', fromNumber: '+15555550123' },
        apiKeys: { zerobounce: '' },
        ai: { provider: 'gemini', apiKey: '' },
        verification: {}
    };
    settings.verification.twilio = { fingerprint: fingerprintIntegration('twilio', settings), verifiedAt: '2026-01-01T00:00:00.000Z' };

    const status = buildIntegrationStatus(settings);
    assert.equal(status.proxy.state, 'untested');
    assert.equal(status.smtp.state, 'not-configured');
    assert.equal(status.twilio.state, 'working');
    assert.equal(JSON.stringify(status).includes('secret-key'), false);
    assert.equal(JSON.stringify(status).includes('token'), false);
});

test('Google Maps retries directly when a proxy returns no listings', () => {
    const { shouldRetryDirect } = require('../services/googleMapsExtractor');
    assert.equal(shouldRetryDirect({ proxyAttempted: true, resultCount: 0, retriedDirect: false }), true);
    assert.equal(shouldRetryDirect({ proxyAttempted: false, resultCount: 0, retriedDirect: false }), false);
    assert.equal(shouldRetryDirect({ proxyAttempted: true, resultCount: 2, retriedDirect: false }), false);
});

test('UI contains clean deep links, six product detail actions, direct inputs and restart action', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
    const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'app.js'), 'utf8');

    assert.match(html, /id="promoBar"/);
    assert.match(html, /SAVE50/);
    assert.equal((html.match(/data-product-details=/g) || []).length, 6);
    assert.match(html, /id="productDetailsModal"/);
    assert.match(html, /data-module-count="87"/);
    assert.equal((html.match(/class="promo-description"/g) || []).length, 6);
    assert.doesNotMatch(html, /id="promoPrevious"/);
    assert.doesNotMatch(html, /id="promoNext"/);
    assert.match(html, /<a href="\/dashboard" class="logo" id="logoHomeLink"/);
    assert.match(html, /class="promo-set"/);
    assert.match(js, /productSet\?\.cloneNode\(true\)/);
    const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'style.css'), 'utf8');
    assert.match(css, /animation:\s*promo-products-marquee\s+55s\s+linear\s+infinite/);
    assert.match(css, /\.promo-bar:hover \.promo-track[\s\S]*animation-play-state:\s*paused/);
    assert.match(html, /id="promoToggle"/);
    assert.match(html, /id="promoClose"/);
    assert.match(html, /id="promoReopen"/);
    assert.match(html, /<\/a>\s*<button type="button" id="promoReopen"/);
    assert.match(js, /classList\.add\('promo-hidden'\)/);
    assert.match(html, /id="btnEditCampaign"/);
    assert.match(html, /id="mapsUseProxies"/);
    assert.match(html, /id="domainUseProxies"/);
    assert.match(html, /id="domainsInput"/);
    assert.match(html, /id="screenshotUrls"/);
    assert.match(html, /id="trafficFile"/);
    assert.match(html, /id="downloadFile"/);
    assert.match(html, /class="[^"]*restart[^"]*"[^>]*id="btnRestartCampaign"/);
    assert.doesNotMatch(html, /href="#\//);
    assert.doesNotMatch(js, /routeFromHash|hashchange|`#\//);
    assert.match(js, /\/visual-tools\/screenshots/);
    assert.match(js, /loadIntegrationStatus\(\)/);
});

test('Maps reads visible listings before stopping at an immediately visible end-of-list marker', () => {
    const extractor = fs.readFileSync(path.join(ROOT, 'services', 'googleMapsExtractor.js'), 'utf8');
    const initialRead = extractor.indexOf('const initialBusinesses');
    const endCheck = extractor.indexOf('const endOfList', initialRead);
    assert.ok(initialRead > -1, 'initial visible listing extraction should exist');
    assert.ok(endCheck > initialRead, 'visible listings must be read before checking end of list');
});

test('Maps proxy setting is explicitly saved by the UI and honored by the worker', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
    const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'app.js'), 'utf8');
    const route = fs.readFileSync(path.join(ROOT, 'routes', 'googleMaps.js'), 'utf8');
    assert.match(html, /id="mapsUseProxies"/);
    assert.match(js, /useProxies:\s*document\.getElementById\('mapsUseProxies'\)\.checked/);
    assert.match(route, /useProxies:\s*options\.useProxies\s*===\s*true/);
});

test('campaign editing reuses all four wizard steps and replaces source data transactionally', () => {
    const route = fs.readFileSync(path.join(ROOT, 'routes', 'campaigns.js'), 'utf8');
    const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'app.js'), 'utf8');
    assert.match(route, /router\.patch\('\/:id'/);
    assert.match(route, /Campaign name is required/);
    assert.match(route, /sourceItems/);
    assert.match(route, /DELETE FROM domains WHERE campaign_id/);
    assert.match(route, /DELETE FROM keywords WHERE campaign_id/);
    assert.match(js, /editingCampaignId/);
    assert.match(js, /elements\.modalNewCampaign\.classList\.add\('active'\)/);
    assert.match(js, /Save Campaign/);
});

test('domain extraction uses proxies only when selected and retries direct for proxy HTTP failures', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
    const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'app.js'), 'utf8');
    const extractor = fs.readFileSync(path.join(ROOT, 'services', 'extractor.js'), 'utf8');
    assert.match(html, /id="domainUseProxies"/);
    assert.match(js, /useProxies:\s*document\.getElementById\('domainUseProxies'\)\.checked/);
    assert.match(extractor, /this\.options\.useProxies\s*===\s*true/);
    assert.match(extractor, /isProxyHttpFailure/);
});

test('email extraction handles multiple mailto/data addresses and Cloudflare protection', () => {
    const cheerio = require('cheerio');
    const { extract } = require('../services/emailExtractor');
    const encodeCloudflare = (email, key = 0x12) => key.toString(16).padStart(2, '0')
        + [...email].map(character => (character.charCodeAt(0) ^ key).toString(16).padStart(2, '0')).join('');
    const protectedEmail = encodeCloudflare('sales@company.org');
    const root = cheerio.load(`
        <a href="mailto:hello@company.org">Email</a>
        <span data-email="support@company.org"></span>
        <a href="/cdn-cgi/l/email-protection#${protectedEmail}">Protected</a>
    `);
    assert.deepEqual(extract(root, 'https://company.org').sort(), [
        'hello@company.org',
        'sales@company.org',
        'support@company.org'
    ]);
});

test('email extraction ignores script payloads and identifies first-party business addresses', () => {
    const cheerio = require('cheerio');
    const { extract, isLikelyBusinessEmail, preferBusinessEmails } = require('../services/emailExtractor');
    const root = cheerio.load(`
        <html><body>
            <script>window.reviewers = ["random.person@gmail.com", "buyer@live.com"];</script>
            <p>Questions? Email <a href="mailto:support@dealfuel.com">support@dealfuel.com</a>.</p>
        </body></html>
    `);

    assert.deepEqual(extract(root, 'https://dealfuel.com'), ['support@dealfuel.com']);
    assert.equal(isLikelyBusinessEmail('support@dealfuel.com', 'https://www.dealfuel.com'), true);
    assert.equal(isLikelyBusinessEmail('random.person@gmail.com', 'https://dealfuel.com'), false);
    assert.deepEqual(
        preferBusinessEmails(['random.person@gmail.com', 'support@dealfuel.com', 'buyer@live.com'], 'dealfuel.com'),
        ['support@dealfuel.com']
    );
});

test('anonymized import and export examples are safe and linked from the docs', () => {
    const expected = [
        'examples/domain-input.txt',
        'examples/lead-verification.csv',
        'examples/export-results.csv',
        'examples/export-results.json'
    ];
    const combined = expected.map(relative => {
        const file = path.join(ROOT, relative);
        assert.equal(fs.existsSync(file), true, `${relative} should exist`);
        return fs.readFileSync(file, 'utf8');
    }).join('\n');
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const guide = fs.readFileSync(path.join(ROOT, 'docs', 'USER_GUIDE.md'), 'utf8');

    assert.doesNotMatch(combined, /@(gmail|yahoo|hotmail|outlook|live)\./i);
    assert.match(combined, /example\.(com|org|net)/i);
    for (const relative of expected) {
        assert.match(readme, new RegExp(relative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(guide, /\.\.\/examples\/domain-input\.txt/);
    assert.match(guide, /\.\.\/examples\/export-results\.json/);
});

test('application uses consistent dark square scrollbars', () => {
    const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'style.css'), 'utf8');
    assert.match(css, /scrollbar-color:\s*#71717a\s+#0b0b11/);
    assert.match(css, /::-webkit-scrollbar-button[\s\S]*display:\s*none/);
    assert.match(css, /::-webkit-scrollbar-thumb[\s\S]*border-radius:\s*0/);
});

test('top bar shows a persistent anonymous unique visitor total', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
    const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'app.js'), 'utf8');
    const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const database = fs.readFileSync(path.join(ROOT, 'config', 'database.js'), 'utf8');
    const metrics = fs.readFileSync(path.join(ROOT, 'routes', 'metrics.js'), 'utf8');

    assert.match(html, /id="totalVisitors"/);
    assert.match(js, /dataxtractVisitorId/);
    assert.match(js, /loadVisitorCount\(\)/);
    assert.match(server, /\/api\/metrics/);
    assert.match(database, /CREATE TABLE IF NOT EXISTS app_visitors/);
    assert.match(metrics, /INSERT OR IGNORE INTO app_visitors/);
});

test('favicon is included and served as a local SVG asset', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
    assert.match(html, /rel="icon"[^>]+href="\/favicon\.svg"/);
    assert.equal(fs.existsSync(path.join(ROOT, 'public', 'favicon.svg')), true);
});

test('Smart Extractor popup lists every officially supported platform separately', () => {
    const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'app.js'), 'utf8');
    for (const platform of ['Google Maps', 'Web domains', 'Website source', 'Search engine', 'Social platform', 'Trustpilot', 'Reddit', 'GitHub', 'Flipkart', 'Telegram', 'Online marketplaces']) {
        assert.match(js, new RegExp(platform));
    }
    assert.match(js, /Supported platforms, sources and capabilities/);
});

test('domain extraction recovers usable partial HTML after a navigation timeout and reports total failure', () => {
    const extractor = fs.readFileSync(path.join(ROOT, 'services', 'extractor.js'), 'utf8');
    assert.match(extractor, /recoverTimedOutNavigation/);
    assert.match(extractor, /Continuing with the page content already received/);
    assert.match(extractor, /campaignOps\.updateStatus\.run\('error', this\.campaignId\)/);
    assert.match(extractor, /return \{ success: false, error: error\.message \}/);
});

test('server defaults to loopback and sensitive raw-settings route is removed', () => {
    const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const settings = fs.readFileSync(path.join(ROOT, 'routes', 'settings.js'), 'utf8');
    const ai = fs.readFileSync(path.join(ROOT, 'routes', 'ai.js'), 'utf8');

    assert.match(server, /127\.0\.0\.1/);
    assert.match(server, /Cache-Control/);
    assert.match(server, /dashboard\|campaigns/);
    assert.doesNotMatch(settings, /router\.get\(['"]\/raw/);
    assert.doesNotMatch(settings, /settings:\s*merged/);
    assert.doesNotMatch(ai, /res\.json\(aiService\.config\)/);
});
