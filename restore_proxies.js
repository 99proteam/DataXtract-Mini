const fs = require('fs');
const path = require('path');
const { proxyOps } = require('./config/database');

const proxiesFile = path.join(__dirname, 'data', 'webshare-proxies.json');

if (fs.existsSync(proxiesFile)) {
    try {
        const proxies = JSON.parse(fs.readFileSync(proxiesFile, 'utf8'));
        console.log(`Found ${proxies.length} proxies in backup file.`);

        if (proxies.length > 0) {
            proxyOps.deleteAll.run();
            proxyOps.addMany(proxies);
            console.log('Successfully restored proxies to database!');
        }
    } catch (e) {
        console.error('Error restoring proxies:', e);
    }
} else {
    console.log('No backup proxy file found.');
}
