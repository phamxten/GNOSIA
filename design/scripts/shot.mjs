// Screenshot one mockup page per run (RAM-friendly).
// Usage: node scripts/shot.mjs <page> [paper|ink] [width] [query]
// Needs a local Playwright install; set PW_PATH to its node_modules/playwright if different.
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH || '/home/alexie/project-alex/sigchat/frontend/node_modules/playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const [page = 'index', theme = 'paper', width = '1440', extra = ''] = process.argv.slice(2);
const w = +width, h = w < 600 ? 844 : 900;
const url = `file://${path.join(here, '..', 'mockups', page + '.html')}?theme=${theme}&clean=1${extra ? '&' + extra : ''}`;
const tag = (extra ? '-' + extra.replace(/[^a-z0-9]+/gi, '_') : '') + (process.env.TAG ? '-' + process.env.TAG : '');
const out = path.join(process.env.SHOT_DIR || path.join(here, '..', 'shots'), `${page}${tag}-${theme}-${w}.png`);
const browser = await pw.chromium.launch({ args: ['--disable-gpu', '--no-sandbox'] });
const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForLoadState('load', { timeout: 25000 }).catch(() => console.error('warn: load timeout'));
await p.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
await Promise.race([p.evaluate(() => document.fonts.ready), p.waitForTimeout(8000)]).catch(() => {});
await p.waitForTimeout(+(process.env.WAIT || 400));
// CLICK="sel1;sel2" clicks elements in order (to capture interaction states)
for (const sel of (process.env.CLICK || '').split(';').filter(Boolean)) { await p.click(sel); await p.waitForTimeout(+(process.env.STEP || 500)); }
await p.screenshot({ path: out, fullPage: process.env.FULL === '1' });
await browser.close();
console.log(out, errors.length ? '\nERRORS:\n' + errors.join('\n') : '');
