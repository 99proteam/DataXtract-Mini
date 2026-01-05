/**
 * Media Extractor Service
 * Extracts images, videos, and PDF links from websites
 */

const { URL } = require('url');

// Image extensions
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];

// Video patterns
const videoPatterns = {
    youtube: /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi,
    vimeo: /vimeo\.com\/(?:video\/)?(\d+)/gi,
    wistia: /wistia\.com\/(?:medias|embed)\/([a-zA-Z0-9]+)/gi,
    dailymotion: /dailymotion\.com\/(?:video|embed\/video)\/([a-zA-Z0-9]+)/gi
};

// Document extensions
const documentExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];

/**
 * Extract media links from HTML content
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @returns {Object} - Object containing arrays of images, videos, and pdfs
 */
function extract($, baseUrl) {
    const media = {
        images: new Set(),
        videos: new Set(),
        pdfs: new Set()
    };

    const base = new URL(baseUrl);

    // Extract images
    $('img[src], img[data-src], img[data-lazy-src]').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
        if (src) {
            const fullUrl = resolveUrl(src, base);
            if (fullUrl && isValidImage(fullUrl)) {
                media.images.add(fullUrl);
            }
        }
    });

    // Extract from srcset
    $('img[srcset], source[srcset]').each((_, el) => {
        const srcset = $(el).attr('srcset');
        if (srcset) {
            const urls = parseSrcset(srcset);
            urls.forEach(url => {
                const fullUrl = resolveUrl(url, base);
                if (fullUrl && isValidImage(fullUrl)) {
                    media.images.add(fullUrl);
                }
            });
        }
    });

    // Extract from picture elements
    $('picture source[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
            const fullUrl = resolveUrl(src, base);
            if (fullUrl && isValidImage(fullUrl)) {
                media.images.add(fullUrl);
            }
        }
    });

    // Extract background images from inline styles
    $('[style*="background"]').each((_, el) => {
        const style = $(el).attr('style');
        if (style) {
            const urlMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/gi);
            if (urlMatch) {
                urlMatch.forEach(match => {
                    const url = match.replace(/url\(['"]?|['"]?\)/gi, '');
                    const fullUrl = resolveUrl(url, base);
                    if (fullUrl && isValidImage(fullUrl)) {
                        media.images.add(fullUrl);
                    }
                });
            }
        }
    });

    // Extract videos - embedded iframes
    $('iframe[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
            for (const [platform, pattern] of Object.entries(videoPatterns)) {
                pattern.lastIndex = 0;
                if (pattern.test(src)) {
                    media.videos.add(src);
                }
            }
        }
    });

    // Extract videos - video elements
    $('video source[src], video[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
            const fullUrl = resolveUrl(src, base);
            if (fullUrl) {
                media.videos.add(fullUrl);
            }
        }
    });

    // Extract video links from HTML
    const html = $.html();
    for (const [platform, pattern] of Object.entries(videoPatterns)) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const videoId = match[1];
            let videoUrl;
            switch (platform) {
                case 'youtube':
                    videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    break;
                case 'vimeo':
                    videoUrl = `https://vimeo.com/${videoId}`;
                    break;
                case 'wistia':
                    videoUrl = `https://wistia.com/medias/${videoId}`;
                    break;
                case 'dailymotion':
                    videoUrl = `https://www.dailymotion.com/video/${videoId}`;
                    break;
            }
            if (videoUrl) {
                media.videos.add(videoUrl);
            }
        }
    }

    // Extract PDFs and documents
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
            const fullUrl = resolveUrl(href, base);
            if (fullUrl) {
                const lowerUrl = fullUrl.toLowerCase();
                if (lowerUrl.endsWith('.pdf')) {
                    media.pdfs.add(fullUrl);
                }
                // Could add other document types here
            }
        }
    });

    // Search for PDF links in text
    $('a').each((_, el) => {
        const text = $(el).text().toLowerCase();
        const href = $(el).attr('href');
        if (href && (text.includes('pdf') || text.includes('download') || text.includes('brochure'))) {
            const fullUrl = resolveUrl(href, base);
            if (fullUrl && (fullUrl.toLowerCase().endsWith('.pdf') || fullUrl.includes('/pdf/'))) {
                media.pdfs.add(fullUrl);
            }
        }
    });

    return {
        images: Array.from(media.images),
        videos: Array.from(media.videos),
        pdfs: Array.from(media.pdfs)
    };
}

/**
 * Resolve relative URL to absolute
 * @param {string} url - URL to resolve
 * @param {URL} base - Base URL object
 * @returns {string|null} - Absolute URL or null
 */
function resolveUrl(url, base) {
    try {
        if (!url || url.startsWith('data:') || url.startsWith('javascript:')) {
            return null;
        }

        // Already absolute
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // Protocol-relative
        if (url.startsWith('//')) {
            return base.protocol + url;
        }

        // Relative URL
        return new URL(url, base.origin).href;
    } catch (e) {
        return null;
    }
}

/**
 * Parse srcset attribute
 * @param {string} srcset - srcset value
 * @returns {string[]} - Array of URLs
 */
function parseSrcset(srcset) {
    return srcset
        .split(',')
        .map(entry => entry.trim().split(/\s+/)[0])
        .filter(url => url && url.length > 0);
}

/**
 * Check if URL is a valid image
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isValidImage(url) {
    const lowerUrl = url.toLowerCase();

    // Check extension
    const hasImageExt = imageExtensions.some(ext => lowerUrl.includes(ext));

    // Check for common image patterns
    const hasImagePattern = lowerUrl.includes('/images/') ||
        lowerUrl.includes('/img/') ||
        lowerUrl.includes('/media/') ||
        lowerUrl.includes('/uploads/') ||
        lowerUrl.includes('image') ||
        lowerUrl.includes('photo');

    // Exclude tiny images (likely icons/spacers)
    const isLikelyReal = !lowerUrl.includes('1x1') &&
        !lowerUrl.includes('spacer') &&
        !lowerUrl.includes('pixel') &&
        !lowerUrl.includes('loading');

    return (hasImageExt || hasImagePattern) && isLikelyReal;
}

module.exports = {
    extract,
    resolveUrl,
    isValidImage,
    videoPatterns
};
