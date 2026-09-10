const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');
const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Polyfill File for Node 18.5 (pkg environment)
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Create uploads and exports directories
// Create uploads and exports directories
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;

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
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
    storage,
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

// Initialize Scheduler
const schedulerService = require('./services/schedulerService');
schedulerService.init();


// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket connection handling
wss.on('connection', (ws) => {
    const clientId = uuidv4();
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
    res.status(500).json({ error: err.message || 'Something went wrong!' });
});

const PORT = process.env.PORT || 3007;
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🚀 Domain Data Extractor - Campaign System                ║
║                                                               ║
║     Server running at: http://localhost:${PORT}                 ║
║                                                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});

module.exports = { app, server, wss };
