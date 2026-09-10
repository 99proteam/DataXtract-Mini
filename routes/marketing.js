/**
 * Marketing Routes - SMS and Email Campaign Sending
 */

const express = require('express');
const router = express.Router();
const smsService = require('../services/smsService');
const emailMarketingService = require('../services/emailMarketingService');

/**
 * POST /api/marketing/send-sms
 * Send SMS campaign
 */
router.post('/send-sms', async (req, res) => {
    try {
        const { recipients, message, senderId, scheduleTime, rateLimit, delay, optOut, trackLinks } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ error: 'Recipients array required' });
        }

        if (!message) {
            return res.status(400).json({ error: 'Message required' });
        }

        const configurationError = smsService.getConfigurationError();
        if (configurationError) {
            return res.status(400).json({ success: false, error: configurationError });
        }

        // Format recipients as needed
        const formattedRecipients = recipients.map(r => ({
            phone: typeof r === 'string' ? r : r.phone,
            name: r.name || '',
            company: r.company || '',
            city: r.city || ''
        }));

        const options = {
            senderId,
            scheduleTime,
            rateLimit,
            delay: delay || 2,
            optOut: optOut !== false,
            trackLinks: trackLinks === true
        };

        const result = await smsService.sendBulkSMS(formattedRecipients, message, options);

        res.json({
            success: true,
            sent: result.sent,
            failed: result.failed,
            total: recipients.length,
            results: result.results,
            scheduled: !!scheduleTime
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/marketing/send-single-sms
 * Send single SMS for testing
 */
router.post('/send-single-sms', async (req, res) => {
    try {
        const { phone, message, senderId } = req.body;

        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone and message required' });
        }

        const result = await smsService.sendSMS(phone, message, { senderId });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/marketing/send-email
 * Send Email campaign
 */
router.post('/send-email', async (req, res) => {
    try {
        const {
            recipients, subject, html, text,
            fromName, replyTo, cc, bcc,
            scheduleTime, rateLimit,
            trackOpens, trackClicks, includeUnsubscribe, priority,
            attachments
        } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ error: 'Recipients array required' });
        }

        if (!subject || !html) {
            return res.status(400).json({ error: 'Subject and HTML content required' });
        }

        const configurationError = emailMarketingService.getConfigurationError();
        if (configurationError) {
            return res.status(400).json({ success: false, error: configurationError });
        }

        // Format recipients
        const formattedRecipients = recipients.map(r => ({
            email: typeof r === 'string' ? r : r.email,
            name: r.name || '',
            company: r.company || '',
            city: r.city || ''
        }));

        const template = { subject, html, text };
        const options = {
            fromName,
            replyTo,
            cc,
            bcc,
            scheduleTime,
            rateLimit,
            trackOpens: trackOpens !== false,
            trackClicks: trackClicks !== false,
            includeUnsubscribe: includeUnsubscribe !== false,
            priority: priority || 'normal',
            attachments
        };

        const result = await emailMarketingService.sendBulkEmail(formattedRecipients, template, options);

        res.json({
            success: true,
            sent: result.sent,
            failed: result.failed,
            total: recipients.length,
            results: result.results,
            scheduled: !!scheduleTime
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/marketing/send-single-email
 * Send single email for testing
 */
router.post('/send-single-email', async (req, res) => {
    try {
        const { to, subject, html, text, fromName, replyTo } = req.body;

        if (!to || !subject || !html) {
            return res.status(400).json({ error: 'To, subject, and html required' });
        }

        const result = await emailMarketingService.sendEmail({
            to, subject, html, text,
            fromName, replyTo
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/marketing/test-sms
 * Test SMS connection (Twilio)
 */
router.post('/test-sms', async (req, res) => {
    try {
        const result = await smsService.testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/marketing/test-email
 * Test Email connection (SMTP)
 */
router.post('/test-email', async (req, res) => {
    try {
        const result = await emailMarketingService.testConnection();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
