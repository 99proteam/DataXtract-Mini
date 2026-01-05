/**
 * LinkedIn Profile Extractor Service
 * Scrapes LinkedIn profiles using Puppeteer with session management
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Session storage
const SESSIONS_DIR = path.join(__dirname, '..', 'data', 'linkedin-sessions');
const activeSessions = new Map();

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * Get all available LinkedIn sessions
 */
function getAvailableSessions() {
    try {
        if (!fs.existsSync(SESSIONS_DIR)) return [];
        return fs.readdirSync(SESSIONS_DIR)
            .filter(f => fs.statSync(path.join(SESSIONS_DIR, f)).isDirectory())
            .map(name => ({
                name,
                active: activeSessions.has(name),
                loggedIn: activeSessions.get(name)?.loggedIn || false
            }));
    } catch (e) {
        return [];
    }
}

/**
 * Initialize a LinkedIn session
 */
async function initSession(sessionName, onLoginNeeded) {
    const sessionPath = path.join(SESSIONS_DIR, sessionName);

    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    const hasExistingSession = fs.readdirSync(sessionPath).length > 5;

    try {
        console.log(`[LinkedIn] Initializing session "${sessionName}"${hasExistingSession ? ' (existing data found)' : ''}...`);

        const browser = await puppeteer.launch({
            headless: false, // Show browser for login
            userDataDir: sessionPath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();

        // Anti-detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1366, height: 768 });

        // Navigate to LinkedIn
        await page.goto('https://www.linkedin.com/', { waitUntil: 'networkidle2', timeout: 60000 });

        // Check if logged in - use multiple methods
        let loggedIn = false;

        // Wait a bit for page to fully load
        await page.waitForTimeout(3000);

        // Method 1: Check URL - if we're on feed or in, we're logged in
        const currentUrl = page.url();
        if (currentUrl.includes('/feed') || currentUrl.includes('/in/') || currentUrl.includes('/mynetwork')) {
            loggedIn = true;
            console.log(`[LinkedIn] Session "${sessionName}" logged in (detected via URL: ${currentUrl})`);
        }

        // Method 2: Check for logged-in specific elements
        if (!loggedIn) {
            const loginSelectors = [
                '.global-nav__me',
                '.feed-identity-module',
                '[data-control-name="identity_welcome_message"]',
                '.artdeco-entity-lockup__title',
                '.share-box-feed-entry__avatar',
                'img.global-nav__me-photo',
                '[data-test-global-nav-link="me"]',
                '.msg-overlay-bubble-header',
                '.feed-shared-actor__avatar-image',
                '#voyager-feed',
                '.scaffold-layout__main'
            ];

            for (const selector of loginSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        loggedIn = true;
                        console.log(`[LinkedIn] Session "${sessionName}" logged in (found: ${selector})`);
                        break;
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }
        }

        // Method 3: Check if login form is NOT present (means we're logged in)
        if (!loggedIn) {
            const loginFormExists = await page.$('input[id="session_key"], .sign-in-form, [data-id="sign-in-form"]');
            if (!loginFormExists) {
                // No login form and not detected as logged in - check for nav bar
                const hasNavBar = await page.$('.global-nav, .authentication-outlet');
                if (hasNavBar) {
                    loggedIn = true;
                    console.log(`[LinkedIn] Session "${sessionName}" logged in (no login form, has nav)`);
                }
            }
        }

        if (!loggedIn) {
            console.log(`[LinkedIn] Session "${sessionName}" needs login...`);
            if (onLoginNeeded) {
                onLoginNeeded('Please log in to LinkedIn in the browser window');
            }
        }

        activeSessions.set(sessionName, {
            browser,
            page,
            loggedIn,
            lastUsed: Date.now()
        });

        return { success: true, loggedIn, sessionName };
    } catch (error) {
        console.error(`[LinkedIn] Init error:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Close a LinkedIn session
 */
async function closeSession(sessionName) {
    const session = activeSessions.get(sessionName);
    if (session) {
        try {
            await session.browser.close();
        } catch (e) { }
        activeSessions.delete(sessionName);
    }
    return { success: true };
}

/**
 * Manually confirm login - user clicks this after they've logged in
 * @param {string} sessionName 
 * @param {boolean} force - Force mark as logged in without checking
 */
async function confirmLogin(sessionName, force = false) {
    const session = activeSessions.get(sessionName);
    if (!session) {
        return { success: false, error: 'No session found. Start a session first.' };
    }

    const page = session.page;

    // If force is true, just mark as logged in
    if (force) {
        session.loggedIn = true;
        session.lastUsed = Date.now();
        console.log(`[LinkedIn] Session "${sessionName}" force-marked as logged in!`);
        return { success: true, loggedIn: true };
    }

    try {
        // First check current URL without navigating
        let currentUrl = page.url();
        console.log(`[LinkedIn] Checking current URL: ${currentUrl}`);

        // If already on a LinkedIn page that indicates login
        if (currentUrl.includes('/feed') || currentUrl.includes('/in/') ||
            currentUrl.includes('/mynetwork') || currentUrl.includes('/messaging') ||
            currentUrl.includes('/jobs') || currentUrl.includes('/notifications')) {
            session.loggedIn = true;
            session.lastUsed = Date.now();
            console.log(`[LinkedIn] Session "${sessionName}" confirmed logged in via URL!`);
            return { success: true, loggedIn: true };
        }

        // Check if we're on home page but logged in (check for nav elements)
        const isLoggedIn = await page.evaluate(() => {
            // Multiple ways to check login
            const hasNavMe = document.querySelector('.global-nav__me, .global-nav__me-photo, [data-test-global-nav-link="me"]');
            const hasFeedBox = document.querySelector('.share-box, .share-box-feed-entry');
            const hasProfile = document.querySelector('.feed-identity-module, .artdeco-entity-lockup');
            const noLoginForm = !document.querySelector('input[id="session_key"], .sign-in-form');
            const hasMessaging = document.querySelector('.msg-overlay-bubble-header, .msg-overlay-list-bubble');

            return !!(hasNavMe || hasFeedBox || hasProfile || hasMessaging) && noLoginForm;
        });

        if (isLoggedIn) {
            session.loggedIn = true;
            session.lastUsed = Date.now();
            console.log(`[LinkedIn] Session "${sessionName}" confirmed logged in via page elements!`);
            return { success: true, loggedIn: true };
        }

        // Only try navigation as last resort with shorter timeout
        console.log(`[LinkedIn] Trying navigation to feed...`);
        try {
            await page.goto('https://www.linkedin.com/feed/', {
                waitUntil: 'domcontentloaded',  // Faster than networkidle2
                timeout: 15000
            });
            await page.waitForTimeout(2000);

            currentUrl = page.url();
            if (currentUrl.includes('/feed')) {
                session.loggedIn = true;
                session.lastUsed = Date.now();
                console.log(`[LinkedIn] Session "${sessionName}" confirmed logged in after navigation!`);
                return { success: true, loggedIn: true };
            }
        } catch (navError) {
            console.log(`[LinkedIn] Navigation timeout, checking elements...`);
        }

        // Final element check after any navigation attempt
        const finalCheck = await page.evaluate(() => {
            return !!document.querySelector('.global-nav__me, .feed-identity-module, .share-box');
        });

        if (finalCheck) {
            session.loggedIn = true;
            session.lastUsed = Date.now();
            console.log(`[LinkedIn] Session "${sessionName}" confirmed logged in (final check)!`);
            return { success: true, loggedIn: true };
        }

        return { success: false, loggedIn: false, error: 'Could not confirm login. Try "Force Login" button.' };

    } catch (error) {
        console.error(`[LinkedIn] Confirm login error:`, error.message);
        // Even on error, check if we might be logged in
        try {
            const emergencyCheck = await page.$('.global-nav__me, .feed-identity-module');
            if (emergencyCheck) {
                session.loggedIn = true;
                return { success: true, loggedIn: true };
            }
        } catch (e) { }
        return { success: false, error: error.message };
    }
}

/**
 * Get session status
 */
function getSessionStatus(sessionName) {
    if (!activeSessions.has(sessionName)) {
        return { active: false };
    }
    const session = activeSessions.get(sessionName);
    return {
        active: true,
        loggedIn: session.loggedIn,
        lastUsed: session.lastUsed
    };
}

/**
 * Check if session is active and logged in
 */
async function ensureSessionActive(sessionName) {
    let session = activeSessions.get(sessionName);

    if (!session) {
        const result = await initSession(sessionName);
        if (!result.success) {
            return { success: false, error: 'Failed to initialize session' };
        }
        session = activeSessions.get(sessionName);
    }

    // Check if browser is still connected
    try {
        if (!session.browser.isConnected()) {
            console.log(`[LinkedIn] Session ${sessionName} browser disconnected, reinitializing...`);
            await initSession(sessionName);
            session = activeSessions.get(sessionName);
        }
    } catch (e) {
        await initSession(sessionName);
        session = activeSessions.get(sessionName);
    }

    if (!session || !session.loggedIn) {
        return { success: false, error: 'Session not logged in. Please log in first.' };
    }

    return { success: true, session };
}

/**
 * Search for people on LinkedIn with pagination
 */
async function searchPeople(sessionName, options = {}) {
    const check = await ensureSessionActive(sessionName);
    if (!check.success) {
        return { success: false, error: check.error };
    }

    const { keywords, company, title, location, limit = 100, maxPages = 5 } = options;
    const page = check.session.page;
    const allProfiles = [];

    try {
        // Build base search URL
        let baseUrl = 'https://www.linkedin.com/search/results/people/?';
        const params = [];

        if (keywords) params.push(`keywords=${encodeURIComponent(keywords)}`);
        if (company) params.push(`company=${encodeURIComponent(company)}`);
        if (title) params.push(`title=${encodeURIComponent(title)}`);
        if (location) params.push(`geoUrn=${encodeURIComponent(location)}`);

        baseUrl += params.join('&');

        // Extract from multiple pages
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            const searchUrl = pageNum === 1 ? baseUrl : `${baseUrl}&page=${pageNum}`;

            console.log(`[LinkedIn] Searching people page ${pageNum}: ${searchUrl}`);

            try {
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
                await page.waitForTimeout(3000);

                // Scroll to load lazy content
                for (let i = 0; i < 3; i++) {
                    await page.evaluate((y) => window.scrollTo(0, y), (i + 1) * 500);
                    await page.waitForTimeout(1000);
                }

                // Check for LinkedIn limits
                const limitMessage = await page.evaluate(() => {
                    const limitEl = document.querySelector('.search-results__no-results, .artdeco-empty-state, [class*="no-results"]');
                    if (limitEl) return limitEl.innerText;
                    const errorEl = document.querySelector('.error-container, .artdeco-inline-feedback--error');
                    if (errorEl) return errorEl.innerText;
                    return null;
                });

                if (limitMessage && limitMessage.includes('limit')) {
                    console.log(`[LinkedIn] Limit detected: ${limitMessage}`);
                    return {
                        success: true,
                        profiles: allProfiles,
                        count: allProfiles.length,
                        limitReached: true,
                        message: `LinkedIn limit reached. Extracted ${allProfiles.length} profiles.`
                    };
                }

                // Extract profiles from this page
                const pageProfiles = await page.evaluate(() => {
                    const results = [];
                    const containerSelectors = [
                        '.reusable-search__result-container',
                        '.entity-result',
                        'li.reusable-search__result-container',
                        '[data-chameleon-result-urn]'
                    ];

                    let cards = [];
                    for (const selector of containerSelectors) {
                        cards = document.querySelectorAll(selector);
                        if (cards.length > 0) break;
                    }

                    cards.forEach((card) => {
                        const nameEl = card.querySelector(
                            '.entity-result__title-text a span[aria-hidden="true"], ' +
                            '.entity-result__title-text a, ' +
                            '.app-aware-link span[aria-hidden="true"]'
                        );
                        const titleEl = card.querySelector('.entity-result__primary-subtitle, .entity-result__summary');
                        const locationEl = card.querySelector('.entity-result__secondary-subtitle');
                        const linkEl = card.querySelector('a[href*="/in/"]');
                        const imgEl = card.querySelector('img.presence-entity__image, img[class*="presence"], .entity-result__universal-image img');

                        const name = nameEl?.innerText?.trim();
                        if (name && name.length > 0) {
                            results.push({
                                name,
                                title: titleEl?.innerText?.trim() || '',
                                location: locationEl?.innerText?.trim() || '',
                                profileUrl: linkEl?.href?.split('?')[0] || '',
                                imageUrl: imgEl?.src || ''
                            });
                        }
                    });

                    return results;
                });

                console.log(`[LinkedIn] Page ${pageNum}: Found ${pageProfiles.length} profiles`);

                // Check for no results (end of data)
                if (pageProfiles.length === 0) {
                    console.log(`[LinkedIn] No more results on page ${pageNum}, stopping pagination`);
                    break;
                }

                allProfiles.push(...pageProfiles);

                // Check if we've reached the limit
                if (allProfiles.length >= limit) {
                    console.log(`[LinkedIn] Reached requested limit of ${limit}`);
                    break;
                }

                // Wait between pages to avoid rate limiting
                if (pageNum < maxPages) {
                    await page.waitForTimeout(2000);
                }

            } catch (pageError) {
                console.error(`[LinkedIn] Error on page ${pageNum}:`, pageError.message);
                // Continue to return what we have
                break;
            }
        }

        check.session.lastUsed = Date.now();
        console.log(`[LinkedIn] Total profiles extracted: ${allProfiles.length}`);

        return {
            success: true,
            profiles: allProfiles.slice(0, limit),
            count: Math.min(allProfiles.length, limit),
            pagesScanned: Math.min(maxPages, Math.ceil(allProfiles.length / 10))
        };

    } catch (error) {
        console.error(`[LinkedIn] Search people error:`, error.message);
        return { success: false, error: error.message, profiles: allProfiles, count: allProfiles.length };
    }
}

/**
 * Extract detailed profile information
 */
async function extractProfile(sessionName, profileUrl) {
    const check = await ensureSessionActive(sessionName);
    if (!check.success) {
        return { success: false, error: check.error };
    }

    const page = check.session.page;

    try {
        console.log(`[LinkedIn] Extracting profile: ${profileUrl}`);
        await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForTimeout(3000);

        const profile = await page.evaluate(() => {
            const getText = (selector) => document.querySelector(selector)?.innerText?.trim() || '';
            const getAttr = (selector, attr) => document.querySelector(selector)?.getAttribute(attr) || '';

            // Basic info
            const name = getText('h1.text-heading-xlarge, h1[class*="text-heading"]');
            const headline = getText('.text-body-medium.break-words, div[class*="text-body-medium"]');
            const location = getText('.text-body-small.inline, span[class*="top-card-layout__second-subline"]');
            const about = getText('#about ~ div.display-flex section div.inline-show-more-text, section[data-section="summary"] div');

            // Profile image
            const imageUrl = getAttr('img.pv-top-card-profile-picture__image, img[class*="profile-picture"]', 'src');

            // Current company
            const currentCompany = getText('.pv-text-details__right-panel-item-text, .experience-item__subtitle');

            // Experience
            const experiences = [];
            document.querySelectorAll('#experience ~ div ul li, section[data-section="experience"] li').forEach(exp => {
                const title = exp.querySelector('.t-bold span[aria-hidden="true"]')?.innerText?.trim();
                const company = exp.querySelector('.t-normal span[aria-hidden="true"]')?.innerText?.trim();
                const duration = exp.querySelector('.t-black--light span[aria-hidden="true"]')?.innerText?.trim();
                if (title || company) {
                    experiences.push({ title, company, duration });
                }
            });

            // Education
            const education = [];
            document.querySelectorAll('#education ~ div ul li, section[data-section="education"] li').forEach(edu => {
                const school = edu.querySelector('.t-bold span[aria-hidden="true"]')?.innerText?.trim();
                const degree = edu.querySelector('.t-normal span[aria-hidden="true"]')?.innerText?.trim();
                if (school) {
                    education.push({ school, degree });
                }
            });

            // Skills
            const skills = [];
            document.querySelectorAll('#skills ~ div span.mr1.t-bold span[aria-hidden="true"]').forEach(skill => {
                skills.push(skill.innerText.trim());
            });

            // Contact info (if visible)
            const email = '';
            const phone = '';

            return {
                name,
                headline,
                location,
                about,
                imageUrl,
                currentCompany,
                experiences: experiences.slice(0, 5),
                education: education.slice(0, 3),
                skills: skills.slice(0, 10),
                email,
                phone,
                profileUrl: window.location.href.split('?')[0]
            };
        });

        console.log(`[LinkedIn] Extracted: ${profile.name}`);
        check.session.lastUsed = Date.now();

        return { success: true, profile };

    } catch (error) {
        console.error(`[LinkedIn] Extract error:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Extract multiple profiles from URLs
 */
async function extractProfiles(sessionName, profileUrls, onProgress) {
    const results = [];

    for (let i = 0; i < profileUrls.length; i++) {
        const url = profileUrls[i];

        if (onProgress) {
            onProgress({
                current: i + 1,
                total: profileUrls.length,
                url
            });
        }

        const result = await extractProfile(sessionName, url);
        if (result.success) {
            results.push(result.profile);
        } else {
            results.push({ profileUrl: url, error: result.error });
        }

        // Rate limiting - wait between requests
        if (i < profileUrls.length - 1) {
            await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
        }
    }

    return { success: true, profiles: results, count: results.length };
}

/**
 * Search companies on LinkedIn
 */
async function searchCompanies(sessionName, keywords, limit = 25) {
    const check = await ensureSessionActive(sessionName);
    if (!check.success) {
        return { success: false, error: check.error };
    }

    const page = check.session.page;

    try {
        const searchUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(keywords)}`;
        console.log(`[LinkedIn] Searching companies: ${keywords}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForTimeout(3000);

        const companies = await page.evaluate((maxLimit) => {
            const results = [];
            const cards = document.querySelectorAll('.entity-result, .reusable-search__result-container');

            cards.forEach((card, index) => {
                if (index >= maxLimit) return;

                const nameEl = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]');
                const industryEl = card.querySelector('.entity-result__primary-subtitle');
                const followersEl = card.querySelector('.entity-result__secondary-subtitle');
                const linkEl = card.querySelector('.entity-result__title-text a');
                const imgEl = card.querySelector('img.presence-entity__image');

                if (nameEl) {
                    results.push({
                        name: nameEl.innerText.trim(),
                        industry: industryEl?.innerText.trim() || '',
                        followers: followersEl?.innerText.trim() || '',
                        companyUrl: linkEl?.href?.split('?')[0] || '',
                        logoUrl: imgEl?.src || ''
                    });
                }
            });

            return results;
        }, limit);

        console.log(`[LinkedIn] Found ${companies.length} companies`);
        return { success: true, companies, count: companies.length };

    } catch (error) {
        console.error(`[LinkedIn] Company search error:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Search for jobs on LinkedIn with pagination (extracts all pages)
 */
async function searchJobs(sessionName, options = {}) {
    const check = await ensureSessionActive(sessionName);
    if (!check.success) {
        return { success: false, error: check.error };
    }

    const { keywords, location, jobType, experience, limit = 200, maxPages = 10 } = options;
    const page = check.session.page;
    const allJobs = [];

    try {
        // Build base search URL
        let baseUrl = 'https://www.linkedin.com/jobs/search/?';
        const params = [];

        if (keywords) params.push(`keywords=${encodeURIComponent(keywords)}`);
        if (location) params.push(`location=${encodeURIComponent(location)}`);
        if (jobType) params.push(`f_JT=${encodeURIComponent(jobType)}`);
        if (experience) params.push(`f_E=${encodeURIComponent(experience)}`);

        baseUrl += params.join('&');

        // Extract from multiple pages
        for (let pageNum = 0; pageNum < maxPages; pageNum++) {
            // LinkedIn uses 'start' parameter (0, 25, 50, 75...)
            const startOffset = pageNum * 25;
            const searchUrl = startOffset === 0 ? baseUrl : `${baseUrl}&start=${startOffset}`;

            console.log(`[LinkedIn] Searching jobs page ${pageNum + 1} (start=${startOffset}): ${searchUrl}`);

            try {
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
                await page.waitForTimeout(3000);

                // Scroll to load lazy content
                for (let i = 0; i < 4; i++) {
                    await page.evaluate((y) => window.scrollTo(0, y), (i + 1) * 400);
                    await page.waitForTimeout(800);
                }

                // Extract jobs from this page
                const pageJobs = await page.evaluate(() => {
                    const results = [];
                    const containerSelectors = [
                        '.jobs-search-results__list-item',
                        '.job-card-container',
                        '.jobs-search-two-pane__job-card-container',
                        '[data-job-id]',
                        '.scaffold-layout__list-container li',
                        '.jobs-search-results-list li'
                    ];

                    let cards = [];
                    for (const selector of containerSelectors) {
                        cards = document.querySelectorAll(selector);
                        if (cards.length > 0) break;
                    }

                    cards.forEach((card) => {
                        const titleEl = card.querySelector(
                            '.job-card-list__title, .job-card-container__link, ' +
                            'a[class*="job-card-list__title"], .artdeco-entity-lockup__title'
                        );
                        const companyEl = card.querySelector(
                            '.job-card-container__primary-description, .job-card-container__company-name, ' +
                            '.artdeco-entity-lockup__subtitle'
                        );
                        const locationEl = card.querySelector(
                            '.job-card-container__metadata-item, .artdeco-entity-lockup__caption'
                        );
                        const linkEl = card.querySelector('a[href*="/jobs/view/"], a[href*="/jobs/"]');
                        const salaryEl = card.querySelector('.job-card-container__metadata-item--salary, [class*="salary"]');
                        const postedEl = card.querySelector('time, .job-card-container__listed-time');
                        const logoEl = card.querySelector('img.artdeco-entity-image, img[class*="entity-image"]');

                        const title = titleEl?.innerText?.trim() || titleEl?.querySelector('span')?.innerText?.trim();

                        if (title && title.length > 0) {
                            results.push({
                                title,
                                company: companyEl?.innerText?.trim() || '',
                                location: locationEl?.innerText?.trim() || '',
                                salary: salaryEl?.innerText?.trim() || '',
                                posted: postedEl?.innerText?.trim() || postedEl?.getAttribute('datetime') || '',
                                jobUrl: linkEl?.href?.split('?')[0] || '',
                                logoUrl: logoEl?.src || ''
                            });
                        }
                    });

                    return results;
                });

                console.log(`[LinkedIn] Page ${pageNum + 1}: Found ${pageJobs.length} jobs`);

                // Check for no results (end of data)
                if (pageJobs.length === 0) {
                    console.log(`[LinkedIn] No more job results on page ${pageNum + 1}, stopping pagination`);
                    break;
                }

                allJobs.push(...pageJobs);

                // Check if we've reached the limit
                if (allJobs.length >= limit) {
                    console.log(`[LinkedIn] Reached requested limit of ${limit}`);
                    break;
                }

                // Wait between pages to avoid rate limiting
                if (pageNum < maxPages - 1) {
                    await page.waitForTimeout(1500);
                }

            } catch (pageError) {
                console.error(`[LinkedIn] Error on jobs page ${pageNum + 1}:`, pageError.message);
                break;
            }
        }

        check.session.lastUsed = Date.now();
        console.log(`[LinkedIn] Total jobs extracted: ${allJobs.length}`);

        return {
            success: true,
            jobs: allJobs.slice(0, limit),
            count: Math.min(allJobs.length, limit),
            pagesScanned: Math.min(maxPages, Math.ceil(allJobs.length / 25))
        };

    } catch (error) {
        console.error(`[LinkedIn] Job search error:`, error.message);
        return { success: false, error: error.message, jobs: allJobs, count: allJobs.length };
    }
}

/**
 * Extract detailed job information
 */
async function extractJob(sessionName, jobUrl) {
    const check = await ensureSessionActive(sessionName);
    if (!check.success) {
        return { success: false, error: check.error };
    }

    const page = check.session.page;

    try {
        console.log(`[LinkedIn] Extracting job: ${jobUrl}`);
        await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await page.waitForTimeout(3000);

        const job = await page.evaluate(() => {
            const getText = (selector) => document.querySelector(selector)?.innerText?.trim() || '';

            const title = getText('h1.t-24, h1.jobs-unified-top-card__job-title, h1[class*="top-card-layout__title"]');
            const company = getText('.jobs-unified-top-card__company-name, .topcard__org-name-link, a[class*="topcard__org-name-link"]');
            const location = getText('.jobs-unified-top-card__bullet, .topcard__flavor--bullet');
            const workplace = getText('.jobs-unified-top-card__workplace-type');
            const posted = getText('.jobs-unified-top-card__posted-date, time');
            const applicants = getText('.jobs-unified-top-card__applicant-count');

            // Job details
            const description = getText('.jobs-description__content, .description__text, article[class*="jobs-description"]');
            const criteria = [];
            document.querySelectorAll('.jobs-unified-top-card__job-insight, li.jobs-unified-top-card__job-insight').forEach(el => {
                criteria.push(el.innerText.trim());
            });

            // Salary if available
            const salary = getText('.salary-main-rail__current-salary, .compensation__salary');

            return {
                title,
                company,
                location,
                workplace,
                posted,
                applicants,
                description: description.substring(0, 2000),
                criteria,
                salary,
                jobUrl: window.location.href.split('?')[0]
            };
        });

        console.log(`[LinkedIn] Extracted job: ${job.title} at ${job.company}`);
        check.session.lastUsed = Date.now();

        return { success: true, job };

    } catch (error) {
        console.error(`[LinkedIn] Job extract error:`, error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    getAvailableSessions,
    initSession,
    closeSession,
    confirmLogin,
    getSessionStatus,
    ensureSessionActive,
    searchPeople,
    extractProfile,
    extractProfiles,
    searchCompanies,
    searchJobs,
    extractJob
};
