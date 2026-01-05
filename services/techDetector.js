/**
 * Technology Detector Service
 * Detects CMS, frameworks, analytics, and other technologies used on websites
 */

// Technology signatures to detect
const technologies = {
    // CMS
    cms: {
        'WordPress': [
            { type: 'meta', name: 'generator', pattern: /wordpress/i },
            { type: 'script', pattern: /wp-content|wp-includes/i },
            { type: 'link', pattern: /wp-content|wp-includes/i }
        ],
        'Shopify': [
            { type: 'meta', name: 'generator', pattern: /shopify/i },
            { type: 'script', pattern: /cdn\.shopify\.com/i },
            { type: 'link', pattern: /cdn\.shopify\.com/i }
        ],
        'Wix': [
            { type: 'meta', name: 'generator', pattern: /wix/i },
            { type: 'script', pattern: /static\.wixstatic\.com|parastorage\.com/i }
        ],
        'Squarespace': [
            { type: 'meta', name: 'generator', pattern: /squarespace/i },
            { type: 'script', pattern: /squarespace\.com/i }
        ],
        'Drupal': [
            { type: 'meta', name: 'generator', pattern: /drupal/i },
            { type: 'script', pattern: /drupal\.js|drupal\.settings/i }
        ],
        'Joomla': [
            { type: 'meta', name: 'generator', pattern: /joomla/i },
            { type: 'script', pattern: /\/media\/jui\/js/i }
        ],
        'Magento': [
            { type: 'script', pattern: /mage\/|magento/i },
            { type: 'html', pattern: /Magento/i }
        ],
        'Webflow': [
            { type: 'meta', name: 'generator', pattern: /webflow/i },
            { type: 'script', pattern: /webflow\.js/i }
        ],
        'Ghost': [
            { type: 'meta', name: 'generator', pattern: /ghost/i }
        ],
        'PrestaShop': [
            { type: 'meta', name: 'generator', pattern: /prestashop/i }
        ],
        'BigCommerce': [
            { type: 'script', pattern: /bigcommerce\.com/i }
        ],
        'WooCommerce': [
            { type: 'script', pattern: /woocommerce/i },
            { type: 'html', pattern: /woocommerce/i }
        ]
    },

    // JavaScript Frameworks
    frameworks: {
        'React': [
            { type: 'script', pattern: /react[-\.]|reactdom/i },
            { type: 'html', pattern: /data-reactroot|__NEXT_DATA__/i }
        ],
        'Vue.js': [
            { type: 'script', pattern: /vue[-\.]|vue\.js/i },
            { type: 'html', pattern: /data-v-[a-f0-9]/i }
        ],
        'Angular': [
            { type: 'script', pattern: /angular[-\.]|angular\.js/i },
            { type: 'html', pattern: /ng-app|ng-controller|\[ng-/i }
        ],
        'jQuery': [
            { type: 'script', pattern: /jquery[-\.]min\.js|jquery\.js/i }
        ],
        'Next.js': [
            { type: 'script', pattern: /_next\/static/i },
            { type: 'html', pattern: /__NEXT_DATA__/i }
        ],
        'Nuxt.js': [
            { type: 'script', pattern: /_nuxt\//i },
            { type: 'html', pattern: /__NUXT__/i }
        ],
        'Gatsby': [
            { type: 'script', pattern: /gatsby/i },
            { type: 'html', pattern: /___gatsby/i }
        ],
        'Bootstrap': [
            { type: 'link', pattern: /bootstrap[-\.]min\.css|bootstrap\.css/i },
            { type: 'script', pattern: /bootstrap[-\.]min\.js|bootstrap\.js/i }
        ],
        'Tailwind CSS': [
            { type: 'html', pattern: /class="[^"]*\b(flex|grid|bg-|text-|p-|m-|w-|h-)[^"]*"/i }
        ]
    },

    // Analytics
    analytics: {
        'Google Analytics': [
            { type: 'script', pattern: /google-analytics\.com|googletagmanager\.com|gtag\(/i }
        ],
        'Google Tag Manager': [
            { type: 'script', pattern: /googletagmanager\.com\/gtm/i }
        ],
        'Facebook Pixel': [
            { type: 'script', pattern: /connect\.facebook\.net.*fbevents|fbq\(/i }
        ],
        'Hotjar': [
            { type: 'script', pattern: /static\.hotjar\.com|hj\(/i }
        ],
        'Mixpanel': [
            { type: 'script', pattern: /cdn\.mxpnl\.com|mixpanel/i }
        ],
        'Segment': [
            { type: 'script', pattern: /cdn\.segment\.com|analytics\.js/i }
        ],
        'Heap': [
            { type: 'script', pattern: /heap-analytics|heapanalytics/i }
        ],
        'Amplitude': [
            { type: 'script', pattern: /amplitude\.com|amplitude\.getInstance/i }
        ],
        'Clarity': [
            { type: 'script', pattern: /clarity\.ms/i }
        ]
    },

    // Web Servers / Hosting
    hosting: {
        'Cloudflare': [
            { type: 'header', name: 'cf-ray', pattern: /.+/ },
            { type: 'script', pattern: /cloudflare/i }
        ],
        'Netlify': [
            { type: 'header', name: 'x-nf-request-id', pattern: /.+/ },
            { type: 'script', pattern: /netlify/i }
        ],
        'Vercel': [
            { type: 'header', name: 'x-vercel-id', pattern: /.+/ },
            { type: 'script', pattern: /vercel/i }
        ],
        'AWS': [
            { type: 'script', pattern: /amazonaws\.com|aws\./i }
        ],
        'Heroku': [
            { type: 'header', name: 'via', pattern: /heroku/i }
        ]
    },

    // Other Tools
    tools: {
        'reCAPTCHA': [
            { type: 'script', pattern: /recaptcha/i }
        ],
        'hCaptcha': [
            { type: 'script', pattern: /hcaptcha/i }
        ],
        'Stripe': [
            { type: 'script', pattern: /js\.stripe\.com/i }
        ],
        'PayPal': [
            { type: 'script', pattern: /paypal\.com\/sdk/i }
        ],
        'Intercom': [
            { type: 'script', pattern: /widget\.intercom\.io|intercomSettings/i }
        ],
        'Zendesk': [
            { type: 'script', pattern: /zdassets\.com|zendesk/i }
        ],
        'Drift': [
            { type: 'script', pattern: /drift\.com|driftt/i }
        ],
        'Crisp': [
            { type: 'script', pattern: /crisp\.chat/i }
        ],
        'Mailchimp': [
            { type: 'script', pattern: /mailchimp/i }
        ],
        'HubSpot': [
            { type: 'script', pattern: /hubspot|hs-scripts|hbspt/i }
        ],
        'Klaviyo': [
            { type: 'script', pattern: /klaviyo/i }
        ]
    }
};

/**
 * Detect technologies on a page
 * @param {Page} page - Puppeteer page instance
 * @param {CheerioStatic} $ - Cheerio instance
 * @returns {Array<{name: string, category: string}>} - Detected technologies
 */
async function detect(page, $) {
    const detected = [];
    const html = $.html();

    // Get all script sources
    const scripts = [];
    $('script[src]').each((_, el) => {
        scripts.push($(el).attr('src'));
    });
    const scriptContent = scripts.join(' ');

    // Get all link sources
    const links = [];
    $('link[href]').each((_, el) => {
        links.push($(el).attr('href'));
    });
    const linkContent = links.join(' ');

    // Get inline scripts
    let inlineScripts = '';
    $('script:not([src])').each((_, el) => {
        inlineScripts += $(el).html() + ' ';
    });

    // Check each technology category
    for (const [category, techs] of Object.entries(technologies)) {
        for (const [name, signatures] of Object.entries(techs)) {
            let found = false;

            for (const sig of signatures) {
                if (found) break;

                switch (sig.type) {
                    case 'meta':
                        const metaValue = $(`meta[name="${sig.name}"]`).attr('content') ||
                            $(`meta[property="${sig.name}"]`).attr('content');
                        if (metaValue && sig.pattern.test(metaValue)) {
                            found = true;
                        }
                        break;

                    case 'script':
                        if (sig.pattern.test(scriptContent) || sig.pattern.test(inlineScripts)) {
                            found = true;
                        }
                        break;

                    case 'link':
                        if (sig.pattern.test(linkContent)) {
                            found = true;
                        }
                        break;

                    case 'html':
                        if (sig.pattern.test(html)) {
                            found = true;
                        }
                        break;

                    case 'header':
                        // Headers would need to be passed separately
                        break;
                }
            }

            if (found) {
                detected.push({ name, category });
            }
        }
    }

    return detected;
}

module.exports = {
    detect,
    technologies
};
