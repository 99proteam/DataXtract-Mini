/**
 * Do-not-contact (suppression) list.
 *
 * Every bulk sender (email, SMS, WhatsApp) drops recipients on this list before sending,
 * and emails get a working, signed unsubscribe link that adds the reader to it.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { dataDir, suppressionOps } = require('../config/database');

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i;

/** Lowercase, trimmed email, or null when it isn't a plausible address. */
function normalizeEmail(value) {
    const email = String(value ?? '').trim().replace(/^mailto:/i, '').toLowerCase();
    return EMAIL_RE.test(email) ? email : null;
}

/**
 * Digits-only phone number (a leading "00" international prefix is dropped), or null when it
 * has fewer than 7 digits. "+1 (555) 010-9999" and "0015550109999" both become "15550109999".
 */
function normalizePhone(value) {
    let digits = String(value ?? '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

/** Guess the channel of a raw value and normalize it. */
function normalizeContact(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (raw.includes('@')) {
        const email = normalizeEmail(raw);
        return email ? { channel: 'email', value: email } : null;
    }
    const phone = normalizePhone(raw);
    return phone ? { channel: 'phone', value: phone } : null;
}

/** Split pasted text (one per line, or separated by commas/semicolons) into values. */
function splitValues(text) {
    return String(text ?? '')
        .split(/[\r\n,;\t]+/)
        .map(v => v.trim())
        .filter(Boolean);
}

/**
 * Add emails and/or phone numbers. Returns how many were new, already listed or invalid.
 * @param {string[]} values
 * @param {{ reason?: string, source?: string }} [meta]
 */
function addContacts(values, { reason = '', source = 'manual' } = {}) {
    const result = { added: 0, existing: 0, invalid: [] };
    for (const raw of values) {
        const contact = normalizeContact(raw);
        if (!contact) {
            result.invalid.push(String(raw));
            continue;
        }
        const info = suppressionOps.add.run(contact.channel, contact.value, String(reason).slice(0, 200) || null, source);
        if (info.changes > 0) result.added++;
        else result.existing++;
    }
    return result;
}

function isSuppressed(channel, rawValue) {
    const value = channel === 'email' ? normalizeEmail(rawValue) : normalizePhone(rawValue);
    return Boolean(value && suppressionOps.has.get(channel, value));
}

/**
 * Split recipients into those that may be contacted and those on the do-not-contact list.
 * @param {Array} recipients
 * @param {'email'|'phone'} channel
 * @param {(recipient: any) => string} getValue
 */
function filterRecipients(recipients, channel, getValue) {
    const allowed = [];
    const suppressed = [];
    for (const recipient of recipients) {
        if (isSuppressed(channel, getValue(recipient))) suppressed.push(recipient);
        else allowed.push(recipient);
    }
    return { allowed, suppressed };
}

function listContacts({ channel = null, search = null, limit = 100, offset = 0 } = {}) {
    const params = {
        channel: channel === 'email' || channel === 'phone' ? channel : null,
        search: search ? String(search).trim().toLowerCase() || null : null,
        limit: Math.min(Math.max(Number(limit) || 100, 1), 1000),
        offset: Math.max(Number(offset) || 0, 0)
    };
    return { items: suppressionOps.list.all(params), total: suppressionOps.count.get(params).total };
}

function removeContact(id) {
    return suppressionOps.remove.run(Number(id)).changes > 0;
}

// ---------- signed unsubscribe links ----------

let cachedSecret = null;

/** Secret for unsubscribe tokens: UNSUBSCRIBE_SECRET, or a random one kept in the data folder. */
function unsubscribeSecret() {
    if (cachedSecret) return cachedSecret;
    if (process.env.UNSUBSCRIBE_SECRET) {
        cachedSecret = process.env.UNSUBSCRIBE_SECRET;
        return cachedSecret;
    }
    const file = path.join(dataDir, 'unsubscribe.secret');
    try {
        cachedSecret = fs.readFileSync(file, 'utf8').trim();
    } catch (_) {
        cachedSecret = '';
    }
    if (!cachedSecret) {
        cachedSecret = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(file, cachedSecret, { mode: 0o600 });
    }
    return cachedSecret;
}

function unsubscribeToken(email) {
    return crypto
        .createHmac('sha256', unsubscribeSecret())
        .update(`unsubscribe:${normalizeEmail(email) || ''}`)
        .digest('base64url')
        .slice(0, 32);
}

function verifyUnsubscribeToken(email, token) {
    if (!normalizeEmail(email) || typeof token !== 'string') return false;
    const expected = Buffer.from(unsubscribeToken(email));
    const given = Buffer.from(token);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Public unsubscribe link for an email address. `baseUrl` is where this app is reachable. */
function unsubscribeUrl(baseUrl, email) {
    const base = String(baseUrl || '').replace(/\/+$/, '');
    const address = normalizeEmail(email) || '';
    return `${base}/unsubscribe?e=${encodeURIComponent(address)}&t=${unsubscribeToken(address)}`;
}

module.exports = {
    normalizeEmail,
    normalizePhone,
    normalizeContact,
    splitValues,
    addContacts,
    isSuppressed,
    filterRecipients,
    listContacts,
    removeContact,
    unsubscribeToken,
    verifyUnsubscribeToken,
    unsubscribeUrl
};
