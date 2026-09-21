const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { proxyOps } = require('../config/database');
const { buildIntegrationStatus, markVerified } = require('../services/integrationReadiness');

const SETTINGS_FILE = process.env.DATAXTRACT_SETTINGS_FILE || path.join(__dirname, '..', 'data', 'settings.json');

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
    },
    verification: {}
};

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            // Ensure structure exists
            return {
                ...defaultSettings,
                ...settings,
                proxy: { ...defaultSettings.proxy, ...settings.proxy },
                smtp: { ...defaultSettings.smtp, ...settings.smtp },
                twilio: { ...defaultSettings.twilio, ...settings.twilio },
                apiKeys: { ...defaultSettings.apiKeys, ...settings.apiKeys },
                ai: { ...defaultSettings.ai, ...settings.ai },
                verification: settings.verification || {}
            };
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
    const masked = JSON.parse(JSON.stringify(settings));
    if (masked.proxy?.webshareApiKey) masked.proxy.webshareApiKey = '***:' + masked.proxy.webshareApiKey.length;
    if (masked.smtp?.pass) masked.smtp.pass = '***:' + masked.smtp.pass.length;
    if (masked.twilio?.authToken) masked.twilio.authToken = '***:' + masked.twilio.authToken.length;
    if (masked.apiKeys?.zerobounce) masked.apiKeys.zerobounce = '***:' + masked.apiKeys.zerobounce.length;
    if (masked.ai?.apiKey) masked.ai.apiKey = '***:' + masked.ai.apiKey.length;
    delete masked.verification;
    res.json(masked);
});
// GET /api/settings/status — readiness check, NEVER returns secret values
router.get('/status', (req, res) => {
    const settings = loadSettings();

    res.json(buildIntegrationStatus(settings));
});

// POST update settings
router.post('/', (req, res) => {
    try {
        const current = loadSettings();
        const updates = req.body || {};
        const text = (value, fallback, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
        const bool = (value, fallback) => typeof value === 'boolean' ? value : fallback;
        const number = (value, fallback, min, max) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
        };

        // Copy only known fields so request bodies cannot inject settings keys.
        const merged = {
            proxy: {
                enabled: bool(updates.proxy?.enabled, current.proxy.enabled),
                rotateOnError: bool(updates.proxy?.rotateOnError, current.proxy.rotateOnError),
                webshareApiKey: text(updates.proxy?.webshareApiKey, current.proxy.webshareApiKey)
            },
            smtp: {
                host: text(updates.smtp?.host, current.smtp.host, 253),
                port: number(updates.smtp?.port, current.smtp.port, 1, 65535),
                secure: bool(updates.smtp?.secure, current.smtp.secure),
                user: text(updates.smtp?.user, current.smtp.user, 320),
                pass: text(updates.smtp?.pass, current.smtp.pass, 1000),
                enabled: bool(updates.smtp?.enabled, current.smtp.enabled)
            },
            twilio: {
                accountSid: text(updates.twilio?.accountSid, current.twilio.accountSid, 128),
                authToken: text(updates.twilio?.authToken, current.twilio.authToken, 256),
                fromNumber: text(updates.twilio?.fromNumber, current.twilio.fromNumber, 32),
                enabled: bool(updates.twilio?.enabled, current.twilio.enabled)
            },
            apiKeys: { zerobounce: text(updates.apiKeys?.zerobounce, current.apiKeys.zerobounce, 256) },
            ai: {
                provider: ['gemini', 'openai'].includes(updates.ai?.provider) ? updates.ai.provider : current.ai.provider,
                apiKey: text(updates.ai?.apiKey, current.ai.apiKey, 512)
            },
            verification: current.verification || {}
        };

        // Don't overwrite password if it's masked (*** or dots pattern)
        const isMasked = (val) => !val || val === '***' || val.startsWith('***:') || /^•+$/.test(val);

        if (isMasked(updates.smtp?.pass)) {
            merged.smtp.pass = current.smtp.pass;
        }
        if (isMasked(updates.twilio?.authToken)) {
            merged.twilio.authToken = current.twilio.authToken;
        }
        if (isMasked(updates.proxy?.webshareApiKey)) {
            merged.proxy.webshareApiKey = current.proxy.webshareApiKey;
        }
        if (isMasked(updates.apiKeys?.zerobounce)) {
            merged.apiKeys.zerobounce = current.apiKeys.zerobounce;
        }
        if (isMasked(updates.ai?.apiKey)) {
            merged.ai.apiKey = current.ai.apiKey;
        }

        saveSettings(merged);
        res.json({ success: true });
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
            tls: { minVersion: 'TLSv1.2' }
        });

        await transporter.verify();
        markVerified('smtp', settings);
        saveSettings(settings);
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
        markVerified('twilio', settings);
        saveSettings(settings);

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
            return res.json({ success: false, message: `Webshare returned HTTP ${response.status}` });
        }

        const data = await response.json();
        settings.proxy.webshareApiKey = apiKey;
        markVerified('proxy', settings);
        saveSettings(settings);
        res.json({
            success: true,
            message: `Connected! Found ${data.count || 0} proxies available`,
            proxyCount: data.count || 0
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

router.post('/test-integration/:name', async (req, res) => {
    const name = req.params.name;
    try {
        const settings = loadSettings();
        if (name === 'zerobounce') {
            const key = settings.apiKeys?.zerobounce;
            if (!key) return res.status(400).json({ success: false, message: 'ZeroBounce API key is not configured' });
            const response = await fetch(`https://api.zerobounce.net/v2/getcredits?api_key=${encodeURIComponent(key)}`);
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || `ZeroBounce returned HTTP ${response.status}`);
        } else if (name === 'ai') {
            const key = settings.ai?.apiKey;
            if (!key) return res.status(400).json({ success: false, message: 'AI API key is not configured' });
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
            if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
        } else {
            return res.status(400).json({ success: false, message: 'Unknown integration' });
        }
        markVerified(name, settings);
        saveSettings(settings);
        res.json({ success: true, message: `${name} connection verified` });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
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
            return res.json({ success: false, message: `Webshare returned HTTP ${response.status}` });
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
