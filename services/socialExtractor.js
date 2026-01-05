/**
 * Social Media Link Extractor Service
 * Extracts social media profile links from websites
 */

// Social media platform patterns
const socialPatterns = {
    facebook: {
        pattern: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?!sharer|share\.)([a-zA-Z0-9._-]+)\/?/gi,
        validate: (url) => !url.includes('/sharer') && !url.includes('/share.php')
    },
    twitter: {
        pattern: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?/gi,
        validate: (url) => !url.includes('/intent') && !url.includes('/share')
    },
    linkedin: {
        pattern: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in|school)\/([a-zA-Z0-9-]+)\/?/gi,
        validate: () => true
    },
    instagram: {
        pattern: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)\/?/gi,
        validate: (url) => !url.includes('/p/') && !url.includes('/reel/')
    },
    youtube: {
        pattern: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:channel|c|user|@)\/([a-zA-Z0-9_-]+)\/?/gi,
        validate: (url) => !url.includes('/watch')
    },
    tiktok: {
        pattern: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._]+)\/?/gi,
        validate: () => true
    },
    pinterest: {
        pattern: /(?:https?:\/\/)?(?:www\.)?pinterest\.com\/([a-zA-Z0-9_]+)\/?/gi,
        validate: (url) => !url.includes('/pin/')
    },
    github: {
        pattern: /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9-]+)\/?/gi,
        validate: (url) => !url.includes('/issues') && !url.includes('/pull')
    },
    telegram: {
        pattern: /(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)\/?/gi,
        validate: () => true
    },
    whatsapp: {
        pattern: /(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com)\/([0-9]+)/gi,
        validate: () => true
    },
    discord: {
        pattern: /(?:https?:\/\/)?(?:www\.)?discord\.(?:gg|com\/invite)\/([a-zA-Z0-9-]+)\/?/gi,
        validate: () => true
    },
    medium: {
        pattern: /(?:https?:\/\/)?(?:www\.)?medium\.com\/@?([a-zA-Z0-9._-]+)\/?/gi,
        validate: () => true
    },
    reddit: {
        pattern: /(?:https?:\/\/)?(?:www\.)?reddit\.com\/(?:r|user)\/([a-zA-Z0-9_]+)\/?/gi,
        validate: () => true
    },
    snapchat: {
        pattern: /(?:https?:\/\/)?(?:www\.)?snapchat\.com\/add\/([a-zA-Z0-9._-]+)\/?/gi,
        validate: () => true
    },
    vimeo: {
        pattern: /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/([a-zA-Z0-9_-]+)\/?/gi,
        validate: (url) => !/\/\d+$/.test(url) // Exclude video links
    },
    dribbble: {
        pattern: /(?:https?:\/\/)?(?:www\.)?dribbble\.com\/([a-zA-Z0-9_-]+)\/?/gi,
        validate: () => true
    },
    behance: {
        pattern: /(?:https?:\/\/)?(?:www\.)?behance\.net\/([a-zA-Z0-9_-]+)\/?/gi,
        validate: () => true
    }
};

/**
 * Extract social media links from HTML content
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {Array<{platform: string, url: string}>} - Social media links
 */
function extract($) {
    const socials = new Map(); // Use Map to prevent duplicates per platform
    const html = $.html();

    // Extract from href attributes
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        for (const [platform, { pattern, validate }] of Object.entries(socialPatterns)) {
            // Reset regex lastIndex
            pattern.lastIndex = 0;

            if (pattern.test(href) && validate(href)) {
                // Clean and normalize URL
                const cleanUrl = normalizeUrl(href, platform);
                if (cleanUrl && (!socials.has(platform) || !socials.get(platform).includes(cleanUrl))) {
                    if (!socials.has(platform)) {
                        socials.set(platform, []);
                    }
                    socials.get(platform).push(cleanUrl);
                }
            }
        }
    });

    // Also search in text content for unlinked URLs
    const textContent = $.text();
    for (const [platform, { pattern, validate }] of Object.entries(socialPatterns)) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(textContent)) !== null) {
            const url = match[0];
            if (validate(url)) {
                const cleanUrl = normalizeUrl(url, platform);
                if (cleanUrl && (!socials.has(platform) || !socials.get(platform).includes(cleanUrl))) {
                    if (!socials.has(platform)) {
                        socials.set(platform, []);
                    }
                    socials.get(platform).push(cleanUrl);
                }
            }
        }
    }

    // Convert to array format
    const result = [];
    for (const [platform, urls] of socials) {
        for (const url of urls) {
            result.push({ platform, url });
        }
    }

    return result;
}

/**
 * Normalize social media URL
 * @param {string} url - Raw URL
 * @param {string} platform - Social platform name
 * @returns {string} - Normalized URL
 */
function normalizeUrl(url, platform) {
    // Ensure protocol
    let normalized = url.trim();
    if (!normalized.startsWith('http')) {
        normalized = 'https://' + normalized;
    }

    // Remove trailing slashes
    normalized = normalized.replace(/\/+$/, '');

    // Handle x.com -> twitter.com
    if (platform === 'twitter') {
        normalized = normalized.replace('x.com', 'twitter.com');
    }

    return normalized;
}

module.exports = {
    extract,
    socialPatterns,
    normalizeUrl
};
