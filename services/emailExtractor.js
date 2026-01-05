/**
 * Email Extractor Service
 * Extracts email addresses from HTML content with source tracking
 */

// Email regex pattern
const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// Common false positives to exclude
const excludePatterns = [
    /example\.com$/i,
    /test\.com$/i,
    /domain\.com$/i,
    /email\.com$/i,
    /yoursite\.com$/i,
    /yourdomain\.com$/i,
    /sentry\.io$/i,
    /wixpress\.com$/i,
    /@\d+x\d+/i,  // Image dimensions like @2x
];

// Common image file extensions
const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

/**
 * Extract emails from HTML content
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {string} sourceUrl - URL where content was extracted from
 * @returns {string[]} - Array of unique email addresses
 */
function extract($, sourceUrl) {
    const emails = new Set();
    const htmlContent = $.html();
    const textContent = $.text();

    // Extract from HTML
    const htmlMatches = htmlContent.match(emailPattern) || [];
    htmlMatches.forEach(email => emails.add(email.toLowerCase()));

    // Extract from visible text
    const textMatches = textContent.match(emailPattern) || [];
    textMatches.forEach(email => emails.add(email.toLowerCase()));

    // Extract from mailto: links
    $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
            const email = href.replace('mailto:', '').split('?')[0].toLowerCase();
            if (emailPattern.test(email)) {
                emails.add(email);
            }
        }
    });

    // Extract from data attributes
    $('[data-email], [data-mail]').each((_, el) => {
        const email = $(el).attr('data-email') || $(el).attr('data-mail');
        if (email && emailPattern.test(email)) {
            emails.add(email.toLowerCase());
        }
    });

    // Filter out false positives
    const filtered = Array.from(emails).filter(email => {
        // Check against exclude patterns
        for (const pattern of excludePatterns) {
            if (pattern.test(email)) return false;
        }

        // Check for image extensions
        for (const ext of imageExtensions) {
            if (email.includes(ext)) return false;
        }

        // Basic validation
        const parts = email.split('@');
        if (parts.length !== 2) return false;
        if (parts[0].length < 1 || parts[1].length < 3) return false;
        if (!parts[1].includes('.')) return false;

        return true;
    });

    return filtered;
}

/**
 * Decode obfuscated emails
 * @param {string} encoded - Encoded email string
 * @returns {string|null} - Decoded email or null
 */
function decodeObfuscatedEmail(encoded) {
    // CloudFlare email protection
    if (encoded.startsWith('/cdn-cgi/l/email-protection#')) {
        const hex = encoded.split('#')[1];
        if (hex) {
            try {
                let decoded = '';
                const key = parseInt(hex.substr(0, 2), 16);
                for (let i = 2; i < hex.length; i += 2) {
                    decoded += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ key);
                }
                if (emailPattern.test(decoded)) {
                    return decoded.toLowerCase();
                }
            } catch (e) {
                return null;
            }
        }
    }

    // Common [at] and [dot] replacements
    let decoded = encoded
        .replace(/\s*\[\s*at\s*\]\s*/gi, '@')
        .replace(/\s*\(\s*at\s*\)\s*/gi, '@')
        .replace(/\s*<\s*at\s*>\s*/gi, '@')
        .replace(/\s*\[\s*dot\s*\]\s*/gi, '.')
        .replace(/\s*\(\s*dot\s*\)\s*/gi, '.')
        .replace(/\s*<\s*dot\s*>\s*/gi, '.')
        .replace(/\s+/g, '');

    if (emailPattern.test(decoded)) {
        return decoded.toLowerCase();
    }

    return null;
}

module.exports = {
    extract,
    decodeObfuscatedEmail,
    emailPattern
};
