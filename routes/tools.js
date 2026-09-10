/**
 * Tools API Routes
 * Handles miscellaneous tools like bulk screenshots
 */

const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { toolsOps } = require('../config/database');
const { proxyOps } = require('../config/database');
const { withBrowserExecutable } = require('../services/browserExecutable');

// Pkg-compatible base directory
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..');

// Helper to delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get random user agent
const getRandomUA = (type = 'desktop') => {
    const desktopUAs = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
    ];
    const mobileUAs = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Mobile Safari/537.36'
    ];
    return type === 'mobile'
        ? mobileUAs[Math.floor(Math.random() * mobileUAs.length)]
        : desktopUAs[Math.floor(Math.random() * desktopUAs.length)];
};

/**
 * POST /api/tools/traffic
 * Generate fake traffic to URLs
 */
router.post('/traffic', async (req, res) => {
    const { urls, config } = req.body;
    // config: { useProxies: bool, durationMin: int, durationMax: int, device: 'desktop'|'mobile', visitCount: int }

    if (!urls || !Array.isArray(urls)) return res.status(400).json({ error: 'URLs array is required' });

    const jobId = Date.now().toString();
    const visitCount = config.visitCount || 1;

    // Respond immediately
    res.json({ success: true, message: 'Traffic generation started', jobId });

    // Background Process
    (async () => {
        try {
            // Get proxies if enabled
            let proxies = [];
            if (config.useProxies) {
                proxies = proxyOps.getAll.all();
                if (proxies.length === 0) {
                    if (global.broadcastToCampaign) {
                        global.broadcastToCampaign('visual_tools', {
                            type: 'tool_log',
                            tool: 'traffic',
                            message: '⚠️ No proxies found! Checking database...',
                            status: 'error'
                        });
                    }
                }
            }

            // Loop 1: URLs
            for (let i = 0; i < urls.length; i++) {
                let url = urls[i];
                if (!url.startsWith('http')) url = 'https://' + url;

                // Loop 2: Visits per URL
                for (let v = 0; v < visitCount; v++) {

                    let browser = null;
                    let page = null;
                    let status = 'failed';
                    let details = 'Using Direct IP';

                    try {
                        const launchArgs = [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-features=IsolateOrigins,site-per-process'
                        ];

                        // Proxy Selection (Random per visit)
                        let activeProxy = null;
                        if (proxies.length > 0) {
                            activeProxy = proxies[Math.floor(Math.random() * proxies.length)];
                            if (activeProxy && activeProxy.host && activeProxy.port) {
                                // Default to http if protocol missing
                                const protocol = activeProxy.protocol || 'http';
                                launchArgs.push(`--proxy-server=${protocol}://${activeProxy.host}:${activeProxy.port}`);
                                details = `Using Proxy: ${activeProxy.host}`;
                            }
                        }

                        // Launch New Browser Instance for this SPECIFIC visit
                        // This ensures the --proxy-server arg is applied fresh
                        browser = await puppeteer.launch(withBrowserExecutable({
                            headless: 'new',
                            args: launchArgs
                        }));

                        page = await browser.newPage();

                        // Authenticate Proxy if needed
                        if (activeProxy && activeProxy.username && activeProxy.password) {
                            await page.authenticate({
                                username: activeProxy.username,
                                password: activeProxy.password
                            });
                        }

                        // UA Rotation
                        const ua = getRandomUA(config.device === 'mix' ? (Math.random() > 0.5 ? 'mobile' : 'desktop') : config.device);
                        await page.setUserAgent(ua);

                        // Viewport
                        if (ua.includes('Mobile') || config.device === 'mobile') {
                            await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
                        } else {
                            await page.setViewport({ width: 1920, height: 1080 });
                        }

                        // Visit
                        await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

                        // Behavior (Simulate Human)
                        const duration = Math.floor(Math.random() * (config.durationMax - config.durationMin + 1)) + config.durationMin;
                        const durationMs = duration * 1000;

                        // Only simulate if enabled
                        if (config.enableHuman) {
                            await simulateHumanBehavior(page, durationMs);
                        } else {
                            await sleep(durationMs);
                        }

                        // Internal Page Visits
                        if (config.internalVisits > 0) {
                            try {
                                // Extract internal links
                                const links = await page.evaluate(() => {
                                    const currentHost = window.location.host;
                                    return Array.from(document.querySelectorAll('a'))
                                        .map(a => a.href)
                                        .filter(href => href.includes(currentHost) && !href.includes('#') && !href.startsWith('mailto'));
                                });

                                // Visit N random internal pages
                                const uniqueLinks = [...new Set(links)];
                                let visits = 0;
                                const maxInternal = Math.min(config.internalVisits, uniqueLinks.length);

                                while (visits < maxInternal && uniqueLinks.length > 0) {
                                    const randomIndex = Math.floor(Math.random() * uniqueLinks.length);
                                    const nextUrl = uniqueLinks.splice(randomIndex, 1)[0];

                                    if (global.broadcastToCampaign) {
                                        global.broadcastToCampaign('visual_tools', {
                                            type: 'tool_log',
                                            tool: 'traffic',
                                            message: `➡️ Visiting internal: ${nextUrl}`,
                                            status: 'info'
                                        });
                                    }

                                    await page.goto(nextUrl, { waitUntil: 'networkidle2', timeout: 60000 });

                                    // Short stay on internal page
                                    const internalDuration = 10000 + Math.floor(Math.random() * 20000);
                                    if (config.enableHuman) {
                                        await simulateHumanBehavior(page, internalDuration);
                                    } else {
                                        await sleep(internalDuration);
                                    }
                                    visits++;
                                }
                            } catch (err) {
                                console.error('Internal visit error:', err.message);
                            }
                        }

                        status = 'completed';
                        details += ` - Visited for ${duration}s`;

                        if (global.broadcastToCampaign) {
                            global.broadcastToCampaign('visual_tools', {
                                type: 'tool_log',
                                tool: 'traffic',
                                message: `✅ [${v + 1}/${visitCount}] Visited: ${url} (${duration}s) [IP: ${activeProxy ? activeProxy.host : 'Direct'}]`,
                                url: url,
                                status: 'success'
                            });
                        }

                    } catch (e) {
                        // Simplify error message
                        const cleanMsg = e.message ? e.message.split('\n')[0] : 'Unknown error';
                        if (global.broadcastToCampaign) {
                            global.broadcastToCampaign('visual_tools', {
                                type: 'tool_log',
                                tool: 'traffic',
                                message: `❌ [${v + 1}/${visitCount}] Failed: ${url} - ${cleanMsg}`,
                                url: url,
                                status: 'error'
                            });
                        }
                    } finally {
                        try {
                            if (browser) await browser.close();
                        } catch (err) { }

                        // Log to DB
                        toolsOps.logUsage.run('traffic', url, status, 0, null, details);
                    }

                    // Human delay between visits
                    await sleep(1000 + Math.random() * 2000);
                }
            }

        } catch (e) {
            console.error('Traffic Job Error:', e);
            if (global.broadcastToCampaign) {
                global.broadcastToCampaign('visual_tools', {
                    type: 'tool_log',
                    tool: 'traffic',
                    message: `🔥 CRITICAL ERROR: ${e.message}`,
                    status: 'error'
                });
            }
        } finally {
            if (global.broadcastToCampaign) {
                global.broadcastToCampaign('visual_tools', { type: 'tool_log', tool: 'traffic', message: 'Traffic generation finished' });
            }
        }
    })();
});

