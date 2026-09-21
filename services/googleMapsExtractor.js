/**
 * Google Maps Extractor Service
 * Extracts business data from Google Maps based on keyword searches
 */

const puppeteer = require('puppeteer');
const security = require('./security');
const proxyManager = require('./proxyManager');
const userAgentRotator = require('./userAgentRotator');
const { withBrowserExecutable, getBrowserExecutablePath } = require('./browserExecutable');

function isProxyConnectionError(error) {
    return /ERR_PROXY|ERR_TUNNEL|proxy connection/i.test(error?.message || '');
}

function shouldRetryDirect({ proxyAttempted, resultCount, retriedDirect }) {
    return Boolean(proxyAttempted && resultCount === 0 && !retriedDirect);
}

/**
 * Google Maps Business Data Structure
 * @typedef {Object} BusinessData
 * @property {string} name - Business name
 * @property {string} address - Full address
 * @property {string} phone - Phone number
 * @property {string} website - Website URL
 * @property {number} rating - Star rating
 * @property {number} reviewCount - Number of reviews
 * @property {string} category - Business category
 * @property {Object} hours - Opening hours
 * @property {Object} coordinates - Lat/lng
 * @property {string} placeId - Google Place ID
 * @property {string} mapsUrl - Google Maps URL
 */

/**
 * Search Google Maps for businesses
 * @param {string} keyword - Search keyword (e.g., "restaurants in New York")
 * @param {Object} options - Search options
 * @returns {Promise<Array<BusinessData>>} Array of business data
 */
