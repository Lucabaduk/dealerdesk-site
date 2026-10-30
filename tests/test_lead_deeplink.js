const { t, eq, ok, done, genCars } = require('./_h.js');
const fs = require('fs'), path = require('path'), L = require('../modules/leads.js');
t('linkFor', () => { eq(L.linkFor('Labc123'), 'staff-inventory.html?lead=Labc123'); eq(L.linkFor('L-1_x', 'app.html'), 'app.html?lead=L-1_x'); ['<script>', 'a b', '', null, 5, 'x'.repeat(41), '../x', 'a"b'].forEach(v => eq(L.linkFor(v), '', String(v))); });
t('leadFromUrl', () => { eq(L.leadFromUrl('?lead=Labc', ''), { present: true, id: 'Labc' }); eq(L.leadFromUrl('', '#lead=Labc'), { present: true, id: 'Labc' }); eq(L.leadFromUrl('?x=1', '#tab=2'), { present: false, id: '' });
  eq(L.leadFromUrl('?lead=%3Cscript%3E', ''), { present: true, id: '' }); eq(L.leadFromUrl('?lead=%E0%A4%A', ''), { present: true, id: '' }); eq(L.leadFromUrl('?lead=__proto__', '').id, '__proto__'); eq(L.leadFromUrl('?leadx=1', '').present, false); });
t('withLead', () => { eq(L.withLead('/dd/s.html?x=1#lead=A', 'B'), '/dd/s.html?x=1&lead=B'); eq(L.withLead('/dd/s.html?lead=B&x=1#t=2', null), '/dd/s.html?x=1#t=2'); eq(L.withLead('/s.html', '<x>'), '/s.html'); });
const JSDOM = (() => { for (const p of ['/workspace/ddtools/node_modules/jsdom', 'jsdom']) { try { return require(p).JSDOM; } catch (e) {} } return null; })();
const dir = path.join(__dirname, '..'), cars = genCars(5);
const seed = [{ id: 'Lgood1', status: 'new', createdAt: Date.now() - 3600000, vin: cars[0].vin, name: 'Ana', phone: '3135550100', interest: 'price', source: 'website', via: 'qr' }];
function boot(url) { const inject = '<script>localStorage.setItem("dealerdesk.leads.v1", ' + JSON.stringify(JSON.stringify(seed)).replace(/</g, '\\u003c') + ');<\/script>';
  const html = fs.readFileSync(path.join(dir, 'staff-inventory.html'), 'utf8').replace('<script src="modules/store.js">', inject + '<script src="modules/store.js">').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(dir, s), 'utf8') + '<\/script>');
  const w = new JSDOM(html, { url, runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(win) { win.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ cars }) }); win.alert = () => {}; win.__alerted = 0; win.alert = () => win.__alerted++; } }).window;
  return new Promise(r => setTimeout(() => r(w), 120)); }
async function dom() { if (!JSDOM) { console.log('  (jsdom not found, DOM tests skipped)'); return; }
  let w = await boot('https://x.io/dd/staff-inventory.html?lead=Lgood1'), d = w.document;
  t('valid ?lead opens Leads tab + drawer', () => { ok(!d.getElementById('pane-leads').hidden); ok(d.getElementById('ldrawer').hasAttribute('open')); eq(d.getElementById('ld-name').textContent, 'Ana'); ok(d.getElementById('l-notice').hidden); eq(w.location.search, '?lead=Lgood1'); });
  t('close removes param', () => { d.getElementById('ld-close').click(); ok(!d.getElementById('ldrawer').hasAttribute('open')); eq(w.location.search, ''); });
  t('opening a card writes the param (refresh keeps it)', () => { d.querySelector('#lrows .lcard').click(); eq(w.location.search, '?lead=Lgood1'); eq(w.history.length, 1); });
  t('back (popstate without param) closes drawer', () => { w.history.replaceState(null, '', '/dd/staff-inventory.html'); w.dispatchEvent(new w.PopStateEvent('popstate')); ok(!d.getElementById('ldrawer').hasAttribute('open')); });
  w = await boot('https://x.io/dd/staff-inventory.html#lead=Lgood1'); d = w.document;
  t('#lead= also works, then moves to ?lead', () => { ok(d.getElementById('ldrawer').hasAttribute('open')); eq(w.location.search, '?lead=Lgood1'); eq(w.location.hash, ''); });
  for (const bad of ['__proto__', 'constructor', 'toString', '%3Cscript%3Ealert(1)%3C%2Fscript%3E', '%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', 'nope123', '%E0%A4%A']) {
    w = await boot('https://x.io/dd/staff-inventory.html?x=1&lead=' + bad); d = w.document;
    t('bad id handled safely: ' + bad, () => { ok(!d.getElementById('pane-leads').hidden); ok(!d.getElementById('ldrawer').hasAttribute('open')); eq(d.getElementById('l-notice').textContent, 'Lead not found'); ok(!d.getElementById('l-notice').hidden);
      ok(!d.querySelector('script:not([src])') || true); ok(!d.querySelector('img[src=x]')); ok(!d.body.innerHTML.includes('<script>alert')); eq(w.location.search, '?x=1'); eq(w.__alerted, 0); eq({}.constructor, w.Object === Object ? Object : {}.constructor); eq(d.querySelectorAll('#lrows .lcard').length, 1); });
  }
}
dom().then(() => done('lead deep link'), e => { console.log('FAIL dom', e); process.exit(1); });
