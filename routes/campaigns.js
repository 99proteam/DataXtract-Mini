const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { campaignOps, domainOps, resultOps, keywordOps, mapsResultOps, db } = require('../config/database');

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
        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new campaign (supports both domain and maps types)
// Create new campaign (supports both domain and maps types)
router.post('/', (req, res) => {
    const upload = req.app.get('upload');

    upload.single('domainsFile')(req, res, (err) => {
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
            const { name, mode, options, campaignType, keywords } = req.body;
            const campaignId = uuidv4();
            const type = campaignType || 'domain';

            // Parse options if it's a string
            const parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;

            // Helper to parse file content based on extension
            const parseUploadedFile = (file) => {
                if (!file) return [];

                const ext = path.extname(file.originalname).toLowerCase();
                let items = [];

                if (ext === '.xlsx' || ext === '.xls') {
                    const XLSX = require('xlsx');
                    const workbook = XLSX.readFile(file.path);
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    // Flatten 2D array and filter empty
                    items = data.flat().filter(item => item && String(item).trim().length > 0);
                } else if (ext === '.csv') {
                    // Simple CSV parser - split by newline and comma
                    const content = fs.readFileSync(file.path, 'utf-8');
                    items = content
                        .split(/[\r\n]+/)
                        .flatMap(line => line.split(','))
                        .map(item => item.trim())
                        .filter(item => item.length > 0);
                } else {
                    // Default text file
                    const content = fs.readFileSync(file.path, 'utf-8');
                    items = content
                        .split(/[\r\n]+/)
                        .map(item => item.trim())
                        .filter(item => item.length > 0);
                }

                // Clean up file
                try {
                    fs.unlinkSync(file.path);
                } catch (e) {
                    console.error('Error deleting temp file:', e);
                }

                return items;
            };

            if (type === 'maps') {
                // Google Maps campaign - use keywords
                let keywordList = [];

                // Keywords can come from file or direct input
                if (req.file) {
                    keywordList = parseUploadedFile(req.file);
                } else if (keywords) {
                    keywordList = (typeof keywords === 'string' ? JSON.parse(keywords) : keywords)
                        .map(k => k.trim())
                        .filter(k => k && k.length > 0);
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
                    const items = parseUploadedFile(req.file);
                    domains = items.map(d => {
                        // Clean domain - remove protocol if present
                        return String(d).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
                    });
                }

                if (domains.length === 0) {
                    return res.status(400).json({ error: 'No valid domains found in file. Please upload a file with domains.' });
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
router.patch('/:id/status', (req, res) => {
    try {
        const { status } = req.body;
        campaignOps.updateStatus.run(status, req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
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