async function searchGoogleMaps(keyword, options = {}) {
    let browser = null;
    let proxy = null;
    const businesses = [];

    const log = (msg) => {
        console.log(`[Maps] ${msg}`);
        if (options.onLog) options.onLog(msg);
    };

    try {
        log(`Starting extraction for "${keyword}"...`);

        // Proxy setup
        proxy = options.useProxies === false ? null : proxyManager.getNextProxy();
        const proxyAttempted = Boolean(proxy);
        const proxyArgs = proxyManager.formatForPuppeteer(proxy);
        const proxyAuth = proxyManager.getAuth(proxy);

        if (proxy) {
            log(`Using proxy: ${proxy.host}:${proxy.port}`);
        }

        const executablePath = getBrowserExecutablePath();
        if (executablePath) log(`Using browser: ${executablePath}`);

        const launchOptions = {
            headless: options.headless || 'new',
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--start-maximized',
                '--lang=en-US,en',
                ...proxyArgs
            ]
        };

        log(`Starting browser (Headless: ${launchOptions.headless})...`);
        browser = await puppeteer.launch(withBrowserExecutable(launchOptions));
        const page = await browser.newPage();

        // Apply rotating user agent
        const useUserAgentRotation = options.useUserAgentRotation !== false; // Default ON
        if (useUserAgentRotation) {
            await userAgentRotator.applyToPage(page, { rotate: true });
        }

        if (proxyAuth) {
            await page.authenticate(proxyAuth);
        }

        const { maxResults = 20, securityConfig = security.defaultConfig } = options;

        // Calculate scroll attempts dynamically based on maxResults
        // For unlimited (-1), use many scroll attempts; otherwise calculate based on ~15 results per scroll
        const scrollAttempts = maxResults < 0 ? 100 : Math.max(5, Math.ceil(maxResults / 15) + 3);
        // Apply security measures
        await security.configurePage(page, { ...securityConfig, userAgent: false });

        // Check if keyword is a direct URL
        const isDirectUrl = keyword.startsWith('http');
        const searchUrl = isDirectUrl ? keyword : `https://www.google.com/maps/search/${encodeURIComponent(keyword)}`;

        log(`Navigating to ${isDirectUrl ? 'direct URL' : 'search URL'}...`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        if (isDirectUrl) {
            // Direct Business Page Logic
            log('Direct URL detected. Extracting single business details...');
            try {
                // Wait for key elements to ensure page loaded
                await page.waitForFunction(() => {
                    return document.querySelector('h1') || document.querySelector('[role="main"]');
                }, { timeout: 15000 });

                // Create a basic business object from current page
                const basicBiz = await page.evaluate((url) => {
                    return {
                        name: document.querySelector('h1')?.textContent?.trim() || 'Unknown Business',
                        mapsUrl: url,
                        address: '', // Will be filled by getBusinessDetails
                        rating: null,
                        reviewCount: 0
                    };
                }, searchUrl);

                // Get full details
                const details = await getBusinessDetails(page, basicBiz);
                const fullBiz = { ...basicBiz, ...details };

                businesses.push(fullBiz);

                if (options.onResult) {
                    options.onResult(fullBiz);
                }

                log(`✅ Extracted data for: ${fullBiz.name}`);

            } catch (e) {
                log(`❌ Failed to extract from direct URL: ${e.message}`);
            }

        } else {
            // Standard Search Logic
            let resultsSurfaceFound = false;
            // Wait for results to load
            try {
                await page.waitForFunction(() => (
                    document.querySelector('[role="feed"]') ||
                    document.querySelector('a[href*="/maps/place/"]')
                ), { timeout: 15000 });
                resultsSurfaceFound = true;
                log('Results feed found.');
            } catch (e) {
                log('Results feed not found. Checking for consent popup...');

                // Try multiple consent button selectors
                const consentSelectors = [
                    'button[aria-label*="Accept all"]',
                    'button[aria-label*="Accept"]',
                    'button[aria-label*="Reject all"]',
                    'button[jsaction*="dismiss"]',
                    'form[action*="consent"] button',
                    'button:has-text("Accept")',
                    '[aria-label="Accept all"]'
                ];

                let dismissed = false;
                for (const sel of consentSelectors) {
                    try {
                        const btn = await page.$(sel);
                        if (btn) {
                            await btn.click();
                            log(`Clicked consent button: ${sel}`);
                            dismissed = true;
                            await security.delay(2000);
                            break;
                        }
                    } catch (e2) { }
                }

                if (!dismissed) {
                    // Try clicking by text
                    try {
                        await page.evaluate(() => {
                            const buttons = document.querySelectorAll('button');
                            for (const btn of buttons) {
                                const text = btn.textContent || '';
                                if (text.includes('Accept') || text.includes('Reject')) {
                                    btn.click();
                                    return true;
                                }
                            }
                            return false;
                        });
                        log('Clicked consent button by text search.');
                    } catch (e3) { }
                }

                // Try to find the feed again
                try {
                    await page.waitForFunction(() => (
                        document.querySelector('[role="feed"]') ||
                        document.querySelector('a[href*="/maps/place/"]')
                    ), { timeout: 15000 });
                    resultsSurfaceFound = true;
                    log('Results feed found after consent handling.');
                } catch (e2) {
                    log('Still no results feed - page may have different layout.');
                }
            }

            if (!resultsSurfaceFound && shouldRetryDirect({ proxyAttempted, resultCount: 0, retriedDirect: options._retriedDirect })) {
                const pageState = await page.evaluate(() => ({ title: document.title, url: location.href })).catch(() => ({}));
                log(`Proxy did not load Maps results${pageState.title ? ` (${pageState.title})` : ''}. Retrying without the proxy now...`);
                if (browser) {
                    try { await browser.close(); } catch (_) { /* already closed */ }
                    browser = null;
                }
                return searchGoogleMaps(keyword, { ...options, useProxies: false, _retriedDirect: true });
            }

            // Human-like delay
            await security.humanDelay(securityConfig);

            // Read the listings already visible before looking for an end-of-list marker.
            // Small towns and narrow searches can show every result on the first page.
            const initialBusinesses = await extractBusinessListings(page);
            for (const biz of initialBusinesses) {
                const exists = businesses.some(existing =>
                    (biz.placeId && existing.placeId && existing.placeId === biz.placeId) ||
                    (existing.name === biz.name && existing.address === biz.address)
                );
                if (!exists) {
                    businesses.push(biz);
                    if (options.onResult) options.onResult({ ...biz, partial: true });
                }
                if (maxResults >= 0 && businesses.length >= maxResults) break;
            }
            log(`Read ${initialBusinesses.length} visible listings before scrolling. Total: ${businesses.length}`);

            // Scroll to load more results
            // Handle unlimited (-1) by using a very high limit comparison
            const effectiveMax = maxResults < 0 ? Infinity : maxResults;

            // Improved Scroll Logic for Unlimited Extraction
            let noNewItemsCount = 0;
            let previousHeight = 0;

            // Loop condition: 
            // 1. If unlimited (-1): loop until "End of list" or too many no-new-item attempts
            // 2. If limit set: loop until businesses.length >= maxResults or scrollAttempts exhausted

            const isUnlimited = maxResults < 0;
            const maxScrolls = isUnlimited ? 2000 : scrollAttempts; // Allow many scrolls for unlimited

            for (let i = 0; i < maxScrolls; i++) {
                if (!isUnlimited && businesses.length >= maxResults) break;

                // Check for "End of list" message
                const endOfList = await page.evaluate(() => {
                    const spans = Array.from(document.querySelectorAll('span'));
                    return spans.some(s => s.textContent.includes("You've reached the end of the list"));
                });

                if (endOfList) {
                    log('Reached end of list.');
                    break;
                }

                log(`Scrolling results (${i + 1}/${maxScrolls})... Current: ${businesses.length}`);

                // Robust Scroll
                const scrollResult = await page.evaluate(() => {
                    const feed = document.querySelector('[role="feed"]');
                    if (!feed) return { success: false, height: 0, newHeight: 0 };

                    const height = feed.scrollHeight;
                    feed.scrollTo(0, height);
                    return { success: true, height: height };
                });

                if (!scrollResult.success) {
                    log('Could not find results feed to scroll.');
                    noNewItemsCount++;
                    if (noNewItemsCount > 5) break; // Stop if feed is consistently missing
                    await security.delay(2000);
                    continue;
                }

                // Wait for load
                await security.delay(2000 + Math.random() * 1000);

                // Extract visible businesses
                const newBusinesses = await extractBusinessListings(page);

                let addedCount = 0;
                for (const biz of newBusinesses) {
                    // Deduplicate (PlaceID or Name+Address)
                    const exists = businesses.some(b => (biz.placeId && b.placeId && b.placeId === biz.placeId) || (b.name === biz.name && b.address === biz.address));

                    if (!exists) {
                        businesses.push(biz);
                        addedCount++;

                        // Broadcast each new business live (basic info, before details)
                        if (options.onResult) {
                            options.onResult({ ...biz, partial: true });
                        }
                    }
                    if (!isUnlimited && businesses.length >= maxResults) break;
                }

                log(`Found ${newBusinesses.length} visible. Added ${addedCount} new. Total: ${businesses.length}`);

                if (addedCount === 0) {
                    noNewItemsCount++;
                    // If scrolling didn't change height significantly AND no new items -> stuck or end
                    if (noNewItemsCount >= 5) {
                        log('No new items found after 5 scrolls. Assuming end of list.');
                        break;
                    }
                } else {
                    noNewItemsCount = 0; // Reset if we found something
                }
            }

            if (shouldRetryDirect({ proxyAttempted, resultCount: businesses.length, retriedDirect: options._retriedDirect })) {
                log(`Proxy returned no listings. Retrying directly before marking the search empty...`);
                if (browser) {
                    try { await browser.close(); } catch (_) { /* already closed */ }
                    browser = null;
                }
                return searchGoogleMaps(keyword, { ...options, useProxies: false, _retriedDirect: true });
            }

            // Get detailed info for each business (optional)
            const detailsMax = maxResults < 0 ? businesses.length : Math.min(businesses.length, maxResults);
            if (options.getDetails && businesses.length > 0) {
                log(`Fetching details for ${detailsMax} businesses using parallel tabs...`);

                // Process in chunks to avoid overwhelming memory
                const chunkSize = 1; // Open 1 tab at a time for safety, can increase if needed
                for (let i = 0; i < detailsMax; i += chunkSize) {
                    const chunk = businesses.slice(i, i + chunkSize);

                    await Promise.all(chunk.map(async (biz, idx) => {
                        const businessIndex = i + idx;
                        let detailPage = null;
                        try {
                            log(`Opening detail tab for: ${biz.name} (${businessIndex + 1}/${detailsMax})`);

                            // Open new tab
                            detailPage = await browser.newPage();

                            // Apply stealth
                            if (options.useUserAgentRotation !== false) {
                                await userAgentRotator.applyToPage(detailPage, { rotate: false }); // Reuse same UA is fine
                            }
                            await security.configurePage(detailPage, securityConfig);

                            // Get details in the new tab and pass the page directly
                            // getBusinessDetails handles the navigation now
                            const details = await getBusinessDetails(detailPage, biz);

                            businesses[businessIndex] = { ...biz, ...details, partial: false };

                            // Broadcast detailed result live (replaces partial)
                            if (options.onResult) {
                                options.onResult(businesses[businessIndex]);
                            }

                            log(`✅ Updated: ${biz.name} [Phone: ${details.phone || 'N/A'}]`);

                        } catch (e) {
                            log(`Error processing ${biz.name}: ${e.message}`);
                        } finally {
                            if (detailPage) {
                                try { await detailPage.close(); } catch (e) { }
                            }
                        }
                    }));

                    // Delay between chunks
                    if (i + chunkSize < detailsMax) {
                        await security.humanDelay(securityConfig);
                    }
                }
            }

            log(`✅ Extraction complete. Found ${businesses.length} businesses.`);
        }

    } catch (error) {
        console.error('Google Maps search error:', error.message);
        if (proxy && isProxyConnectionError(error)) {
            log(`⚠️ Proxy ${proxy.host}:${proxy.port} is unavailable. Retrying directly...`);
            if (browser) {
                try { await browser.close(); } catch (e) { }
                browser = null;
            }
            return await searchGoogleMaps(keyword, { ...options, useProxies: false });
        }
        log(`❌ Error: ${error.message}`);
        throw error;
    } finally {
        if (browser) {
            log('Closing browser...');
            await browser.close();
        }
    }

    // For unlimited (-1), return all; otherwise slice to maxResults
    const finalMax = options.maxResults < 0 ? businesses.length : (options.maxResults || 20);
    return businesses.slice(0, finalMax);
}

