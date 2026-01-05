/**
 * WhatsApp Integration Service
 * Formats phone numbers for WhatsApp and checks availability
 */

const https = require('https');
const http = require('http');

/**
 * Format phone number for WhatsApp (remove non-digits, handle country codes)
 * @param {string} phone - Phone number to format
 * @param {string} defaultCountryCode - Default country code if not present (e.g., '91' for India)
 * @returns {string} Formatted phone number for WhatsApp
 */
function formatPhoneForWhatsApp(phone, defaultCountryCode = '91') {
    if (!phone) return null;

    // Remove all non-digit characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Remove leading +
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }

    // If number doesn't start with country code, add default
    // Common India numbers: start with 6,7,8,9 and are 10 digits
    if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
        cleaned = defaultCountryCode + cleaned;
    }

    // Handle numbers with 0 prefix (local format)
    if (cleaned.startsWith('0')) {
        cleaned = defaultCountryCode + cleaned.substring(1);
    }

    return cleaned;
}

/**
 * Generate WhatsApp click-to-chat link
 * @param {string} phone - Phone number (will be formatted)
 * @param {string} message - Optional pre-filled message
 * @param {string} countryCode - Default country code
 * @returns {string} WhatsApp URL
 */
function generateWhatsAppLink(phone, message = '', countryCode = '91') {
    const formattedPhone = formatPhoneForWhatsApp(phone, countryCode);
    if (!formattedPhone) return null;

    let url = `https://wa.me/${formattedPhone}`;
    if (message) {
        url += `?text=${encodeURIComponent(message)}`;
    }
    return url;
}

/**
 * Check if WhatsApp is available for a phone number
 * This can use browser automation for accurate verification, or fall back to basic check
 * 
 * @param {string} phone - Phone number to check
 * @param {string} countryCode - Default country code
 * @param {string} sessionName - Optional WhatsApp session name for browser verification
 * @returns {Promise<{available: boolean, link: string, verified: boolean}>}
 */
async function checkWhatsAppAvailability(phone, countryCode = '91', sessionName = null) {
    const formattedPhone = formatPhoneForWhatsApp(phone, countryCode);
    if (!formattedPhone) {
        return { available: false, link: null, error: 'Invalid phone number', verified: false };
    }

    const link = `https://wa.me/${formattedPhone}`;

    // If a session name is provided, use browser-based verification
    if (sessionName) {
        try {
            const whatsappWebService = require('./whatsappWebService');
            const result = await whatsappWebService.checkNumberExists(sessionName, formattedPhone);
            return {
                available: result.exists,
                link: result.exists ? link : null,
                phone: formattedPhone,
                verified: true // Actually verified via browser
            };
        } catch (e) {
            console.error('Browser verification failed:', e.message);
            // Fall through to basic check
        }
    }

    // Fallback: Return link but mark as unverified
    return {
        available: true, // Assume available if properly formatted (unverified)
        link: link,
        phone: formattedPhone,
        verified: false // Not actually verified
    };
}

/**
 * Bulk check WhatsApp availability for multiple phones
 * @param {Array<{id: number, phone: string}>} items - Items with phone numbers
 * @param {string} countryCode - Default country code
 * @returns {Promise<Array<{id: number, whatsappAvailable: boolean, whatsappLink: string}>>}
 */
async function bulkCheckWhatsApp(items, countryCode = '91') {
    const results = [];

    for (const item of items) {
        if (item.phone) {
            const check = await checkWhatsAppAvailability(item.phone, countryCode);
            results.push({
                id: item.id,
                whatsappAvailable: check.available,
                whatsappLink: check.link
            });
        } else {
            results.push({
                id: item.id,
                whatsappAvailable: false,
                whatsappLink: null
            });
        }
    }

    return results;
}

/**
 * Generate bulk WhatsApp links for export
 * @param {Array<{phone: string, name: string}>} contacts - Contacts to generate links for
 * @param {string} messageTemplate - Message template with {name} placeholder
 * @param {string} countryCode - Default country code
 * @returns {Array<{phone: string, name: string, whatsappLink: string}>}
 */
function generateBulkLinks(contacts, messageTemplate = '', countryCode = '91') {
    return contacts.map(contact => {
        const message = messageTemplate.replace('{name}', contact.name || '');
        return {
            ...contact,
            whatsappLink: generateWhatsAppLink(contact.phone, message, countryCode)
        };
    });
}

module.exports = {
    formatPhoneForWhatsApp,
    generateWhatsAppLink,
    checkWhatsAppAvailability,
    bulkCheckWhatsApp,
    generateBulkLinks
};
