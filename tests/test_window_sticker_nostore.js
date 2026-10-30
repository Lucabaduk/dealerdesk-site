// Storage blocked/full + >30 cars: Print stickers must still open (VINs in URL, first URL_MAX) and say so, never silently do nothing.
const { t, eq, ok, done, genCars } = require('./_h.js');
const fs = require('fs'), path = require('path'), WS = require('../modules/window-sticker.js');
const dir = path.join(__dirname, '..'), bad = { setItem() { throw new Error('QuotaExceededError'); }, getItem() { throw new Error('SecurityError'); } };
const vins = n => genCars(n).map(c => c.vin);
t('<=100 cars: all VINs go in the URL, no total', () => { const v = vins(40), u = WS.batchUrl(v, bad); ok(u.startsWith('window-sticker.html?vins=')); eq(WS.parseVins(u.slice(u.indexOf('?'))), { vins: v, total: 40 }); });
t('>100 cars: first 100 in URL, total + nostore reported', () => { const v = vins(500), u = WS.batchUrl(v, bad), r = WS.parseVins(u.slice(u.indexOf('?'))); eq(r.vins, v.slice(0, WS.URL_MAX)); eq(r.total, 500); eq(r.noStore, true); ok(u.length < 2500, 'url ' + u.length); });
t('spoofed total ignored when not larger / absurd', () => { const v = vins(3); eq(WS.parseVins('?vins=' + v.join(',') + '&total=1').total, 3); eq(WS.parseVins('?vins=' + v.join(',') + '&total=1e99').total, 3); eq(WS.parseVins('?vins=' + v.join(',') + '&total=abc').total, 3); });
const JSDOM = (() => { for (const p of ['/workspace/ddtools/node_modules/jsdom', 'jsdom']) { try { return require(p).JSDOM; } catch (e) {} } return null; })();
async function dom() { if (!JSDOM) return; const cars = genCars(60);
  const html = fs.readFileSync(path.join(dir, 'staff-inventory.html'), 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(dir, s), 'utf8') + '<\/script>');
  const opened = [], w = new JSDOM(html, { url: 'https://x.io/dd/staff-inventory.html', runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(win) { win.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ cars }) }); win.open = u => (opened.push(u), {});
    Object.defineProperty(win, 'sessionStorage', { get() { return bad; } }); } }).window;
  await new Promise(r => setTimeout(r, 150)); const d = w.document;
  d.getElementById('stickers').click();
  t('staff button opens stickers via URL fallback (60 cars)', () => { eq(opened.length, 1); ok(/^window-sticker\.html\?vins=/.test(opened[0]) && /&print=1$/.test(opened[0])); eq(WS.parseVins(opened[0].slice(opened[0].indexOf('?'))).vins.length, 60); ok(d.getElementById('st-notice').hidden); });
  const page = fs.readFileSync(path.join(dir, 'modules/window-sticker-page.js'), 'utf8');
  t('sticker page explains the storage cut', () => ok(/parsed\.noStore/.test(page) && /Browser storage is unavailable/.test(page)));
}
dom().then(() => done('window sticker no-storage'));
