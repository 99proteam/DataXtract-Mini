# Data Extractor Pro

**Professional Data Extraction Platform by BundleWP**

Extract business data from Google Maps, run email/SMS campaigns, and manage multi-channel outreach - all in one powerful platform.

---

## 🚀 Features

### 📍 Google Maps Extractor
- Extract business name, phone, email, website, hours, reviews
- Bulk keyword search with location targeting
- User Agent rotation for anti-blocking
- Configurable extraction limits and delays

### 📧 Email Marketing
- SMTP-based bulk email campaigns
- HTML email templates
- Variable personalization ({{name}}, {{company}}, etc.)
- Email verification (ZeroBounce, SMTP, MX methods)

### 📱 SMS Campaigns
- Twilio-powered SMS sending
- Message templates with personalization
- Character count and segment tracking

### 💬 WhatsApp Web Integration
- Browser-based WhatsApp bulk messaging
- Group member extraction
- Bulk group joiner
- Session management

### 🔗 LinkedIn Sales Navigator
- People search extraction
- Job search extraction
- Session persistence

### 📸 Bulk Screenshots
- Capture multiple website screenshots
- Multiple device emulation
- Browser selection

### 🌐 Domain Extractor
- Extract emails, phones, social links from domains
- Technology detection
- Metadata extraction

---

## 📋 Requirements

- **Node.js** 18.x or higher
- **npm** 8.x or higher
- **RAM** 2GB minimum (4GB recommended)

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start Application
```bash
npm start
```

### 4. Access
Open browser: `http://localhost:3000`

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [INSTALLATION.md](docs/INSTALLATION.md) | Complete localhost & VPS setup guide |
| [USER_GUIDE.md](docs/USER_GUIDE.md) | Feature documentation |
| [CHANGELOG.md](docs/CHANGELOG.md) | Version history |
| [LICENSE.md](LICENSE.md) | License terms |

---

## 🔧 Configuration

Copy `.env.example` to `.env` and configure:

| Service | Required For |
|---------|--------------|
| SMTP | Email campaigns |
| Twilio | SMS campaigns |
| Webshare | Proxy rotation |
| ZeroBounce | Email verification |
| OpenAI/Gemini | AI features |

---

## 📁 Directory Structure

```
data-extractor-pro/
├── config/           # Configuration
├── docs/             # Documentation
├── public/           # Frontend assets
│   ├── css/
│   └── js/
├── routes/           # API endpoints
├── services/         # Business logic
├── .env.example      # Environment template
├── LICENSE.md        # License terms
├── package.json      # Dependencies
├── README.md         # This file
└── server.js         # Entry point
```

---

## 🛡️ Security Notes

- Never share your `.env` file
- Use strong SMTP/Twilio credentials
- Enable proxy rotation for heavy extraction
- Respect website ToS and rate limits

---

## 📞 Support

**Email:** support@bundlewp.com  
**Website:** https://bundlewp.com

---

## 📄 License

See [LICENSE.md](LICENSE.md) for licensing terms.

---

© 2025 BundleWP. All rights reserved.
