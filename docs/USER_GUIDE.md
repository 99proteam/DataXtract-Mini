# Data Extractor Pro - User Guide

A professional Node.js application for extracting comprehensive data from bulk domains with a campaign-based workflow.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
http://localhost:3000
```

## Features

| Feature | Description |
|---------|-------------|
| **Campaign System** | Create, manage, and run extraction campaigns |
| **Bulk Upload** | Upload .txt files with domain lists |
| **Live/Background** | Real-time or background processing |
| **Smart Filters** | Configure what to extract and limits |
| **Source Tracking** | Track which page each data was found on |
| **Export Options** | CSV, JSON, Excel formats |
| **Visual Tools** | Fake Traffic, Code Downloader, Bulk Screenshots |

## Data Types Extracted

- ✅ **Emails** - All email addresses with source page URL
- ✅ **Phone Numbers** - Multiple formats, international support
- ✅ **Technology** - CMS, frameworks, analytics (40+ signatures)
- ✅ **Social Links** - 17+ platforms (Facebook, Twitter, LinkedIn, etc.)
- ✅ **Metadata** - Title, description, keywords
- ✅ **Address** - Physical/contact address
- ✅ **Media** - Images, videos, PDFs

## Step-by-Step Usage

### 1. Create a Campaign

1. Click **"New Campaign"** in the sidebar
2. Enter a descriptive campaign name
3. Select mode:
   - **Live Mode**: Watch extraction in real-time
   - **Background**: Run silently while you work

> **Note:** Please run **only one campaign at a time** to ensure best performance and avoid IP bans.

### 2. Upload Domain List

Create a `.txt` file with one domain per line:

```
example.com
google.com
github.com
microsoft.com
```

Drag and drop or click to upload.

### 3. Configure Filters

Select what data to extract:

| Filter | Options |
|--------|---------|
| Emails | 1, 5, 10, or all per domain |
| Phones | 1, 5, or all per domain |
| Technology | Enabled/Disabled |
| Social Links | Enabled/Disabled |
| Metadata | Title, description, address |
| Media | Images, videos, PDFs with limits |

Set **Max Pages** to crawl per domain (1-10).

### 4. Review & Create

Review your settings and click **"Create Campaign"**.

### 5. Start Extraction

1. Click **"Start"** to begin extraction
2. Watch progress in real-time
3. View extracted data in the results table

### 6. Export Results & Scoring

- **Export**: Click "Export" to download CSV, JSON, or Excel.
- **Lead Scoring**: Click **"Calculate Lead Scores"** to grade leads based on data completeness (Phone, Email, Website quality, etc.).

---

## Visual Tools & Extras

### 🚦 Fake Traffic Generator
Located in the **Visual Tools** tab.
- **Purpose**: Simulate organic traffic to websites.
- **Features**:
  - **Rotational Proxies**: Uses a unique IP for every single visit (requires Proxy configuration).
  - **Human Behavior**: Simulates mouse movements, scrolling, and random pauses.
  - **Internal Visits**: Can visit multiple internal pages per session to lower bounce rate.
  - **Device**: Emulate Desktop, Mobile, or a Mix.

### 📸 Bulk Screenshots
- Capture visual copies of multiple websites at once.
- Supports multiple devices (Desktop, Laptop, Tablet, Mobile) and browsers.

### 💾 Code Downloader
- Download full HTML source code of websites.
- Options to download Raw HTML or Rendered JS (Puppeteer).

### 🛡️ Rotation Proxies
Configure under **Settings**.
- Add proxies (Webshare or custom format `host:port:user:pass`).
- Proxies are used automatically for Traffic Generation and heavy Extraction tasks to prevent blocking.

---

## API Reference

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List all campaigns |
| GET | `/api/campaigns/:id` | Get campaign details |
| POST | `/api/campaigns` | Create new campaign |
| DELETE | `/api/campaigns/:id` | Delete campaign |

### Extraction

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/extraction/start/:id` | Start extraction |
| POST | `/api/extraction/pause/:id` | Pause extraction |
| GET | `/api/extraction/status/:id` | Get progress |
| GET | `/api/extraction/export/:id/:format` | Export results |

## Troubleshooting

### "No domains found in file"
- Ensure your file is `.txt` format
- One domain per line
- No `http://` or `https://` prefix needed

### Extraction is slow
- Reduce max pages per domain
- Use background mode for large lists
- Consider extracting fewer data types

### Real-time data not showing
- Ensure WebSocket connection is active (check console).
- Large campaigns may buffer data; wait for completion or check logs.

## System Requirements

- Node.js 18+ 
- 2GB RAM minimum (4GB recommended for large lists)
- Stable internet connection

## License

This product is sold under CodeCanyon's Regular License. One license per project/domain.

---

**Support**: For technical support, please contact through CodeCanyon.
