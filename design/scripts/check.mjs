// Smoke-check every mockup: JS errors + broken local links. Usage: node scripts/check.mjs
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH || '/home/alexie/project-alex/sigchat/frontend/node_modules/playwright');
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'mockups');
const pages = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
let bad = 0;
for (const f of pages) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } }); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto('file://' + path.join(dir, f) + '?clean=1', { waitUntil: 'load', timeout: 30000 }).catch(e => errs.push('goto: ' + e.message));
  await p.waitForTimeout(1500);
  const links = await p.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
  const broken = [...new Set(links.filter(h => h && /\.html/.test(h) && !/^https?:/.test(h)).map(h => h.split(/[?#]/)[0]).filter(h => !fs.existsSync(path.join(dir, h))))];
  if (broken.length) errs.push('broken links: ' + broken.join(', '));
  console.log((errs.length ? 'FAIL ' : 'ok   ') + f + (errs.length ? '\n   ' + errs.join('\n   ') : ''));
  bad += errs.length ? 1 : 0; await p.close();
}
await browser.close(); process.exit(bad ? 1 : 0);
