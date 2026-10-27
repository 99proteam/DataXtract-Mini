const express = require('express');
const suppression = require('../services/suppressionService');

/**
 * /api/suppression: manage the do-not-contact list.
 */
const router = express.Router();

/**
 * GET /api/suppression?channel=email|phone&q=search&limit=100&offset=0
 */
router.get('/', (req, res) => {
    try {
        res.json(suppression.listContacts({
            channel: req.query.channel,
            search: req.query.q,
            limit: req.query.limit,
            offset: req.query.offset
        }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/suppression
 * Body: { values: string[] } or { text: "one per line" }, plus optional { reason }
 */
router.post('/', (req, res) => {
    try {
        const { values, text, reason } = req.body || {};
        const list = Array.isArray(values) ? values.map(String) : suppression.splitValues(text);
        if (list.length === 0) {
            return res.status(400).json({ error: 'Provide emails or phone numbers in "values" or "text"' });
        }
        if (list.length > 50000) {
            return res.status(400).json({ error: 'Add at most 50,000 entries at a time' });
        }
        const result = suppression.addContacts(list, { reason, source: list.length > 1 ? 'import' : 'manual' });
        res.json({ success: true, ...result, invalid: result.invalid.slice(0, 100), invalidCount: result.invalid.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/suppression/check
 * Body: { values: string[] }. Returns the values that are on the list.
 */
router.post('/check', (req, res) => {
    const values = Array.isArray(req.body?.values) ? req.body.values.map(String) : [];
    const suppressed = values.filter(v => {
        const contact = suppression.normalizeContact(v);
        return contact && suppression.isSuppressed(contact.channel, contact.value);
    });
    res.json({ suppressed });
});

/**
 * DELETE /api/suppression/:id
 */
router.delete('/:id', (req, res) => {
    if (!suppression.removeContact(req.params.id)) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true });
});

/** Minimal standalone page for the public unsubscribe flow (no app chrome, no scripts). */
function page(title, body) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 16px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; background: #f5f6f8; color: #1d2330; }
  main { max-width: 420px; margin: 24px; padding: 32px; background: #fff; border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.08); text-align: center; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p { color: #556; margin: 0 0 20px; }
  button { font: inherit; font-weight: 600; padding: 12px 22px; border: 0; border-radius: 10px; background: #1d2330; color: #fff; cursor: pointer; }
  @media (prefers-color-scheme: dark) { body { background: #111318; color: #e7e9ee; } main { background: #1a1d24; } p { color: #a6adbb; } button { background: #e7e9ee; color: #111318; } }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Public routes for the links in campaign emails: GET shows a confirmation button (so link
 * scanners can't unsubscribe anyone), POST adds the address to the do-not-contact list. The
 * POST also accepts RFC 8058 one-click requests from mail clients.
 */
function mountUnsubscribe(app) {
    app.get('/unsubscribe', (req, res) => {
        const { e: email, t: token } = req.query;
        res.setHeader('Cache-Control', 'no-store');
        if (!suppression.verifyUnsubscribeToken(email, token)) {
            return res.status(400).send(page('Invalid link', '<h1>This link is not valid</h1><p>It may be incomplete. Copy the whole link from the email and try again.</p>'));
        }
        const address = escapeHtml(suppression.normalizeEmail(email));
        res.send(page('Unsubscribe', `<h1>Unsubscribe?</h1><p>${address} will not receive any more emails from this sender.</p>
<form method="post" action="/unsubscribe"><input type="hidden" name="e" value="${address}"><input type="hidden" name="t" value="${escapeHtml(token)}"><button type="submit">Unsubscribe</button></form>`));
    });

    app.post('/unsubscribe', (req, res) => {
        const email = req.body?.e ?? req.query.e;
        const token = req.body?.t ?? req.query.t;
        res.setHeader('Cache-Control', 'no-store');
        if (!suppression.verifyUnsubscribeToken(email, token)) {
            return res.status(400).send(page('Invalid link', '<h1>This link is not valid</h1><p>It may be incomplete. Copy the whole link from the email and try again.</p>'));
        }
        suppression.addContacts([email], { reason: 'Unsubscribed via email link', source: 'unsubscribe' });
        res.send(page('Unsubscribed', `<h1>You're unsubscribed</h1><p>${escapeHtml(suppression.normalizeEmail(email))} has been removed and won't be emailed again.</p>`));
    });
}

module.exports = router;
module.exports.mountUnsubscribe = mountUnsubscribe;
