const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const { campaignOps, domainOps, resultOps, keywordOps, mapsResultOps, db } = require('../config/database');
const { normalizeDomains, parseUploadedList, flattenValues } = require('../services/inputList');

// Get all campaigns
router.get('/', (req, res) => {
    try {
        const campaigns = campaignOps.getAll.all();
        res.json(campaigns.map(c => ({
            ...c,
            options: c.options ? JSON.parse(c.options) : null
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single campaign
router.get('/:id', (req, res) => {
    try {
        const campaign = campaignOps.getById.get(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        campaign.options = campaign.options ? JSON.parse(campaign.options) : null;
        campaign.sourceItems = campaign.campaign_type === 'domain'
            ? domainOps.getByCampaign.all(req.params.id).map(item => item.domain)
            : keywordOps.getByCampaign.all(req.params.id).map(item => item.keyword);
        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new campaign (supports both domain and maps types)
// Create new campaign (supports both domain and maps types)
router.post('/', (req, res) => {
    const upload = req.app.get('upload');

    upload.single('domainsFile')(req, res, async (err) => {
        if (err) {
            console.error('Upload Error:', err);
            return res.status(400).json({ error: err.message });
        }

        console.log('Campaign Creation Request:');
        console.log('Body:', req.body);
        if (req.file) {
            console.log('File:', req.file.originalname, req.file.mimetype);
        }

        try {
            const { name, mode, options, campaignType, keywords, domains: directDomains } = req.body;
            const campaignId = randomUUID();
            const type = campaignType || 'domain';

            // Parse options if it's a string
            const parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;

            // Helper to parse file content based on extension
            const parseUploadedFile = parseUploadedList;

            if (type === 'maps') {
                // Google Maps campaign - use keywords
                let keywordList = [];

                // Keywords can come from file or direct input
                if (req.file) {
                    keywordList = await parseUploadedFile(req.file);
                } else if (keywords) {
                    keywordList = flattenValues(typeof keywords === 'string' ? JSON.parse(keywords) : keywords);
                }

                if (keywordList.length === 0) {
                    return res.status(400).json({ error: 'No valid keywords found in file or input' });
                }

                // Create campaign with maps type
                db.prepare(`
                    INSERT INTO campaigns (id, name, campaign_type, mode, options, total_domains)
                    VALUES (?, ?, 'maps', ?, ?, ?)
                `).run(
                    campaignId,
                    name || `Maps Campaign ${new Date().toLocaleDateString()}`,
                    mode || 'live',
                    JSON.stringify(parsedOptions || {}),
                    keywordList.length
                );

                // Add keywords
                keywordOps.addMany(campaignId, keywordList);

                res.json({
                    success: true,
                    campaign: {
                        id: campaignId,
                        name: name || `Maps Campaign ${new Date().toLocaleDateString()}`,
                        campaign_type: 'maps',
                        mode: mode || 'live',
                        total_domains: keywordList.length,
                        status: 'pending'
                    }
                });

            } else if (type === 'social' || type === 'reviews' || type === 'ecommerce' || type === 'custom-website') {
                // Social/Reviews/E-commerce/Custom Website campaigns - use links from keywords field
                let linkList = [];

                // Links come from keywords field (parsed as JSON array of strings)
                if (keywords) {
                    linkList = (typeof keywords === 'string' ? JSON.parse(keywords) : keywords)
                        .map(k => k.trim())
                        .filter(k => k && k.length > 0);
                }

                if (linkList.length === 0) {
                    return res.status(400).json({ error: 'No valid links/URLs found. Please enter URLs in the input field.' });
                }

                // Create campaign with the specified type
                db.prepare(`
                    INSERT INTO campaigns (id, name, campaign_type, mode, options, total_domains)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(
                    campaignId,
                    name || `${type.charAt(0).toUpperCase() + type.slice(1)} Campaign ${new Date().toLocaleDateString()}`,
                    type,
                    mode || 'live',
                    JSON.stringify(parsedOptions || {}),
                    linkList.length
                );

                // Add links as keywords (reuse keywords table)
                keywordOps.addMany(campaignId, linkList);

                res.json({
                    success: true,
                    campaign: {
                        id: campaignId,
                        name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} Campaign ${new Date().toLocaleDateString()}`,
                        campaign_type: type,
                        mode: mode || 'live',
                        total_domains: linkList.length,
                        status: 'pending'
                    }
                });

            } else {
                // Domain extraction campaign
                let domains = [];
                if (req.file) {
                    domains = normalizeDomains(await parseUploadedFile(req.file));
                } else if (directDomains) {
                    const values = typeof directDomains === 'string' ? JSON.parse(directDomains) : directDomains;
                    domains = normalizeDomains(values);
                }

                if (domains.length === 0) {
                    return res.status(400).json({ error: 'No valid domains found. Paste domains or upload a file.' });
                }

                // Create campaign
                db.prepare(`
                    INSERT INTO campaigns (id, name, campaign_type, mode, options, total_domains)
                    VALUES (?, ?, 'domain', ?, ?, ?)
                `).run(
                    campaignId,
                    name || `Campaign ${new Date().toLocaleDateString()}`,
                    mode || 'live',
                    JSON.stringify(parsedOptions || {}),
                    domains.length
                );

                // Add domains
                domainOps.addMany(campaignId, domains);

                res.json({
                    success: true,
                    campaign: {
                        id: campaignId,
                        name: name || `Campaign ${new Date().toLocaleDateString()}`,
                        campaign_type: 'domain',
                        mode: mode || 'live',
                        total_domains: domains.length,
                        status: 'pending'
                    }
                });
            }
        } catch (error) {
            console.error('Campaign Creation Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// Get campaign results (handles all types)
router.get('/:id/results', (req, res) => {
    try {
        const campaign = campaignOps.getById.get(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // Maps, social, reviews, ecommerce, custom-website all use maps_results table
        if (campaign.campaign_type === 'maps' ||
            campaign.campaign_type === 'social' ||
            campaign.campaign_type === 'reviews' ||
            campaign.campaign_type === 'ecommerce' ||
            campaign.campaign_type === 'custom-website') {
            const results = mapsResultOps.getGroupedByCampaign(req.params.id);
            res.json(results);
        } else {
            // Domain extraction uses results table
            const results = resultOps.getGroupedByCampaign(req.params.id);
            res.json(results);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get campaign domains/keywords
router.get('/:id/items', (req, res) => {
    try {
        const campaign = campaignOps.getById.get(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // Maps, social, reviews, ecommerce, custom-website use keywords table
        if (campaign.campaign_type === 'maps' ||
            campaign.campaign_type === 'social' ||
            campaign.campaign_type === 'reviews' ||
            campaign.campaign_type === 'ecommerce' ||
            campaign.campaign_type === 'custom-website') {
            const keywords = keywordOps.getByCampaign.all(req.params.id);
            res.json({ type: 'keywords', items: keywords });
        } else {
            // Domain extraction
            const domains = domainOps.getByCampaign.all(req.params.id);
            res.json({ type: 'domains', items: domains });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get campaign domains (legacy endpoint)
router.get('/:id/domains', (req, res) => {
    try {
        const domains = domainOps.getByCampaign.all(req.params.id);
        res.json(domains);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update campaign status (pause/resume)
router.patch('/:id', (req, res) => {
    try {
        const campaign = campaignOps.getById.get(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        if (campaign.status === 'running') {
            return res.status(409).json({ error: 'Pause the campaign before editing its settings' });
        }

        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ error: 'Campaign name is required' });
        if (name.length > 120) return res.status(400).json({ error: 'Campaign name must be 120 characters or fewer' });

        const mode = req.body.mode;
        if (!['live', 'background'].includes(mode)) {
            return res.status(400).json({ error: 'Invalid extraction mode' });
        }

        const campaignType = req.body.campaignType;
        if (!['domain', 'maps'].includes(campaignType)) {
            return res.status(400).json({ error: 'Campaign type must be domain or maps' });
        }

        const options = req.body.options;
        if (!options || typeof options !== 'object' || Array.isArray(options)) {
            return res.status(400).json({ error: 'Campaign options must be an object' });
        }

        const sourceItems = campaignType === 'domain'
            ? normalizeDomains(req.body.sourceItems || [])
            : [...new Set(flattenValues(req.body.sourceItems || []).map(value => String(value).trim()).filter(Boolean))];
        if (sourceItems.length === 0) {
            return res.status(400).json({ error: campaignType === 'domain' ? 'At least one valid domain is required' : 'At least one search keyword is required' });
        }

        db.transaction(() => {
            db.prepare('DELETE FROM results WHERE campaign_id = ?').run(req.params.id);
            db.prepare('DELETE FROM maps_results WHERE campaign_id = ?').run(req.params.id);
            db.prepare('DELETE FROM domains WHERE campaign_id = ?').run(req.params.id);
            db.prepare('DELETE FROM keywords WHERE campaign_id = ?').run(req.params.id);
            db.prepare(`
                UPDATE campaigns
                SET name = ?, mode = ?, campaign_type = ?, options = ?, total_domains = ?,
                    processed_domains = 0, status = 'pending', started_at = NULL, completed_at = NULL
                WHERE id = ?
            `).run(name, mode, campaignType, JSON.stringify(options), sourceItems.length, req.params.id);

            if (campaignType === 'domain') {
                const insertDomain = db.prepare('INSERT INTO domains(campaign_id, domain) VALUES(?, ?)');
                sourceItems.forEach(domain => insertDomain.run(req.params.id, domain));
            } else {
                const insertKeyword = db.prepare('INSERT INTO keywords(campaign_id, keyword) VALUES(?, ?)');
                sourceItems.forEach(keyword => insertKeyword.run(req.params.id, keyword));
            }
        })();

        const updated = campaignOps.getById.get(req.params.id);
        updated.options = updated.options ? JSON.parse(updated.options) : {};
        updated.sourceItems = sourceItems;
        res.json({ success: true, campaign: updated });
    } catch (error) {
        console.error('Campaign edit error:', error);
        res.status(500).json({ error: 'Could not update campaign' });
    }
});

// Update campaign status (pause/resume)
router.patch('/:id/status', (req, res) => {
    try {
        const { status } = req.body;
        campaignOps.updateStatus.run(status, req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Clear previous output and put every source item back in the pending queue.
router.post('/:id/restart', (req, res) => {
    try {
        const campaign = campaignOps.getById.get(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        if (campaign.status === 'running') return res.status(409).json({ error: 'Pause the campaign before restarting it' });

        db.transaction((campaignId) => {
            db.prepare('DELETE FROM results WHERE campaign_id = ?').run(campaignId);
            db.prepare('DELETE FROM maps_results WHERE campaign_id = ?').run(campaignId);
            db.prepare("UPDATE domains SET status = 'pending', processed_at = NULL, error = NULL WHERE campaign_id = ?").run(campaignId);
            db.prepare("UPDATE keywords SET status = 'pending', processed_at = NULL, results_count = 0, error = NULL WHERE campaign_id = ?").run(campaignId);
            db.prepare("UPDATE campaigns SET status = 'pending', processed_domains = 0, started_at = NULL, completed_at = NULL WHERE id = ?").run(campaignId);
        })(req.params.id);

        res.json({ success: true, message: 'Campaign reset and ready to run again' });
    } catch (error) {
        console.error('Campaign restart error:', error);
        res.status(500).json({ error: 'Could not restart campaign' });
    }
});

// Delete campaign
router.delete('/:id', (req, res) => {
    try {
        campaignOps.delete.run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

