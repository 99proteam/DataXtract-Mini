/**
 * SMS Service - Twilio Integration
 * Handles SMS campaign sending via Twilio
 */

const fs = require('fs');
const path = require('path');
const { marketingOps } = require('../config/database');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading settings:', e);
    }
    return null;
}

function getConfigurationError() {
    const settings = loadSettings();
    if (!settings?.twilio?.enabled) return 'Twilio is not enabled in Settings';
    if (!settings.twilio.accountSid || !settings.twilio.authToken) return 'Twilio credentials are not configured in Settings';
    if (!settings.twilio.fromNumber) return 'Twilio sender phone number is not configured in Settings';
    return null;
}

/**
 * Send SMS via Twilio
 * @param {string} to - Phone number to send to
 * @param {string} message - Message content
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
async function sendSMS(to, message) {
    const configurationError = getConfigurationError();
    if (configurationError) return { success: false, error: configurationError };
    const settings = loadSettings();

    try {
        // Dynamic require to avoid issues if twilio not installed
        const twilio = require('twilio');
        const client = twilio(settings.twilio.accountSid, settings.twilio.authToken);

        const result = await client.messages.create({
            body: message,
            from: settings.twilio.fromNumber,
            to: to
        });

        return { success: true, sid: result.sid };
    } catch (error) {
        console.error('Twilio SMS error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send bulk SMS campaign
 * @param {Array<{phone: string, name?: string}>} recipients - List of recipients
 * @param {string} messageTemplate - Message template with {{name}} placeholders
 * @param {function} onProgress - Progress callback
 * @returns {Promise<{sent: number, failed: number, results: Array}>}
 */
async function sendBulkSMS(recipients, messageTemplate, options = {}, onProgress = null) {
    // Handle arguments: if 3rd arg is function, it's onProgress (legacy/overload fix)
    if (typeof options === 'function') {
        onProgress = options;
        options = {};
    }

    // Initialize Campaign Log
    let campaignId = null;
    try {
        const result = marketingOps.createCampaign.run(
            'sms',
            options.name || `SMS Campaign - ${new Date().toLocaleString()}`,
            JSON.stringify(options),
            recipients.length
        );
        campaignId = result.lastInsertRowid;
    } catch (e) {
        console.error('Failed to create campaign log:', e.message);
    }

    const results = [];
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        // Replace template variables
        let message = messageTemplate;
        if (recipient.name) {
            message = message.replace(/\{\{name\}\}/gi, recipient.name);
        }
        message = message.replace(/\{\{phone\}\}/gi, recipient.phone);

        const result = await sendSMS(recipient.phone, message);

        // Log individual result
        if (campaignId) {
            try {
                marketingOps.logResult.run(
                    campaignId,
                    recipient.phone,
                    result.success ? 'sent' : 'failed',
                    result.sid || null,
                    result.error || null
                );
            } catch (e) {
                // Silent fail for log
            }
        }

        if (result.success) {
            sent++;
            results.push({ ...recipient, status: 'sent', sid: result.sid });
        } else {
            failed++;
            results.push({ ...recipient, status: 'failed', error: result.error });
        }

        // Progress callback
        if (onProgress && typeof onProgress === 'function') {
            onProgress({
                current: i + 1,
                total: recipients.length,
                sent,
                failed,
                lastResult: results[results.length - 1]
            });
        }

        // Rate limiting - wait 100ms between messages (or use options.delay)
        const delay = options.delay ? options.delay * 1000 : 100;
        if (i < recipients.length - 1) {
            await new Promise(r => setTimeout(r, delay));
        }
    }

    // Finalize Campaign Stats
    if (campaignId) {
        try {
            marketingOps.updateCampaignStats.run(
                sent,
                failed,
                'completed',
                campaignId
            );
        } catch (e) {
            console.error('Failed to update campaign stats:', e.message);
        }
    }

    return { sent, failed, results, campaignId };
}

/**
 * Test Twilio connection
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function testConnection() {
    const settings = loadSettings();

    if (!settings?.twilio?.accountSid || !settings?.twilio?.authToken) {
        return { success: false, message: 'Twilio credentials not configured' };
    }

    try {
        const twilio = require('twilio');
        const client = twilio(settings.twilio.accountSid, settings.twilio.authToken);

        // Verify credentials by fetching account info
        const account = await client.api.accounts(settings.twilio.accountSid).fetch();

        return {
            success: true,
            message: `Connected as: ${account.friendlyName}`
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    sendSMS,
    sendBulkSMS,
    testConnection,
    getConfigurationError
};
