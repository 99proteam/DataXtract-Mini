const fs = require('fs');
const path = require('path');
const net = require('net');

const MAX_ITEMS = 1000;

function flattenValues(values) {
    return values
        .flat(Infinity)
        .flatMap(value => String(value ?? '').split(/[\r\n,;]+/))
        .map(value => value.trim())
        .filter(Boolean)
        .slice(0, MAX_ITEMS);
}

function normalizeUrls(values) {
    const seen = new Set();
    const urls = [];
    for (const value of flattenValues(values)) {
        if (/^(url|urls|website|websites|link|links|domain|domains)$/i.test(value)) continue;
        const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
        try {
            const url = new URL(candidate);
            if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) continue;
            if (!url.hostname.includes('.') && url.hostname !== 'localhost' && !net.isIP(url.hostname)) continue;
            url.hash = '';
            const normalized = url.toString();
            if (!seen.has(normalized)) {
                seen.add(normalized);
                urls.push(normalized);
            }
        } catch (_) { /* ignore invalid values */ }
    }
    return urls;
}

function normalizeDomains(values) {
    const seen = new Set();
    const domains = [];
    for (const value of flattenValues(values)) {
        const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
        try {
            const url = new URL(candidate);
            const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
            if (!hostname.includes('.') || /\s/.test(hostname)) continue;
            if (!seen.has(hostname)) {
                seen.add(hostname);
                domains.push(hostname);
            }
        } catch (_) { /* ignore invalid values */ }
    }
    return domains;
}

async function parseUploadedList(file) {
    if (!file) return [];
    const ext = path.extname(file.originalname || file.path).toLowerCase();
    try {
        if (ext === '.xlsx' || ext === '.xls') {
            if (ext === '.xls') throw new Error('Legacy .xls files are not supported; save the file as .xlsx');
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(file.path);
            const values = [];
            workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => values.push(cell.text))));
            return values;
        }
        return flattenValues([fs.readFileSync(file.path, 'utf8')]);
    } finally {
        try { fs.unlinkSync(file.path); } catch (_) { /* already removed */ }
    }
}

module.exports = { MAX_ITEMS, flattenValues, normalizeUrls, normalizeDomains, parseUploadedList };
