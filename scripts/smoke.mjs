// Headless smoke test: opens the game in the locally installed Edge/Chrome,
// runs a scripted scenario, fails on console errors and saves screenshots to
// scripts/shots/. Usage: start `npm run dev` (or preview), then
//   node scripts/smoke.mjs [scenario] [url]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { scenarios } from './scenarios.mjs';

const name = process.argv[2] || 'default';
const url = process.argv[3] || 'http://localhost:5173/';
mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });

let browser;
for (const channel of ['msedge', 'chrome']) {
  try {
    browser = await chromium.launch({ channel, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    break;
  } catch {
    /* try next browser */
  }
}
if (!browser) {
  console.error('No Edge/Chrome found for the smoke test.');
  process.exit(2);
}
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));

const shot = (n) => page.screenshot({ path: new URL(`./shots/${n}.png`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const wait = (ms) => page.waitForTimeout(ms);

try {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 20000 });
  const run = scenarios[name];
  if (!run) throw new Error('Unknown scenario: ' + name);
  await run({ page, shot, wait });
} catch (e) {
  errors.push('SCENARIO ' + e.message);
}
await browser.close();
const real = errors.filter((e) => !/favicon|fonts\.g|ERR_INTERNET|net::ERR|GPU stall|WebGL: INVALID|GL Driver Message/i.test(e));
if (real.length) {
  console.error(`✗ ${name}: ${real.length} error(s)`);
  for (const e of real.slice(0, 12)) console.error('  ' + e);
  process.exit(1);
}
console.log(`✓ ${name}: no console errors`);
