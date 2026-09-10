# DataXtract Mini

A local data-extraction and outreach application from [BundleWP](https://bundlewp.com). It includes Google Maps and domain extraction, lead verification, screenshots, code download, traffic testing, and authenticated outreach tools.

Repository: **https://github.com/99proteam/DataXtract-Mini**

## Requirements

- Windows, macOS, or Linux
- Node.js 18 or newer (Node.js 20 LTS recommended)
- npm
- Google Chrome or Microsoft Edge
- 4 GB RAM recommended

## Install and run

### Option A: Downloaded or transferred folder

1. Install [Node.js](https://nodejs.org/) 18 or newer.
2. Install Chrome or Microsoft Edge.
3. Extract/copy the complete project folder.
4. Open Terminal or PowerShell inside that folder.
5. Run this one command:

   ```bash
   npm run deploy
   ```

6. Open **http://localhost:3007**.

The command installs all dependencies and starts the server. For later starts, use `npm start`.

### Option B: Clone from GitHub

```bash
git clone https://github.com/99proteam/DataXtract-Mini.git
cd DataXtract-Mini
npm run deploy
```

## First-time configuration

1. Open **http://localhost:3007**.
2. Select **Settings**.
3. Configure only the integrations you intend to use:

| Integration | Required for |
|---|---|
| SMTP host, port, username, password | Email campaigns |
| Twilio Account SID, auth token, sender number | SMS campaigns |
| Webshare/custom proxies | Optional proxy rotation |
| ZeroBounce API key | Optional ZeroBounce email checks |
| OpenAI or Gemini key | Optional AI features |

Settings are stored locally in `data/settings.json`. Do not publish or share that file after adding real credentials. Application data is stored in `data/extractor.db`; the root-level `data.db` file is not used.

## How to use each tool

### Google Maps extraction

1. Click **New Campaign** and select **Google Maps**.
2. Enter one search per line, such as `dentists in Hyderabad`.
3. Choose the result limit, details option, user-agent rotation, and delay.
4. Create the campaign and click **Start**.
5. Review live results and export them when complete.

If a configured proxy is unreachable, the extractor automatically retries through the direct connection.

### Domain extraction

1. Create a text or CSV file containing one domain per line, without paths.
2. Click **New Campaign**, select **Domain Extraction**, and upload the file.
3. Choose emails, phones, technology, social links, metadata, media, and crawl depth.
4. Create and start the campaign.
5. Export the grouped results as CSV, JSON, or Excel.

Example input:

```text
example.com
company.example
```

### Verify leads

1. Open **Verify Leads**.
2. Upload or paste email addresses/phone numbers.
3. Select a verification method.
4. Run verification and export valid or invalid results.

MX email verification works without an API key. ZeroBounce requires its API key. WhatsApp-number verification requires an active, logged-in WhatsApp session.

### SMS campaign

1. Configure Twilio under **Settings**.
2. Open **SMS Campaign** and upload recipients.
3. Write the message and optionally use personalization fields such as `{{name}}`.
4. Test with one controlled number.
5. Start the campaign and review sent/failed results.

### Email campaign

1. Configure and test SMTP under **Settings**.
2. Open **Email Campaign** and upload recipients.
3. Add the subject, HTML/text content, sender details, and attachments.
4. Send a test email first.
5. Start the campaign and review the results.

### WhatsApp Web

1. Open **WhatsApp Web** and add a session name.
2. Start the session and scan the displayed QR code with WhatsApp.
3. Wait until the session shows as logged in.
4. Upload recipients, prepare the message, and run the campaign.

The session is stored locally so it can be reused until WhatsApp expires it.

### LinkedIn

1. Open **LinkedIn** and start a named session.
2. Log in manually in the Chrome window that opens.
3. Return to DataXtract Mini and click **Confirm Login**.
4. Use people, company, profile, or job extraction.

LinkedIn may show verification challenges. Complete them manually and use reasonable request limits.

### Bulk Screenshots

1. Open **Tools → Bulk Screenshots**.
2. Upload a URL list.
3. Select desktop, laptop, tablet, or mobile viewports.
4. Start the job and download the generated PNG files.

### Code Downloader

1. Open **Tools → Code Downloader**.
2. Enter or upload URLs.
3. Select static HTML or rendered JavaScript mode.
4. Start the download and collect the generated HTML files.

### Traffic testing

1. Open **Tools → Fake Traffic**.
2. Enter URLs you own or are authorized to test.
3. Choose visit count, device, duration, human simulation, and optional proxies.
4. Start the job and review the activity log.

## Useful commands

| Command | Purpose |
|---|---|
| `npm run deploy` | Install dependencies and start the application |
| `npm start` | Start an already-installed copy |
| `npm run dev` | Start the development server |
| `npm test` | Run automated integrity tests |
| `npm run build-exe` | Build the Windows executable package |

## Troubleshooting

- **Port already in use:** close the other DataXtract/Node process and run `npm start` again.
- **Chrome does not open:** install or update Chrome/Edge, or set `PUPPETEER_EXECUTABLE_PATH` to a working browser executable.
- **SMS/Email reports configuration errors:** complete Twilio or SMTP settings before sending.
- **WhatsApp/LinkedIn is not ready:** start a session and finish the manual login first.
- **Proxy connection failed:** disable/remove dead proxies; Maps and domain extraction also retry directly.
- **Database locked:** close external database viewers while a campaign is writing data.

More documentation: [Installation](docs/INSTALLATION.md), [User Guide](docs/USER_GUIDE.md), [Changelog](docs/CHANGELOG.md), and [License](LICENSE.md).

## Premium products from BundleWP

Explore the complete catalog at **[bundlewp.com/shop](https://bundlewp.com/shop/)**.

| Product | Description | Listed price* |
|---|---|---:|
| [Auto Lead Pilot AI – The Complete Business Solution](https://bundlewp.com/product/auto-lead-pilot-ai/) | All-in-one lead generation and business automation platform for campaigns, CRM, customer engagement, Google integrations, website tools, and team productivity. | $699–$1,999 |
| [Billify – Smart Inventory, Billing and POS](https://bundlewp.com/product/billify-smart-inventory-billing-and-pos-windows-software/) | Windows software for products, invoices, sales, stock alerts, customers, suppliers, reports, and barcode workflows. | $19 sale |
| [DataXtract Pro Web Application](https://bundlewp.com/product/dataxtract-pro/) | Data extraction and outreach suite for finding leads, extracting business data, managing campaigns, and automating marketing workflows. | $30 |
| [WooFlow Manager](https://bundlewp.com/product/wooflow-manager-store-automation-toolkit-for-woocommerce/) | WooCommerce order control, product automation, rewards, recovery workflows, reports, exports, and license delivery. | $29 |
| [Fin Tools WordPress Theme](https://bundlewp.com/product/fin-tools-100-premium-web-tools-for-wordpress/) | WordPress tools website with finance calculators, PDF, image, developer, text, converter, and network tools. | $29 |
| [Pro Fin Suite Windows Software](https://bundlewp.com/product/pro-fin-suite/) | Finance, business management, productivity, office, media, security, marketing, and system tools. | $45 |
| [All In One Smart Extractor Windows Software](https://bundlewp.com/product/all-in-one-smart-extractor/) | Windows extraction suite for business data, social intelligence, e-commerce research, marketplace data, and lead generation. | $20 |

*Prices shown on BundleWP when this README was updated; visit the website for current pricing and availability.

## Support and license

- Website: https://bundlewp.com
- Email: support@bundlewp.com
- License: see [LICENSE.md](LICENSE.md)

© 2026 BundleWP. All rights reserved.
