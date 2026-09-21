const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const { mapsResultOps, resultOps, campaignOps, db } = require('../config/database');

// Get AI Configuration
router.get('/config', (req, res) => {
    const { apiKey, ...safeConfig } = aiService.config || {};
    res.json({ ...safeConfig, configured: Boolean(apiKey) });
});

// Update AI Configuration
router.post('/config', (req, res) => {
    try {
        const { provider, apiKey, baseUrl, model } = req.body;
        if (!['gemini', 'openai'].includes(provider)) return res.status(400).json({ error: 'Unsupported AI provider' });
        aiService.saveConfig({
            provider,
            apiKey: typeof apiKey === 'string' ? apiKey.trim().slice(0, 512) : '',
            baseUrl: typeof baseUrl === 'string' ? baseUrl.trim().slice(0, 500) : '',
            model: typeof model === 'string' ? model.trim().slice(0, 100) : ''
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Run Enrichment
router.post('/enrich/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { prompt, systemPrompt, maxItems } = req.body; // maxItems for testing cost control

        const campaign = campaignOps.getById.get(campaignId);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        // Fetch data based on campaign type
        let items = [];
        let table = '';

        if (campaign.campaign_type === 'maps') {
            items = mapsResultOps.getByCampaign.all(campaignId);
            table = 'maps_results';
        } else {
            // For domain campaigns, we might want to group by domain or just process raw results?
            // Usually we want to enrich the *domain* entity or the *result*.
            // Let's fetch all results for now, but maybe grouping is better.
            // Simplified: Fetch all results.
            items = resultOps.getByCampaign.all(campaignId);
            table = 'results';
        }

        // Filter out already enriched? Or allow re-run?
        // Let's filter items that don't have analysis if user wants? 
        // For now, process everything or limit.
        if (maxItems) {
            items = items.slice(0, parseInt(maxItems));
        }

        if (items.length === 0) {
            return res.json({ success: true, message: 'No data to enrich' });
        }

        // Run AI Analysis
        // This can be long-running. In a real app, use background job.
        // For now, we'll keep connection open or return "Started" (but UI expects result).
        // Let's behave asynchronously: Start and return immediate success, UI polls?
        // Or simpler: Wait if it's small batch. 
        // Users might wait 10-20s for 5 items. 
        // Creating a background runner is better.

        // Let's do Background Run
        (async () => {
            try {
                const results = await aiService.analyzeBatch(items, prompt, systemPrompt);

                // Save results
                const updateStmt = db.prepare(`UPDATE ${table} SET ai_analysis = ? WHERE id = ?`);
                const transaction = db.transaction((updates) => {
                    for (const u of updates) {
                        if (u.success) {
                            updateStmt.run(u.analysis, u.id);
                        }
                    }
                });
                transaction(results);

                console.log(`[AI] Enriched ${results.length} items for campaign ${campaignId}`);

            } catch (error) {
                console.error('[AI] Enrichment failed:', error);
            }
        })();

        res.json({ success: true, message: 'Enrichment started in background', count: items.length });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