/**
 * POST /api/tools/download
 * Download Source Code
 */
router.post('/download', async (req, res) => {
    const { urls, renderJs } = req.body;

    if (!urls || !Array.isArray(urls)) return res.status(400).json({ error: 'URLs array is required' });

    const batchId = Date.now().toString();
    const saveDir = path.join(baseDir, 'data', 'downloads', batchId);

    try {
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
    } catch (e) {
        return res.status(500).json({ error: 'Failed to create save directory' });
    }

    res.json({ success: true, message: 'Download started', batchId });

    (async () => {
        let browser = null;
        try {
            if (renderJs) {
                browser = await puppeteer.launch(withBrowserExecutable({ headless: 'new', args: ['--no-sandbox'] }));
            }

            for (let i = 0; i < urls.length; i++) {
                let url = urls[i];
                if (!url.startsWith('http')) url = 'https://' + url;

                const startTime = Date.now();
                let status = 'failed';
                let savedPath = null;
                let html = '';

                try {
                    if (renderJs) {
                        const page = await browser.newPage();
                        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                        html = await page.content();
                        await page.close();
                    } else {
                        // Static fetch using built-in fetch (Node 18+) or axios
                        const response = await fetch(url);
                        html = await response.text();
                    }

                    // Save file
                    const safeName = url.replace(/[^a-z0-9]/gi, '_').substring(0, 50) + '.html';
                    savedPath = path.join(saveDir, safeName);
                    fs.writeFileSync(savedPath, html);

                    status = 'completed';

                    if (global.broadcastToCampaign) {
                        global.broadcastToCampaign('visual_tools', {
                            type: 'tool_log',
                            tool: 'downloader',
                            message: `✅ Saved: ${url} -> ${savedPath}`,
                            url: url,
                            status: 'success'
                        });
                    }

                } catch (e) {
                    console.error('Download error:', e.message);
                    if (global.broadcastToCampaign) {
                        global.broadcastToCampaign('visual_tools', {
                            type: 'tool_log',
                            tool: 'downloader',
                            message: `❌ Failed: ${url} - ${e.message}`,
                            url: url,
                            status: 'error'
                        });
                    }
                } finally {
                    const totalTime = Date.now() - startTime;
                    toolsOps.logUsage.run('code_download', url, status, totalTime, savedPath, renderJs ? 'Rendered JS' : 'Static');
                }
            }
        } catch (e) {
            console.error('Download Job Error:', e);
        } finally {
            if (browser) await browser.close();
            if (global.broadcastToCampaign) {
                global.broadcastToCampaign('visual_tools', { type: 'tool_log', tool: 'downloader', message: 'All downloads finished' });
            }
        }
    })();
});

