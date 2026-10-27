/**
 * Lead list cleaner: normalizes emails and phone numbers, drops rows without a usable
 * contact, removes duplicates and (optionally) anyone on the do-not-contact list.
 */
const suppression = require('./suppressionService');

/** Parse CSV text (RFC 4180: quoted fields, escaped quotes, newlines inside quotes). */
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const input = String(text ?? '').replace(/^﻿/, '');
    for (let i = 0; i < input.length; i++) {
        const c = input[i];
        if (quoted) {
            if (c === '"' && input[i + 1] === '"') {
                field += '"';
                i++;
            } else if (c === '"') {
                quoted = false;
            } else {
                field += c;
            }
        } else if (c === '"' && field === '') {
            quoted = true;
        } else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && input[i + 1] === '\n') i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += c;
        }
    }
    if (field !== '' || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter(r => r.some(v => v.trim() !== ''));
}

function toCsv(columns, rows) {
    const cell = (v) => {
        const s = v === null || v === undefined ? '' : String(v);
        // Quote fields with separators, and neutralize spreadsheet formulas.
        const safe = /^[=+\-@]/.test(s) && !/^[+-]?\d/.test(s) ? `'${s}` : s;
        return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    return [columns.map(cell).join(','), ...rows.map(r => columns.map(c => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}

/** Keep the international "+" only when the number was written with one (or a 00 prefix). */
function formatPhone(raw, digits) {
    return /^\s*(\+|00)/.test(String(raw ?? '')) ? `+${digits}` : digits;
}

const COLUMN_HINTS = {
    email: /^(e-?mail|email address|mail)s?$/i,
    phone: /^(phone|phone number|mobile|cell|tel|telephone|whatsapp|contact number)s?$/i,
    website: /^(website|web|url|domain|site)s?$/i
};

function findColumn(columns, kind) {
    return columns.find(c => COLUMN_HINTS[kind].test(c.trim())) || null;
}

/**
 * Turn CSV text or a plain list (one email or phone per line) into row objects.
 * @returns {{ columns: string[], rows: object[] }}
 */
function readInput({ text, rows }) {
    if (Array.isArray(rows)) {
        const columns = [...new Set(rows.flatMap(r => Object.keys(r || {})))];
        return { columns, rows: rows.map(r => ({ ...r })) };
    }
    const table = parseCsv(text);
    if (table.length === 0) return { columns: [], rows: [] };
    const header = table[0].map(h => h.trim());
    const looksLikeHeader = header.some(h => Object.values(COLUMN_HINTS).some(re => re.test(h)))
        || (header.length > 1 && !header.some(h => suppression.normalizeContact(h)));
    if (!looksLikeHeader) {
        // A plain list: every cell is a contact.
        const values = table.flat().map(v => v.trim()).filter(Boolean);
        return {
            columns: ['contact'],
            rows: values.map(v => ({ contact: v }))
        };
    }
    const columns = header.map((h, i) => h || `column_${i + 1}`);
    return {
        columns,
        rows: table.slice(1).map(cells => Object.fromEntries(columns.map((c, i) => [c, (cells[i] ?? '').trim()])))
    };
}

/**
 * Clean a lead list.
 * @param {{ text?: string, rows?: object[] }} input
 * @param {{ removeInvalid?: boolean, removeDuplicates?: boolean, removeSuppressed?: boolean }} [options]
 */
function cleanList(input, options = {}) {
    const { removeInvalid = true, removeDuplicates = true, removeSuppressed = true } = options;
    const { columns, rows } = readInput(input);
    const emailCol = findColumn(columns, 'email');
    const phoneCol = findColumn(columns, 'phone');
    const contactCol = columns.includes('contact') && !emailCol && !phoneCol ? 'contact' : null;

    const stats = { input: rows.length, invalid: 0, duplicates: 0, suppressed: 0, output: 0 };
    const seen = new Set();
    const kept = [];
    const removed = [];

    for (const row of rows) {
        let email = null;
        let phone = null;
        if (contactCol) {
            const contact = suppression.normalizeContact(row[contactCol]);
            if (contact?.channel === 'email') email = contact.value;
            if (contact?.channel === 'phone') phone = contact.value;
        } else {
            if (emailCol) email = suppression.normalizeEmail(row[emailCol]);
            if (phoneCol) phone = suppression.normalizePhone(row[phoneCol]);
        }
        if (emailCol && email) row[emailCol] = email;
        if (phoneCol && phone) row[phoneCol] = formatPhone(row[phoneCol], phone);
        if (contactCol && (email || phone)) row[contactCol] = email || formatPhone(row[contactCol], phone);

        if (!email && !phone && (emailCol || phoneCol || contactCol)) {
            stats.invalid++;
            if (removeInvalid) {
                removed.push({ ...row, _reason: 'invalid' });
                continue;
            }
        }

        // A row is a duplicate when its email or its phone was already seen.
        const keys = [email && `e:${email}`, phone && `p:${phone}`].filter(Boolean);
        if (keys.length === 0) keys.push(`r:${JSON.stringify(row)}`);
        if (keys.some(k => seen.has(k))) {
            stats.duplicates++;
            if (removeDuplicates) {
                removed.push({ ...row, _reason: 'duplicate' });
                continue;
            }
        }
        keys.forEach(k => seen.add(k));

        if ((email && suppression.isSuppressed('email', email)) || (phone && suppression.isSuppressed('phone', phone))) {
            stats.suppressed++;
            if (removeSuppressed) {
                removed.push({ ...row, _reason: 'do-not-contact' });
                continue;
            }
        }
        kept.push(row);
    }

    stats.output = kept.length;
    return {
        columns,
        detected: { email: emailCol || (contactCol ? 'contact' : null), phone: phoneCol || (contactCol ? 'contact' : null) },
        stats,
        rows: kept,
        removed,
        csv: toCsv(columns, kept)
    };
}

module.exports = { parseCsv, toCsv, readInput, cleanList };