/**
 * Extract business listings from the current page
 * @param {Page} page - Puppeteer page
 * @returns {Promise<Array<BusinessData>>} Array of business listings
 */
async function extractBusinessListings(page) {
    return await page.evaluate(() => {
        const businesses = [];

        // Try multiple selectors for items
        const itemSelectors = [
            '[role="feed"] > div > div[role="article"]',
            '[role="feed"] > div > div:has(a.hfpxzc)',
            '.Nv2PK' // Common class for result items
        ];

        let items = [];
        for (const selector of itemSelectors) {
            items = document.querySelectorAll(selector);
            if (items.length > 0) break;
        }

        items.forEach((item, index) => {
            try {
                // The link overlay has the name and URL
                const linkEl = item.querySelector('a.hfpxzc') || item.querySelector('a[href*="/maps/place/"]');
                const ariaLabel = linkEl?.getAttribute('aria-label') || '';
                const href = linkEl?.getAttribute('href') || '';

                // Check for Ad/Sponsored/Promoted indicators
                const isAd = Array.from(item.querySelectorAll('span, div')).some(el => {
                    const txt = el.textContent.trim();
                    return txt === 'Ad' || txt === 'Sponsored' || txt === 'Promoted';
                });

                // Extract name
                let name = ariaLabel.split('·')[0]?.trim() || '';
                if (!name) return;

                // Tag ads in the name for visibility in exports
                if (isAd) {
                    name = `[AD] ${name}`;
                }

                // Find rating and review count
                const ratingEl = item.querySelector('[aria-label*="stars"]');
                const ratingLabel = ratingEl?.getAttribute('aria-label') || '';
                const ratingMatch = ratingLabel.match(/([\d.]+)\s*star/i);
                const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

                // Reviews - looking for (123) pattern
                const reviewMatch = item.textContent.match(/\(([\d,]+)\)/);
                const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(',', '')) : 0;

                // Category and Address parsing
                const allText = item.innerText || '';
                // Filter out non-printable chars and UI icons (like the three dots menu char)
                const cleanText = allText.replace(/[^\x20-\x7E\s·,()]/g, '').trim();
                const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l);

                let category = '';
                let address = '';

                // Line 0 is name. Line 1 is usually rating/reviews.
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];

                    // Skip if it's just the rating/review line
                    if (line.match(/^[\d.]+\(\d+\)$/) || line.includes('stars')) continue;

                    if (line.includes('·')) {
                        const parts = line.split('·').map(p => p.trim());
                        if (parts.length >= 2) {
                            category = category || parts[0];
                            address = address || parts[1];
                        } else {
                            category = category || parts[0];
                        }
                        continue;
                    }

                    // Heuristic fallback
                    if (!category && line.length < 30 && !line.match(/\d/)) {
                        category = line;
                    } else if (line.match(/\d/) || line.includes(',')) {
                        if (!address) address = line;
                        else if (line.length > address.length && line.includes(',')) address = line;
                    }
                }

                // Final cleanup of category to remove leading/trailing noise
                category = category.replace(/·/g, '').trim();
                address = address.replace(/·/g, '').trim();

                const placeIdMatch = href.match(/place\/([^/]+)/);
                const placeId = placeIdMatch ? placeIdMatch[1] : null;

                businesses.push({
                    name,
                    rating,
                    reviewCount,
                    category,
                    address,
                    placeId,
                    mapsUrl: href.startsWith('/') ? `https://www.google.com${href}` : href,
                });
            } catch (e) {
                // skip
            }
        });

        return businesses;
    });
}

