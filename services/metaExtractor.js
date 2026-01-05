/**
 * Metadata Extractor Service
 * Extracts page title, description, and address information
 */

// Address patterns
// Address patterns
const addressPatterns = [
    // US Address (strict)
    /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|highway|hwy|lane|ln|drive|dr|court|ct|boulevard|blvd|way|place|pl)[,.\s]+[\w\s]+,?\s*[A-Z]{2}\s+\d{5}(-\d{4})?/gi,

    // International / Generic (City, Region, Postal Code)
    /[A-Za-z\s]+,[A-Za-z\s]+\s+\d{4,10}/gi, // Generic City, State Zip
    /\d{4,6}\s+[A-Za-z\s]+,\s*[A-Za-z\s]+/gi, // Zip City, Country (Europe style)

    // Indian Address (Pin Code 6 digits)
    /\b\d{6}\b.*\b(India|State|District)\b/gi,
    /\b(New Delhi|Mumbai|Bangalore|Hyderabad|Chennai|Kolkata|Pune).*\d{6}/gi
];

/**
 * Metadata Extractor Service

/**
 * Extract metadata from HTML content
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {Object} - Extracted metadata
 */
function extract($) {
    const metadata = {
        title: null,
        description: null,
        keywords: null,
        address: null,
        ogData: {}
    };

    // Extract title
    metadata.title = extractTitle($);

    // Extract description
    metadata.description = extractDescription($);

    // Extract keywords
    const keywordsMeta = $('meta[name="keywords"]').attr('content');
    if (keywordsMeta) {
        metadata.keywords = keywordsMeta.trim();
    }

    // Extract Open Graph data
    metadata.ogData = extractOpenGraph($);

    // Extract address
    metadata.address = extractAddress($);

    return metadata;
}

/**
 * Extract page title
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {string|null}
 */
function extractTitle($) {
    // Try Open Graph title first
    let title = $('meta[property="og:title"]').attr('content');
    if (title) return title.trim();

    // Try Twitter title
    title = $('meta[name="twitter:title"]').attr('content');
    if (title) return title.trim();

    // Try regular title tag
    title = $('title').text();
    if (title) return title.trim();

    // Try h1
    title = $('h1').first().text();
    if (title) return title.trim();

    return null;
}

/**
 * Extract page description
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {string|null}
 */
function extractDescription($) {
    // Try meta description
    let desc = $('meta[name="description"]').attr('content');
    if (desc) return desc.trim();

    // Try Open Graph description
    desc = $('meta[property="og:description"]').attr('content');
    if (desc) return desc.trim();

    // Try Twitter description
    desc = $('meta[name="twitter:description"]').attr('content');
    if (desc) return desc.trim();

    // Try first paragraph
    const firstP = $('article p, main p, .content p, p').first().text();
    if (firstP && firstP.length > 50) {
        return firstP.trim().slice(0, 300) + (firstP.length > 300 ? '...' : '');
    }

    return null;
}

/**
 * Extract Open Graph data
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {Object}
 */
function extractOpenGraph($) {
    const og = {};

    $('meta[property^="og:"]').each((_, el) => {
        const property = $(el).attr('property').replace('og:', '');
        const content = $(el).attr('content');
        if (property && content) {
            og[property] = content;
        }
    });

    return og;
}

/**
 * Extract address from page
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {string|null}
 */
function extractAddress($) {
    // Try structured data first
    const ldJson = $('script[type="application/ld+json"]').toArray();
    for (const script of ldJson) {
        try {
            const data = JSON.parse($(script).html());
            const address = findAddressInJson(data);
            if (address) return address;
        } catch (e) {
            // Invalid JSON, continue
        }
    }

    // Try microdata
    const microdata = $('[itemtype*="PostalAddress"]');
    if (microdata.length > 0) {
        const parts = [];
        microdata.find('[itemprop="streetAddress"]').each((_, el) => parts.push($(el).text().trim()));
        microdata.find('[itemprop="addressLocality"]').each((_, el) => parts.push($(el).text().trim()));
        microdata.find('[itemprop="addressRegion"]').each((_, el) => parts.push($(el).text().trim()));
        microdata.find('[itemprop="postalCode"]').each((_, el) => parts.push($(el).text().trim()));
        microdata.find('[itemprop="addressCountry"]').each((_, el) => parts.push($(el).text().trim()));

        if (parts.length > 0) {
            return parts.filter(p => p).join(', ');
        }
    }

    // Try common address elements
    const addressElement = $('address, .address, #address, [class*="address"], [class*="location"]').first();
    if (addressElement.length > 0) {
        const text = addressElement.text().trim().replace(/\s+/g, ' ');
        if (text.length > 10 && text.length < 200) {
            return text;
        }
    }

    // Try footer (common location for addresses)
    const footer = $('footer, .footer, #footer').text();
    for (const pattern of addressPatterns) {
        const match = footer.match(pattern);
        if (match) {
            return match[0].trim().replace(/\s+/g, ' ');
        }
    }

    // Try contact page-like sections
    const contactSection = $('.contact, #contact, [class*="contact"], .about, #about').text();
    for (const pattern of addressPatterns) {
        const match = contactSection.match(pattern);
        if (match) {
            return match[0].trim().replace(/\s+/g, ' ');
        }
    }

    return null;
}

/**
 * Recursively find address in JSON-LD data
 * @param {Object} data - JSON-LD object
 * @returns {string|null}
 */
function findAddressInJson(data) {
    if (!data || typeof data !== 'object') return null;

    // Check if this object is an address
    if (data['@type'] === 'PostalAddress' || data.address) {
        const addr = data['@type'] === 'PostalAddress' ? data : data.address;
        if (typeof addr === 'string') return addr;

        const parts = [];
        if (addr.streetAddress) parts.push(addr.streetAddress);
        if (addr.addressLocality) parts.push(addr.addressLocality);
        if (addr.addressRegion) parts.push(addr.addressRegion);
        if (addr.postalCode) parts.push(addr.postalCode);
        if (addr.addressCountry) parts.push(typeof addr.addressCountry === 'object' ? addr.addressCountry.name : addr.addressCountry);

        if (parts.length > 0) {
            return parts.join(', ');
        }
    }

    // Recursively search in arrays and objects
    if (Array.isArray(data)) {
        for (const item of data) {
            const result = findAddressInJson(item);
            if (result) return result;
        }
    } else {
        for (const key of Object.keys(data)) {
            const result = findAddressInJson(data[key]);
            if (result) return result;
        }
    }

    return null;
}

module.exports = {
    extract,
    extractTitle,
    extractDescription,
    extractAddress,
    extractOpenGraph
};
