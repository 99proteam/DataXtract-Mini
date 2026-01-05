/**
 * Sitemap & Robots.txt Parser Service
 * Handles deep crawling by discovering URLs from sitemap.xml and respecting robots.txt
 */

const cheerio = require('cheerio');

/**
 * Parse robots.txt and extract rules
 * @param {string} robotsTxt - Raw robots.txt content
 * @param {string} userAgent - User agent to check rules for
 * @returns {Object} Parsed rules { allowed: [], disallowed: [], sitemaps: [] }
 */
function parseRobotsTxt(robotsTxt, userAgent = '*') {
    const rules = {
        allowed: [],
        disallowed: [],
        sitemaps: [],
        crawlDelay: 0,
    };

    if (!robotsTxt) return rules;

    const lines = robotsTxt.split('\n');
    let currentUserAgent = null;
    let isRelevantSection = false;

    for (let line of lines) {
        line = line.trim();

        // Skip comments and empty lines
        if (line.startsWith('#') || line === '') continue;

        // Parse directive
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const directive = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();

        switch (directive) {
            case 'user-agent':
                currentUserAgent = value;
                isRelevantSection = (value === '*' || value.toLowerCase().includes('bot') || userAgent === value);
                break;

            case 'disallow':
                if (isRelevantSection && value) {
                    rules.disallowed.push(value);
                }
                break;

            case 'allow':
                if (isRelevantSection && value) {
                    rules.allowed.push(value);
                }
                break;

            case 'sitemap':
                if (value) {
                    rules.sitemaps.push(value);
                }
                break;

            case 'crawl-delay':
                if (isRelevantSection) {
                    rules.crawlDelay = parseInt(value) * 1000 || 0;
                }
                break;
        }
    }

    return rules;
}

/**
 * Check if URL is allowed by robots.txt rules
 * @param {string} path - URL path to check
 * @param {Object} rules - Parsed robots.txt rules
 * @returns {boolean} Whether URL is allowed
 */
function isUrlAllowed(path, rules) {
    // Check allowed first (more specific)
    for (const pattern of rules.allowed) {
        if (matchRobotsPattern(path, pattern)) {
            return true;
        }
    }

    // Check disallowed
    for (const pattern of rules.disallowed) {
        if (matchRobotsPattern(path, pattern)) {
            return false;
        }
    }

    // Default allow
    return true;
}

/**
 * Match URL against robots.txt pattern
 * @param {string} path - URL path
 * @param {string} pattern - Robots.txt pattern
 * @returns {boolean} Whether path matches pattern
 */
function matchRobotsPattern(path, pattern) {
    // Handle wildcard patterns
    if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\$/g, '$'));
        return regex.test(path);
    }

    // Handle end anchor
    if (pattern.endsWith('$')) {
        return path === pattern.slice(0, -1);
    }

    // Simple prefix match
    return path.startsWith(pattern);
}

/**
 * Parse sitemap XML and extract URLs
 * @param {string} sitemapXml - Raw sitemap XML content
 * @returns {Array} Array of URL objects { loc, lastmod, priority, changefreq }
 */
function parseSitemap(sitemapXml) {
    const urls = [];

    if (!sitemapXml) return urls;

    const $ = cheerio.load(sitemapXml, { xmlMode: true });

    // Check if this is a sitemap index
    const sitemapIndex = $('sitemapindex sitemap');
    if (sitemapIndex.length > 0) {
        // Return sitemap URLs for further processing
        sitemapIndex.each((_, el) => {
            const loc = $(el).find('loc').text();
            if (loc) {
                urls.push({
                    loc,
                    type: 'sitemap',
                    lastmod: $(el).find('lastmod').text() || null,
                });
            }
        });
        return urls;
    }

    // Parse regular sitemap
    $('urlset url').each((_, el) => {
        const loc = $(el).find('loc').text();
        if (loc) {
            urls.push({
                loc,
                type: 'url',
                lastmod: $(el).find('lastmod').text() || null,
                changefreq: $(el).find('changefreq').text() || null,
                priority: parseFloat($(el).find('priority').text()) || 0.5,
            });
        }
    });

    return urls;
}

/**
 * Fetch and parse robots.txt for a domain
 * @param {Page} page - Puppeteer page (optional, for complex sites)
 * @param {string} baseUrl - Base URL of the domain
 * @returns {Object} Parsed robots.txt rules
 */
async function fetchRobotsTxt(baseUrl) {
    try {
        const robotsUrl = new URL('/robots.txt', baseUrl).href;
        const response = await fetch(robotsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DataExtractor/1.0)',
            },
            timeout: 10000,
        });

        if (!response.ok) {
            return parseRobotsTxt(''); // Return empty rules
        }

        const text = await response.text();
        return parseRobotsTxt(text);
    } catch (error) {
        console.error(`Error fetching robots.txt for ${baseUrl}:`, error.message);
        return parseRobotsTxt('');
    }
}