/**
 * POST /api/tools/screenshot
 * Take screenshots of multiple URLs
 */
router.post('/screenshot', async (req, res) => {
    const { urls, browser, device, campaignId } = req.body;

    if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ error: 'URLs array is required' });
    }

    // Create unique folder for this batch
    const batchId = Date.now().toString();
    const saveDir = path.join(baseDir, 'public', 'screenshots', batchId);

    try {
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }
    } catch (e) {
        return res.status(500).json({ error: 'Failed to create screenshot directory' });
    }

    // Respond immediately, process in background
    res.json({
        success: true,
        message: 'Screenshot job started',
        batchId: batchId,
        savePath: saveDir
    });

    // Background Processing
    (async () => {
        let browserInstance = null;
        try {
            // Configure Browser based on selection (User-Agent mainly)
            const launchOptions = {
                headless: 'new',
                defaultViewport: null,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
            };

            browserInstance = await puppeteer.launch(withBrowserExecutable(launchOptions));
            const page = await browserInstance.newPage();

            // Configure User Agent
            let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            if (browser === 'firefox') userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0';
            if (browser === 'safari') userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15';
            if (browser === 'edge') userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';

            await page.setUserAgent(userAgent);

            // Handle devices array (fallback to single device if old legacy call)
            const targetDevices = (req.body.devices && Array.isArray(req.body.devices)) ? req.body.devices : [device || 'desktop'];
            const totalTasks = urls.length * targetDevices.length;
            let processedCount = 0;

            // Process URLs
            for (let i = 0; i < urls.length; i++) {
                let url = urls[i];
                if (!url.startsWith('http')) url = 'https://' + url;

                for (const currentDevice of targetDevices) {
                    try {
                        // Configure Viewport
                        let viewport = { width: 1920, height: 1080 };
                        let isMobile = false;

                        if (currentDevice === 'laptop') viewport = { width: 1366, height: 768 };
                        if (currentDevice === 'tablet') { viewport = { width: 768, height: 1024, isMobile: true, hasTouch: true }; isMobile = true; }
                        if (currentDevice === 'mobile') { viewport = { width: 390, height: 844, isMobile: true, hasTouch: true }; isMobile = true; }

                        await page.setViewport(viewport);

                        // If mobile/tablet, simulate mobile UA
                        if (isMobile) {
                            await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
                        } else {
                            // Reset to selected browser UA
                            await page.setUserAgent(userAgent);
                        }

                        // Update Progress
                        if (global.broadcastToCampaign && campaignId) {
                            global.broadcastToCampaign(campaignId, {
                                type: 'progress',
                                message: `Capturing ${url} on ${currentDevice}...`,
                                progress: Math.round((processedCount / totalTasks) * 100),
                                processed: processedCount,
                                total: totalTasks
                            });
                        }

                        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

                        // Sanitize filename
                        const safeUrl = url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').substring(0, 50);
                        const filename = `${safeUrl}_${currentDevice}_${Date.now()}.png`;
                        const filepath = path.join(saveDir, filename);
                        const publicPath = `/screenshots/${batchId}/${filename}`;

                        await page.screenshot({ path: filepath, fullPage: false });

                        // Broadcast Success
                        if (global.broadcastToCampaign && campaignId) {
                            global.broadcastToCampaign(campaignId, {
                                type: 'screenshot_result',
                                urlIndex: i, // Index of URL in the original list
                                device: currentDevice,
                                url: url,
                                success: true,
                                image: publicPath,
                                path: filepath
                            });
                        }

                    } catch (err) {
                        console.error(`Screenshot failed for ${url} (${currentDevice}):`, err.message);
                        if (global.broadcastToCampaign && campaignId) {
                            global.broadcastToCampaign(campaignId, {
                                type: 'screenshot_result',
                                urlIndex: i,
                                device: currentDevice,
                                url: url,
                                success: false,
                                error: err.message
                            });
                        }
                    }
                    processedCount++;
                }
            }

            // Final Completion
            if (global.broadcastToCampaign && campaignId) {
                global.broadcastToCampaign(campaignId, {
                    type: 'progress',
                    message: 'All screenshots completed',
                    progress: 100
                });
            }

        } catch (error) {
            console.error('Screenshot job error:', error);
        } finally {
            if (browserInstance) await browserInstance.close();
        }
    })();
});

