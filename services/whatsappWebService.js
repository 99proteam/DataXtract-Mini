/**
 * WhatsApp Web Automation Service
 * Uses Puppeteer to automate WhatsApp Web for bulk messaging
 * Supports multiple sessions with rotation
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Session storage directory
const SESSIONS_DIR = path.join(__dirname, '..', 'data', 'whatsapp-sessions');

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Active browser instances
const activeSessions = new Map();

/**
 * Get list of available sessions
 */
function getAvailableSessions() {
    if (!fs.existsSync(SESSIONS_DIR)) return [];

    const sessions = [];
    const dirs = fs.readdirSync(SESSIONS_DIR);

    for (const dir of dirs) {
        const sessionPath = path.join(SESSIONS_DIR, dir);
        const stat = fs.statSync(sessionPath);
        if (stat.isDirectory()) {
            sessions.push({
                name: dir,
                active: activeSessions.has(dir),
                path: sessionPath
            });
        }
    }

    return sessions;
}

/**
 * Initialize a WhatsApp Web session
 * Returns QR code data URL if login required
 */
async function initSession(sessionName, onQRCode) {
    const sessionPath = path.join(SESSIONS_DIR, sessionName);

    // Check if session already active
    if (activeSessions.has(sessionName)) {
        const session = activeSessions.get(sessionName);
        return { success: true, message: 'Session already active', loggedIn: session.loggedIn };
    }

    // Ensure session directory exists
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    // Check if session folder has data (existing login)
    const hasExistingSession = fs.readdirSync(sessionPath).length > 10;

    try {
        console.log(`[WhatsApp] Initializing session "${sessionName}"${hasExistingSession ? ' (existing data found)' : ''}...`);

        // Launch browser with persistent session
        const browser = await puppeteer.launch({
            headless: false, // Show browser for QR scan
            userDataDir: sessionPath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to WhatsApp Web
        await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for either QR code or logged in state
        let loggedIn = false;
        let qrCode = null;

        // Use longer timeout if existing session (WhatsApp loads saved session)
        const loginTimeout = hasExistingSession ? 30000 : 10000;

        try {
            // Check if already logged in using multiple possible selectors
            console.log(`[WhatsApp] Waiting for login (${loginTimeout / 1000}s timeout)...`);

            // Try multiple selectors that indicate logged-in state
            const loginSelectors = [
                '[data-testid="chat-list"]',
                '[data-testid="chatlist"]',
                '#pane-side',
                '[data-testid="conversation-panel-wrapper"]',
                '[aria-label="Chat list"]',
                '.two > div'  // Main app container with side panel
            ];

            await page.waitForFunction(
                (selectors) => selectors.some(s => document.querySelector(s)),
                { timeout: loginTimeout },
                loginSelectors
            );
            loggedIn = true;
            console.log(`[WhatsApp] Session "${sessionName}" logged in successfully!`);
        } catch (e) {
            // Not logged in, try to get QR code
            console.log(`[WhatsApp] Not logged in, looking for QR code...`);
            try {
                await page.waitForSelector('canvas[aria-label="Scan me!"]', { timeout: 15000 });

                // Capture QR code as image
                const qrCanvas = await page.$('canvas[aria-label="Scan me!"]');
                if (qrCanvas) {
                    qrCode = await qrCanvas.screenshot({ encoding: 'base64' });
                    qrCode = `data:image/png;base64,${qrCode}`;
                    console.log(`[WhatsApp] QR code captured for "${sessionName}"`);

                    if (onQRCode) onQRCode(qrCode);
                }

                // Wait for login after QR scan (up to 2 minutes)
                console.log(`[WhatsApp] Waiting for QR scan (2 min timeout)...`);
                await page.waitForSelector('[data-testid="chat-list"]', { timeout: 120000 });
                loggedIn = true;
                console.log(`[WhatsApp] Session "${sessionName}" logged in after QR scan!`);
            } catch (qrError) {
                console.error(`[WhatsApp] QR/login error for "${sessionName}":`, qrError.message);
            }
        }

        // Store session
        activeSessions.set(sessionName, {
            browser,
            page,
            loggedIn,
            lastUsed: Date.now()
        });

        console.log(`[WhatsApp] Session "${sessionName}" stored. loggedIn: ${loggedIn}`);

        return {
            success: true,
            loggedIn,
            qrCode,
            message: loggedIn ? 'Logged in successfully' : 'Waiting for QR scan or login failed'
        };

    } catch (error) {
        console.error('[WhatsApp] Session init error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Close a session
 */
async function closeSession(sessionName) {
    if (activeSessions.has(sessionName)) {
        const session = activeSessions.get(sessionName);
        try {
            await session.browser.close();
        } catch (e) {
            console.error('Error closing browser:', e);
        }
        activeSessions.delete(sessionName);
        return { success: true };
    }
    return { success: false, error: 'Session not found' };
}

/**
 * Ensure a session is active and logged in
 * If session exists but not logged in, try to re-verify login status
 * Handles disconnected browsers and refreshes page if needed
 */
async function ensureSessionActive(sessionName) {
    let session = activeSessions.get(sessionName);

    // If no session in memory, try to init it
    if (!session) {
        console.log(`[WhatsApp] Session ${sessionName} not in memory, initializing...`);
        const result = await initSession(sessionName);
        if (!result.success) {
            return { success: false, error: result.error || 'Failed to init session' };
        }
        session = activeSessions.get(sessionName);
    }

    // Check if browser/page is still connected
    if (session && session.page) {
        try {
            // Check if page is still connected by trying to get the URL
            const url = await session.page.url();
            console.log(`[WhatsApp] Session ${sessionName} page URL: ${url}`);
        } catch (e) {
            console.log(`[WhatsApp] Session ${sessionName} browser disconnected, reinitializing...`);
            // Browser disconnected, remove session and reinit
            activeSessions.delete(sessionName);
            const result = await initSession(sessionName);
            if (!result.success) {
                return { success: false, error: 'Browser disconnected. Please reinitialize session.' };
            }
            session = activeSessions.get(sessionName);
        }
    }

    // If session exists but not logged in, try to re-check login status
    if (session && !session.loggedIn && session.page) {
        console.log(`[WhatsApp] Session ${sessionName} not logged in, navigating and re-checking...`);
        try {
            // Navigate to WhatsApp main page (in case page is on a different URL)
            const currentUrl = await session.page.url();
            if (!currentUrl.includes('web.whatsapp.com')) {
                await session.page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 30000 });
            }

            // Try multiple selectors that indicate logged-in state
            const loginSelectors = [
                '[data-testid="chat-list"]',
                '[data-testid="chatlist"]',
                '#pane-side',
                '[data-testid="conversation-panel-wrapper"]',
                '[aria-label="Chat list"]',
                '.two > div'
            ];

            await session.page.waitForFunction(
                (selectors) => selectors.some(s => document.querySelector(s)),
                { timeout: 20000 },
                loginSelectors
            );
            // If we get here, we're logged in!
            session.loggedIn = true;
            activeSessions.set(sessionName, session);
            console.log(`[WhatsApp] Session ${sessionName} is now logged in!`);
        } catch (e) {
            console.log(`[WhatsApp] Session ${sessionName} still not logged in: ${e.message}`);
            return { success: false, error: 'Session not logged in. Please scan QR code in the browser window.' };
        }
    }

    // Also verify existing "logged in" sessions still work
    if (session && session.loggedIn && session.page) {
        try {
            // Quick verify - can we access the page?
            const currentUrl = await session.page.url();
            if (!currentUrl.includes('web.whatsapp.com')) {
                await session.page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 30000 });
            }
        } catch (e) {
            console.log(`[WhatsApp] Session ${sessionName} verification failed, reinitializing...`);
            activeSessions.delete(sessionName);
            return { success: false, error: 'Session expired. Please reinitialize.' };
        }
    }

    if (!session || !session.loggedIn) {
        return { success: false, error: 'Session not active or not logged in' };
    }

    return { success: true, session };
}



/**
 * Check if a phone number exists on WhatsApp
 */
async function checkNumberExists(sessionName, phone) {
    const check = await ensureSessionActive(sessionName);
    if (!check.success) {
        return { exists: false, error: check.error };
    }

    const page = check.session.page;

    try {
        // Format phone number
        const formattedPhone = phone.replace(/[^0-9]/g, '');
        console.log(`[WhatsApp] Checking if ${formattedPhone} has WhatsApp...`);

        // Navigate to chat with number
        await page.goto(`https://web.whatsapp.com/send?phone=${formattedPhone}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait for page to load
        await page.waitForTimeout(4000);

        // Check for various error indicators
        const pageContent = await page.content();

        // Check for error popup or invalid number messages
        if (pageContent.includes('Phone number shared via url is invalid') ||
            pageContent.includes('invalid phone number') ||
            pageContent.includes('not on WhatsApp')) {
            console.log(`[WhatsApp] ${formattedPhone} - No WhatsApp (invalid/not registered)`);
            return { exists: false, phone: formattedPhone, reason: 'invalid' };
        }

        // Check for popup with error
        const errorPopup = await page.$('div[data-testid="popup-contents"], div[role="dialog"]');
        if (errorPopup) {
            const text = await page.evaluate(el => el.textContent.toLowerCase(), errorPopup);
            if (text.includes('invalid') || text.includes('not registered') || text.includes('shared via url')) {
                console.log(`[WhatsApp] ${formattedPhone} - No WhatsApp (popup error)`);
                return { exists: false, phone: formattedPhone, reason: 'invalid' };
            }
        }

        // Try multiple selectors to detect if chat loaded (user exists)
        const chatSelectors = [
            '[data-testid="conversation-compose-box-input"]',
            'div[contenteditable="true"][data-tab="10"]',
            'footer div[contenteditable="true"]',
            '#main footer div[contenteditable="true"]',
            '[data-testid="compose-box"]',
            '[data-testid="conversation-panel-wrapper"]',
            '#main [data-testid="msg-container"]'
        ];

        for (const selector of chatSelectors) {
            const element = await page.$(selector);
            if (element) {
                console.log(`[WhatsApp] ${formattedPhone} - Has WhatsApp! (found: ${selector})`);
                return { exists: true, phone: formattedPhone };
            }
        }

        // Wait a bit more and try again
        await page.waitForTimeout(2000);

        for (const selector of chatSelectors) {
            const element = await page.$(selector);
            if (element) {
                console.log(`[WhatsApp] ${formattedPhone} - Has WhatsApp! (found after wait: ${selector})`);
                return { exists: true, phone: formattedPhone };
            }
        }

        // If we're still on a loading state or something, check URL
        const currentUrl = await page.url();
        if (currentUrl.includes('/send?phone=') && !currentUrl.includes('error')) {
            // URL suggests we might have a valid chat, give it one more check
            await page.waitForTimeout(2000);
            const hasMainPanel = await page.$('#main');
            if (hasMainPanel) {
                console.log(`[WhatsApp] ${formattedPhone} - Likely has WhatsApp (main panel exists)`);
                return { exists: true, phone: formattedPhone };
            }
        }

        console.log(`[WhatsApp] ${formattedPhone} - No chat input found, assuming no WhatsApp`);
        return { exists: false, phone: formattedPhone, reason: 'no_input_found' };

    } catch (error) {
        console.error(`[WhatsApp] Check error for ${phone}:`, error.message);
        return { exists: false, error: error.message };
    }
}

/**
 * Send a message to a phone number
 */
async function sendMessage(sessionName, phone, message) {
    const check = await ensureSessionActive(sessionName);
    if (!check.success) {
        return { success: false, error: check.error };
    }

    const session = check.session;
    const page = session.page;

    try {
        // Format phone number
        const formattedPhone = phone.replace(/[^0-9]/g, '');
        console.log(`[WhatsApp] Sending message to ${formattedPhone}...`);

        // Navigate to chat
        const url = `https://web.whatsapp.com/send?phone=${formattedPhone}`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for message input with multiple selectors
        const inputSelectors = [
            '[data-testid="conversation-compose-box-input"]',
            'div[contenteditable="true"][data-tab="10"]',
            'footer div[contenteditable="true"]',
            '#main footer div[contenteditable="true"]'
        ];

        let messageInput = null;
        for (const selector of inputSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 10000 });
                messageInput = await page.$(selector);
                if (messageInput) {
                    console.log(`[WhatsApp] Found input with selector: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!messageInput) {
            return { success: false, error: 'Message input not found. Number may not have WhatsApp.' };
        }

        // Wait a bit for page to fully load
        await page.waitForTimeout(1500);

        // Click on input to focus it
        await messageInput.click();
        await page.waitForTimeout(500);

        // Type the message
        await page.keyboard.type(message, { delay: 30 });
        await page.waitForTimeout(500);

        // Press Enter to send
        await page.keyboard.press('Enter');
        console.log(`[WhatsApp] Message sent to ${formattedPhone}`);

        // Wait for message to be sent
        await page.waitForTimeout(2000);

        session.lastUsed = Date.now();

        return { success: true, phone: formattedPhone };

    } catch (error) {
        console.error(`[WhatsApp] Send error:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send bulk messages with session rotation
 */
async function sendBulkMessages(recipients, messageTemplate, options = {}) {
    const {
        sessionRotation = true,
        delayBetweenMessages = 5000, // 5 seconds default
        onProgress = null
    } = options;

    // Get active sessions
    let sessions = Array.from(activeSessions.entries())
        .filter(([name, session]) => session.loggedIn)
        .map(([name]) => name);

    // If no active sessions, try to init saved sessions
    if (sessions.length === 0) {
        const savedSessions = getAvailableSessions();
        if (savedSessions.length > 0) {
            console.log('[WhatsApp] No active sessions, initializing saved sessions...');
            for (const saved of savedSessions) {
                try {
                    await initSession(saved.name);
                } catch (e) {
                    console.error(`[WhatsApp] Failed to init ${saved.name}:`, e.message);
                }
            }
            // Re-check active sessions after init
            sessions = Array.from(activeSessions.entries())
                .filter(([name, session]) => session.loggedIn)
                .map(([name]) => name);
        }
    }

    if (sessions.length === 0) {
        return { success: false, error: 'No WhatsApp sessions available. Please add and scan QR for at least one session.' };
    }

    const results = [];
    let sessionIndex = 0;

    for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        const phone = recipient.phone || recipient;
        const name = recipient.name || '';

        // Replace template placeholders
        let message = messageTemplate
            .replace(/\{\{name\}\}/gi, name)
            .replace(/\{\{phone\}\}/gi, phone);

        // Get current session (rotate if enabled)
        const currentSession = sessions[sessionIndex];

        // Send message
        const result = await sendMessage(currentSession, phone, message);
        results.push({
            phone,
            name,
            session: currentSession,
            ...result
        });

        // Progress callback
        if (onProgress) {
            onProgress({
                current: i + 1,
                total: recipients.length,
                lastResult: result,
                session: currentSession
            });
        }

        // Rotate session
        if (sessionRotation && sessions.length > 1) {
            sessionIndex = (sessionIndex + 1) % sessions.length;
        }

        // Delay between messages
        if (i < recipients.length - 1 && delayBetweenMessages > 0) {
            await new Promise(r => setTimeout(r, delayBetweenMessages));
        }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return { success: true, sent, failed, results };
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
 * Extract phone numbers from a WhatsApp group
 */
async function extractGroupMembers(sessionName, groupName) {
    const check = await ensureSessionActive(sessionName);
    if (!check.success) {
        return { success: false, error: check.error };
    }

    const session = check.session;
    const page = session.page;

    try {
        // Navigate to main WhatsApp page
        await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for chat list with multiple fallback selectors
        const chatListSelectors = [
            '[data-testid="chat-list"]',
            '[data-testid="chatlist"]',
            '#pane-side',
            '[aria-label="Chat list"]',
            '.two > div',
            '[data-testid="conversation-panel-wrapper"]'
        ];
        await page.waitForFunction(
            (selectors) => selectors.some(s => document.querySelector(s)),
            { timeout: 20000 },
            chatListSelectors
        );

        // Search for the group
        const searchBox = await page.waitForSelector('[data-testid="chat-list-search"]', { timeout: 10000 });
        await searchBox.click();
        await page.keyboard.type(groupName, { delay: 50 });
        await page.waitForTimeout(2000);

        // Click on the first result
        const firstResult = await page.$('[data-testid="cell-frame-container"]');
        if (!firstResult) {
            return { success: false, error: 'Group not found' };
        }
        await firstResult.click();
        await page.waitForTimeout(2000);

        // Click on group header to open group info
        const groupHeader = await page.$('[data-testid="conversation-header"]');
        if (groupHeader) {
            await groupHeader.click();
            await page.waitForTimeout(2000);
        }

        // Extract members from the group info panel
        const members = await page.evaluate(() => {
            const memberElements = document.querySelectorAll('[data-testid="group-info-participants-item"]');
            const phones = [];

            memberElements.forEach(el => {
                // Try to get phone number from various places
                const text = el.textContent || '';
                const phoneMatch = text.match(/(\+?\d{10,15})/);
                if (phoneMatch) {
                    phones.push(phoneMatch[1]);
                }
            });

            return phones;
        });

        // Close side panel
        await page.keyboard.press('Escape');

        return {
            success: true,
            groupName,
            memberCount: members.length,
            members
        };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Join multiple WhatsApp groups via invite links
 */
async function joinGroups(sessionName, inviteLinks, options = {}) {
    const { delayBetweenJoins = 3000, onProgress = null } = options;

    const check = await ensureSessionActive(sessionName);
    if (!check.success) {
        return { success: false, error: check.error };
    }

    const session = check.session;
    const page = session.page;
    const results = [];

    for (let i = 0; i < inviteLinks.length; i++) {
        const link = inviteLinks[i].trim();

        // Validate link format
        if (!link.includes('chat.whatsapp.com')) {
            results.push({ link, success: false, error: 'Invalid WhatsApp invite link' });
            continue;
        }

        try {
            console.log(`[WhatsApp] Attempting to join group: ${link}`);

            // Navigate to invite link
            await page.goto(link, { waitUntil: 'networkidle2', timeout: 30000 });
            await page.waitForTimeout(3000);

            // Check page content first
            const pageContent = await page.content();

            // Check if already a member
            if (pageContent.includes('already a participant') || pageContent.includes('You\'re already a member')) {
                console.log(`[WhatsApp] Already a member of group from link: ${link}`);
                results.push({ link, success: true, message: 'Already a member' });
                continue;
            }

            // Look for "Join Group" button with multiple selectors
            const joinButtonSelectors = [
                '[data-testid="invite-join"]',
                'div[role="button"]:has-text("Join group")',
                'span:has-text("Join group")',
                'button:has-text("Join")',
                '.landing-main button',
                '[data-testid="popup-controls-ok"]'
            ];

            let joinButton = null;
            for (const selector of joinButtonSelectors) {
                try {
                    joinButton = await page.$(selector);
                    if (joinButton) {
                        console.log(`[WhatsApp] Found join button with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            // Also try finding by text content
            if (!joinButton) {
                joinButton = await page.evaluateHandle(() => {
                    const buttons = [...document.querySelectorAll('button, div[role="button"], span')];
                    return buttons.find(b => b.textContent?.toLowerCase().includes('join'));
                });
                if (joinButton && !joinButton.asElement()) {
                    joinButton = null;
                }
            }

            if (joinButton) {
                await joinButton.click();
                console.log(`[WhatsApp] Clicked join button for: ${link}`);
                await page.waitForTimeout(4000);

                // Check if we joined successfully by looking for chat list or main area
                const successIndicators = await page.$('[data-testid="chat-list"], #pane-side, [data-testid="conversation-panel-wrapper"]');
                if (successIndicators) {
                    console.log(`[WhatsApp] Successfully joined group: ${link}`);
                    results.push({ link, success: true });
                } else {
                    results.push({ link, success: false, error: 'Join may have failed - chat list not found' });
                }
            } else {
                // Check for various error states
                if (pageContent.includes('invite link was reset') || pageContent.includes('invalid')) {
                    results.push({ link, success: false, error: 'Invalid or expired invite link' });
                } else {
                    results.push({ link, success: false, error: 'Join button not found on page' });
                }
            }

        } catch (error) {
            console.error(`[WhatsApp] Join error for ${link}:`, error.message);
            results.push({ link, success: false, error: error.message });
        }

        // Progress callback
        if (onProgress) {
            onProgress({
                current: i + 1,
                total: inviteLinks.length,
                lastResult: results[results.length - 1]
            });
        }

        // Delay between joins
        if (i < inviteLinks.length - 1 && delayBetweenJoins > 0) {
            await new Promise(r => setTimeout(r, delayBetweenJoins));
        }
    }

    const joined = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return { success: true, joined, failed, results };
}

/**
 * Ensure at least one session is active, init from saved if needed
 */
async function ensureActiveSession() {
    // Check if any session is already active
    const activeCount = Array.from(activeSessions.values()).filter(s => s.loggedIn).length;
    if (activeCount > 0) return true;

    // Try to init first saved session
    const sessions = getAvailableSessions();
    if (sessions.length > 0) {
        await initSession(sessions[0].name);
        return activeSessions.size > 0;
    }

    return false;
}

/**
 * List all WhatsApp groups for the session
 */
async function listGroups(sessionName) {
    const check = await ensureSessionActive(sessionName);
    if (!check.success) {
        return { success: false, error: check.error };
    }

    const session = check.session;
    const page = session.page;

    try {
        // Navigate to main WhatsApp page
        await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for chat list with multiple fallback selectors
        const chatListSelectors = [
            '[data-testid="chat-list"]',
            '[data-testid="chatlist"]',
            '#pane-side',
            '[aria-label="Chat list"]',
            '.two > div',
            '[data-testid="conversation-panel-wrapper"]'
        ];
        await page.waitForFunction(
            (selectors) => selectors.some(s => document.querySelector(s)),
            { timeout: 20000 },
            chatListSelectors
        );

        // Scroll through chat list to load all chats
        const paneSelector = '#pane-side';
        for (let i = 0; i < 5; i++) {
            await page.evaluate((sel) => {
                const pane = document.querySelector(sel);
                if (pane) pane.scrollTop += 500;
            }, paneSelector);
            await page.waitForTimeout(500);
        }

        // Scroll back to top
        await page.evaluate((sel) => {
            const pane = document.querySelector(sel);
            if (pane) pane.scrollTop = 0;
        }, paneSelector);
        await page.waitForTimeout(500);

        // Extract all groups from chat list with improved detection
        const groups = await page.evaluate(() => {
            const chatItems = document.querySelectorAll('[data-testid="cell-frame-container"], [role="listitem"], div[tabindex="-1"]');
            const groupList = [];
            const seenNames = new Set();

            chatItems.forEach(item => {
                // Get the chat title
                const titleEl = item.querySelector('[data-testid="cell-frame-title"]') ||
                    item.querySelector('span[dir="auto"][title]') ||
                    item.querySelector('span._ao3e');

                if (titleEl) {
                    const name = titleEl.textContent?.trim() || titleEl.getAttribute('title') || '';

                    if (name && !seenNames.has(name)) {
                        // Check if it's a group using multiple indicators
                        const hasGroupIcon = item.querySelector('[data-icon="default-group"]') ||
                            item.querySelector('[data-icon="community"]') ||
                            item.querySelector('[data-icon="status-image"]');

                        // Check subtitle for group indicators
                        const subtitleEl = item.querySelector('[data-testid="last-msg-status"]') ||
                            item.querySelector('span[dir="auto"]:nth-child(2)');
                        const subtitle = subtitleEl?.textContent?.toLowerCase() || '';

                        const hasGroupIndicators = subtitle.includes('members') ||
                            subtitle.includes(':') ||  // Group messages often show "Name: message"
                            subtitle.includes('~') ||
                            subtitle.includes('you:') ||
                            name.includes('📢') ||
                            name.includes('👥') ||
                            name.includes('🏢');

                        // If has group icon or group indicators, it's likely a group
                        if (hasGroupIcon || hasGroupIndicators) {
                            seenNames.add(name);
                            groupList.push({
                                name: name,
                                memberCount: null
                            });
                        }
                    }
                }
            });

            return groupList;
        });

        console.log(`[WhatsApp] Found ${groups.length} groups for session ${sessionName}`);

        return {
            success: true,
            groups,
            count: groups.length
        };

    } catch (error) {
        console.error(`[WhatsApp] listGroups error:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a WhatsApp session completely (data folder)
 */
async function deleteSession(sessionName) {
    const sessionPath = path.join(SESSIONS_DIR, sessionName);

    // Close session if active
    if (activeSessions.has(sessionName)) {
        try {
            const session = activeSessions.get(sessionName);
            await session.browser.close();
        } catch (e) {
            // Ignore close errors
        }
        activeSessions.delete(sessionName);
    }

    // Delete session folder
    if (fs.existsSync(sessionPath)) {
        try {
            // Recursively delete directory
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`[WhatsApp] Deleted session "${sessionName}" data`);
            return { success: true, message: `Session "${sessionName}" deleted` };
        } catch (e) {
            console.error(`[WhatsApp] Error deleting session folder:`, e.message);
            return { success: false, error: e.message };
        }
    }

    return { success: true, message: 'Session folder not found, but removed from memory' };
}

module.exports = {
    getAvailableSessions,
    initSession,
    closeSession,
    deleteSession,
    checkNumberExists,
    sendMessage,
    sendBulkMessages,
    getSessionStatus,
    extractGroupMembers,
    joinGroups,
    ensureSessionActive,
    listGroups
};
