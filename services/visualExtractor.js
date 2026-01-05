/**
 * Visual Web Scraper Extractor Service
 * Loads pages via Puppeteer and extracts data based on CSS selectors
 */

const puppeteer = require('puppeteer');
const security = require('./security');
const userAgentRotator = require('./userAgentRotator');

/**
 * Load a URL and return the page HTML for preview
 * @param {string} url - URL to load
 * @param {Object} options - Loading options
 * @returns {Promise<Object>} Page content and metadata
 */
async function loadPage(url, options = {}) {
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: 'new',
            defaultViewport: { width: 1920, height: 1080 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Apply rotating user agent
        if (options.useUserAgentRotation !== false) {
            await userAgentRotator.applyToPage(page, { rotate: true });
        } else {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        }

        // Navigate to URL
        await page.goto(url, {
            waitUntil: options.waitUntil || 'networkidle2',
            timeout: options.timeout || 30000
        });

        // Wait for specific selector if provided
        if (options.waitForSelector) {
            await page.waitForSelector(options.waitForSelector, { timeout: 10000 }).catch(() => { });
        }

        // Get page content
        const html = await page.content();
        const title = await page.title();

        // Get page metrics
        const metrics = await page.evaluate(() => ({
            url: window.location.href,
            title: document.title,
            elementsCount: document.querySelectorAll('*').length
        }));

        return {
            success: true,
            html,
            title,
            url: metrics.url,
            elementsCount: metrics.elementsCount
        };

    } catch (error) {
        console.error('Error loading page:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Extract data from a page using CSS selectors
 * @param {string} url - URL to extract from
 * @param {Array} fields - Array of field definitions [{name, selector, type}]
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extracted data
 */
async function extractData(url, fields, options = {}) {
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: options.headless !== false ? 'new' : false,
            defaultViewport: { width: 1920, height: 1080 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Apply rotating user agent
        if (options.useUserAgentRotation !== false) {
            await userAgentRotator.applyToPage(page, { rotate: true });
        } else {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        }

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for content
        if (options.waitForSelector) {
            await page.waitForSelector(options.waitForSelector, { timeout: 10000 }).catch(() => { });
        }
        await security.delay(1000);

        // Extract data for each field
        const extractedData = await page.evaluate((fieldDefs) => {
            const results = [];

            // Check if we're extracting multiple items (list extraction)
            const itemSelector = fieldDefs.find(f => f.isContainer)?.selector;

            if (itemSelector) {
                // Extract from each item
                const items = document.querySelectorAll(itemSelector);
                items.forEach(item => {
                    const itemData = {};
                    fieldDefs.forEach(field => {
                        if (field.isContainer) return;

                        const el = item.querySelector(field.selector);
                        if (el) {
                            switch (field.type) {
                                case 'link':
                                    itemData[field.name] = el.href || el.getAttribute('href');
                                    break;
                                case 'image':
                                    itemData[field.name] = el.src || el.getAttribute('src');
                                    break;
                                case 'html':
                                    itemData[field.name] = el.innerHTML;
                                    break;
                                case 'attr':
                                    itemData[field.name] = el.getAttribute(field.attr) || null;
                                    break;
                                default:
                                    itemData[field.name] = el.textContent?.trim();
                            }
                        } else {
                            itemData[field.name] = null;
                        }
                    });
                    results.push(itemData);
                });
            } else {
                // Single page extraction
                const pageData = {};
                fieldDefs.forEach(field => {
                    const els = document.querySelectorAll(field.selector);
                    if (els.length > 1) {
                        // Multiple elements - return array
                        pageData[field.name] = Array.from(els).map(el => {
                            if (field.type === 'link') return el.href;
                            if (field.type === 'image') return el.src;
                            if (field.type === 'attr') return el.getAttribute(field.attr);
                            return el.textContent?.trim();
                        });
                    } else if (els.length === 1) {
                        const el = els[0];
                        if (field.type === 'link') pageData[field.name] = el.href;
                        else if (field.type === 'image') pageData[field.name] = el.src;
                        else if (field.type === 'attr') pageData[field.name] = el.getAttribute(field.attr);
                        else pageData[field.name] = el.textContent?.trim();
                    } else {
                        pageData[field.name] = null;
                    }
                });
                results.push(pageData);
            }

            return results;
        }, fields);

        return {
            success: true,
            url,
            count: extractedData.length,
            data: extractedData
        };

    } catch (error) {
        console.error('Extraction error:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Extract data from multiple pages with pagination
 * @param {string} url - Starting URL
 * @param {Array} fields - Field definitions
 * @param {string} nextSelector - CSS selector for "Next" button
 * @param {number} maxPages - Maximum pages to scrape
 * @param {Function} onProgress - Progress callback
 */
async function extractWithPagination(url, fields, nextSelector, maxPages = 10, onProgress) {
    let browser = null;
    const allData = [];

    try {
        browser = await puppeteer.launch({
            headless: 'new',
            defaultViewport: { width: 1920, height: 1080 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Apply rotating user agent
        await userAgentRotator.applyToPage(page, { rotate: true });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            if (onProgress) onProgress({ page: pageNum, totalItems: allData.length });

            await security.delay(1000);

            // Extract from current page
            const pageData = await page.evaluate((fieldDefs) => {
                const results = [];
                const itemSelector = fieldDefs.find(f => f.isContainer)?.selector;

                if (itemSelector) {
                    const items = document.querySelectorAll(itemSelector);
                    items.forEach(item => {
                        const itemData = {};
                        fieldDefs.forEach(field => {
                            if (field.isContainer) return;
                            const el = item.querySelector(field.selector);
                            if (el) {
                                if (field.type === 'link') itemData[field.name] = el.href;
                                else if (field.type === 'image') itemData[field.name] = el.src;
                                else if (field.type === 'attr') itemData[field.name] = el.getAttribute(field.attr);
                                else itemData[field.name] = el.textContent?.trim();
                            }
                        });
                        if (Object.keys(itemData).length > 0) results.push(itemData);
                    });
                }
                return results;
            }, fields);

            allData.push(...pageData);

            // Try to click next button
            if (pageNum < maxPages && nextSelector) {
                const nextBtn = await page.$(nextSelector);
                if (nextBtn) {
                    const isDisabled = await nextBtn.evaluate(el =>
                        el.disabled || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true'
                    );

                    if (!isDisabled) {
                        await nextBtn.click();
                        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => { });
                    } else {
                        break; // No more pages
                    }
                } else {
                    break; // Next button not found
                }
            }
        }

        return {
            success: true,
            pagesProcessed: Math.min(maxPages, allData.length > 0 ? maxPages : 1),
            count: allData.length,
            data: allData
        };

    } catch (error) {
        console.error('Pagination extraction error:', error.message);
        return {
            success: false,
            error: error.message,
            data: allData
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Get CSS selector for an element (simplified path)
 * @param {string} url - Page URL
 * @param {number} x - Click X coordinate
 * @param {number} y - Click Y coordinate
 */
async function getElementSelector(url, x, y) {
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: 'new',
            defaultViewport: { width: 1920, height: 1080 }
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Get element at coordinates
        const selector = await page.evaluate((clickX, clickY) => {
            const element = document.elementFromPoint(clickX, clickY);
            if (!element) return null;

            // Build a unique selector
            const buildSelector = (el) => {
                if (el.id) return `#${el.id}`;

                let path = [];
                while (el && el.nodeType === Node.ELEMENT_NODE) {
                    let selector = el.tagName.toLowerCase();

                    if (el.className) {
                        const classes = el.className.split(' ').filter(c => c && !c.includes(':'));
                        if (classes.length) {
                            selector += '.' + classes.slice(0, 2).join('.');
                        }
                    }

                    path.unshift(selector);

                    // Stop at body or if unique enough
                    if (el.tagName === 'BODY' || el.id || path.length > 4) break;
                    el = el.parentElement;
                }

                return path.join(' > ');
            };

            return {
                selector: buildSelector(element),
                text: element.textContent?.substring(0, 100),
                tagName: element.tagName
            };
        }, x, y);

        return selector;

    } finally {
        if (browser) await browser.close();
    }
}

module.exports = {
    loadPage,
    extractData,
    extractWithPagination,
    getElementSelector
};
