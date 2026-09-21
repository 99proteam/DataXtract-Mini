const express = require('express');
const { db } = require('../config/database');

const router = express.Router();
const VISITOR_ID_PATTERN = /^[a-zA-Z0-9_-]{16,100}$/;
const countVisitors = db.prepare('SELECT COUNT(*) AS totalVisitors FROM app_visitors');
const registerVisitor = db.prepare('INSERT OR IGNORE INTO app_visitors (visitor_id) VALUES (?)');

router.get('/visitors', (req, res) => {
    res.json({ totalVisitors: countVisitors.get().totalVisitors });
});

router.post('/visitors', (req, res) => {
    const visitorId = typeof req.body?.visitorId === 'string' ? req.body.visitorId.trim() : '';
    if (!VISITOR_ID_PATTERN.test(visitorId)) {
        return res.status(400).json({ error: 'A valid anonymous visitor ID is required' });
    }

    registerVisitor.run(visitorId);
    return res.json({ totalVisitors: countVisitors.get().totalVisitors });
});

module.exports = router;
