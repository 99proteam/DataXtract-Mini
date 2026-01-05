const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'extractor.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
    -- Campaigns table
    CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        campaign_type TEXT DEFAULT 'domain',
        mode TEXT DEFAULT 'live',
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        total_domains INTEGER DEFAULT 0,
        processed_domains INTEGER DEFAULT 0,
        options TEXT
    );

    -- Keywords table for Google Maps campaigns
    CREATE TABLE IF NOT EXISTS keywords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        results_count INTEGER DEFAULT 0,
        processed_at DATETIME,
        error TEXT,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    -- Google Maps results table
    CREATE TABLE IF NOT EXISTS maps_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        keyword_id INTEGER,
        search_keyword TEXT,
        business_name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        website TEXT,
        rating REAL,
        review_count INTEGER,
        category TEXT,
        hours TEXT,
        maps_url TEXT,
        place_id TEXT,
        plus_code TEXT,
        coordinates TEXT,
        ai_analysis TEXT,
        -- WhatsApp Integration fields
        whatsapp_available BOOLEAN DEFAULT NULL,
        whatsapp_link TEXT,
        -- Email Finder fields
        business_email TEXT,
        email_verified BOOLEAN DEFAULT NULL,
        email_score INTEGER DEFAULT NULL,
        -- Lead Scoring fields
        lead_score INTEGER DEFAULT NULL,
        lead_score_breakdown TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE
    );

    -- Domains table
    CREATE TABLE IF NOT EXISTS domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        processed_at DATETIME,
        error TEXT,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    -- Results table - stores extracted data
    CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        domain_id INTEGER NOT NULL,
        domain TEXT NOT NULL,
        data_type TEXT NOT NULL,
        value TEXT NOT NULL,
        source_url TEXT,
        extra_info TEXT,
        ai_analysis TEXT, -- JSON or text analysis
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_domains_campaign ON domains(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
    CREATE INDEX IF NOT EXISTS idx_results_campaign ON results(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_results_domain ON results(domain_id);
    CREATE INDEX IF NOT EXISTS idx_results_type ON results(data_type);
    CREATE INDEX IF NOT EXISTS idx_keywords_campaign ON keywords(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_maps_results_campaign ON maps_results(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_maps_results_campaign ON maps_results(campaign_id);
    
    -- Proxies table
    CREATE TABLE IF NOT EXISTS proxies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        protocol TEXT DEFAULT 'http', -- http, https, socks4, socks5
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT,
        password TEXT,
        status TEXT DEFAULT 'active', -- active, dead
        last_checked DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Email Verification table
    CREATE TABLE IF NOT EXISTS email_verification (
        email TEXT PRIMARY KEY,
        status TEXT DEFAULT 'unknown', -- valid, invalid, catch-all, unknown, disposable
        score INTEGER DEFAULT 0,
        checks TEXT, -- JSON details
        last_verified DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Schedules table
    CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        frequency_label TEXT,
        next_run DATETIME,
        last_run DATETIME,
        status TEXT DEFAULT 'active', -- active, paused
        auto_export_format TEXT DEFAULT 'none', -- csv, json, none
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    -- Marketing Campaigns (SMS/Email History)
    CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, -- 'sms' or 'email'
        name TEXT,
        options TEXT, -- JSON settings
        total_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Marketing Logs (Individual Message History)
    CREATE TABLE IF NOT EXISTS marketing_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER,
        recipient TEXT NOT NULL,
        status TEXT, -- sent, failed
        message_id TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE
    );

    -- Tools Usage Logs (Traffic/Download)
    CREATE TABLE IF NOT EXISTS tools_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_type TEXT NOT NULL, -- 'traffic', 'code_download', 'screenshot'
        url TEXT,
        status TEXT, -- 'completed', 'failed'
        duration INTEGER, -- ms
        output_path TEXT, -- for downloads/screenshots
        details TEXT, -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Proxy operations
const proxyOps = {
    add: db.prepare(`
        INSERT INTO proxies(protocol, host, port, username, password)
VALUES(?, ?, ?, ?, ?)
    `),

    addMany: db.transaction((proxies) => {
        const insert = db.prepare(`
            INSERT INTO proxies(protocol, host, port, username, password)
VALUES(?, ?, ?, ?, ?)
    `);
        for (const p of proxies) {
            insert.run(p.protocol, p.host, p.port, p.username, p.password);
        }
    }),

    getAll: db.prepare(`
SELECT * FROM proxies ORDER BY status, created_at DESC
    `),

    getActive: db.prepare(`
SELECT * FROM proxies WHERE status = 'active'
    `),

    updateStatus: db.prepare(`
        UPDATE proxies SET status = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?
    `),

    delete: db.prepare(`
        DELETE FROM proxies WHERE id = ?
    `),

    deleteAll: db.prepare(`
        DELETE FROM proxies
    `)
};

// Email Verification operations
const verificationOps = {
    get: db.prepare(`
SELECT * FROM email_verification WHERE email = ?
    `),

    add: db.prepare(`
        INSERT OR REPLACE INTO email_verification(email, status, score, checks, last_verified)
VALUES(?, ?, ?, ?, CURRENT_TIMESTAMP)
    `),

    getBatch: db.transaction((emails) => {
        const stmt = db.prepare('SELECT * FROM email_verification WHERE email = ?');
        return emails.map(email => stmt.get(email)).filter(r => r);
    })
};

// Schedule operations
const scheduleOps = {
    add: db.prepare(`
        INSERT INTO schedules(campaign_id, cron_expression, frequency_label, next_run, auto_export_format)
VALUES(?, ?, ?, ?, ?)
    `),

    getAll: db.prepare(`
        SELECT s.*, c.name as campaign_name 
        FROM schedules s
        JOIN campaigns c ON s.campaign_id = c.id
        ORDER BY s.created_at DESC
    `),

    getById: db.prepare(`
SELECT * FROM schedules WHERE id = ?
    `),

    updateStatus: db.prepare(`
        UPDATE schedules SET status = ? WHERE id = ?
    `),

    updateLastRun: db.prepare(`
        UPDATE schedules SET last_run = CURRENT_TIMESTAMP, next_run = ? WHERE id = ?
    `),

    delete: db.prepare(`
        DELETE FROM schedules WHERE id = ?
    `)
};

// Campaign operations
const campaignOps = {
    create: db.prepare(`
        INSERT INTO campaigns(id, name, mode, options, total_domains)
VALUES(?, ?, ?, ?, ?)
    `),

    getAll: db.prepare(`
SELECT * FROM campaigns ORDER BY created_at DESC
    `),

    getById: db.prepare(`
SELECT * FROM campaigns WHERE id = ?
    `),

    updateStatus: db.prepare(`
        UPDATE campaigns SET status = ? WHERE id = ?
    `),

    updateProgress: db.prepare(`
        UPDATE campaigns SET processed_domains = ? WHERE id = ?
    `),

    start: db.prepare(`
        UPDATE campaigns SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?
    `),

    complete: db.prepare(`
        UPDATE campaigns SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?
    `),

    pause: db.prepare(`
        UPDATE campaigns SET status = 'paused' WHERE id = ?
    `),

    delete: db.prepare(`
        DELETE FROM campaigns WHERE id = ?
    `)
};

// Domain operations
const domainOps = {
    addMany: db.transaction((campaignId, domains) => {
        const insert = db.prepare(`
            INSERT INTO domains(campaign_id, domain) VALUES(?, ?)
    `);
        for (const domain of domains) {
            insert.run(campaignId, domain.trim());
        }
    }),

    getByCampaign: db.prepare(`
SELECT * FROM domains WHERE campaign_id = ?
    `),

    getPending: db.prepare(`
        SELECT * FROM domains WHERE campaign_id = ? AND status = 'pending' LIMIT 1
    `),

    getAllPending: db.prepare(`
SELECT * FROM domains WHERE campaign_id = ? AND status = 'pending'
    `),

    updateStatus: db.prepare(`
        UPDATE domains SET status = ?, processed_at = CURRENT_TIMESTAMP, error = ? WHERE id = ?
    `)
};

// Results operations
const resultOps = {
    add: db.prepare(`
        INSERT INTO results(campaign_id, domain_id, domain, data_type, value, source_url, extra_info)
VALUES(?, ?, ?, ?, ?, ?, ?)
    `),

    addMany: db.transaction((results) => {
        const insert = db.prepare(`
            INSERT INTO results(campaign_id, domain_id, domain, data_type, value, source_url, extra_info)
VALUES(?, ?, ?, ?, ?, ?, ?)
    `);
        for (const r of results) {
            insert.run(r.campaignId, r.domainId, r.domain, r.dataType, r.value, r.sourceUrl, r.extraInfo);
        }
    }),

    getByCampaign: db.prepare(`
SELECT * FROM results WHERE campaign_id = ? ORDER BY domain, data_type
    `),

    getByDomain: db.prepare(`
SELECT * FROM results WHERE domain_id = ?
    `),

    getGroupedByCampaign: (campaignId) => {
        const results = db.prepare(`
            SELECT * FROM results WHERE campaign_id = ? ORDER BY domain, data_type
    `).all(campaignId);

        // Group by domain
        const grouped = {};
        for (const r of results) {
            if (!grouped[r.domain]) {
                grouped[r.domain] = {
                    domain: r.domain,
                    emails: [],
                    phones: [],
                    socialLinks: [],
                    technology: [],
                    metadata: {},
                    media: { images: [], videos: [], pdfs: [] },
                    address: null
                };
            }

            const d = grouped[r.domain];
            const extra = r.extra_info ? JSON.parse(r.extra_info) : {};

            switch (r.data_type) {
                case 'email':
                    d.emails.push({ value: r.value, source: r.source_url });
                    break;
                case 'phone':
                    d.phones.push({ value: r.value, source: r.source_url });
                    break;
                case 'social':
                    d.socialLinks.push({ platform: extra.platform, url: r.value });
                    break;
                case 'technology':
                    d.technology.push({ name: r.value, category: extra.category });
                    break;
                case 'title':
                    d.metadata.title = r.value;
                    break;
                case 'description':
                    d.metadata.description = r.value;
                    break;
                case 'address':
                    d.address = r.value;
                    break;
                case 'image':
                    d.media.images.push(r.value);
                    break;
                case 'video':
                    d.media.videos.push(r.value);
                    break;
                case 'pdf':
                    d.media.pdfs.push(r.value);
                    break;
            }
        }

        return Object.values(grouped);
    }
};

// Keywords operations (for Google Maps campaigns)
const keywordOps = {
    addMany: db.transaction((campaignId, keywords) => {
        const insert = db.prepare(`
            INSERT INTO keywords(campaign_id, keyword) VALUES(?, ?)
    `);
        for (const keyword of keywords) {
            insert.run(campaignId, keyword.trim());
        }
    }),

    getByCampaign: db.prepare(`
SELECT * FROM keywords WHERE campaign_id = ?
    `),

    getAllPending: db.prepare(`
        SELECT * FROM keywords WHERE campaign_id = ? AND status = 'pending'
    `),

    updateStatus: db.prepare(`
        UPDATE keywords SET status = ?, processed_at = CURRENT_TIMESTAMP, results_count = ?, error = ? WHERE id = ?
    `)
};

// Maps results operations
const mapsResultOps = {
    add: db.prepare(`
        INSERT INTO maps_results(campaign_id, keyword_id, search_keyword, business_name, address, phone, website, rating, review_count, category, hours, maps_url, place_id, plus_code, coordinates)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),

    addMany: db.transaction((results) => {
        const insert = db.prepare(`
            INSERT INTO maps_results(campaign_id, keyword_id, search_keyword, business_name, address, phone, website, rating, review_count, category, hours, maps_url, place_id, plus_code, coordinates)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        for (const r of results) {
            insert.run(
                r.campaignId, r.keywordId, r.searchKeyword, r.businessName, r.address,
                r.phone, r.website, r.rating, r.reviewCount, r.category,
                r.hours, r.mapsUrl, r.placeId, r.plusCode, r.coordinates
            );
        }
    }),

    getByCampaign: db.prepare(`
SELECT * FROM maps_results WHERE campaign_id = ? ORDER BY search_keyword, business_name
    `),

    getByKeyword: db.prepare(`
SELECT * FROM maps_results WHERE keyword_id = ?
    `),

    getGroupedByCampaign: (campaignId) => {
        const results = db.prepare(`
            SELECT * FROM maps_results WHERE campaign_id = ? ORDER BY lead_score DESC, rating DESC
    `).all(campaignId);

        // Group by keyword
        const grouped = {};
        for (const r of results) {
            const key = r.search_keyword || 'Unknown';
            if (!grouped[key]) {
                grouped[key] = {
                    keyword: key,
                    businesses: []
                };
            }

            grouped[key].businesses.push({
                id: r.id,
                name: r.business_name,
                address: r.address,
                phone: r.phone,
                website: r.website,
                rating: r.rating,
                reviewCount: r.review_count,
                category: r.category,
                hours: r.hours,
                mapsUrl: r.maps_url,
                placeId: r.place_id,
                plusCode: r.plus_code,
                coordinates: r.coordinates ? JSON.parse(r.coordinates) : null,
                // Enrichment fields
                whatsappAvailable: r.whatsapp_available,
                whatsappLink: r.whatsapp_link,
                businessEmail: r.business_email,
                emailVerified: r.email_verified,
                emailScore: r.email_score,
                leadScore: r.lead_score,
                leadGrade: r.lead_score ? getLeadGrade(r.lead_score) : null
            });
        }

        return Object.values(grouped);
    }
};

// Helper to calculate lead grade
function getLeadGrade(score) {
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    if (score >= 30) return 'D';
    return 'F';
}

// Marketing Operations
const marketingOps = {
    createCampaign: db.prepare(`
        INSERT INTO marketing_campaigns(type, name, options, total_count, status)
VALUES(?, ?, ?, ?, 'processing')
    `),

    updateCampaignStats: db.prepare(`
        UPDATE marketing_campaigns 
        SET success_count = ?, failed_count = ?, status = ?
    WHERE id = ?
        `),

    logResult: db.prepare(`
        INSERT INTO marketing_logs(campaign_id, recipient, status, message_id, error)
VALUES(?, ?, ?, ?, ?)
    `),

    logResultApps: db.transaction((logs) => {
        const stmt = db.prepare(`
            INSERT INTO marketing_logs(campaign_id, recipient, status, message_id, error)
VALUES(?, ?, ?, ?, ?)
    `);
        for (const log of logs) {
            stmt.run(log.campaignId, log.recipient, log.status, log.messageId, log.error);
        }
    }),

    getCampaigns: db.prepare(`
SELECT * FROM marketing_campaigns ORDER BY created_at DESC
    `),

    getCampaignLogs: db.prepare(`
SELECT * FROM marketing_logs WHERE campaign_id = ? ORDER BY id
    `),

    deleteCampaign: db.prepare(`
        DELETE FROM marketing_campaigns WHERE id = ?
    `)
};

// Tools Operations
const toolsOps = {
    logUsage: db.prepare(`
        INSERT INTO tools_logs(tool_type, url, status, duration, output_path, details)
VALUES(?, ?, ?, ?, ?, ?)
    `),

    getLogs: db.prepare(`
SELECT * FROM tools_logs ORDER BY created_at DESC LIMIT 100
    `)
};

module.exports = {
    db,
    campaignOps,
    domainOps,
    resultOps,
    keywordOps,
    mapsResultOps,
    proxyOps,
    verificationOps,
    scheduleOps,
    marketingOps,
    toolsOps
};
