const express = require('express');
const router = express.Router();
const { proxyOps } = require('../config/database');
const proxyManager = require('../services/proxyManager');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Get all proxies
router.get('/', (req, res) => {
    try {
        const proxies = proxyOps.getAll.all();
        res.json(proxies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add proxies (supporting bulk format)
router.post('/', (req, res) => {
    try {
        const { proxiesString } = req.body;

        if (!proxiesString) {
            return res.status(400).json({ error: 'No proxies provided' });
        }

        const lines = proxiesString.split('\n').map(l => l.trim()).filter(l => l);
        const parsedProxies = [];

        for (const line of lines) {
            // Flexible parsing logic
            // Supports:
            // protocol://user:pass@host:port
            // host:port:user:pass
            // host:port

            let protocol = 'http';
            let host, port, username, password;

            try {
                if (line.includes('://')) {
                    const url = new URL(line);
                    protocol = url.protocol.replace(':', '');
                    host = url.hostname;
                    port = parseInt(url.port);
                    username = url.username;
                    password = url.password;
                } else {
                    const parts = line.split(':');
                    if (parts.length === 2) {
                        [host, port] = parts;
                    } else if (parts.length === 4) {
                        [host, port, username, password] = parts;
                    }
                }

                if (host && port) {
                    parsedProxies.push({ protocol, host, port, username, password });
                }
            } catch (e) {
                // Skip invalid lines
            }
        }

        if (parsedProxies.length > 0) {
            proxyOps.addMany(parsedProxies);
            proxyManager.loadProxies(); // Reload manager
            res.json({ success: true, count: parsedProxies.length });
        } else {
            res.status(400).json({ error: 'No valid proxies found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete proxy
router.delete('/:id', (req, res) => {
    try {
        proxyOps.delete.run(req.params.id);
        proxyManager.loadProxies(); // Reload manager
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test proxy
router.post('/test', async (req, res) => {
    const { id } = req.body;
    try {
        const proxy = proxyOps.getAll.all().find(p => p.id == id);
        if (!proxy) return res.status(404).json({ error: 'Proxy not found' });

        const proxyUrl = `${proxy.protocol}://${proxy.username ? `${proxy.username}:${proxy.password}@` : ''}${proxy.host}:${proxy.port}`;
        const agent = new HttpsProxyAgent(proxyUrl);

        const start = Date.now();
        await axios.get('https://www.google.com/humans.txt', {
            httpsAgent: agent,
            timeout: 5000
        });
        const latency = Date.now() - start;

        proxyOps.updateStatus.run('active', id);
        res.json({ success: true, latency });

    } catch (error) {
        proxyOps.updateStatus.run('dead', id);
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;
