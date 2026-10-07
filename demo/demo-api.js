/*
 * DataXtract Mini - static live demo shim.
 *
 * Loaded only by the GitHub Pages build (scripts/build-pages.js), before app.js.
 * It replaces the Node.js backend with an in-browser mock so the dashboard can be
 * explored without installing anything. Nothing here is used by the self-hosted app.
 */
(function () {
    'use strict';

    const BASE = (window.__DEMO_BASE__ || '/').replace(/\/+$/, '');
    const HOME = window.__DEMO_HOME__ || '../';
    const SPONSOR_URL = 'https://buymeacoffee.com/99proteam';
    const SELF_HOSTED_ONLY = 'This action needs the self-hosted server. Install DataXtract Mini locally to run it for real.';
    const SECONDS_PER_ITEM = 1.5;

    // -----------------------------------------------------------------
    // Routing under a sub-path (e.g. /DataXtract-Mini/)
    // -----------------------------------------------------------------

    const withBase = url => (typeof url === 'string' && url.startsWith('/') && !url.startsWith(BASE + '/') ? BASE + url : url);

    for (const method of ['pushState', 'replaceState']) {
        const original = history[method].bind(history);
        history[method] = (data, title, url) => original(data, title, withBase(url));
    }

    // app.js reads the route through this (rewritten from window.location.pathname at build time).
    window.__demoPathname = () => {
        const path = window.location.pathname;
        const stripped = BASE && path.startsWith(BASE) ? path.slice(BASE.length) : path;
        return stripped.replace(/\/index\.html$/, '/') || '/';
    };

    // -----------------------------------------------------------------
    // Sample data
    // -----------------------------------------------------------------

    const now = Date.now();
    const iso = offsetMs => new Date(now - offsetMs).toISOString();
    const HOUR = 3600 * 1000;

    const TECH = ['WordPress', 'Shopify', 'React', 'Cloudflare', 'Google Analytics', 'Stripe', 'Next.js', 'jQuery', 'HubSpot'];
    const CATEGORIES = {
        dentist: 'Dentist', cafe: 'Coffee shop', coffee: 'Coffee shop', plumber: 'Plumber', gym: 'Gym',
        restaurant: 'Restaurant', lawyer: 'Law firm', salon: 'Hair salon', hotel: 'Hotel', bakery: 'Bakery'
    };
    const PREFIXES = ['Bright', 'Downtown', 'Golden', 'Prime', 'Urban', 'Riverside', 'Elite', 'Family', 'Green', 'Summit'];
    const STREETS = ['Main St', 'Oak Ave', 'Market St', 'Park Blvd', 'Elm St', '5th Ave', 'Lake Rd', 'Hill St'];

    function hash(text) {
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
        return h >>> 0;
    }

    function pick(list, seed, offset = 0) {
        return list[(seed + offset) % list.length];
    }

    function phoneFor(seed) {
        const n = String(seed % 10000000).padStart(7, '0');
        return `+1 (${200 + (seed % 700)}) ${n.slice(0, 3)}-${n.slice(3)}`;
    }

    function domainResult(domain, id) {
        const seed = hash(domain);
        const name = domain.split('.')[0];
        return {
            id,
            domain,
            emails: [
                { value: `info@${domain}`, source: `https://${domain}/contact` },
                { value: `sales@${domain}`, source: `https://${domain}/about` },
                ...(seed % 3 === 0 ? [{ value: `support@${domain}`, source: `https://${domain}/help` }] : [])
            ],
            phones: [{ value: phoneFor(seed) }],
            technology: [pick(TECH, seed), pick(TECH, seed, 3), pick(TECH, seed, 5)].map(n => ({ name: n })),
            socialLinks: [
                { platform: 'linkedin', url: `https://www.linkedin.com/company/${name}` },
                { platform: 'twitter', url: `https://x.com/${name}` },
                { platform: 'facebook', url: `https://www.facebook.com/${name}` }
            ],
            metadata: { title: `${name.charAt(0).toUpperCase() + name.slice(1)} - Official Website` }
        };
    }

    function mapsBusinesses(keyword, startId) {
        const seed = hash(keyword);
        const lower = keyword.toLowerCase();
        const categoryKey = Object.keys(CATEGORIES).find(k => lower.includes(k));
        const category = categoryKey ? CATEGORIES[categoryKey] : 'Local business';
        const place = (keyword.match(/\bin\s+(.+)$/i) || [])[1] || 'Austin, TX';
        const noun = categoryKey ? CATEGORIES[categoryKey].split(' ')[0] : 'Services';
        return Array.from({ length: 4 }, (_, i) => {
            const s = seed + i * 7919;
            const name = `${pick(PREFIXES, s)} ${noun}${i % 2 ? ' Co.' : ''}`;
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
            const score = 35 + (s % 60);
            return {
                id: startId + i,
                name,
                category,
                address: `${100 + (s % 900)} ${pick(STREETS, s)}, ${place}`,
                phone: phoneFor(s),
                website: `https://www.${slug}.com`,
                rating: (3.6 + (s % 14) / 10).toFixed(1),
                reviewCount: 12 + (s % 480),
                leadScore: score,
                leadGrade: score >= 70 ? 'A' : score >= 50 ? 'B' : 'C',
                businessEmail: i === 3 ? null : `hello@${slug}.com`,
                emailVerified: i % 2 === 0,
                whatsappLink: i === 1 ? null : `https://wa.me/1${String(s).slice(0, 10)}`
            };
        });
    }

    let nextId = 100;

    function makeCampaign({ name, type, items, status = 'pending', ageMs = 0 }) {
        const campaign = {
            id: nextId++,
            name,
            campaign_type: type,
            status,
            items,
            total_domains: items.length,
            processed_domains: status === 'completed' ? items.length : 0,
            created_at: iso(ageMs),
            startedAt: null,
            results: []
        };
        if (status === 'completed') campaign.results = buildResults(campaign, items.length);
        return campaign;
    }

    function buildResults(campaign, count) {
        const done = campaign.items.slice(0, count);
        if (campaign.campaign_type === 'domain') return done.map((d, i) => domainResult(d, campaign.id * 1000 + i));
        return done.map((keyword, i) => ({ keyword, businesses: mapsBusinesses(keyword, campaign.id * 1000 + i * 10) }));
    }

    const store = {
        visitors: 1284,
        campaigns: [
            makeCampaign({
                name: 'Dentists in Austin', type: 'maps', status: 'completed', ageMs: 26 * HOUR,
                items: ['dentist in Austin, TX', 'cosmetic dentist in Round Rock, TX']
            }),
            makeCampaign({
                name: 'SaaS competitor research', type: 'domain', status: 'completed', ageMs: 50 * HOUR,
                items: ['example.com', 'acme-analytics.io', 'brightcrm.com', 'cloudpilot.dev', 'shipfast.app']
            }),
            makeCampaign({
                name: 'Coffee shops - Seattle (try Start)', type: 'maps', ageMs: 2 * HOUR,
                items: ['coffee shop in Seattle, WA', 'cafe in Bellevue, WA', 'bakery in Seattle, WA']
            })
        ],
        proxies: [
            { id: 1, status: 'active', protocol: 'http', host: '203.0.113.10', port: 8080, username: 'demo', last_checked: iso(HOUR) },
            { id: 2, status: 'active', protocol: 'socks5', host: '198.51.100.24', port: 1080, username: null, last_checked: iso(3 * HOUR) },
            { id: 3, status: 'failed', protocol: 'http', host: '192.0.2.77', port: 3128, username: 'demo', last_checked: iso(5 * HOUR) }
        ],
        schedules: [
            { id: 1, campaign_name: 'Dentists in Austin', frequency_label: 'Weekly', cron_expression: '0 9 * * 1', next_run: iso(-72 * HOUR), last_run: iso(26 * HOUR), status: 'active' }
        ],
        settings: {
            proxy: { enabled: true, rotateOnError: true, webshareApiKey: '' },
            smtp: { enabled: false, host: 'smtp.example.com', port: 587, user: '' },
            twilio: {},
            zerobounce: {},
            ai: {}
        }
    };
    store.campaigns.reverse();

    // Advance a running campaign based on elapsed time since Start was pressed.
    function tick(campaign) {
        if (campaign.status !== 'running' || !campaign.startedAt) return campaign;
        const processed = Math.min(campaign.total_domains, Math.floor((Date.now() - campaign.startedAt) / 1000 / SECONDS_PER_ITEM) + 1);
        campaign.processed_domains = processed;
        campaign.results = buildResults(campaign, processed);
        if (processed >= campaign.total_domains) campaign.status = 'completed';
        return campaign;
    }

    // The real app streams new rows over WebSocket; the demo refreshes the open table instead.
    function pushLiveResults(campaign) {
        tick(campaign);
        if (campaign.processed_domains === campaign.shownProcessed || typeof window.loadCampaignResults !== 'function') return;
        campaign.shownProcessed = campaign.processed_domains;
        setTimeout(async () => {
            await window.loadCampaignResults(campaign.id);
            const found = document.getElementById('campaignDetailFound');
            if (found) {
                found.textContent = campaign.campaign_type === 'domain'
                    ? campaign.results.length
                    : campaign.results.reduce((n, g) => n + g.businesses.length, 0);
            }
        }, 50);
    }

    function publicCampaign(c) {
        tick(c);
        const { results, items, startedAt, ...rest } = c;
        return rest;
    }

    function findCampaign(id) {
        return store.campaigns.find(c => String(c.id) === String(id));
    }

    function flatten(campaign) {
        if (campaign.campaign_type === 'domain') {
            return campaign.results.flatMap(r => [
                ...r.emails.map(e => ({ source: r.domain, type: 'email', value: e.value, url: e.source })),
                ...r.phones.map(p => ({ source: r.domain, type: 'phone', value: p.value, url: '' }))
            ]);
        }
        return campaign.results.flatMap(g => g.businesses.map(b => ({
            keyword: g.keyword, name: b.name, category: b.category, address: b.address, phone: b.phone,
            email: b.businessEmail || '', website: b.website, rating: b.rating, reviews: b.reviewCount, score: b.leadScore
        })));
    }

    function downloadExport(campaignId, format) {
        const campaign = findCampaign(campaignId);
        if (!campaign) return;
        const rows = flatten(tick(campaign));
        let body;
        let type;
        if (format === 'json') {
            body = JSON.stringify(rows, null, 2);
            type = 'application/json';
        } else {
            const cols = rows.length ? Object.keys(rows[0]) : ['empty'];
            const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
            body = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
            type = 'text/csv';
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([body], { type }));
        a.download = `${campaign.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${format === 'json' ? 'json' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    // -----------------------------------------------------------------
    // Mock API router
    // -----------------------------------------------------------------

    function parseList(value) {
        try {
            const parsed = JSON.parse(value || '[]');
            return Array.isArray(parsed) ? parsed.map(String).map(s => s.trim()).filter(Boolean) : [];
        } catch (_) {
            return String(value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        }
    }

    async function readBody(init) {
        const body = init && init.body;
        if (!body) return {};
        if (body instanceof FormData) return Object.fromEntries(body.entries());
        try { return JSON.parse(body); } catch (_) { return {}; }
    }

    const routes = [
        ['GET', /^\/api\/metrics\/visitors$/, () => ({ totalVisitors: store.visitors })],
        ['POST', /^\/api\/metrics\/visitors$/, () => ({ totalVisitors: ++store.visitors })],

        ['GET', /^\/api\/settings\/status$/, () => ({
            proxy: { state: 'working', settingsTab: 'proxy' },
            smtp: { state: 'untested', settingsTab: 'smtp' },
            twilio: { state: 'not-configured', settingsTab: 'api' },
            zerobounce: { state: 'not-configured', settingsTab: 'api' },
            ai: { state: 'not-configured', settingsTab: 'api' }
        })],
        ['GET', /^\/api\/settings$/, () => store.settings],

        ['GET', /^\/api\/campaigns$/, () => store.campaigns.map(publicCampaign)],
        ['POST', /^\/api\/campaigns$/, async (_m, init) => {
            const body = await readBody(init);
            const type = body.campaignType === 'domain' ? 'domain' : 'maps';
            const items = parseList(type === 'domain' ? body.domains : body.keywords);
            if (!items.length) {
                return { success: false, error: body.domainsFile ? 'File upload is available in the self-hosted app. Paste items instead in the demo.' : 'Enter at least one item' };
            }
            const campaign = makeCampaign({ name: body.name || 'Demo campaign', type, items: items.slice(0, 25) });
            store.campaigns.unshift(campaign);
            return { success: true, campaign: publicCampaign(campaign) };
        }],
        ['GET', /^\/api\/campaigns\/([^/]+)\/results$/, m => {
            const c = findCampaign(m[1]);
            return c ? tick(c).results : [];
        }],
        ['POST', /^\/api\/campaigns\/([^/]+)\/restart$/, m => {
            const c = findCampaign(m[1]);
            if (!c) return { success: false, error: 'Campaign not found' };
            Object.assign(c, { status: 'pending', processed_domains: 0, results: [], startedAt: null });
            return { success: true };
        }],
        ['GET', /^\/api\/campaigns\/([^/]+)$/, m => {
            const c = findCampaign(m[1]);
            if (c) pushLiveResults(c);
            return c ? { ...publicCampaign(c), sourceItems: c.items } : { error: 'Campaign not found' };
        }],
        ['PATCH', /^\/api\/campaigns\/([^/]+)$/, async (m, init) => {
            const c = findCampaign(m[1]);
            if (!c) return { success: false, error: 'Campaign not found' };
            const body = await readBody(init);
            const items = (body.sourceItems || []).map(String).filter(Boolean).slice(0, 25);
            Object.assign(c, {
                name: body.name || c.name,
                campaign_type: body.campaignType === 'domain' ? 'domain' : 'maps',
                items, total_domains: items.length, processed_domains: 0, results: [], status: 'pending', startedAt: null, verified: false
            });
            return { success: true, campaign: publicCampaign(c) };
        }],
        ['DELETE', /^\/api\/campaigns\/([^/]+)$/, m => {
            store.campaigns = store.campaigns.filter(c => String(c.id) !== String(m[1]));
            return { success: true };
        }],

        ['POST', /^\/api\/(?:extraction|maps)\/start\/([^/]+)$/, m => {
            const c = findCampaign(m[1]);
            if (!c) return { success: false, error: 'Campaign not found' };
            if (c.status === 'completed') return { success: false, error: 'Campaign already completed. Use Restart to run it again.' };
            const done = c.processed_domains;
            c.status = 'running';
            c.startedAt = Date.now() - done * SECONDS_PER_ITEM * 1000;
            return { success: true };
        }],
        ['POST', /^\/api\/(?:extraction|maps)\/pause\/([^/]+)$/, m => {
            const c = findCampaign(m[1]);
            if (c) { tick(c); if (c.status === 'running') c.status = 'paused'; }
            return { success: true };
        }],

        ['GET', /^\/api\/verification\/campaign\/([^/]+)\/status$/, m => {
            const c = findCampaign(m[1]);
            const statusMap = {};
            if (c && c.verified) {
                for (const r of c.results) for (const e of r.emails || []) {
                    statusMap[e.value] = e.value.startsWith('support@') ? 'catch-all' : 'valid';
                }
            }
            return { statusMap };
        }],
        ['POST', /^\/api\/verification\/campaign\/([^/]+)$/, m => {
            const c = findCampaign(m[1]);
            if (!c) return { success: false, error: 'Campaign not found' };
            c.verified = true;
            return { success: true, count: c.results.reduce((n, r) => n + (r.emails || []).length, 0) };
        }],

        ['GET', /^\/api\/proxies$/, () => store.proxies],
        ['DELETE', /^\/api\/proxies\/(\d+)$/, m => {
            store.proxies = store.proxies.filter(p => String(p.id) !== m[1]);
            return { success: true };
        }],
        ['GET', /^\/api\/schedules$/, () => store.schedules],
        ['POST', /^\/api\/schedules\/(\d+)\/toggle$/, m => {
            const s = store.schedules.find(x => String(x.id) === m[1]);
            if (s) s.status = s.status === 'active' ? 'paused' : 'active';
            return { success: true };
        }],
        ['DELETE', /^\/api\/schedules\/(\d+)$/, m => {
            store.schedules = store.schedules.filter(s => String(s.id) !== m[1]);
            return { success: true };
        }],
        ['GET', /^\/api\/whatsapp\/sessions$/, () => ({ sessions: [] })]
    ];

    function json(data, status = 200) {
        return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    }

    const realFetch = window.fetch.bind(window);

    window.fetch = async function demoFetch(input, init = {}) {
        const rawUrl = typeof input === 'string' ? input : input && input.url;
        const url = new URL(rawUrl, window.location.href);
        if (url.origin !== window.location.origin) return realFetch(input, init);

        const path = url.pathname.startsWith(BASE + '/api/') ? url.pathname.slice(BASE.length) : url.pathname;
        if (!path.startsWith('/api/')) return realFetch(input, init);

        const method = (init.method || (input && input.method) || 'GET').toUpperCase();
        await new Promise(resolve => setTimeout(resolve, 120 + Math.random() * 180));

        for (const [routeMethod, pattern, handler] of routes) {
            const match = routeMethod === method && path.match(pattern);
            if (match) return json(await handler(match, init));
        }
        return json({ success: false, error: SELF_HOSTED_ONLY, message: SELF_HOSTED_ONLY });
    };

    // No backend socket on GitHub Pages: a quiet stand-in that never connects.
    window.WebSocket = class DemoWebSocket {
        constructor() { this.readyState = 0; }
        send() {}
        close() {}
        addEventListener() {}
        removeEventListener() {}
    };

    const realOpen = window.open.bind(window);
    window.open = function demoOpen(url, ...rest) {
        const match = typeof url === 'string' && url.match(/\/api\/(?:maps|extraction)\/export\/([^/]+)\/(\w+)/);
        if (match) {
            downloadExport(match[1], match[2]);
            return null;
        }
        return realOpen(url, ...rest);
    };

    // -----------------------------------------------------------------
    // Demo banner
    // -----------------------------------------------------------------

    function addBanner() {
        const banner = document.createElement('div');
        banner.className = 'demo-banner';
        banner.setAttribute('role', 'note');
        banner.innerHTML = `
            <div class="demo-banner-text">
                <strong>Live demo</strong>
                <span>Sample data only. Press Start on a campaign to watch a simulated run. Install it free on your computer to extract real data.</span>
            </div>
            <div class="demo-banner-actions">
                <a class="demo-banner-github" href="${HOME}#install">How to install (free)</a>
                <a class="sponsor-button" href="${SPONSOR_URL}" target="_blank" rel="noopener noreferrer"><span class="sponsor-cup" aria-hidden="true">&#9749;</span><span>Buy me a coffee</span></a>
            </div>`;
        document.body.appendChild(banner);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBanner);
    else addBanner();
})();
