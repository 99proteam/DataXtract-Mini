const crypto = require('crypto');

const definitions = {
    proxy: { settingsTab: 'proxy', fields: [['proxy', 'webshareApiKey']] },
    smtp: { settingsTab: 'smtp', fields: [['smtp', 'host'], ['smtp', 'user'], ['smtp', 'pass']] },
    twilio: { settingsTab: 'twilio', fields: [['twilio', 'accountSid'], ['twilio', 'authToken'], ['twilio', 'fromNumber']] },
    zerobounce: { settingsTab: 'apikeys', fields: [['apiKeys', 'zerobounce']] },
    ai: { settingsTab: 'ai', fields: [['ai', 'provider'], ['ai', 'apiKey']] }
};

function valueAt(settings, path) {
    return path.reduce((value, key) => value?.[key], settings);
}

function fingerprintIntegration(name, settings) {
    const definition = definitions[name];
    if (!definition) return '';
    const value = definition.fields.map(field => String(valueAt(settings, field) || '')).join('\u0000');
    return crypto.createHash('sha256').update(value).digest('hex');
}

function buildIntegrationStatus(settings) {
    return Object.fromEntries(Object.entries(definitions).map(([name, definition]) => {
        const configured = definition.fields.every(field => Boolean(String(valueAt(settings, field) || '').trim()));
        const verification = settings.verification?.[name];
        const working = configured && verification?.fingerprint === fingerprintIntegration(name, settings);
        return [name, {
            configured,
            tested: working,
            state: !configured ? 'not-configured' : (working ? 'working' : 'untested'),
            settingsTab: definition.settingsTab,
            verifiedAt: working ? verification.verifiedAt : null
        }];
    }));
}

function markVerified(name, settings) {
    settings.verification = settings.verification || {};
    settings.verification[name] = {
        fingerprint: fingerprintIntegration(name, settings),
        verifiedAt: new Date().toISOString()
    };
    return settings;
}

module.exports = { definitions, fingerprintIntegration, buildIntegrationStatus, markVerified };
