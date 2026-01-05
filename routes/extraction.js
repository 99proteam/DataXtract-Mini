const express = require('express');
const router = express.Router();
const { campaignOps, domainOps, resultOps } = require('../config/database');
const extractorService = require('../services/extractor');
const security = require('../services/security');


// Active extraction jobs
const activeJobs = new Map();

// Start extraction for a campaign
router.post('/start/:campaignId', async (req, res) => {
    try {
        const campaignId = req.params.campaignId;
        const campaign = campaignOps.getById.get(campaignId);

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        if (campaign.status === 'running') {
            return res.status(400).json({ error: 'Campaign is already running' });
        }

        // Get options
        const options = campaign.options ? JSON.parse(campaign.options) : {};
        const campaignType = campaign.campaign_type;

        // Start campaign
        campaignOps.start.run(campaignId);

        // Handle different campaign types

        // Domain extraction campaign (default)
        const domains = domainOps.getAllPending.all(campaignId);

        if (domains.length === 0) {
            campaignOps.complete.run(campaignId);
            return res.json({ success: true, message: 'No pending domains' });
        }

        // Start extraction in background
        const job = extractorService.startExtraction(campaignId, domains, options);
        activeJobs.set(campaignId, job);

        res.json({
            success: true,
            message: 'Extraction started',
            totalDomains: domains.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Pause extraction
router.post('/pause/:campaignId', (req, res) => {
    try {
        const campaignId = req.params.campaignId;

        if (activeJobs.has(campaignId)) {
            activeJobs.get(campaignId).pause();
        }

        campaignOps.pause.run(campaignId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Resume extraction
router.post('/resume/:campaignId', async (req, res) => {
    try {
        const campaignId = req.params.campaignId;
        const campaign = campaignOps.getById.get(campaignId);

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const options = campaign.options ? JSON.parse(campaign.options) : {};
        const domains = domainOps.getAllPending.all(campaignId);

        if (domains.length === 0) {
            campaignOps.complete.run(campaignId);
            return res.json({ success: true, message: 'No pending domains' });
        }

        campaignOps.updateStatus.run('running', campaignId);

        const job = extractorService.startExtraction(campaignId, domains, options);
        activeJobs.set(campaignId, job);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get extraction status
router.get('/status/:campaignId', (req, res) => {
    try {
        const campaign = campaignOps.getById.get(req.params.campaignId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        res.json({
            status: campaign.status,
            total: campaign.total_domains,
            processed: campaign.processed_domains,
            progress: campaign.total_domains > 0
                ? Math.round((campaign.processed_domains / campaign.total_domains) * 100)
                : 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export results
router.get('/export/:campaignId/:format', (req, res) => {
    try {
        const { campaignId, format } = req.params;
        const results = resultOps.getGroupedByCampaign(campaignId);
        const campaign = campaignOps.getById.get(campaignId);

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        switch (format) {
            case 'json':
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="${campaign.name}-results.json"`);
                res.json(results);
                break;

            case 'csv':
                const csv = generateCSV(results);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${campaign.name}-results.csv"`);
                res.send(csv);
                break;

            case 'excel':
                const XLSX = require('xlsx');
                const wb = generateExcel(results);
                const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${campaign.name}-results.xlsx"`);
                res.end(buffer); // Use end() for binary buffers
                break;

            default:
                res.status(400).json({ error: 'Invalid format. Use json, csv, or excel' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate CSV from results
function generateCSV(results) {
    const rows = [
        ['Domain', 'Emails', 'Email Sources', 'Phones', 'Phone Sources', 'Technology', 'Social Links', 'Title', 'Description', 'Address', 'Images', 'Videos', 'PDFs']
    ];

    for (const r of results) {
        rows.push([
            r.domain,
            r.emails.map(e => e.value).join('; '),
            r.emails.map(e => e.source).join('; '),
            r.phones.map(p => p.value).join('; '),
            r.phones.map(p => p.source).join('; '),
            r.technology.map(t => t.name).join('; '),
            r.socialLinks.map(s => `${s.platform}: ${s.url}`).join('; '),
            r.metadata.title || '',
            r.metadata.description || '',
            r.address || '',
            r.media.images.join('; '),
            r.media.videos.join('; '),
            r.media.pdfs.join('; ')
        ]);
    }

    return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// Generate Excel workbook from results
function generateExcel(results) {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();

    // Main results sheet
    const mainData = results.map(r => ({
        'Domain': r.domain,
        'Emails': r.emails.map(e => e.value).join('; '),
        'Phones': r.phones.map(p => p.value).join('; '),
        'Technology': r.technology.map(t => t.name).join('; '),
        'Social Links': r.socialLinks.map(s => s.url).join('; '),
        'Title': r.metadata.title || '',
        'Description': r.metadata.description || '',
        'Address': r.address || ''
    }));

    const mainSheet = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(wb, mainSheet, 'Results');

    // Detailed emails sheet
    const emailData = [];
    for (const r of results) {
        for (const e of r.emails) {
            emailData.push({
                'Domain': r.domain,
                'Email': e.value,
                'Found On Page': e.source
            });
        }
    }
    if (emailData.length > 0) {
        const emailSheet = XLSX.utils.json_to_sheet(emailData);
        XLSX.utils.book_append_sheet(wb, emailSheet, 'Emails');
    }

    // Detailed phones sheet
    const phoneData = [];
    for (const r of results) {
        for (const p of r.phones) {
            phoneData.push({
                'Domain': r.domain,
                'Phone': p.value,
                'Found On Page': p.source
            });
        }
    }
    if (phoneData.length > 0) {
        const phoneSheet = XLSX.utils.json_to_sheet(phoneData);
        XLSX.utils.book_append_sheet(wb, phoneSheet, 'Phones');
    }

    // Media sheet
    const mediaData = [];
    for (const r of results) {
        for (const img of r.media.images) {
            mediaData.push({ 'Domain': r.domain, 'Type': 'Image', 'URL': img });
        }
        for (const vid of r.media.videos) {
            mediaData.push({ 'Domain': r.domain, 'Type': 'Video', 'URL': vid });
        }
        for (const pdf of r.media.pdfs) {
            mediaData.push({ 'Domain': r.domain, 'Type': 'PDF', 'URL': pdf });
        }
    }
    if (mediaData.length > 0) {
        const mediaSheet = XLSX.utils.json_to_sheet(mediaData);
        XLSX.utils.book_append_sheet(wb, mediaSheet, 'Media');
    }

    return wb;
}

// Helper to start extraction (exposed for Scheduler)
function startDomainExtraction(campaignId, domains, options) {
    const job = extractorService.startExtraction(campaignId, domains, options);
    activeJobs.set(campaignId, job);
    return job;
}

/**
 * POST /api/extraction/custom-website
 * Extract data from custom websites (bulk URLs)
 * Auto-detects emails, phones, social links, addresses
 */


module.exports = router;
module.exports.startDomainExtraction = startDomainExtraction;
