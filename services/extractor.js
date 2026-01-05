const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { campaignOps, domainOps, resultOps } = require('../config/database');
const emailExtractor = require('./emailExtractor');
const phoneExtractor = require('./phoneExtractor');
const techDetector = require('./techDetector');
const socialExtractor = require('./socialExtractor');
const mediaExtractor = require('./mediaExtractor');
const metaExtractor = require('./metaExtractor');
const security = require('./security');
const sitemapParser = require('./sitemapParser');
const proxyManager = require('./proxyManager');
const userAgentRotator = require('./userAgentRotator');

class ExtractionJob {
    constructor(campaignId, domains, options) {
        this.campaignId = campaignId;
        this.domains = domains;
        this.options = options;
        this.isPaused = false;
        this.browser = null;
        this.processed = 0;

        // Security configuration
        this.securityConfig = {
            ...security.defaultConfig,
            minDelay: options.security?.minDelay || 2000,
            maxDelay: options.security?.maxDelay || 5000,
            maxConcurrent: options.security?.maxConcurrent || 2,
            respectRobotsTxt: options.crawlSettings?.respectRobotsTxt !== false,
        };

        // User agent rotation setting (default ON)
        this.useUserAgentRotation = options.useUserAgentRotation !== false;
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }

    async run() {
        try {
            console.log(`[Extraction] Starting job for campaign ${this.campaignId}`);

            // Proxy setup
            const proxy = proxyManager.getNextProxy();
            const proxyArgs = proxyManager.formatForPuppeteer(proxy);
            const proxyAuth = proxyManager.getAuth(proxy);

            if (proxy) {
                console.log(`[Extraction] Using proxy: ${proxy.host}:${proxy.port}`);
            }

            // Launch browser with anti-detection args
            console.log('[Extraction] Launching browser...');
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-features=IsolateOrigins,site-per-process',
                    ...proxyArgs
                ]
            });

            // Apply auth to all pages if needed
            if (proxyAuth) {
                this.browser.on('targetcreated', async (target) => {
                    const page = await target.page();
                    if (page) {
                        await page.authenticate(proxyAuth);
                    }
                });
            }

            // Process domains
            // We can implement concurrency here if needed, but keeping it sequential with delays for safety
            for (const domainRecord of this.domains) {
                if (this.isPaused) {
                    console.log('[Extraction] Job paused');
                    break;
                }

                console.log(`[Extraction] Processing domain: ${domainRecord.domain}`);
                await this.processDomain(domainRecord);
                this.processed++;

                // Update campaign progress
                campaignOps.updateProgress.run(this.processed, this.campaignId);

                // Broadcast progress
                this.broadcast({
                    type: 'progress',
                    processed: this.processed,
                    total: this.domains.length,
                    domain: domainRecord.domain
                });

                // Security delay between domains
                if (!this.isPaused && this.domains.indexOf(domainRecord) < this.domains.length - 1) {
                    await security.humanDelay(this.securityConfig);
                }
            }

            // Close browser
            if (this.browser) {
                console.log('[Extraction] Closing browser...');
                await this.browser.close();
            }

            // Mark campaign as completed if not paused
            if (!this.isPaused) {
                console.log('[Extraction] Job completed');
                campaignOps.complete.run(this.campaignId);
                this.broadcast({ type: 'completed' });
            }
        } catch (error) {
            console.error('Extraction job error:', error);
            this.broadcast({ type: 'error', message: error.message });

            // Try to close browser on error
            if (this.browser) {
                try { await this.browser.close(); } catch (e) { }
            }
        }
    }

    async processDomain(domainRecord) {
        const { id: domainId, domain } = domainRecord;
        const baseUrl = `https://${domain}`;
        const results = [];
        let page = null;

        try {
            // Check rate limiting
            await security.waitForRateLimit(domain);
            security.trackRequest(domain);

            page = await this.browser.newPage();

            // Apply rotating user agent
            if (this.useUserAgentRotation) {
                await userAgentRotator.applyToPage(page, { rotate: true });
            }

            // Configure page with anti-detection measures
            await security.configurePage(page, this.securityConfig);
            await page.setDefaultNavigationTimeout(this.securityConfig.requestTimeout);

            // 1. Initial Navigation
            this.log(`🌐 Navigating to ${baseUrl}`);
            const response = await page.goto(baseUrl, { waitUntil: 'networkidle2' });

            // Handle redirects/errors
            if (!response || !response.ok()) {
                this.log(`⚠️ Warning: ${baseUrl} returned status ${response ? response.status() : 'No response'}`);
            } else {
                this.log(`✓ Page loaded successfully`);
            }

            // Simulate human behavior
            await security.simulateHumanBehavior(page);

            // Get page content
            const html = await page.content();
            const $ = cheerio.load(html);

            // 2. Discover URLs (Sitemap/Robots.txt integration)
            let pagesToCrawl = [];
            const crawlSettings = this.options.crawlSettings || {};

            if (crawlSettings.deepCrawl) {
                if (crawlSettings.useSitemap) {
                    // Use sitemap discovery
                    const discovery = await sitemapParser.discoverUrls(baseUrl, {
                        maxUrls: crawlSettings.maxPages || 10,
                    });
                    pagesToCrawl = discovery.urls.map(u => u.loc);

                    // Respect crawl delay if specified in robots.txt
                    if (discovery.crawlDelay > 0) {
                        this.securityConfig.minDelay = Math.max(this.securityConfig.minDelay, discovery.crawlDelay);
                    }
                } else {
                    // Standard link discovery from page
                    pagesToCrawl = await this.getPagesToCrawl(page, $, baseUrl);
                }
            }

            // 3. Extract data from main page
            await this.extractFromPage(page, $, baseUrl, domainId, domain, results);

            // 4. Crawl additional pages
            const maxPages = crawlSettings.maxPages || 5;
            const crawledUrls = new Set([baseUrl]);
            // Ensure we don't recrawl main page
            const uniquePages = pagesToCrawl.filter(u => {
                try {
                    const uObj = new URL(u);
                    const bObj = new URL(baseUrl);
                    return uObj.href !== bObj.href && uObj.href !== bObj.href + '/';
                } catch { return false; }
            });

            for (const pageUrl of uniquePages.slice(0, maxPages - 1)) {
                if (this.isPaused) break;
                if (crawledUrls.has(pageUrl)) continue;
                crawledUrls.add(pageUrl);

                try {
                    // Rate limiting check
                    await security.waitForRateLimit(domain);
                    security.trackRequest(domain);

                    // Navigate to page
                    this.log(`📄 Crawling: ${pageUrl}`);
                    await page.goto(pageUrl, { waitUntil: 'networkidle2' });
                    await security.simulateHumanBehavior(page);

                    const pageHtml = await page.content();
                    const $page = cheerio.load(pageHtml);

                    // Extract data
                    await this.extractFromPage(page, $page, pageUrl, domainId, domain, results);

                    // Delay between pages
                    await security.humanDelay(this.securityConfig);
                } catch (e) {
                    this.log(`❌ Error on ${pageUrl}: ${e.message}`);
                }
            }

            await page.close();

            // Save results to database
            if (results.length > 0) {
                resultOps.addMany(results);
            }

            // Update domain status
            domainOps.updateStatus.run('completed', null, domainId);

            // Broadcast domain results
            this.broadcast({
                type: 'domain_complete',
                domain,
                resultsCount: results.length
            });

        } catch (error) {
            console.error(`Error processing ${domain}:`, error.message);
            domainOps.updateStatus.run('error', error.message, domainId);

            if (page) {
                try { await page.close(); } catch (e) { }
            }

            this.broadcast({
                type: 'domain_error',
                domain,
                error: error.message
            });
        }
    }

    async getPagesToCrawl(page, $, baseUrl) {
        const pages = new Set();
        let domain;
        try {
            domain = new URL(baseUrl).hostname;
        } catch (e) {
            return [];
        }

        // Find all internal links
        $('a[href]').each((_, el) => {
            try {
                const href = $(el).attr('href');
                if (!href) return;

                let url;
                if (href.startsWith('http')) {
                    url = new URL(href);
                } else if (href.startsWith('/')) {
                    url = new URL(href, baseUrl);
                } else {
                    return;
                }

                // Clean hostname (remove www)
                const linkHost = url.hostname.replace(/^www\./, '');
                const baseHost = domain.replace(/^www\./, '');

                // Only include internal links
                if (linkHost === baseHost) {
                    // Remove hash and query params for deduplication
                    url.hash = '';
                    url.search = '';
                    const cleanUrl = url.href;
                    pages.add(cleanUrl);
                }
            } catch (e) {
                // Invalid URL, skip
            }
        });

        // Prioritize important pages
        const priorityKeywords = ['contact', 'about', 'team', 'support', 'help', 'privacy', 'terms', 'location'];
        const sortedPages = Array.from(pages).sort((a, b) => {
            const aHasPriority = priorityKeywords.some(k => a.toLowerCase().includes(k));
            const bHasPriority = priorityKeywords.some(k => b.toLowerCase().includes(k));
            if (aHasPriority && !bHasPriority) return -1;
            if (!aHasPriority && bHasPriority) return 1;
            return 0;
        });

        return sortedPages;
    }

    async extractFromPage(page, $, pageUrl, domainId, domain, results) {
        const opts = this.options.extractionOptions || {};

        // Extract emails
        if (opts.emails?.enabled !== false) {
            const emails = emailExtractor.extract($, pageUrl);
            const limit = opts.emails?.limit === 'all' ? Infinity : (opts.emails?.limit || 5);
            if (emails.length > 0) {
                this.log(`📧 Found ${emails.length} email(s) on ${new URL(pageUrl).pathname}`);
            }
            emails.slice(0, limit).forEach(email => {
                if (!results.some(r => r.dataType === 'email' && r.value === email)) {
                    this.log(`   → ${email}`);
                    const resultData = {
                        campaignId: this.campaignId,
                        domainId,
                        domain,
                        dataType: 'email',
                        value: email,
                        sourceUrl: pageUrl,
                        extraInfo: null
                    };
                    results.push(resultData);

                    // Broadcast live result for real-time display
                    this.broadcast({
                        type: 'result_found',
                        result: resultData
                    });
                }
            });
        }

        // Extract phones
        if (opts.phones?.enabled !== false) {
            const phones = phoneExtractor.extract($, pageUrl);
            const limit = opts.phones?.limit === 'all' ? Infinity : (opts.phones?.limit || 5);
            if (phones.length > 0) {
                this.log(`📞 Found ${phones.length} phone(s) on ${new URL(pageUrl).pathname}`);
            }
            phones.slice(0, limit).forEach(phone => {
                if (!results.some(r => r.dataType === 'phone' && r.value === phone)) {
                    this.log(`   → ${phone}`);
                    const resultData = {
                        campaignId: this.campaignId,
                        domainId,
                        domain,
                        dataType: 'phone',
                        value: phone,
                        sourceUrl: pageUrl,
                        extraInfo: null
                    };
                    results.push(resultData);

                    // Broadcast live result
                    this.broadcast({
                        type: 'result_found',
                        result: resultData
                    });
                }
            });
        }

        // Detect technology (only on main page or if forced)
        const isMainPage = pageUrl.includes(domain) && (pageUrl.split('/').length <= 4);
        if (opts.technology?.enabled !== false && isMainPage) {
            const technologies = await techDetector.detect(page, $);
            if (technologies.length > 0) {
                this.log(`🔧 Detected ${technologies.length} technologies: ${technologies.map(t => t.name).join(', ')}`);
            }
            technologies.forEach(tech => {
                if (!results.some(r => r.dataType === 'technology' && r.value === tech.name)) {
                    const resultData = {
                        campaignId: this.campaignId,
                        domainId,
                        domain,
                        dataType: 'technology',
                        value: tech.name,
                        sourceUrl: pageUrl,
                        extraInfo: JSON.stringify({ category: tech.category })
                    };
                    results.push(resultData);

                    // Broadcast live result
                    this.broadcast({
                        type: 'result_found',
                        result: resultData
                    });
                }
            });
        }

        // Extract social links
        if (opts.socialLinks?.enabled !== false) {
            const socials = socialExtractor.extract($);
            socials.forEach(social => {
                if (!results.some(r => r.dataType === 'social' && r.value === social.url)) {
                    const resultData = {
                        campaignId: this.campaignId,
                        domainId,
                        domain,
                        dataType: 'social',
                        value: social.url,
                        sourceUrl: pageUrl,
                        extraInfo: JSON.stringify({ platform: social.platform })
                    };
                    results.push(resultData);

                    // Broadcast live result
                    this.broadcast({
                        type: 'result_found',
                        result: resultData
                    });
                }
            });
        }

        // Extract metadata (mostly mainly page, but address can be anywhere)
        // Extract metadata
        if (opts.metadata?.enabled !== false) {
            const meta = metaExtractor.extract($);

            // Determine if this page is high-value for metadata (Main, Contact, About)
            const isContactPage = /contact|about|location/i.test(pageUrl);
            const shouldExtractMeta = isMainPage || isContactPage;

            // 1. Title: Capture if Main Page OR if it's a specific sub-page (and title isn't generic)
            if (shouldExtractMeta && meta.title && !results.some(r => r.dataType === 'title' && r.value === meta.title)) {

                // Avoid generic titles on subpages if main page already has one
                const isGenericTitle = /contact|about|home/i.test(meta.title);
                const hasTitleAlready = results.some(r => r.dataType === 'title');

                if (!hasTitleAlready || (!isGenericTitle && isContactPage)) {
                    const resultData = {
                        campaignId: this.campaignId,
                        domainId,
                        domain,
                        dataType: 'title',
                        value: meta.title,
                        sourceUrl: pageUrl,
                        extraInfo: isContactPage ? JSON.stringify({ type: 'subpage_title' }) : null
                    };
                    results.push(resultData);
                    this.broadcast({ type: 'result_found', result: resultData });
                }
            }

            // Extract social comments (Instagram/Facebook)
            if (this.options.extractComments && (pageUrl.includes('instagram.com') || pageUrl.includes('facebook.com'))) {
                await this.extractSocialComments(page, pageUrl, domainId, domain, results);
            }

            // 2. Description: Capture from Main Page or About Page
            if (shouldExtractMeta && meta.description && !results.some(r => r.dataType === 'description' && r.value === meta.description)) {
                const resultData = {
                    campaignId: this.campaignId,
                    domainId,
                    domain,
                    dataType: 'description',
                    value: meta.description,
                    sourceUrl: pageUrl,
                    extraInfo: null
                };
                results.push(resultData);
            }

            // 3. Address: Capture from ANY page (Contact pages are prime sources)
            if (meta.address) {
                // Check if we already have this exact address
                const exists = results.some(r => r.dataType === 'address' && (r.value === meta.address || r.value.includes(meta.address)));

                if (!exists) {
                    const resultData = {
                        campaignId: this.campaignId,
                        domainId,
                        domain,
                        dataType: 'address',
                        value: meta.address,
                        sourceUrl: pageUrl,
                        extraInfo: null
                    };
                    results.push(resultData);
                    this.broadcast({ type: 'result_found', result: resultData });
                }
            }
        }

        // Extract media
        if (opts.media) {
            const media = mediaExtractor.extract($, pageUrl);

            if (opts.media.images?.enabled) {
                const imgLimit = opts.media.images?.limit || 10;
                media.images.slice(0, imgLimit).forEach(img => {
                    if (!results.some(r => r.dataType === 'image' && r.value === img)) {
                        results.push({
                            campaignId: this.campaignId,
                            domainId,
                            domain,
                            dataType: 'image',
                            value: img,
                            sourceUrl: pageUrl,
                            extraInfo: null
                        });
                    }
                });
            }

            if (opts.media.videos?.enabled) {
                const vidLimit = opts.media.videos?.limit || 5;
                media.videos.slice(0, vidLimit).forEach(vid => {
                    if (!results.some(r => r.dataType === 'video' && r.value === vid)) {
                        results.push({
                            campaignId: this.campaignId,
                            domainId,
                            domain,
                            dataType: 'video',
                            value: vid,
                            sourceUrl: pageUrl,
                            extraInfo: null
                        });
                    }
                });
            }

            if (opts.media.pdfs?.enabled) {
                const pdfLimit = opts.media.pdfs?.limit || 5;
                media.pdfs.slice(0, pdfLimit).forEach(pdf => {
                    if (!results.some(r => r.dataType === 'pdf' && r.value === pdf)) {
                        results.push({
                            campaignId: this.campaignId,
                            domainId,
                            domain,
                            dataType: 'pdf',
                            value: pdf,
                            sourceUrl: pageUrl,
                            extraInfo: null
                        });
                    }
                });
            }
        }
    }

    async extractSocialComments(page, pageUrl, domainId, domain, results) {
        this.log(`💬 Checking for comments on ${pageUrl}...`);

        try {
            await security.humanDelay();

            let comments = [];

            if (pageUrl.includes('instagram.com')) {
                // Click "View all comments" if available (up to 3 times)
                for (let i = 0; i < 3; i++) {
                    try {
                        // Look for a button or link with "View all" text
                        await page.evaluate(() => {
                            const elements = [...document.querySelectorAll('button, a, span')];
                            const loadMore = elements.find(el => el.innerText && el.innerText.includes('View all') && el.innerText.includes('comments'));
                            if (loadMore) loadMore.click();
                        });
                        await security.delay(1000 + Math.random() * 1000);
                    } catch (e) { }
                }

                // Extract comments
                comments = await page.evaluate(() => {
                    const items = [];
                    // Instagram comment selector (generalized)
                    const rows = document.querySelectorAll('ul._a9ym > li, ul > li'); // Often list items in the side pane

                    rows.forEach(row => {
                        const userEl = row.querySelector('h3, span._a9zc, a.x1i10hfl'); // User link
                        const textEl = row.querySelector('span._aacl, span.x1lliihq'); // Comment text

                        if (userEl && textEl) {
                            items.push({
                                user: userEl.innerText,
                                text: textEl.innerText
                            });
                        }
                    });
                    return items;
                });

            } else if (pageUrl.includes('facebook.com')) {
                // Facebook logic - click "View more comments"
                try {
                    await page.evaluate(() => {
                        const buttons = [...document.querySelectorAll('div[role="button"], span')];
                        const viewMore = buttons.find(b => b.innerText && (b.innerText.includes('View more comments') || b.innerText.includes('Most relevant')));
                        if (viewMore) viewMore.click();
                    });
                    await security.delay(2000);
                } catch (e) { }

                comments = await page.evaluate(() => {
                    const items = [];
                    // Facebook comment blocks (div with aria-label or specific classes)
                    const comments = document.querySelectorAll('div[aria-label="Comment"], div.x1y1aw1k');
                    comments.forEach(c => {
                        // Rough extraction of text and user
                        // This is fragile on FB, but best effort
                        const text = c.innerText;
                        const lines = text.split('\n');
                        if (lines.length >= 2) {
                            items.push({
                                user: lines[0],
                                text: lines.slice(1).join(' ')
                            });
                        }
                    });
                    return items;
                });
            }

            if (comments.length > 0) {
                this.log(`✅ Found ${comments.length} comments`);

                // Add to results and broadcast
                comments.slice(0, 20).forEach(c => { // Limit to 20
                    if (!results.some(r => r.dataType === 'comment' && r.value === c.text)) {
                        const resultData = {
                            campaignId: this.campaignId,
                            domainId,
                            domain,
                            dataType: 'comment',
                            value: `${c.user}: ${c.text.substring(0, 50)}...`,
                            sourceUrl: pageUrl,
                            extraInfo: JSON.stringify({ user: c.user, fullText: c.text })
                        };
                        results.push(resultData);

                        this.broadcast({
                            type: 'result_found',
                            result: resultData
                        });
                    }
                });
            }

        } catch (error) {
            this.log(`⚠️ Comment extraction failed: ${error.message}`);
        }
    }

    broadcast(data) {
        if (global.broadcastToCampaign) {
            global.broadcastToCampaign(this.campaignId, data);
        }
    }

    log(message) {
        console.log(`[Extraction] ${message}`);
        this.broadcast({ type: 'log', message });
    }
}

// Start extraction process
function startExtraction(campaignId, domains, options) {
    const job = new ExtractionJob(campaignId, domains, options);
    job.run(); // Run asynchronously
    return job;
}

module.exports = {
    startExtraction,
    ExtractionJob
};
