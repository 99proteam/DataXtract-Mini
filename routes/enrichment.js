/**
 * Enrichment Routes
 * API endpoints for WhatsApp, Lead Scoring, and Email Finding
 */

const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

const whatsappService = require('../services/whatsappService');
const leadScoringService = require('../services/leadScoringService');
const businessEmailFinder = require('../services/businessEmailFinder');

/**
 * GET /api/enrichment/whatsapp/:resultId
 * Get WhatsApp link for a single result
 */
router.get('/whatsapp/:resultId', (req, res) => {
    try {
        const result = db.prepare('SELECT id, phone FROM maps_results WHERE id = ?').get(req.params.resultId);

        if (!result) {
            return res.status(404).json({ error: 'Result not found' });
        }

        if (!result.phone) {
            return res.json({ available: false, link: null, message: 'No phone number' });
        }

        const whatsappLink = whatsappService.generateWhatsAppLink(result.phone);

        // Update database
        db.prepare('UPDATE maps_results SET whatsapp_available = ?, whatsapp_link = ? WHERE id = ?')
            .run(1, whatsappLink, result.id);

        res.json({
            available: true,
            link: whatsappLink,
            phone: result.phone
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/enrichment/whatsapp/bulk
 * Generate WhatsApp links for multiple results
 */
router.post('/whatsapp/bulk', async (req, res) => {
    try {
        const { campaignId, resultIds } = req.body;

        let results;
        if (resultIds && resultIds.length > 0) {
            const placeholders = resultIds.map(() => '?').join(',');
            results = db.prepare(`SELECT id, phone FROM maps_results WHERE id IN (${placeholders})`).all(...resultIds);
        } else if (campaignId) {
            results = db.prepare('SELECT id, phone FROM maps_results WHERE campaign_id = ? AND phone IS NOT NULL').all(campaignId);
        } else {
            return res.status(400).json({ error: 'Provide campaignId or resultIds' });
        }

        const enriched = [];
        const updateStmt = db.prepare('UPDATE maps_results SET whatsapp_available = ?, whatsapp_link = ? WHERE id = ?');

        for (const result of results) {
            if (result.phone) {
                const link = whatsappService.generateWhatsAppLink(result.phone);
                updateStmt.run(1, link, result.id);
                enriched.push({ id: result.id, link });
            }
        }

        res.json({
            processed: enriched.length,
            results: enriched
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/enrichment/score/:resultId
 * Calculate lead score for a single result
 */
router.get('/score/:resultId', (req, res) => {
    try {
        const result = db.prepare('SELECT * FROM maps_results WHERE id = ?').get(req.params.resultId);

        if (!result) {
            return res.status(404).json({ error: 'Result not found' });
        }

        const scoreData = leadScoringService.calculateScore(result);

        // Update database
        db.prepare('UPDATE maps_results SET lead_score = ?, lead_score_breakdown = ? WHERE id = ?')
            .run(scoreData.score, JSON.stringify(scoreData.breakdown), result.id);

        res.json({
            id: result.id,
            score: scoreData.score,
            grade: scoreData.grade,
            breakdown: scoreData.breakdown,
            color: leadScoringService.getScoreColor(scoreData.score)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/enrichment/score/bulk
 * Calculate lead scores for multiple results
 */
router.post('/score/bulk', (req, res) => {
    try {
        const { campaignId, resultIds } = req.body;

        let results;
        if (resultIds && resultIds.length > 0) {
            const placeholders = resultIds.map(() => '?').join(',');
            results = db.prepare(`SELECT * FROM maps_results WHERE id IN (${placeholders})`).all(...resultIds);
        } else if (campaignId) {
            results = db.prepare('SELECT * FROM maps_results WHERE campaign_id = ?').all(campaignId);
        } else {
            return res.status(400).json({ error: 'Provide campaignId or resultIds' });
        }

        const updateStmt = db.prepare('UPDATE maps_results SET lead_score = ?, lead_score_breakdown = ? WHERE id = ?');
        const scored = [];

        for (const result of results) {
            const scoreData = leadScoringService.calculateScore(result);
            updateStmt.run(scoreData.score, JSON.stringify(scoreData.breakdown), result.id);
            scored.push({
                id: result.id,
                score: scoreData.score,
                grade: scoreData.grade
            });
        }

        const stats = leadScoringService.getScoreStats(scored.map(s => ({ lead_score: s.score })));

        res.json({
            processed: scored.length,
            stats,
            results: scored
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/enrichment/email/:resultId
 * Find email for a single result
 */
router.get('/email/:resultId', async (req, res) => {
    try {
        const result = db.prepare('SELECT id, website, business_name FROM maps_results WHERE id = ?').get(req.params.resultId);

        if (!result) {
            return res.status(404).json({ error: 'Result not found' });
        }

        if (!result.website) {
            return res.json({ email: null, message: 'No website to search' });
        }

        const emailResult = await businessEmailFinder.findBusinessEmail(result, { verify: true });

        // Update database
        db.prepare('UPDATE maps_results SET business_email = ?, email_verified = ?, email_score = ? WHERE id = ?')
            .run(emailResult.email, emailResult.verified ? 1 : 0, emailResult.score, result.id);

        res.json({
            id: result.id,
            email: emailResult.email,
            allEmails: emailResult.allEmails,
            verified: emailResult.verified,
            score: emailResult.score
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/enrichment/email/bulk
 * Find emails for multiple results (async operation)
 */
router.post('/email/bulk', async (req, res) => {
    try {
        const { campaignId, resultIds, verify = false } = req.body;

        let results;
        if (resultIds && resultIds.length > 0) {
            const placeholders = resultIds.map(() => '?').join(',');
            results = db.prepare(`SELECT id, website, business_name FROM maps_results WHERE id IN (${placeholders}) AND website IS NOT NULL`).all(...resultIds);
        } else if (campaignId) {
            results = db.prepare('SELECT id, website, business_name FROM maps_results WHERE campaign_id = ? AND website IS NOT NULL').all(campaignId);
        } else {
            return res.status(400).json({ error: 'Provide campaignId or resultIds' });
        }

        // Return immediately, process in background
        res.json({
            message: 'Email finding started',
            totalToProcess: results.length
        });

        // Process in background
        const updateStmt = db.prepare('UPDATE maps_results SET business_email = ?, email_verified = ?, email_score = ? WHERE id = ?');

        for (const result of results) {
            try {
                const emailResult = await businessEmailFinder.findBusinessEmail(result, { verify });
                updateStmt.run(emailResult.email, emailResult.verified ? 1 : 0, emailResult.score, result.id);

                // Broadcast progress if SSE is available
                if (global.broadcastToCampaign && campaignId) {
                    global.broadcastToCampaign(campaignId, {
                        type: 'email_found',
                        business: result.business_name,
                        email: emailResult.email
                    });
                }
            } catch (e) {
                console.error(`Email find error for ${result.id}:`, e.message);
            }
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/enrichment/full
 * Full enrichment: WhatsApp + Email + Lead Score
 */
router.post('/full', async (req, res) => {
    try {
        const { campaignId, resultIds, findEmail = true, checkWhatsApp = true, calculateScore = true } = req.body;

        let results;
        if (resultIds && resultIds.length > 0) {
            const placeholders = resultIds.map(() => '?').join(',');
            results = db.prepare(`SELECT * FROM maps_results WHERE id IN (${placeholders})`).all(...resultIds);
        } else if (campaignId) {
            results = db.prepare('SELECT * FROM maps_results WHERE campaign_id = ?').all(campaignId);
        } else {
            return res.status(400).json({ error: 'Provide campaignId or resultIds' });
        }

        res.json({
            message: 'Full enrichment started',
            totalToProcess: results.length,
            options: { findEmail, checkWhatsApp, calculateScore }
        });

        // Process in background
        for (const result of results) {
            try {
                let updates = {};

                // 1. WhatsApp
                if (checkWhatsApp && result.phone) {
                    const link = whatsappService.generateWhatsAppLink(result.phone);
                    updates.whatsapp_available = 1;
                    updates.whatsapp_link = link;
                }

                // 2. Email
                if (findEmail && result.website && !result.business_email) {
                    const emailResult = await businessEmailFinder.findBusinessEmail(result, { verify: true });
                    if (emailResult.email) {
                        updates.business_email = emailResult.email;
                        updates.email_verified = emailResult.verified ? 1 : 0;
                        updates.email_score = emailResult.score;
                    }
                }

                // Merge updates with result for scoring
                const enrichedResult = { ...result, ...updates };

                // 3. Lead Score
                if (calculateScore) {
                    const scoreData = leadScoringService.calculateScore(enrichedResult);
                    updates.lead_score = scoreData.score;
                    updates.lead_score_breakdown = JSON.stringify(scoreData.breakdown);
                }

                // Update database
                if (Object.keys(updates).length > 0) {
                    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
                    const values = [...Object.values(updates), result.id];
                    db.prepare(`UPDATE maps_results SET ${setClauses} WHERE id = ?`).run(...values);
                }

                // Broadcast progress
                if (global.broadcastToCampaign && campaignId) {
                    global.broadcastToCampaign(campaignId, {
                        type: 'enrichment_progress',
                        business: result.business_name,
                        updates
                    });
                }

            } catch (e) {
                console.error(`Enrichment error for ${result.id}:`, e.message);
            }
        }

        // Broadcast completion
        if (global.broadcastToCampaign && campaignId) {
            global.broadcastToCampaign(campaignId, {
                type: 'enrichment_complete',
                total: results.length
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/enrichment/stats/:campaignId
 * Get enrichment statistics for a campaign
 */
router.get('/stats/:campaignId', (req, res) => {
    try {
        const results = db.prepare('SELECT * FROM maps_results WHERE campaign_id = ?').all(req.params.campaignId);

        const stats = {
            total: results.length,
            withPhone: results.filter(r => r.phone).length,
            withWebsite: results.filter(r => r.website).length,
            withEmail: results.filter(r => r.business_email).length,
            withWhatsApp: results.filter(r => r.whatsapp_available).length,
            emailsVerified: results.filter(r => r.email_verified).length,
            scoreStats: leadScoringService.getScoreStats(results)
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/enrichment/verify-email
 * Verify if an email address is valid
 * Methods: zerobounce (API), smtp (SMTP check), mx (MX records)
 */
router.post('/verify-email', async (req, res) => {
    try {
        const { email, method = 'mx' } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        // Load settings for API keys and SMTP
        const fs = require('fs');
        const path = require('path');
        const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');
        let settings = {};
        try {
            if (fs.existsSync(SETTINGS_FILE)) {
                settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            }
        } catch (e) { }

        // Method: ZeroBounce API
        if (method === 'zerobounce') {
            if (!settings.apiKeys?.zerobounce) {
                return res.json({ valid: false, error: 'ZeroBounce API key not configured in Settings', provider: 'zerobounce', email });
            }
            try {
                const fetch = require('node-fetch');
                const response = await fetch(`https://api.zerobounce.net/v2/validate?api_key=${settings.apiKeys.zerobounce}&email=${encodeURIComponent(email)}`);
                const data = await response.json();

                return res.json({
                    valid: data.status === 'valid',
                    status: data.status,
                    subStatus: data.sub_status,
                    provider: 'zerobounce',
                    email
                });
            } catch (e) {
                return res.json({ valid: false, error: e.message, provider: 'zerobounce', email });
            }
        }

        // Method: SMTP check  
        if (method === 'smtp') {
            if (!settings.smtp?.host || !settings.smtp?.user) {
                return res.json({ valid: false, error: 'SMTP not configured in Settings', provider: 'smtp', email });
            }
            // SMTP verification - try to connect to mail server
            const nodemailer = require('nodemailer');
            const port = parseInt(settings.smtp.port) || 587;
            const isSecure = port === 465;

            const transporter = nodemailer.createTransport({
                host: settings.smtp.host,
                port: port,
                secure: isSecure,
                auth: {
                    user: settings.smtp.user,
                    pass: settings.smtp.pass
                },
                tls: { rejectUnauthorized: false }
            });

            try {
                await transporter.verify();
                // If SMTP works, assume email format is valid (can't actually check recipient)
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return res.json({
                    valid: emailRegex.test(email),
                    status: 'smtp_verified',
                    provider: 'smtp',
                    email,
                    note: 'SMTP verified format and connection, but cannot verify recipient exists'
                });
            } catch (e) {
                return res.json({ valid: false, error: e.message, provider: 'smtp', email });
            }
        }

        // Fallback / Method: MX record check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.json({
                valid: false,
                status: 'invalid_syntax',
                provider: 'mx_check',
                email
            });
        }

        // Check MX records
        const dns = require('dns').promises;
        const domain = email.split('@')[1];

        try {
            const mxRecords = await dns.resolveMx(domain);
            return res.json({
                valid: mxRecords && mxRecords.length > 0,
                status: mxRecords?.length > 0 ? 'mx_valid' : 'no_mx',
                mxRecords: mxRecords?.map(r => r.exchange) || [],
                provider: 'mx_check',
                email,
                note: 'Use ZeroBounce API for more accurate verification'
            });
        } catch (e) {
            return res.json({
                valid: false,
                status: 'domain_error',
                error: e.message,
                provider: 'mx_check',
                email
            });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