/**
 * Get detailed business information by clicking on listing
 * @param {Page} page - Puppeteer page
 * @param {Object} business - Basic business data
 * @returns {Promise<Object>} Detailed business data
 */
async function getBusinessDetails(page, business) {
    const details = {
        phone: null,
        website: null,
        hours: null,
        fullAddress: null,
    };

    try {
        // Navigate directly to the business page using its URL
        // This is more reliable than clicking in the list
        if (business.mapsUrl) {
            await page.goto(business.mapsUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // Wait for panel elements to appear
            try {
                await page.waitForFunction(() => {
                    const addressBtn = document.querySelector('[data-item-id="address"]');
                    const phoneBtn = document.querySelector('button[data-item-id^="phone"]');
                    return addressBtn || phoneBtn;
                }, { timeout: 15000 });
            } catch (e) {
                // Continue anyway - some businesses might not have phone
            }

            // Extra wait for all elements to render
            await security.delay(2000);
        } else {
            console.log(`No mapsUrl for: ${business.name}`);
            return details;
        }

        // Extract details from the panel
        const panelData = await page.evaluate(() => {
            const data = {};

            // Phone - Google Maps uses data-item-id="phone:tel:08712300333" format
            // First: try button with data-item-id starting with "phone"
            const phoneBtn = document.querySelector('button[data-item-id^="phone"]');
            if (phoneBtn) {
                const itemId = phoneBtn.getAttribute('data-item-id') || '';
                if (itemId.includes('tel:')) {
                    data.phone = itemId.split('tel:')[1];
                }
            }
            // Second: try tel: link
            if (!data.phone) {
                const telLink = document.querySelector('a[href^="tel:"]');
                if (telLink) data.phone = telLink.href.replace('tel:', '');
            }
            // Third: regex search in panel text
            if (!data.phone) {
                const panel = document.querySelector('[role="main"]');
                const txt = panel ? panel.innerText : '';
                const m = txt.match(/(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
                if (m) data.phone = m[0].replace(/\s/g, '');
            }

            // Website - try multiple selectors (order matters - direct link first)
            const websiteSelectors = [
                'a[data-item-id="authority"]',           // Direct link element
                '[data-item-id="authority"] a',          // Child link inside authority
                'a[aria-label*="website" i]',            // Case-insensitive website label
                'a[aria-label*="Website"]',              // Website label (case-sensitive fallback)
            ];
            for (const sel of websiteSelectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const href = el.getAttribute('href');
                    if (href && !href.includes('google.com')) {
                        data.website = href;
                        break;
                    }
                }
            }

            // Address
            const addressEl = document.querySelector('[data-item-id="address"]');
            data.fullAddress = addressEl?.textContent?.trim() || null;

            // Hours
            const hoursButton = document.querySelector('[aria-label*="hour"]');
            if (hoursButton) {
                const hoursText = hoursButton.getAttribute('aria-label') || '';
                data.hoursInfo = hoursText;
            }

            // Plus Code
            const plusCodeEl = document.querySelector('[data-item-id="pluscode"]');
            data.plusCode = plusCodeEl?.textContent?.trim() || null;

            return data;
        });

        Object.assign(details, panelData);

        // No need to press Escape since we are in a dedicated tab that will be closed
        await security.delay(500);

    } catch (error) {
        console.error(`Error getting details for ${business.name}:`, error.message);
    }

    return details;
}

/**
 * Extract coordinates from Google Maps URL
 * @param {string} mapsUrl - Google Maps URL
 * @returns {Object|null} { lat, lng } or null
 */
function extractCoordinates(mapsUrl) {
    try {
        const match = mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) {
            return {
                lat: parseFloat(match[1]),
                lng: parseFloat(match[2]),
            };
        }
    } catch (e) { }
    return null;
}

/**
 * Format business data for database storage
 * @param {Object} business - Raw business data
 * @param {string} keyword - Search keyword used
 * @returns {Object} Formatted data
 */
function formatBusinessForStorage(business, keyword) {
    return {
        name: business.name || '',
        address: business.fullAddress || business.address || '',
        phone: business.phone || '',
        website: business.website || '',
        rating: business.rating || 0,
        reviewCount: business.reviewCount || 0,
        category: business.category || '',
        hours: business.hoursInfo || '',
        plusCode: business.plusCode || '',
        mapsUrl: business.mapsUrl || '',
        placeId: business.placeId || '',
        searchKeyword: keyword,
        coordinates: extractCoordinates(business.mapsUrl),
    };
}

/**
 * Search multiple keywords and aggregate results
 * @param {Array<string>} keywords - Array of search keywords
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Aggregated results
 */
async function searchMultipleKeywords(keywords, options = {}) {
    const allResults = [];
    const seenPlaceIds = new Set();

    for (const keyword of keywords) {
        console.log(`Searching Google Maps for: ${keyword}`);

        const results = await searchGoogleMaps(keyword, options);

        for (const business of results) {
            // Deduplicate by place ID or name+address
            const key = business.placeId || `${business.name}-${business.address}`;
            if (!seenPlaceIds.has(key)) {
                seenPlaceIds.add(key);
                allResults.push(formatBusinessForStorage(business, keyword));
            }
        }

        // Delay between keyword searches
        if (keywords.indexOf(keyword) < keywords.length - 1) {
            await security.humanDelay({
                minDelay: 3000,
                maxDelay: 6000,
            });
        }
    }

    return allResults;
}

module.exports = {
    searchGoogleMaps,
    shouldRetryDirect,
    extractBusinessListings,
    getBusinessDetails,
    extractCoordinates,
    formatBusinessForStorage,
    searchMultipleKeywords,
};
