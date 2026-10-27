const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

// Use a throwaway database and secret for these tests.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dataxtract-compliance-'));
process.env.DATAXTRACT_DATA_DIR = tempDir;
delete process.env.UNSUBSCRIBE_SECRET;

const suppression = require('../services/suppressionService');
const { cleanList, parseCsv, toCsv } = require('../services/listCleaner');
const { db } = require('../config/database');

test.after(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('normalizes emails and phone numbers', () => {
    assert.equal(suppression.normalizeEmail('  Jane.Doe@Example.COM '), 'jane.doe@example.com');
    assert.equal(suppression.normalizeEmail('mailto:a@b.io'), 'a@b.io');
    assert.equal(suppression.normalizeEmail('not-an-email'), null);
    assert.equal(suppression.normalizePhone('+1 (555) 010-9999'), '15550109999');
    assert.equal(suppression.normalizePhone('0015550109999'), '15550109999');
    assert.equal(suppression.normalizePhone('12345'), null);
    assert.deepEqual(suppression.normalizeContact('A@B.co'), { channel: 'email', value: 'a@b.co' });
    assert.deepEqual(suppression.splitValues('a@b.co, c@d.co\n+1 555 010 9999'), ['a@b.co', 'c@d.co', '+1 555 010 9999']);
});

test('adds contacts once and filters them out of campaigns', () => {
    const result = suppression.addContacts(['Stop@Example.com', '+1 555 010 9999', 'stop@example.com', 'garbage'], { reason: 'test' });
    assert.equal(result.added, 2);
    assert.equal(result.existing, 1);
    assert.deepEqual(result.invalid, ['garbage']);

    const emails = suppression.filterRecipients(
        [{ email: 'stop@example.com' }, { email: 'ok@example.com' }],
        'email',
        r => r.email
    );
    assert.deepEqual(emails.allowed, [{ email: 'ok@example.com' }]);
    assert.equal(emails.suppressed.length, 1);

    // Phone matching ignores formatting.
    const phones = suppression.filterRecipients(['15550109999', '+44 20 7946 0000'], 'phone', r => r);
    assert.deepEqual(phones.allowed, ['+44 20 7946 0000']);

    const { items, total } = suppression.listContacts({ channel: 'email' });
    assert.equal(total, 1);
    assert.equal(items[0].value, 'stop@example.com');
    assert.equal(suppression.removeContact(items[0].id), true);
    assert.equal(suppression.isSuppressed('email', 'stop@example.com'), false);
});

test('signs unsubscribe links and rejects tampered ones', () => {
    const url = new URL(suppression.unsubscribeUrl('https://leads.example.com/', 'Reader@Example.com'));
    assert.equal(url.origin + url.pathname, 'https://leads.example.com/unsubscribe');
    assert.equal(url.searchParams.get('e'), 'reader@example.com');
    const token = url.searchParams.get('t');
    assert.equal(suppression.verifyUnsubscribeToken('reader@example.com', token), true);
    assert.equal(suppression.verifyUnsubscribeToken('READER@example.com', token), true);
    assert.equal(suppression.verifyUnsubscribeToken('someone@example.com', token), false);
    assert.equal(suppression.verifyUnsubscribeToken('reader@example.com', token.slice(1) + 'x'), false);
    assert.equal(suppression.verifyUnsubscribeToken('reader@example.com', undefined), false);
    // The generated secret is kept so links keep working after a restart.
    assert.ok(fs.existsSync(path.join(tempDir, 'unsubscribe.secret')));
});

test('parses and writes CSV with quotes and formula protection', () => {
    assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi"""\n\n'), [['a', 'b'], ['x, y', 'say "hi"']]);
    assert.equal(toCsv(['a', 'b'], [{ a: '=HYPERLINK("x")', b: '+15550109999' }]), 'a,b\r\n"\'=HYPERLINK(""x"")",+15550109999\r\n');
});

test('cleans a lead list: normalizes, drops invalid, duplicate and do-not-contact rows', () => {
    suppression.addContacts(['blocked@example.com']);
    const text = [
        'Name,Email,Phone',
        'Ann,ANN@example.com,+1 555 010 0001',
        'Ann again,ann@example.com,',
        'Bob,,555-010-0002',
        'Bob twin,bob@example.com,(555) 010-0002',
        'Nobody,nope,123',
        'Blocked,blocked@example.com,'
    ].join('\n');
    const result = cleanList({ text });
    assert.deepEqual(result.detected, { email: 'Email', phone: 'Phone' });
    assert.deepEqual(result.stats, { input: 6, invalid: 1, duplicates: 2, suppressed: 1, output: 2 });
    assert.deepEqual(result.rows.map(r => [r.Name, r.Email, r.Phone]), [
        ['Ann', 'ann@example.com', '+15550100001'],
        ['Bob', '', '5550100002']
    ]);
    assert.ok(result.csv.startsWith('Name,Email,Phone\r\nAnn,ann@example.com,+15550100001\r\n'));
});

test('cleans a plain list and can keep what the options say to keep', () => {
    const result = cleanList({ text: 'a@x.io\nA@X.io\nnot valid\n+44 20 7946 0000' });
    assert.deepEqual(result.columns, ['contact']);
    assert.deepEqual(result.rows.map(r => r.contact), ['a@x.io', '+442079460000']);

    const kept = cleanList({ text: 'a@x.io\na@x.io' }, { removeDuplicates: false });
    assert.equal(kept.stats.duplicates, 1);
    assert.equal(kept.stats.output, 2);
});
