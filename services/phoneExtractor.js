/**
 * Phone Extractor Service
 * Extracts phone numbers from HTML content with source tracking
 */

// Phone number patterns for various formats
const phonePatterns = [
    // International format: +1 234 567 8901
    /\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    // US format: (123) 456-7890
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    // Tel links
    /tel:[\+\d\-\.\s\(\)]+/gi,
];

// Minimum and maximum lengths for valid phone numbers
const MIN_DIGITS = 7;
const MAX_DIGITS = 15;

/**
 * Extract phone numbers from HTML content
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {string} sourceUrl - URL where content was extracted from
 * @returns {string[]} - Array of unique phone numbers
 */
function extract($, sourceUrl) {
    const phones = new Set();
    const htmlContent = $.html();
    const textContent = $.text();

    // Extract from tel: links first (most reliable)
    $('a[href^="tel:"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
            const phone = cleanPhoneNumber(href.replace('tel:', ''));
            if (isValidPhone(phone)) {
                phones.add(formatPhone(phone));
            }
        }
    });

    // Extract from content
    const contentToSearch = htmlContent + ' ' + textContent;

    for (const pattern of phonePatterns) {
        const matches = contentToSearch.match(pattern) || [];
        matches.forEach(match => {
            const phone = cleanPhoneNumber(match.replace('tel:', ''));
            if (isValidPhone(phone)) {
                phones.add(formatPhone(phone));
            }
        });
    }

    // Look for phone in specific elements
    $('[itemtype*="PostalAddress"], [itemtype*="LocalBusiness"], .phone, .tel, .telephone, [data-phone]').each((_, el) => {
        const text = $(el).text();
        for (const pattern of phonePatterns) {
            const matches = text.match(pattern) || [];
            matches.forEach(match => {
                const phone = cleanPhoneNumber(match);
                if (isValidPhone(phone)) {
                    phones.add(formatPhone(phone));
                }
            });
        }
    });

    return Array.from(phones);
}

/**
 * Clean phone number by removing non-digit characters except +
 * @param {string} phone - Raw phone string
 * @returns {string} - Cleaned phone number
 */
function cleanPhoneNumber(phone) {
    return phone.replace(/[^\d+]/g, '');
}

/**
 * Validate phone number
 * @param {string} phone - Cleaned phone number
 * @returns {boolean} - Whether the phone is valid
 */
function isValidPhone(phone) {
    const digitsOnly = phone.replace(/\D/g, '');

    // Check length
    if (digitsOnly.length < MIN_DIGITS || digitsOnly.length > MAX_DIGITS) {
        return false;
    }

    // Avoid common false positives (years, prices, etc.)
    // Years: 1900-2099
    if (/^(19|20)\d{2}$/.test(digitsOnly)) {
        return false;
    }

    // Prices or other numbers
    if (/^0{3,}/.test(digitsOnly)) {
        return false;
    }

    // Too many repeated digits
    if (/(\d)\1{5,}/.test(digitsOnly)) {
        return false;
    }

    return true;
}

/**
 * Format phone number for display
 * @param {string} phone - Cleaned phone number
 * @returns {string} - Formatted phone number
 */
function formatPhone(phone) {
    const digitsOnly = phone.replace(/\D/g, '');

    // If starts with +, keep the format
    if (phone.startsWith('+')) {
        return phone;
    }

    // US format
    if (digitsOnly.length === 10) {
        return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }

    // US with country code
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
    }

    // International format
    if (digitsOnly.length > 10) {
        return `+${digitsOnly}`;
    }

    return phone;
}

module.exports = {
    extract,
    cleanPhoneNumber,
    isValidPhone,
    formatPhone
};
