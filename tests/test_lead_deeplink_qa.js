const { t, eq, ok, done, genCars } = require('./_h.js');
const fs = require('fs'), path = require('path'), L = require('../modules/leads.js');
// pure helpers: round trips with odd ids, hash/search, encoding
t('linkFor round trip', () => { for (const id of ['L-_9', 'A'.repeat(40), '_', '-']) { const u = L.linkFor(id); const q = u.slice(u.indexOf('?')); eq(L.leadFromUrl(q, '').id, id); } });
t('linkFor rejects odd ids', () => { for (const v of ['A'.repeat(41), 'é', 'L\u0130', 'a%20b', 'javascript:alert(1)', '<img src=x onerror=alert(1)>', ' L1', 'L1\n', {}, ['L1'], undefined]) eq(L.linkFor(v), '', String(v)); });
t('leadFromUrl odd input', () => { eq(L.leadFromUrl('?lead=javascript%3Aalert(1)', '').id, ''); eq(L.leadFromUrl('?lead=' + 'a'.repeat(5000), '').id, ''); eq(L.leadFromUrl('?lead=%EF%BC%A1', '').id, ''); eq(L.leadFromUrl('?lead=', '').present, true); eq(L.leadFromUrl('?lead', '').present, true); eq(L.leadFromUrl('', '#lead=L%2D1').id, 'L-1'); eq(L.leadFromUrl('?LEAD=L1', '').present, false); });
t('withLead keeps other params / hash', () => { eq(L.withLead('/s.html?a=1&lead=X&b=2#x=1&lead=Y', null), '/s.html?a=1&b=2#x=1'); eq(L.withLead('/s.html', 'javascript:x'), '/s.html'); });
const JSDOM = (() => { for (const p of ['/workspace/ddtools/node_modules/jsdom', 'jsdom']) { try { return require(p).JSDOM; } catch (e) {} } return null; })();
const dir = path.join(__dirname, '..'), cars = genCars(5), now = Date.now();
const seed = []; for (let i = 0; i < 450; i++) seed.push({ id: 'Lid' + i, status: i === 420 ? 'lost' : 'new', createdAt: now - i * 60000, vin: cars[0].vin, name: 'P' + i, phone: '3135550100', interest: 'price', source: 'website', via: 'qr' });
seed.push({ id: 'Lid42', status: 'new', createdAt: now - 9e8, vin: cars[0].vin, name: 'Dup?', phone: '3135550100', interest: 'price', source: 'website', via: 'qr' });
function boot(url) { const inject = '<script>localStorage.setItem("dealerdesk.leads.v1", ' + JSON.stringify(JSON.stringify(seed)).replace(/</g, '\\u003c') + ');<\/script>';
  const html = fs.readFileSync(path.join(dir, 'staff-inventory.html'), 'utf8').replace('<script src="modules/store.js">', inject + '<script src="modules/store.js">').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(dir, s), 'utf8') + '<\/script>');
  const w = new JSDOM(html, { url, runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(win) { win.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ cars }) }); win.__alerted = 0; win.alert = () => win.__alerted++; } }).window;
  return new Promise(r => setTimeout(() => r(w), 150)); }
const tick = (ms) => new Promise(r => setTimeout(r, ms || 30));
const D = (w) => w.document.getElementById('ldrawer'), name = (w) => w.document.getElementById('ld-name').textContent;
async function dom() { if (!JSDOM) { console.log('  (jsdom not found, DOM tests skipped)'); return; }
  let w = await boot('https://x.io/dd/staff-inventory.html');
  w.document.getElementById('tab-leads').click(); w.document.querySelector('#lrows .lcard').click();
  t('card open pushes one entry', () => { eq(w.history.length, 2); ok(w.location.search.startsWith('?lead=')); });
  w.history.back(); await tick();
  t('Back closes drawer, stays on page, url clean', () => { ok(!D(w).hasAttribute('open')); eq(w.location.search, ''); eq(w.location.pathname, '/dd/staff-inventory.html'); });
  w.document.querySelector('#lrows .lcard').click(); w.document.getElementById('ld-close').click(); await tick();
  t('close button pops pushed entry (no history growth / loop)', () => { ok(!D(w).hasAttribute('open')); eq(w.location.search, ''); });
  w.document.querySelector('#lrows .lcard').click(); D(w).dispatchEvent(new w.Event('close')); D(w).removeAttribute('open'); await tick();
  t('Esc (dialog close event) cleans url', () => { eq(w.location.search, ''); });
  // pagination: target past the first 200 still opens, and closing keeps Show more position
  w = await boot('https://x.io/dd/staff-inventory.html?lead=Lid350');
  t('lead beyond first 200 opens', () => { ok(D(w).hasAttribute('open')); eq(name(w), 'P350'); });
  w.document.getElementById('ld-close').click();
  t('link-opened close replaces (no back to drawer)', () => { eq(w.location.search, ''); eq(w.history.length, 1); });
  w = await boot('https://x.io/dd/staff-inventory.html'); w.document.getElementById('tab-leads').click(); w.document.getElementById('l-more').click();
  const before = w.document.querySelectorAll('#lrows .lcard').length; w.document.querySelectorAll('#lrows .lcard')[300].click(); w.document.getElementById('ld-close').click(); await tick();
  t('closing keeps Show more pages', () => { eq(w.document.querySelectorAll('#lrows .lcard').length, before); });
  // filter does not hide target
  w = await boot('https://x.io/dd/staff-inventory.html'); w.document.getElementById('tab-leads').click(); const s = w.document.getElementById('l-status'); s.value = 'won'; s.dispatchEvent(new w.Event('change'));
  w.location.hash = 'lead=Lid420'; await tick();
  t('hashchange opens lead hidden by filter', () => { ok(D(w).hasAttribute('open')); eq(name(w), 'P420'); eq(w.location.hash, ''); eq(w.location.search, '?lead=Lid420'); });
  w.location.hash = 'lead=Lid7'; await tick();
  t('hash wins over existing ?lead on hashchange', () => { eq(name(w), 'P7'); eq(w.location.search, '?lead=Lid7'); });
  w.location.hash = 'lead=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E'; await tick();
  t('bad hash while open: drawer stays, url resynced, text-only notice', () => { eq(name(w), 'P7'); eq(w.location.search, '?lead=Lid7'); eq(w.location.hash, ''); const n = w.document.getElementById('l-notice'); eq(n.textContent, 'Lead not found'); eq(n.children.length, 0); ok(!w.document.querySelector('img[src="x"]')); eq(w.__alerted, 0); });
  for (const id of ['Lid', 'Lid4200', 'lid42', 'Lid42%00', 'Lid42%20', 'valueOf', 'hasOwnProperty', 'javascript:alert(1)', 'x'.repeat(4000)]) {
    w = await boot('https://x.io/dd/staff-inventory.html?lead=' + id);
    t('no partial/odd match: ' + id.slice(0, 20), () => { ok(!D(w).hasAttribute('open')); eq(w.document.getElementById('l-notice').textContent, 'Lead not found'); eq(w.location.search, ''); eq(w.__alerted, 0); }); }
  w = await boot('https://x.io/dd/staff-inventory.html?lead=Lid42');
  t('exact match picks Lid42 only', () => { eq(name(w), 'P42'); });
}
dom().then(() => done('lead deep link QA'), e => { console.log('FAIL dom', e); process.exit(1); });
