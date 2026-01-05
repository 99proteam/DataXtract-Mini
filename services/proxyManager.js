const { proxyOps } = require('../config/database');

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.loadProxies();
    }

    loadProxies() {
        try {
            this.proxies = proxyOps.getActive.all();
            console.log(`[ProxyManager] Loaded ${this.proxies.length} active proxies`);
        } catch (error) {
            console.error('[ProxyManager] Failed to load proxies:', error.message);
        }
    }

    getNextProxy() {
        if (this.proxies.length === 0) return null;

        // Simple Round Robin
        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    }

    markBad(proxyId) {
        try {
            proxyOps.updateStatus.run('dead', proxyId);
            this.proxies = this.proxies.filter(p => p.id !== proxyId);
            console.log(`[ProxyManager] Marked proxy ${proxyId} as dead`);
        } catch (error) {
            console.error(`[ProxyManager] Failed to mark proxy ${proxyId} as dead:`, error.message);
        }
    }

    formatForPuppeteer(proxy) {
        if (!proxy) return [];

        const args = [];
        // Construct proxy URL
        const proxyUrl = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
        args.push(`--proxy-server=${proxyUrl}`);

        return args;
    }

    // Returns auth credentials if they exist
    getAuth(proxy) {
        if (proxy && proxy.username && proxy.password) {
            return {
                username: proxy.username,
                password: proxy.password
            };
        }
        return null;
    }
}

// Singleton instance
const proxyManager = new ProxyManager();

module.exports = proxyManager;
