// Renders PNG app icons from public/icons/favicon.svg using the Playwright Chromium.
// Run with `npm run icons` (requires playwright available globally).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const svg = readFileSync(new URL('../public/icons/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(size, file, { maskable = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  // Maskable icons need a safe zone: full-bleed background, artwork scaled to ~80%.
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#1b1420;display:grid;place-items:center"><div style="width:${size * 0.8}px;height:${size * 0.8}px">${svg}</div></div>`
    : `<div style="width:${size}px;height:${size}px">${svg}</div>`;
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner}<style>svg{width:100%;height:100%;display:block}</style></body></html>`);
  writeFileSync(new URL(`../public/icons/${file}`, import.meta.url), await page.screenshot({ omitBackground: !maskable }));
}
await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(512, 'icon-maskable-512.png', { maskable: true });
await render(180, 'apple-touch-icon.png', { maskable: true });
await browser.close();
console.log('icons written');
