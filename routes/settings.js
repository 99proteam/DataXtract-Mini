const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { proxyOps } = require('../config/database');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

// Default settings structure
const defaultSettings = {
    proxy: {
        enabled: false,
        rotateOnError: true,
        webshareApiKey: ''
    },
    smtp: {
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        enabled: false
    },
    twilio: {
        accountSid: '',
        authToken: '',
        fromNumber: '',
        enabled: false
    },
    apiKeys: {
        zerobounce: ''
    },
    ai: {
        provider: 'gemini',
        apiKey: ''
    }
};

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            // Ensure structure exists
            if (!settings.ai) settings.ai = { provider: 'gemini', apiKey: '' };
            return settings;
        }
    } catch (e) {
        console.error('Error loading settings:', e);
    }
    return { ...defaultSettings };
}

function saveSettings(settings) {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// GET all settings
router.get('/', (req, res) => {
    const settings = loadSettings();
    // Mask sensitive data - include length for UI display
    const masked = { ...settings };
    if (masked.smtp?.pass) masked.smtp.pass = '***:' + masked.smtp.pass.length;
    if (masked.twilio?.authToken) masked.twilio.authToken = '***:' + masked.twilio.authToken.length;
    if (masked.ai?.apiKey) masked.ai.apiKey = masked.ai.apiKey.substring(0, 8) + '...';
    res.json(masked);
});
// GET /api/settings/status — readiness check, NEVER returns secret values
router.get('/status', (req, res) => {
    const settings = loadSettings();

    const status = {
        proxy: {
            configured: Boolean(settings.proxy?.webshareApiKey),
            settingsTab: 'proxy'
        },
        smtp: {
            configured: Boolean(settings.smtp?.host && settings.smtp?.user && settings.smtp?.pass),
            settingsTab: 'smtp'
        },
        twilio: {
            configured: Boolean(settings.twilio?.accountSid && settings.twilio?.authToken && settings.twilio?.fromNumber),
            settingsTab: 'twilio'
        },
        zerobounce: {
            configured: Boolean(settings.apiKeys?.zerobounce),
            settingsTab: 'apikeys'
        },
        ai: {
            configured: Boolean(settings.ai?.apiKey),
            settingsTab: 'ai'
        }
    };

    res.json(status);
});

// GET raw settings (for internal use)
router.get('/raw', (req, res) => {
    res.json(loadSettings());
});

// POST update settings
router.post('/', (req, res) => {
    try {
        const current = loadSettings();
        const updates = req.body;

        // Merge updates
        const merged = {
            proxy: { ...current.proxy, ...updates.proxy },
            smtp: { ...current.smtp, ...updates.smtp },
            twilio: { ...current.twilio, ...updates.twilio },
            apiKeys: { ...current.apiKeys, ...updates.apiKeys },
            ai: { ...current.ai, ...updates.ai }
        };

        // Don't overwrite password if it's masked (*** or dots pattern)
        const isMasked = (val) => !val || val === '***' || val.startsWith('***:') || /^•+$/.test(val);

        if (isMasked(updates.smtp?.pass)) {
            merged.smtp.pass = current.smtp.pass;
        }
        if (isMasked(updates.twilio?.authToken)) {
            merged.twilio.authToken = current.twilio.authToken;
        }
        if (updates.ai?.apiKey?.includes('...')) {
            merged.ai.apiKey = current.ai.apiKey;
        }

        saveSettings(merged);
        res.json({ success: true, settings: merged });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test SMTP connection
router.post('/test-smtp', async (req, res) => {
    try {
        const settings = loadSettings();
        if (!settings.smtp.host) {
            return res.json({ success: false, message: 'SMTP not configured' });
        }

        const nodemailer = require('nodemailer');

        // Port 465 requires SSL from the start (secure: true)
        // Port 587 or 25 use STARTTLS (secure: false)
        const port = parseInt(settings.smtp.port) || 587;
        const isSecure = port === 465;

        const transporter = nodemailer.createTransport({
            host: settings.smtp.host,
            port: port,
            secure: isSecure, // true for 465, false for other ports
            auth: {
                user: settings.smtp.user,
                pass: settings.smtp.pass
            },
            tls: {
                rejectUnauthorized: false // Allow self-signed certs
            }
        });

        await transporter.verify();
        res.json({ success: true, message: `SMTP connection successful! (Port ${port}, ${isSecure ? 'SSL' : 'STARTTLS'})` });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Test Twilio connection
router.post('/test-twilio', async (req, res) => {
    try {
        const settings = loadSettings();
        if (!settings.twilio?.accountSid || !settings.twilio?.authToken) {
            return res.json({ success: false, message: 'Twilio not configured. Please add Account SID and Auth Token.' });
        }

        // Try to fetch account info to verify credentials
        const twilio = require('twilio');
        const client = twilio(settings.twilio.accountSid, settings.twilio.authToken);

        // Fetch account to verify credentials
        const account = await client.api.accounts(settings.twilio.accountSid).fetch();

        res.json({
            success: true,
            message: `Twilio connected! Account: ${account.friendlyName}`
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

/**
 * POST /api/settings/test-webshare
 * Test Webshare API connection
 */
router.post('/test-webshare', async (req, res) => {
    try {
        const settings = loadSettings();
        const apiKey = req.body.apiKey || settings.proxy?.webshareApiKey;

        if (!apiKey) {
            return res.json({ success: false, message: 'Webshare API key not provided' });
        }

        const fetch = require('node-fetch');
        const response = await fetch('https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=10', {
            headers: {
                'Authorization': `Token ${apiKey}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.json({ success: false, message: `API Error: ${response.status} - ${errorText}` });
        }

        const data = await response.json();
        res.json({
            success: true,
            message: `Connected! Found ${data.count || 0} proxies available`,
            proxyCount: data.count || 0
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

/**
 * POST /api/settings/fetch-webshare-proxies
 * Fetch all proxies from Webshare and store them
 */
router.post('/fetch-webshare-proxies', async (req, res) => {
    try {
        const settings = loadSettings();
        const apiKey = req.body.apiKey || settings.proxy?.webshareApiKey;

        if (!apiKey) {
            return res.json({ success: false, message: 'Webshare API key not provided' });
        }

        const fetch = require('node-fetch');
        const response = await fetch('https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=100', {
            headers: {
                'Authorization': `Token ${apiKey}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.json({ success: false, message: `API Error: ${response.status} - ${errorText}` });
        }

        const data = await response.json();
        const proxies = (data.results || []).map(p => ({
            host: p.proxy_address,
            port: p.port,
            username: p.username,
            password: p.password,
            protocol: 'http',
            source: 'webshare'
        }));

        // Store proxies in Database
        try {
            // Clear existing? Or append? usually fetch refresh implies replace.
            proxyOps.deleteAll.run();
            proxyOps.addMany(proxies);
            console.log(`[Settings] Saved ${proxies.length} proxies to DB`);
        } catch (e) {
            console.error('[Settings] Failed to save proxies to DB:', e);
            return res.json({ success: false, message: 'Failed to save proxies to database' });
        }

        // Also save to file as backup (optional, but good for debug)
        const proxiesFile = path.join(__dirname, '..', 'data', 'webshare-proxies.json');
        fs.writeFileSync(proxiesFile, JSON.stringify(proxies, null, 2));

        res.json({
            success: true,
            message: `Fetched and stored ${proxies.length} proxies`,
            count: proxies.length
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});
module.exports = router;
