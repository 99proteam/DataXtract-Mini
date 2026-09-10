const path = require('path');
const puppeteer = require('puppeteer');
const { withBrowserExecutable } = require('../services/browserExecutable');

async function main() {
  const browser = await puppeteer.launch(withBrowserExecutable({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }));

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 520, deviceScaleFactor: 1 });
    await page.goto('http://localhost:3007', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    await page.evaluate(() => {
      const recentSection = document.querySelector('.recent-section');
      if (recentSection) recentSection.remove();
    });
    await page.screenshot({
      path: path.join(__dirname, '..', 'docs', 'images', 'dashboard.png'),
      fullPage: false,
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
