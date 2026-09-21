const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');
const multer = require('multer');
const fs = require('fs');
const { randomUUID } = require('crypto');

// Polyfill File for older Node 18 releases
if (typeof global.File === 'undefined') {
    const { Blob } = require('buffer');
    global.File = class File extends Blob {
        constructor(fileBits, fileName, options) {
            super(fileBits, options);
            this.name = fileName;
            this.lastModified = options?.lastModified || Date.now();
        }
    };
}

// Import modules
const db = require('./config/database');
const campaignRoutes = require('./routes/campaigns');
const extractionRoutes = require('./routes/extraction');
const googleMapsRoutes = require('./routes/googleMaps');


const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Store active WebSocket connections
const clients = new Map();

// Middleware
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ws: wss:");
    next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (/\.(?:html|js|css)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-store, max-age=0');
        }
    }
}));

// Create uploads and exports directories
const baseDir = __dirname;

const uploadsDir = path.join(baseDir, 'uploads');
const exportsDir = path.join(baseDir, 'exports');

const logFile = path.join(baseDir, 'app-debug.log');
function logToFile(msg) {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
}

// Global Error Handlers
process.on('uncaughtException', (err) => {
    logToFile(`FATAL ERROR: ${err.message}\n${err.stack}`);
    console.error('FATAL ERROR:', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logToFile(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    console.error('Unhandled Rejection:', reason);
});

logToFile('Application starting...');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const allowedExts = ['.txt', '.csv', '.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();

        console.log(`[Upload Debug] File: ${file.originalname}, MIME: ${file.mimetype}, Ext: ${ext}`);

        // Rely primarily on extension, as MIME types can be inconsistent
        if (allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            console.error(`[Upload Debug] Rejected file: ${file.originalname}`);
            cb(new Error(`File type not allowed. Accepted: ${allowedExts.join(', ')}`), false);
        }
    }
});

// Make upload and wss available to routes
app.set('upload', upload);
app.set('wss', wss);
app.set('clients', clients);

// Routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/extraction', extractionRoutes);
app.use('/api/maps', googleMapsRoutes);
app.use('/api/proxies', require('./routes/proxies'));
app.use('/api/verification', require('./routes/verification'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/settings', require('./routes/settings'));

app.use('/api/enrichment', require('./routes/enrichment'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/marketing', require('./routes/marketing'));
app.use('/api/linkedin', require('./routes/linkedin'));
app.use('/api/tools', require('./routes/tools'));
app.use('/api/metrics', require('./routes/metrics'));

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// Initialize Scheduler
const schedulerService = require('./services/schedulerService');
schedulerService.init();


// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Clean client-side routes. API routes are mounted above and are never caught here.
app.get(/^\/(dashboard|campaigns(?:\/[^/]+)?|marketing(?:\/[^/]+)?|visual-tools(?:\/[^/]+)?|settings(?:\/[^/]+)?|guide)\/?$/, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket connection handling
wss.on('connection', (ws) => {
    const clientId = randomUUID();
    clients.set(clientId, ws);

    ws.send(JSON.stringify({ type: 'connected', clientId }));

    ws.on('close', () => {
        clients.delete(clientId);
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'subscribe' && data.campaignId) {
                ws.campaignId = data.campaignId;
            }
        } catch (e) {
            console.error('WebSocket message error:', e);
        }
    });
});

// Broadcast to all clients subscribed to a campaign
function broadcastToCampaign(campaignId, data) {
    console.log(`[WS Broadcast] Campaign ${campaignId}: ${data.type} ${data.message || ''}`);
    clients.forEach((client) => {
        if (client.readyState === 1 && client.campaignId === campaignId) {
            client.send(JSON.stringify({ ...data, campaignId }));
        }
    });
}

// Make broadcast function available globally
global.broadcastToCampaign = broadcastToCampaign;

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    const isClientError = err instanceof multer.MulterError || /File type not allowed/.test(err.message || '');
    res.status(isClientError ? 400 : 500).json({ error: isClientError ? err.message : 'Something went wrong!' });
});

const PORT = process.env.PORT || 3007;
const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🚀 Domain Data Extractor - Campaign System                ║
║                                                               ║
║     Server running at: http://${HOST}:${PORT}                   ║
║                                                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});

module.exports = { app, server, wss };
