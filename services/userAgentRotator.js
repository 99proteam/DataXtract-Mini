/**
 * User Agent Rotator Service
 * Provides rotating user agents to avoid detection and blocking
 */

// Modern browser user agents (updated December 2024)
const USER_AGENTS = [
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

    // Chrome on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',

    // Firefox on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:120.0) Gecko/20100101 Firefox/120.0',

    // Safari on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',

    // Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',

    // Chrome on Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',

    // Firefox on Linux
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',

    // Mobile Chrome on Android
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',

    // Mobile Safari on iPhone
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
];

// Track index for round-robin rotation
let currentIndex = 0;

/**
 * Get a random user agent
 * @returns {string} Random user agent string
 */
function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Get next user agent in rotation (round-robin)
 * @returns {string} Next user agent in sequence
 */
function getNextUserAgent() {
    const userAgent = USER_AGENTS[currentIndex];
    currentIndex = (currentIndex + 1) % USER_AGENTS.length;
    return userAgent;
}

/**
 * Get a desktop-only user agent (no mobile)
 * @returns {string} Desktop user agent string
 */
function getDesktopUserAgent() {
    const desktopAgents = USER_AGENTS.filter(ua =>
        !ua.includes('Mobile') && !ua.includes('Android') && !ua.includes('iPhone')
    );
    return desktopAgents[Math.floor(Math.random() * desktopAgents.length)];
}

/**
 * Get a mobile-only user agent
 * @returns {string} Mobile user agent string
 */
function getMobileUserAgent() {
    const mobileAgents = USER_AGENTS.filter(ua =>
        ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')
    );
    return mobileAgents[Math.floor(Math.random() * mobileAgents.length)];
}

/**
 * Get user agent by browser type
 * @param {string} browser - 'chrome' | 'firefox' | 'safari' | 'edge'
 * @returns {string} User agent for specified browser
 */
function getUserAgentByBrowser(browser) {
    const browserLower = browser.toLowerCase();
    let filtered;

    if (browserLower === 'chrome') {
        filtered = USER_AGENTS.filter(ua => ua.includes('Chrome') && !ua.includes('Edg'));
    } else if (browserLower === 'firefox') {
        filtered = USER_AGENTS.filter(ua => ua.includes('Firefox'));
    } else if (browserLower === 'safari') {
        filtered = USER_AGENTS.filter(ua => ua.includes('Safari') && !ua.includes('Chrome'));
    } else if (browserLower === 'edge') {
        filtered = USER_AGENTS.filter(ua => ua.includes('Edg'));
    } else {
        filtered = USER_AGENTS;
    }

    return filtered[Math.floor(Math.random() * filtered.length)];
}

/**
 * Apply user agent to a Puppeteer page
 * @param {Object} page - Puppeteer page object
 * @param {Object} options - Options for user agent selection
 * @returns {Promise<string>} The user agent that was applied
 */
async function applyToPage(page, options = {}) {
    let userAgent;

    if (options.userAgent) {
        userAgent = options.userAgent;
    } else if (options.mobile) {
        userAgent = getMobileUserAgent();
    } else if (options.browser) {
        userAgent = getUserAgentByBrowser(options.browser);
    } else if (options.rotate) {
        userAgent = getNextUserAgent();
    } else {
        userAgent = getDesktopUserAgent();
    }

    await page.setUserAgent(userAgent);
    console.log(`[UserAgent] Applied: ${userAgent.substring(0, 60)}...`);
    return userAgent;
}

/**
 * Get headers object with user agent for fetch requests
 * @param {Object} options - Options for user agent selection
 * @returns {Object} Headers object
 */
function getHeaders(options = {}) {
    let userAgent;

    if (options.userAgent) {
        userAgent = options.userAgent;
    } else if (options.rotate) {
        userAgent = getNextUserAgent();
    } else {
        userAgent = getDesktopUserAgent();
    }

    return {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    };
}

/**
 * Get all user agents (for debugging/display)
 * @returns {Array<string>} All user agents
 */
function getAllUserAgents() {
    return [...USER_AGENTS];
}

/**
 * Get count of available user agents
 * @returns {number} Number of user agents
 */
function getCount() {
    return USER_AGENTS.length;
}

module.exports = {
    getRandomUserAgent,
    getNextUserAgent,
    getDesktopUserAgent,
    getMobileUserAgent,
    getUserAgentByBrowser,
    applyToPage,
    getHeaders,
    getAllUserAgents,
    getCount,
    USER_AGENTS
};
