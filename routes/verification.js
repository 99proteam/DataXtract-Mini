const express = require('express');
const router = express.Router();
const emailVerifier = require('../services/emailVerifier');
const { db, resultOps, verificationOps } = require('../config/database');

// Verify a single email (Test/Manual)
router.post('/verify', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
        const result = await emailVerifier.verify(email);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Batch verify campaign
router.post('/campaign/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Get unique emails from campaign results
        const results = resultOps.getByCampaign.all(id);
        const emails = [...new Set(results
            .filter(r => r.data_type === 'email')
            .map(r => r.value))];

        if (emails.length === 0) {
            return res.json({ message: 'No emails to verify', count: 0 });
        }

        // Run verification in background
        // We do this async and don't wait for all to finish
        processBatchVerification(id, emails);

        res.json({
            success: true,
            message: 'Verification started',
            count: emails.length
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get campaign verification status
router.get('/campaign/:id/status', (req, res) => {
    const { id } = req.params;
    try {
        const results = resultOps.getByCampaign.all(id);
        const emails = [...new Set(results
            .filter(r => r.data_type === 'email')
            .map(r => r.value))];

        const verified = verificationOps.getBatch(emails);

        const stats = {
            total: emails.length,
            verified: verified.length,
            valid: verified.filter(v => v.status === 'valid').length,
            invalid: verified.filter(v => v.status === 'invalid').length,
            risky: verified.filter(v => ['catch-all', 'unknown', 'disposable'].includes(v.status)).length
        };

        // Return map of email -> status for UI
        const statusMap = verified.reduce((acc, v) => {
            acc[v.email] = v.status;
            return acc;
        }, {});

        res.json({ stats, statusMap });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function processBatchVerification(campaignId, emails) {
    console.log(`[Verification] Starting batch for campaign ${campaignId} (${emails.length} emails)`);

    // Process in chunks to avoid overwhelming network
    const CHUNK_SIZE = 5;
    for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
        const chunk = emails.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(email => emailVerifier.verify(email)));

        // Broadcast progress if we had WebSocket access here
        // For now, frontend polls status
        await new Promise(r => setTimeout(r, 1000)); // Rate limit
    }

    console.log(`[Verification] Completed batch for campaign ${campaignId}`);
}

module.exports = router;
