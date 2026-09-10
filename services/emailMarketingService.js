/**
 * Email Marketing Service
 * Handles email campaign sending via SMTP/Nodemailer
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
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
    if (!settings?.smtp?.enabled) return 'Email sending is not enabled in Settings';
    if (!settings.smtp.host) return 'SMTP host is not configured in Settings';
    if (!settings.smtp.user || !settings.smtp.pass) return 'SMTP username/password are not configured in Settings';
    return null;
}

/**
 * Create email transporter from settings
 */
function createTransporter() {
    const settings = loadSettings();

    if (!settings?.smtp?.host) {
        throw new Error('SMTP not configured');
    }

    // Port 465 requires SSL from the start (secure: true)
    // Port 587 or 25 use STARTTLS (secure: false)
    const port = parseInt(settings.smtp.port) || 587;
    const isSecure = port === 465;

    return nodemailer.createTransport({
        host: settings.smtp.host,
        port: port,
        secure: isSecure, // true for 465, false for other ports
        auth: {
            user: settings.smtp.user,
            pass: settings.smtp.pass
        },
        tls: {
            rejectUnauthorized: false // Allow self-signed certs
        }
    });
}

/**
 * Send single email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail({ to, subject, html, text }) {
    const configurationError = getConfigurationError();
    if (configurationError) return { success: false, error: configurationError };
    const settings = loadSettings();

    try {
        const transporter = createTransporter();

        const result = await transporter.sendMail({
            from: settings.smtp.user,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '')
        });

        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send bulk email campaign
 * @param {Array<{email: string, name?: string}>} recipients - List of recipients
 * @param {Object} template - Email template
 * @param {string} template.subject - Subject line with {{name}} placeholders
 * @param {string} template.html - HTML content with {{name}}, {{email}} placeholders
 * @param {function} onProgress - Progress callback
 * @returns {Promise<{sent: number, failed: number, results: Array}>}
 */
async function sendBulkEmail(recipients, template, options = {}, onProgress = null) {
    // Handle arguments: if 3rd arg is function, it's onProgress (legacy/overload fix)
    if (typeof options === 'function') {
        onProgress = options;
        options = {};
    }

    // Initialize Campaign Log
    let campaignId = null;
    try {
        const result = marketingOps.createCampaign.run(
            'email',
            options.name || template.subject || `Email Campaign - ${new Date().toLocaleString()}`,
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
        let subject = template.subject || 'No Subject';
        let html = template.html || '';

        const replacements = {
            '{{name}}': recipient.name || 'Valued Customer',
            '{{email}}': recipient.email,
            '{{company}}': recipient.company || '',
            '{{phone}}': recipient.phone || ''
        };

        Object.entries(replacements).forEach(([key, value]) => {
            subject = subject.replace(new RegExp(key, 'gi'), value);
            html = html.replace(new RegExp(key, 'gi'), value);
        });

        const result = await sendEmail({
            to: recipient.email,
            subject,
            html
        });

        // Log individual result
        if (campaignId) {
            try {
                marketingOps.logResult.run(
                    campaignId,
                    recipient.email,
                    result.success ? 'sent' : 'failed',
                    result.messageId || null,
                    result.error || null
                );
            } catch (e) {
                // Silent fail for log
            }
        }

        if (result.success) {
            sent++;
            results.push({ ...recipient, status: 'sent', messageId: result.messageId });
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

        // Rate limiting - wait 500ms between emails or use options.rateLimit (delay)
        if (i < recipients.length - 1) {
            // Default 500ms, or parse rateLimit from options (if provided/handled elsewhere, currently simple delay)
            await new Promise(r => setTimeout(r, 500));
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
 * Test SMTP connection
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function testConnection() {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        return { success: true, message: 'SMTP connection successful' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Generate HTML email from template
 * @param {string} content - Main content
 * @param {Object} options - Template options
 * @returns {string} - Complete HTML email
 */
function generateEmailHTML(content, options = {}) {
    const {
        headerColor = '#6366f1',
        footerText = 'Sent via Data Extractor',
        companyName = 'Your Company'
    } = options;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: ${headerColor}; color: white; padding: 24px; text-align: center; }
        .content { padding: 32px 24px; line-height: 1.6; color: #374151; }
        .footer { background: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #6b7280; }
        a { color: ${headerColor}; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin:0; font-size:24px;">${companyName}</h1>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            ${footerText}<br>
            <a href="{{unsubscribe_url}}">Unsubscribe</a>
        </div>
    </div>
</body>
</html>`;
}

module.exports = {
    sendEmail,
    sendBulkEmail,
    testConnection,
    generateEmailHTML,
    getConfigurationError
};
