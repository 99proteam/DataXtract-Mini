#!/usr/bin/env node
/*
 * Builds the static GitHub Pages site into _site/.
 *
 *   _site/index.html   landing page with install guide (demo/landing.html)
 *   _site/app/         the dashboard from public/, running on sample data
 *
 * For the dashboard:
 *   - demo/demo-api.js is injected before app.js to replace the backend with sample data,
 *   - absolute asset and route links are made relative to the app sub-path,
 *   - it is also written as the site 404.html so deep links such as app/campaigns/1 still load.
 *
 * Usage: BASE_PATH=/DataXtract-Mini/ node scripts/build-pages.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '_site');
const appDir = path.join(outDir, 'app');
const siteBase = `/${(process.env.BASE_PATH || '/DataXtract-Mini/').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
const appBase = `${siteBase}app/`;

function copyDir(from, to) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        if (entry.name === 'screenshots') continue;
        const src = path.join(from, entry.name);
        const dest = path.join(to, entry.name);
        if (entry.isDirectory()) copyDir(src, dest);
        else fs.copyFileSync(src, dest);
    }
}

function replaceRequired(text, search, replacement, label) {
    if (!text.includes(search)) throw new Error(`build-pages: expected ${label} not found`);
    return text.split(search).join(replacement);
}

fs.rmSync(outDir, { recursive: true, force: true });

// Landing page
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(path.join(root, 'demo', 'landing.html'), path.join(outDir, 'index.html'));
fs.copyFileSync(path.join(root, 'public', 'favicon.svg'), path.join(outDir, 'favicon.svg'));
fs.copyFileSync(path.join(root, 'docs', 'images', 'dashboard.png'), path.join(outDir, 'dashboard.png'));
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

// Demo dashboard
copyDir(path.join(root, 'public'), appDir);
fs.mkdirSync(path.join(appDir, 'demo'), { recursive: true });
fs.copyFileSync(path.join(root, 'demo', 'demo-api.js'), path.join(appDir, 'demo', 'demo-api.js'));
fs.copyFileSync(path.join(root, 'demo', 'demo.css'), path.join(appDir, 'demo', 'demo.css'));

// app.js routes on window.location.pathname; under a sub-path it must see the path without the prefix.
const appJsPath = path.join(appDir, 'js', 'app.js');
const appJs = replaceRequired(fs.readFileSync(appJsPath, 'utf8'), 'window.location.pathname', 'window.__demoPathname()', 'pathname reads in app.js');
fs.writeFileSync(appJsPath, appJs);

let html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
html = replaceRequired(html, '<title>Domain Data Extractor - Campaign System</title>', '<title>DataXtract Mini - Live Demo</title>', 'page title');
html = html.replace(/(href|src)="\/(?!\/)/g, '$1="');
html = replaceRequired(html, '<head>', `<head>\n    <base href="${appBase}">`, '<head>');
html = replaceRequired(html, '<link rel="stylesheet" href="css/style.css">',
    '<link rel="stylesheet" href="css/style.css">\n    <link rel="stylesheet" href="demo/demo.css">', 'stylesheet link');
html = replaceRequired(html, '<script src="js/app.js"></script>',
    `<script>window.__DEMO_BASE__ = ${JSON.stringify(appBase)}; window.__DEMO_HOME__ = ${JSON.stringify(siteBase)};</script>\n        <script src="demo/demo-api.js"></script>\n        <script src="js/app.js"></script>`,
    'app.js script tag');

fs.writeFileSync(path.join(appDir, 'index.html'), html);
fs.writeFileSync(path.join(outDir, '404.html'), html);

console.log(`Site built in ${path.relative(root, outDir)}/ (landing ${siteBase}, demo ${appBase})`);
