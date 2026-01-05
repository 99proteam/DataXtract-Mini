/**
 * WhatsApp Web Routes
 * API endpoints for WhatsApp Web automation
 */

const express = require('express');
const router = express.Router();
const whatsappWebService = require('../services/whatsappWebService');

/**
 * GET /api/whatsapp/sessions
 * Get list of all WhatsApp sessions
 */
router.get('/sessions', (req, res) => {
    try {
        const sessions = whatsappWebService.getAvailableSessions();
        res.json({ success: true, sessions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/whatsapp/session/:name/status
 * Get status of a specific session
 */
router.get('/session/:name/status', (req, res) => {
    try {
        const status = whatsappWebService.getSessionStatus(req.params.name);
        res.json({ success: true, ...status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/whatsapp/session/:name/init
 * Initialize a WhatsApp Web session (opens browser, shows QR)
 */
router.post('/session/:name/init', async (req, res) => {
    try {
        const sessionName = req.params.name;

        // For SSE to send QR code updates
        const qrCodes = [];

        const result = await whatsappWebService.initSession(sessionName, (qrCode) => {
            qrCodes.push(qrCode);
        });

        res.json({
            success: result.success,
            ...result,
            qrCode: qrCodes[qrCodes.length - 1] || result.qrCode
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/whatsapp/session/:name/close
 * Close a WhatsApp session
 */
router.post('/session/:name/close', async (req, res) => {
    try {
        const result = await whatsappWebService.closeSession(req.params.name);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/whatsapp/session/:name
 * Delete a WhatsApp session completely (close browser and delete data)
 */
router.delete('/session/:name', async (req, res) => {
    try {
        const sessionName = req.params.name;

        // First close the session if active
        try {
            await whatsappWebService.closeSession(sessionName);
        } catch (e) {
            // Session might not be active, continue with deletion
        }

        // Delete session data
        const result = await whatsappWebService.deleteSession(sessionName);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/whatsapp/check-number
 * Check if a phone number exists on WhatsApp
 */
router.post('/check-number', async (req, res) => {
    try {
        const { sessionName, phone } = req.body;

        if (!sessionName || !phone) {
            return res.status(400).json({ error: 'sessionName and phone required' });
        }

        const result = await whatsappWebService.checkNumberExists(sessionName, phone);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/whatsapp/send
 * Send a single WhatsApp message
 */
router.post('/send', async (req, res) => {
    try {
        const { sessionName, phone, message } = req.body;

        if (!sessionName || !phone || !message) {
            return res.status(400).json({ error: 'sessionName, phone, and message required' });
        }

        const result = await whatsappWebService.sendMessage(sessionName, phone, message);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/whatsapp/bulk
 * Send bulk WhatsApp messages with session rotation
 */
router.post('/bulk', async (req, res) => {
    try {
        const { recipients, messageTemplate, delay = 5000, rotate = true } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ error: 'recipients array required' });
        }

        if (!messageTemplate) {
            return res.status(400).json({ error: 'messageTemplate required' });
        }

        // Start bulk send
        const result = await whatsappWebService.sendBulkMessages(recipients, messageTemplate, {
            sessionRotation: rotate,
            delayBetweenMessages: delay,
            onProgress: (progress) => {
                // Could broadcast via WebSocket here
                if (global.broadcastToCampaign) {
                    global.broadcastToCampaign('whatsapp-bulk', {
                        type: 'whatsapp_progress',
                        ...progress
                    });
                }
            }
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/whatsapp/extract-group
 * Extract phone numbers from a WhatsApp group
 */
router.post('/extract-group', async (req, res) => {
    try {
        const { sessionName, groupName } = req.body;

        if (!sessionName || !groupName) {
            return res.status(400).json({ error: 'sessionName and groupName required' });
        }

        // Ensure session is active
        const status = whatsappWebService.getSessionStatus(sessionName);
        if (!status.active) {
            // Try to init the session
            await whatsappWebService.initSession(sessionName);
        }

        const result = await whatsappWebService.extractGroupMembers(sessionName, groupName);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/whatsapp/join-groups
 * Join multiple WhatsApp groups via invite links
 */
router.post('/join-groups', async (req, res) => {
    try {
        const { sessionName, inviteLinks, delay = 3000 } = req.body;

        if (!sessionName || !inviteLinks || !Array.isArray(inviteLinks)) {
            return res.status(400).json({ error: 'sessionName and inviteLinks array required' });
        }

        // Ensure session is active
        const status = whatsappWebService.getSessionStatus(sessionName);
        if (!status.active) {
            await whatsappWebService.initSession(sessionName);
        }

        const result = await whatsappWebService.joinGroups(sessionName, inviteLinks, {
            delayBetweenJoins: delay,
            onProgress: (progress) => {
                if (global.broadcastToCampaign) {
                    global.broadcastToCampaign('whatsapp-groups', {
                        type: 'group_join_progress',
                        ...progress
                    });
                }
            }
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/whatsapp/list-groups
 * List all WhatsApp groups in the session
 */
router.post('/list-groups', async (req, res) => {
    try {
        const { sessionName } = req.body;

        if (!sessionName) {
            return res.status(400).json({ error: 'sessionName required' });
        }

        // Ensure session is active
        const status = whatsappWebService.getSessionStatus(sessionName);
        if (!status.active) {
            await whatsappWebService.initSession(sessionName);
        }

        const result = await whatsappWebService.listGroups(sessionName);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

