/**
 * Security & Anti-Blocking Service
 * Handles user agent rotation, delays, rate limiting, and proxy support
 */

// 50+ User Agents for rotation
const userAgents = [
    // Chrome Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',

    // Chrome Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',

    // Firefox Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0',

    // Firefox Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',

    // Safari
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',

    // Edge
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.0.0',

    // Chrome Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',

    // Firefox Linux
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',

    // Opera
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0',

    // Brave
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Brave/120',

    // Vivaldi
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Vivaldi/6.5',

    // Additional Chrome variants
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',

    // Mobile User Agents (for variety)
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.66 Mobile Safari/537.36',

    // Windows 11
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91',

    // Additional variety
    'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// Common screen resolutions
const screenResolutions = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 2560, height: 1440 },
    { width: 1680, height: 1050 },
    { width: 1600, height: 900 },
];

// Rate limiting tracker per domain
const domainRateLimits = new Map();

// Configuration defaults
const defaultConfig = {
    minDelay: 1000,          // Minimum delay between requests (ms)
    maxDelay: 3000,          // Maximum delay between requests (ms)
    retryAttempts: 3,        // Number of retry attempts
    retryBaseDelay: 1000,    // Base delay for exponential backoff
    requestTimeout: 30000,   // Request timeout (ms)
    maxConcurrent: 2,        // Max concurrent requests per domain
    respectRobotsTxt: true,  // Whether to respect robots.txt
    proxyList: [],           // List of proxy URLs
};

/**
 * Get a random user agent
 * @returns {string} Random user agent string
 */
function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Get a random screen resolution
 * @returns {Object} Random screen resolution
 */
function getRandomResolution() {
    return screenResolutions[Math.floor(Math.random() * screenResolutions.length)];
}

/**
 * Get random delay within configured range
 * @param {Object} config - Configuration object
 * @returns {number} Random delay in milliseconds
 */
function getRandomDelay(config = defaultConfig) {
    const min = config.minDelay || defaultConfig.minDelay;
    const max = config.maxDelay || defaultConfig.maxDelay;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Wait for specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Resolves after delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Apply human-like random delay
 * @param {Object} config - Configuration object
 * @returns {Promise} Resolves after random delay
 */
async function humanDelay(config = defaultConfig) {
    const waitTime = getRandomDelay(config);
    await delay(waitTime);
    return waitTime;
}

/**
 * Check if domain is rate limited
 * @param {string} domain - Domain to check
 * @param {Object} config - Configuration object
 * @returns {boolean} Whether domain is rate limited
 */
function isRateLimited(domain, config = defaultConfig) {
    const limit = domainRateLimits.get(domain);
    if (!limit) return false;

    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    // Clean old entries
    limit.requests = limit.requests.filter(t => now - t < windowMs);

    // Check if over limit (max 30 requests per minute per domain)
    return limit.requests.length >= 30;
}

/**
 * Track request for rate limiting
 * @param {string} domain - Domain to track
 */
function trackRequest(domain) {
    if (!domainRateLimits.has(domain)) {
        domainRateLimits.set(domain, { requests: [] });
    }
    domainRateLimits.get(domain).requests.push(Date.now());
}

/**
 * Wait until domain is not rate limited
 * @param {string} domain - Domain to wait for
 * @returns {Promise} Resolves when domain is available
 */
async function waitForRateLimit(domain) {
    while (isRateLimited(domain)) {
        await delay(1000);
    }
}

/**
 * Retry with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} config - Configuration object
 * @returns {Promise} Result of function
 */
async function retryWithBackoff(fn, config = defaultConfig) {
    const maxAttempts = config.retryAttempts || defaultConfig.retryAttempts;
    const baseDelay = config.retryBaseDelay || defaultConfig.retryBaseDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxAttempts) {
                throw error;
            }

            // Exponential backoff with jitter
            const backoffDelay = baseDelay * Math.pow(2, attempt - 1);
            const jitter = Math.random() * 1000;
            await delay(backoffDelay + jitter);
        }
    }
}

/**
 * Get random proxy from list
 * @param {Object} config - Configuration object
 * @returns {string|null} Proxy URL or null
 */
function getRandomProxy(config = defaultConfig) {
    const proxies = config.proxyList || [];
    if (proxies.length === 0) return null;
    return proxies[Math.floor(Math.random() * proxies.length)];
}

/**
 * Configure Puppeteer page with anti-detection measures
 * @param {Page} page - Puppeteer page
 * @param {Object} config - Configuration object
 */
async function configurePage(page, config = defaultConfig) {
    const userAgent = getRandomUserAgent();
    const resolution = getRandomResolution();

    // Set user agent
    await page.setUserAgent(userAgent);

    // Set viewport
    await page.setViewport({
        width: resolution.width,
        height: resolution.height,
        deviceScaleFactor: 1,
    });

    // Set extra headers
    await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
    });

    // Override navigator properties to avoid detection
    await page.evaluateOnNewDocument(() => {
        // Override webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });

        // Override languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });

        // Override platform
        Object.defineProperty(navigator, 'platform', {
            get: () => 'Win32',
        });

        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Override Chrome
        window.chrome = {
            runtime: {},
        };
    });

    return { userAgent, resolution };
}

/**
 * Simulate human-like mouse movement
 * @param {Page} page - Puppeteer page
 */
async function simulateHumanBehavior(page) {
    // Random mouse movements
    const x = Math.floor(Math.random() * 500) + 100;
    const y = Math.floor(Math.random() * 500) + 100;
    await page.mouse.move(x, y);

    // Random scroll
    await page.evaluate(() => {
        const scrollAmount = Math.floor(Math.random() * 300) + 100;
        window.scrollBy(0, scrollAmount);
    });

    // Small delay
    await delay(Math.random() * 500 + 200);
}

module.exports = {
    userAgents,
    getRandomUserAgent,
    getRandomResolution,
    getRandomDelay,
    delay,
    humanDelay,
    isRateLimited,
    trackRequest,
    waitForRateLimit,
    retryWithBackoff,
    getRandomProxy,
    configurePage,
    simulateHumanBehavior,
    defaultConfig,
};