/**
 * Fetch and parse all sitemaps for a domain
 * @param {string} baseUrl - Base URL of the domain
 * @param {Object} robotsRules - Parsed robots.txt rules
 * @returns {Array} Array of sitemap URLs
 */
async function fetchSitemaps(baseUrl, robotsRules = null) {
    const allUrls = [];
    const processedSitemaps = new Set();

    // Get sitemap URLs from robots.txt or use defaults
    let sitemapUrls = robotsRules?.sitemaps || [];

    // Add common sitemap locations as fallback
    if (sitemapUrls.length === 0) {
        sitemapUrls = [
            new URL('/sitemap.xml', baseUrl).href,
            new URL('/sitemap_index.xml', baseUrl).href,
            new URL('/sitemap-index.xml', baseUrl).href,
            new URL('/sitemaps.xml', baseUrl).href,
        ];
    }

    // Process sitemaps recursively
    async function processSitemap(sitemapUrl) {
        if (processedSitemaps.has(sitemapUrl)) return;
        processedSitemaps.add(sitemapUrl);

        try {
            const response = await fetch(sitemapUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; DataExtractor/1.0)',
                },
                timeout: 15000,
            });

            if (!response.ok) return;

            const xml = await response.text();
            const entries = parseSitemap(xml);

            for (const entry of entries) {
                if (entry.type === 'sitemap') {
                    // Recursively process nested sitemaps
                    await processSitemap(entry.loc);
                } else {
                    allUrls.push(entry);
                }
            }
        } catch (error) {
            console.error(`Error fetching sitemap ${sitemapUrl}:`, error.message);
        }
    }

    // Process all sitemap URLs
    for (const url of sitemapUrls) {
        await processSitemap(url);
    }

    return allUrls;
}

/**
 * Get prioritized URLs for crawling from sitemap
 * @param {Array} sitemapUrls - URLs from sitemap
 * @param {Object} options - Filtering options
 * @returns {Array} Prioritized and filtered URLs
 */
function prioritizeUrls(sitemapUrls, options = {}) {
    const {
        maxUrls = 50,
        priorityThreshold = 0.3,
        includePatterns = [],
        excludePatterns = [],
    } = options;

    // Priority keywords for important pages
    const highPriorityKeywords = [
        'contact', 'about', 'team', 'support', 'help',
        'services', 'products', 'pricing', 'locations',
        'careers', 'jobs', 'press', 'news', 'blog',
    ];

    // Filter and score URLs
    let scoredUrls = sitemapUrls
        .filter(u => u.type === 'url')
        .map(url => {
            let score = url.priority || 0.5;
            const path = new URL(url.loc).pathname.toLowerCase();

            // Boost score for high-priority pages
            for (const keyword of highPriorityKeywords) {
                if (path.includes(keyword)) {
                    score += 0.3;
                    break;
                }
            }

            // Apply include patterns
            if (includePatterns.length > 0) {
                const matches = includePatterns.some(p => path.includes(p));
                if (!matches) score = 0;
            }

            // Apply exclude patterns
            for (const pattern of excludePatterns) {
                if (path.includes(pattern)) {
                    score = 0;
                    break;
                }
            }

            // Penalize deep pages
            const depth = (path.match(/\//g) || []).length;
            score -= depth * 0.1;

            return { ...url, score };
        })
        .filter(u => u.score >= priorityThreshold);

    // Sort by score and limit
    scoredUrls.sort((a, b) => b.score - a.score);
    return scoredUrls.slice(0, maxUrls);
}

/**
 * Discover all URLs for a domain using robots.txt and sitemaps
 * @param {string} baseUrl - Base URL of the domain
 * @param {Object} options - Discovery options
 * @returns {Object} { robotsRules, urls: [] }
 */
async function discoverUrls(baseUrl, options = {}) {
    // Fetch and parse robots.txt
    const robotsRules = await fetchRobotsTxt(baseUrl);

    // Fetch all sitemaps
    const sitemapUrls = await fetchSitemaps(baseUrl, robotsRules);

    // Filter allowed URLs
    const allowedUrls = sitemapUrls.filter(url => {
        try {
            const path = new URL(url.loc).pathname;
            return isUrlAllowed(path, robotsRules);
        } catch {
            return false;
        }
    });

    // Prioritize URLs
    const prioritizedUrls = prioritizeUrls(allowedUrls, options);

    return {
        robotsRules,
        crawlDelay: robotsRules.crawlDelay,
        urls: prioritizedUrls,
        totalFound: sitemapUrls.length,
    };
}

module.exports = {
    parseRobotsTxt,
    isUrlAllowed,
    parseSitemap,
    fetchRobotsTxt,
    fetchSitemaps,
    prioritizeUrls,
    discoverUrls,
};
