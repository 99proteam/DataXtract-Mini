/**
 * Business Email Finder Service
 * Extracts and verifies business emails from websites
 */

const axios = require('axios');
const cheerio = require('cheerio');
const emailExtractor = require('./emailExtractor');
const emailVerifier = require('./emailVerifier');

/**
 * Common contact page paths to check
 */
const CONTACT_PATHS = [
    '/contact',
    '/contact-us',
    '/contactus',
    '/about',
    '/about-us',
    '/aboutus',
    '/connect',
    '/reach-us',
    '/get-in-touch',
    '/support',
    '/help'
];

/**
 * User agent for requests
 */
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetch webpage content
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<string|null>} HTML content or null
 */
async function fetchPage(url, timeout = 10000) {
    try {
        const response = await axios.get(url, {
            timeout,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            maxRedirects: 5,
            validateStatus: status => status < 400
        });
        return response.data;
    } catch (error) {
        return null;
    }
}

/**
 * Extract base URL from a URL string
 * @param {string} url - Full URL
 * @returns {string} Base URL (protocol + domain)
 */
function getBaseUrl(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        // If URL doesn't have protocol, add https
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }
        try {
            const parsed = new URL(url);
            return `${parsed.protocol}//${parsed.host}`;
        } catch {
            return url;
        }
    }
}

/**
 * Find emails from a single page
 * @param {string} url - URL to scrape
 * @returns {Promise<{emails: string[], url: string}>}
 */
async function findEmailsOnPage(url) {
    const html = await fetchPage(url);
    if (!html) {
        return { emails: [], url };
    }

    const $ = cheerio.load(html);
    const emails = emailExtractor.extract($, url);

    return { emails, url };
}

/**
 * Find emails from website (checks multiple pages)
 * @param {string} websiteUrl - Base website URL
 * @param {Object} options - Options
 * @returns {Promise<{emails: string[], sources: Object[], primaryEmail: string|null}>}
 */
async function findEmailsFromWebsite(websiteUrl, options = {}) {
    const {
        checkContactPages = true,
        maxPages = 5,
        verifyEmails = false
    } = options;

    const baseUrl = getBaseUrl(websiteUrl);
    const allEmails = new Set();
    const sources = [];

    // 1. Check home page
    const homeResult = await findEmailsOnPage(baseUrl);
    homeResult.emails.forEach(email => allEmails.add(email));
    if (homeResult.emails.length > 0) {
        sources.push({ url: baseUrl, emails: homeResult.emails });
    }

    // 2. Check contact pages
    if (checkContactPages) {
        let pagesChecked = 1;

        for (const path of CONTACT_PATHS) {
            if (pagesChecked >= maxPages) break;

            const contactUrl = baseUrl + path;
            const result = await findEmailsOnPage(contactUrl);

            if (result.emails.length > 0) {
                result.emails.forEach(email => allEmails.add(email));
                sources.push({ url: contactUrl, emails: result.emails });
            }

            pagesChecked++;

            // Small delay between requests
            await new Promise(r => setTimeout(r, 500));
        }
    }

    const emails = Array.from(allEmails);

    // 3. Determine primary email (prefer contact@, info@, hello@, etc.)
    const primaryEmail = selectPrimaryEmail(emails);

    // 4. Optionally verify emails
    let verificationResults = null;
    if (verifyEmails && emails.length > 0) {
        verificationResults = {};
        for (const email of emails.slice(0, 3)) { // Verify max 3 emails
            const result = await emailVerifier.verify(email);
            verificationResults[email] = {
                status: result.status,
                score: result.score
            };
        }
    }

    return {
        emails,
        primaryEmail,
        sources,
        verificationResults
    };
}

/**
 * Select the primary business email from a list
 * Prefers generic business emails like contact@, info@, hello@
 * @param {string[]} emails - List of emails
 * @returns {string|null} Primary email or null
 */
function selectPrimaryEmail(emails) {
    if (emails.length === 0) return null;
    if (emails.length === 1) return emails[0];

    // Priority prefixes (in order of preference)
    const priorityPrefixes = [
        'contact@',
        'info@',
        'hello@',
        'enquir', // enquiry, enquiries
        'sales@',
        'support@',
        'admin@',
        'office@',
        'mail@'
    ];

    for (const prefix of priorityPrefixes) {
        const match = emails.find(e => e.toLowerCase().startsWith(prefix));
        if (match) return match;
    }

    // Return first email if no priority match
    return emails[0];
}

/**
 * Find email for a Google Maps business result
 * @param {Object} business - Business data with website
 * @param {Object} options - Options
 * @returns {Promise<{email: string|null, verified: boolean, score: number|null}>}
 */
async function findBusinessEmail(business, options = {}) {
    if (!business.website) {
        return { email: null, verified: false, score: null, error: 'No website' };
    }

    try {
        const result = await findEmailsFromWebsite(business.website, {
            checkContactPages: true,
            maxPages: 3,
            verifyEmails: options.verify || false
        });

        const email = result.primaryEmail;
        let verified = false;
        let score = null;

        if (email && result.verificationResults && result.verificationResults[email]) {
            const verification = result.verificationResults[email];
            verified = verification.status === 'valid';
            score = verification.score;
        }

        return {
            email,
            allEmails: result.emails,
            verified,
            score,
            sources: result.sources
        };
    } catch (error) {
        return {
            email: null,
            verified: false,
            score: null,
            error: error.message
        };
    }
}

/**
 * Bulk find emails for multiple businesses
 * @param {Array<Object>} businesses - Array of business objects with website
 * @param {Object} options - Options
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array<Object>>}
 */
async function bulkFindEmails(businesses, options = {}, onProgress = null) {
    const results = [];

    for (let i = 0; i < businesses.length; i++) {
        const business = businesses[i];
        const emailResult = await findBusinessEmail(business, options);

        results.push({
            id: business.id,
            business_email: emailResult.email,
            email_verified: emailResult.verified,
            email_score: emailResult.score,
            all_emails: emailResult.allEmails
        });

        if (onProgress) {
            onProgress({
                current: i + 1,
                total: businesses.length,
                business: business.business_name || business.name,
                email: emailResult.email
            });
        }

        // Delay between requests to be respectful
        await new Promise(r => setTimeout(r, 1000));
    }

    return results;
}

module.exports = {
    findEmailsOnPage,
    findEmailsFromWebsite,
    selectPrimaryEmail,
    findBusinessEmail,
    bulkFindEmails,
    getBaseUrl
};