// Advanced Human Simulation
async function simulateHumanBehavior(page, totalDuration) {
    const startTime = Date.now();

    // Helper for random mouse move
    const randomMove = async () => {
        try {
            const viewport = await page.viewport();
            const x = Math.floor(Math.random() * viewport.width);
            const y = Math.floor(Math.random() * viewport.height);
            // Steps gives it a smooth "gliding" feel
            await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 20) });
        } catch (e) { }
    };

    while (Date.now() - startTime < totalDuration) {
        try {
            const remaining = totalDuration - (Date.now() - startTime);
            if (remaining <= 0) break;

            // 1. Random Scroll
            const scrollAmount = Math.floor(Math.random() * 400) - 100; // Mostly down, sometimes up
            await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), scrollAmount);

            // 2. Random Mouse Move (Simulate reading/hovering)
            if (Math.random() > 0.3) await randomMove();

            // 3. Random Pause (Reading time)
            const pause = 500 + Math.floor(Math.random() * 2000);
            await sleep(Math.min(pause, remaining));

            // 4. Sometimes "jiggle" (small rapid moves)
            if (Math.random() > 0.8) {
                await page.mouse.move(100, 100, { steps: 5 });
                await page.mouse.move(105, 105, { steps: 5 });
            }

        } catch (e) {
            break; // Exit if page closed
        }
    }
}

/**
 * GET /api/tools/export/:type
 * Export logs to CSV
 */
router.get('/export/:type', async (req, res) => {
    const { type } = req.params; // 'traffic' or 'code_download'

    try {
        const logs = toolsOps.getLogs.all(); // Assuming getLogs fetches all recent

        // Filter by type if needed
        const filtered = logs.filter(l =>
            type === 'traffic' ? l.tool_type === 'traffic' : l.tool_type === 'code_download'
        );

        const { Parser } = require('json2csv');
        const fields = ['id', 'tool_type', 'url', 'status', 'duration', 'details', 'created_at'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(filtered);

        res.header('Content-Type', 'text/csv');
        res.attachment(`${type}_logs_${Date.now()}.csv`);
        res.send(csv);

    } catch (e) {
        console.error('Export error:', e);
        res.status(500).send('Failed to export data');
    }
});

module.exports = router;
