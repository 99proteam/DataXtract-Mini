const express = require('express');
const router = express.Router();
const { campaignOps, keywordOps, mapsResultOps } = require('../config/database');
const googleMapsExtractor = require('../services/googleMapsExtractor');
const security = require('../services/security');
const { createWorkbookBuffer } = require('../services/excelExport');

// Active Google Maps extraction jobs
const activeJobs = new Map();

// Start Google Maps extraction for a campaign
router.post('/start/:campaignId', async (req, res) => {
    try {
        const campaignId = req.params.campaignId;
        const campaign = campaignOps.getById.get(campaignId);

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        if (campaign.campaign_type !== 'maps') {
            return res.status(400).json({ error: 'This is not a Google Maps campaign' });
        }

        if (campaign.status === 'running') {
            return res.status(400).json({ error: 'Campaign is already running' });
        }

        // Get options
        const options = campaign.options ? JSON.parse(campaign.options) : {};

        // Start campaign
        campaignOps.start.run(campaignId);

        // Get pending keywords
        const keywords = keywordOps.getAllPending.all(campaignId);

        if (keywords.length === 0) {
            campaignOps.complete.run(campaignId);
            return res.json({ success: true, message: 'No pending keywords' });
        }

        // Start extraction in background
        const job = startMapsExtraction(campaignId, keywords, options, campaign.mode);
        activeJobs.set(campaignId, job);

        res.json({
            success: true,
            message: 'Google Maps extraction started',
            totalKeywords: keywords.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Maps extraction job
async function startMapsExtraction(campaignId, keywords, options, mode) {
    const job = {
        isPaused: false,
        processed: 0,

        pause() {
            this.isPaused = true;
        }
    };

    // Run extraction asynchronously
    (async () => {
        try {
            const configuredDelay = Number(options.security?.delay);
            const securityConfig = {
                ...security.defaultConfig,
                minDelay: options.security?.minDelay ?? (Number.isFinite(configuredDelay) ? configuredDelay : 2000),
                maxDelay: options.security?.maxDelay ?? (Number.isFinite(configuredDelay) ? configuredDelay : 5000),
            };

            for (const keywordRecord of keywords) {
                if (job.isPaused) break;

                const { id: keywordId, keyword } = keywordRecord;

                try {
                    // Broadcast current keyword processing
                    if (global.broadcastToCampaign) {
                        global.broadcastToCampaign(campaignId, {
                            type: 'processing_item',
                            item: keyword
                        });
                    }

                    // Search Google Maps
                    const results = await googleMapsExtractor.searchGoogleMaps(keyword, {
                        maxResults: options.maxResults ?? options.maxResultsPerKeyword ?? 20,
                        getDetails: options.getDetails !== false && options.getBusinessDetails !== false,
                        useProxies: options.useProxies === true,
                        useUserAgentRotation: options.useUserAgentRotation !== false,
                        securityConfig,
                        // If "live" mode is selected, show browser. Otherwise headless (new).
                        headless: mode === 'live' ? false : 'new',
                        onLog: (msg) => {
                            if (global.broadcastToCampaign) {
                                global.broadcastToCampaign(campaignId, {
                                    type: 'log',
                                    message: msg
                                });
                            }
                        },
                        onResult: (business) => {
                            // Broadcast each result live as it's found
                            if (global.broadcastToCampaign) {
                                global.broadcastToCampaign(campaignId, {
                                    type: 'result',
                                    keyword,
                                    business: {
                                        name: business.name,
                                        address: business.address || business.fullAddress,
                                        phone: business.phone,
                                        website: business.website,
                                        rating: business.rating,
                                        reviewCount: business.reviewCount,
                                        category: business.category
                                    }
                                });
                            }
                        }
                    });

                    // Format and save results
                    if (results.length > 0) {
                        const formattedResults = results.map(r => ({
                            campaignId,
                            keywordId,
                            searchKeyword: keyword,
                            businessName: r.name,
                            address: r.address || r.fullAddress,
                            phone: r.phone,
                            website: r.website,
                            rating: r.rating,
                            reviewCount: r.reviewCount,
                            category: r.category,
                            hours: r.hoursInfo || r.hours,
                            mapsUrl: r.mapsUrl,
                            placeId: r.placeId,
                            plusCode: r.plusCode,
                            coordinates: r.coordinates ? JSON.stringify(r.coordinates) : null,
                        }));

                        mapsResultOps.addMany(formattedResults);
                    }

                    // Update keyword status
                    keywordOps.updateStatus.run('completed', results.length, null, keywordId);

                    // Broadcast progress
                    if (global.broadcastToCampaign) {
                        const processedCount = job.processed + 1; // Current keyword finished

                        global.broadcastToCampaign(campaignId, {
                            type: 'progress',
                            processed: processedCount,
                            total: keywords.length,
                            progress: Math.round((processedCount / keywords.length) * 100)
                        });

                        global.broadcastToCampaign(campaignId, {
                            type: 'keyword_complete',
                            keyword: keyword,
                            resultsCount: results.length
                        });
                    }

                } catch (error) {
                    console.error(`Error searching "${keyword}":`, error.message);
                    keywordOps.updateStatus.run('error', 0, error.message, keywordId);

                    if (global.broadcastToCampaign) {
                        global.broadcastToCampaign(campaignId, {
                            type: 'keyword_error',
                            keyword,
                            error: error.message
                        });
                    }
                }

                job.processed++;

                // Update campaign progress
                campaignOps.updateProgress.run(job.processed, campaignId);

                if (global.broadcastToCampaign) {
                    global.broadcastToCampaign(campaignId, {
                        type: 'progress',
                        processed: job.processed,
                        total: keywords.length
                    });
                }

                // Delay between keywords
                if (!job.isPaused && keywords.indexOf(keywordRecord) < keywords.length - 1) {
                    await security.humanDelay(securityConfig);
                }
            }

            // Mark complete if not paused
            if (!job.isPaused) {
                campaignOps.complete.run(campaignId);
                if (global.broadcastToCampaign) {
                    global.broadcastToCampaign(campaignId, { type: 'completed' });
                }
            }

        } catch (error) {
            console.error('Maps extraction job error:', error);
            if (global.broadcastToCampaign) {
                global.broadcastToCampaign(campaignId, {
                    type: 'error',
                    message: error.message
                });
            }
        }
    })();

    return job;
}

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

// Get Maps results
router.get('/results/:campaignId', (req, res) => {
    try {
        const results = mapsResultOps.getGroupedByCampaign(req.params.campaignId);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export Maps results
router.get('/export/:campaignId/:format', async (req, res) => {
    try {
        const { campaignId, format } = req.params;
        const results = mapsResultOps.getGroupedByCampaign(campaignId);
        const campaign = campaignOps.getById.get(campaignId);

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        // Flatten results for export
        const flatResults = [];
        for (const group of results) {
            for (const biz of group.businesses) {
                flatResults.push({
                    keyword: group.keyword,
                    ...biz
                });
            }
        }

        switch (format) {
            case 'json':
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="${campaign.name}-maps.json"`);
                res.json(flatResults);
                break;

            case 'csv':
                const csv = generateMapsCSV(flatResults);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${campaign.name}-maps.csv"`);
                res.send(csv);
                break;

            case 'excel':
                const buffer = await generateMapsExcel(flatResults);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${campaign.name}-maps.xlsx"`);
                res.send(buffer);
                break;

            default:
                res.status(400).json({ error: 'Invalid format' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate CSV for Maps results
function generateMapsCSV(results) {
    const rows = [
        ['Keyword', 'Business Name', 'Address', 'Phone', 'Website', 'Rating', 'Reviews', 'Category', 'Hours', 'Maps URL']
    ];

    for (const r of results) {
        rows.push([
            r.keyword || '',
            r.name || '',
            r.address || '',
            r.phone || '',
            r.website || '',
            r.rating || '',
            r.reviewCount || '',
            r.category || '',
            r.hours || '',
            r.mapsUrl || ''
        ]);
    }

    return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// Generate Excel for Maps results
async function generateMapsExcel(results) {
    const data = results.map(r => ({
        'Search Keyword': r.keyword || '',
        'Business Name': r.name || '',
        'Address': r.address || '',
        'Phone': r.phone || '',
        'Website': r.website || '',
        'Rating': r.rating || '',
        'Review Count': r.reviewCount || '',
        'Category': r.category || '',
        'Hours': r.hours || '',
        'Google Maps URL': r.mapsUrl || '',
        'Place ID': r.placeId || ''
    }));

    return createWorkbookBuffer([{ name: 'Google Maps Results', rows: data }]);
}

// Export the router and the start function
module.exports = router;
module.exports.startMapsExtraction = startMapsExtraction;
