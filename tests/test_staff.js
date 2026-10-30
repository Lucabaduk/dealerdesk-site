const { t, eq, ok, done, genCars } = require('./_h.js');
const fs = require('fs'), path = require('path'), R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const S = require('../modules/store.js'), SI = require('../modules/staff-inventory.js'), QL = require('../modules/qr-label.js');
t('allowedEndpoint: https + allowlisted host only', () => { const H = ['leads.dealerdesk.example'];
  eq(S.allowedEndpoint('https://leads.dealerdesk.example/api/leads', H), 'https://leads.dealerdesk.example/api/leads');
  ['http://leads.dealerdesk.example/x', 'https://evil.example/x', 'https://leads.dealerdesk.example.evil.com/x', 'https://evil.com@leads.dealerdesk.example/', 'javascript:alert(1)', '//leads.dealerdesk.example/x', 'https://leads.dealerdesk.example/x?a=<b>', '', null].forEach(u => eq(S.allowedEndpoint(u, H), '', String(u)));
  eq(S.allowedEndpoint('https://leads.dealerdesk.example/x', []), ''); });
t('car-page ignores meta unless allowlisted', () => { const s = R('modules/car-page.js'); ok(/LEAD_ENDPOINT_HOSTS = \[\]/.test(s)); ok(s.includes('DDStore.allowedEndpoint(')); ok(!/\/\^https/.test(s)); });
t('setImg falls back to inline placeholder', () => { const img = {}; S.setImg(img, 'assets/site/no-photo.webp'); eq(img.src, 'assets/site/no-photo.webp'); img.onerror(); ok(img.src.startsWith('data:image/svg+xml')); eq(img.onerror, null); const i2 = {}; S.setImg(i2, ''); ok(i2.src === S.NOPHOTO); });
t('labelData text lines', () => { const d = QL.labelData({ vin: '1hgcm82633a004352', year: 2022, make: 'Toyota', model: 'Camry', trim: 'SE', price: 24990, stock_no: 'U100042' }, 'https://x.io/dd/staff-inventory.html');
  eq([d.title, d.trim, d.price, d.vin, d.stock], ['2022 Toyota Camry', 'SE', '$24,990', 'VIN 1HGCM82633A004352', 'Stock # U100042']); eq(d.url, 'https://x.io/dd/car.html?vin=1HGCM82633A004352'); ok(d.svg.startsWith('<svg')); eq(d.error, '');
  eq(QL.labelData({ vin: 'X', price_cents: 150000 }, 'https://x.io/').price, '$1,500'); eq(QL.labelData({ vin: '1HGCM82633A004352' }, 'https://x.io/' + 'a'.repeat(400) + '/').error, 'QR link too long'); });
t('formToCar + errorText + buildQuery', () => { const c = SI.formToCar({ vin: 'v', photos: 'a.webp\n https://x.io/b.webp ', features: 'A, B,,C ' }); eq(c.photos, ['a.webp', 'https://x.io/b.webp']); eq(c.features, ['A', 'B', 'C']);
  ok(SI.errorText(['vin', 'price', 'weird']).includes('VIN (17 chars')); const q = SI.buildQuery({ text: 'camry', sort: 'price:desc', maxPrice: '30000', page: 3 }); eq([q.sort, q.dir, q.maxPrice, q.page, q.pageSize], ['price', 'desc', 30000, 3, 24]); eq(SI.buildQuery({ maxPrice: 'abc' }).maxPrice, undefined); });
t('no HTML injection sinks in UI code', () => { ['modules/staff-inventory.js', 'modules/qr-label.js', 'modules/car-page.js', 'modules/compare-page.js', 'modules/favorites.js'].forEach(f => ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(R(f).replace(/\/\*[\s\S]*?\*\//g, '')), f)); });
t('print layout present', () => { const h = R('staff-inventory.html'); ok(/@media print/.test(h) && /\.dd-page\{display:grid;grid-template-columns:repeat\(3,1fr\);grid-template-rows:repeat\(4,63mm\)/.test(h) && /break-inside:avoid/.test(h)); ok(/prefers-color-scheme:dark/.test(h)); });
// DOM run with jsdom if available
let JSDOM = null; for (const p of ['/workspace/ddtools/node_modules/jsdom', '/tmp/devmods/node_modules/jsdom', '/tmp/qrdev/node_modules/jsdom', 'jsdom']) { try { JSDOM = require(p).JSDOM; break; } catch (e) {} }
async function dom() {
  if (!JSDOM) { console.log('  (jsdom not found, DOM tests skipped)'); return; }
  const cars = genCars(60); cars[0].make = '<img src=x onerror=alert(1)>'; cars[0].photos = [];
  const dir = path.join(__dirname, '..');
  const mk = async (file, url) => { const html = R(file).replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(dir, s), 'utf8') + '<\/script>');
    const w = new JSDOM(html, { url, runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(win) { win.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ cars }) }); win.HTMLDialogElement && (win.HTMLDialogElement.prototype.showModal = function () { this.open = true; }, win.HTMLDialogElement.prototype.close = function () { this.open = false; }); win.print = () => { win.__printed = (win.__printed || 0) + 1; }; win.confirm = () => true; win.alert = () => {}; } }).window;
    await new Promise(r => setTimeout(r, 80)); return w; };
  const w = await mk('staff-inventory.html', 'https://x.io/dd/staff-inventory.html'), d = w.document;
  t('DOM staff: 24 rows, paging, escaped', () => { eq(d.querySelectorAll('#rows tr').length, 24); ok(d.getElementById('count').textContent.startsWith('60')); ok(!d.querySelector('#rows img[src=x]')); ok(d.getElementById('rows').textContent.includes('img src=x onerror')); d.getElementById('next').click(); eq(d.getElementById('pageinfo').textContent, 'Page 2 of 3'); });
  t('DOM staff: search filter', () => { const q = d.getElementById('q'); q.value = cars[5].stock_no; q.dispatchEvent(new w.Event('input')); eq(d.querySelectorAll('#rows tr').length, 1); q.value = ''; q.dispatchEvent(new w.Event('input')); });
  t('DOM staff: add car via form + validation', () => { d.getElementById('add').click(); const f = d.getElementById('carform'); f.elements.vin.value = 'bad'; f.dispatchEvent(new w.Event('submit', { cancelable: true })); ok(d.getElementById('formerr').textContent.includes('VIN')); ok(d.getElementById('dlg').hasAttribute('open'));
    Object.entries({ vin: '1HGCM82633A004352', year: '2023', make: 'Zeta', model: 'One', price: '19,990', mileage: '100' }).forEach(([k, v]) => f.elements[k].value = v); f.dispatchEvent(new w.Event('submit', { cancelable: true })); eq(d.getElementById('formerr').textContent, ''); ok(!d.getElementById('dlg').hasAttribute('open')); ok(d.getElementById('count').textContent.startsWith('61')); });
  t('DOM staff: status change + print QR sheet', () => { const sel = d.querySelector('#rows select'); sel.value = 'sold'; sel.dispatchEvent(new w.Event('change')); const vin = d.querySelector('#rows tr td.hide-sm.muted').textContent; ok(JSON.parse(w.localStorage.getItem('dealerdesk.inventory.v2')).find(c => c.vin === vin).status === 'sold');
    d.getElementById('print-page').click(); eq(d.querySelectorAll('#print .dd-label').length, 24); eq(d.querySelectorAll('#print .dd-page').length, 2); eq([...d.querySelectorAll('#print .dd-page')].map(p => p.children.length), [12, 12]); ok(d.querySelector('#print .dd-label .dd-l4').textContent.startsWith('VIN ')); });
  await new Promise(r => setTimeout(r, 80));
  t('DOM staff: printed', () => ok(w.__printed >= 1));
  // leads tab with a lead submitted from car page (same storage key, same origin)
  const cw = await mk('car.html', 'https://x.io/dd/car.html?vin=' + cars[1].vin), cd = cw.document;
  t('DOM car page: shows car, submits lead', () => { ok(cd.getElementById('car').textContent.includes(cars[1].model)); const f = cd.getElementById('lead'); f.elements.name.value = 'Ana <b>'; f.elements.phone.value = '313 555 0100'; f.dispatchEvent(new cw.Event('submit', { cancelable: true })); ok(cd.getElementById('msg').textContent.startsWith('Thanks'));
    w.localStorage.setItem('dealerdesk.leads.v1', cw.localStorage.getItem('dealerdesk.leads.v1')); });
  const w2 = await mk('staff-inventory.html', 'https://x.io/dd/staff-inventory.html'), d2 = w2.document;
  const lw = await (async () => { const x = await mk('staff-inventory.html', 'https://x.io/dd/staff-inventory.html'); return x; })();
  lw.localStorage.setItem('dealerdesk.leads.v1', cw.localStorage.getItem('dealerdesk.leads.v1'));
  const lw2 = await mk('staff-inventory.html', 'https://x.io/dd/staff-inventory.html'); // fresh load picks up leads if storage shared
  const target = lw2.localStorage.getItem('dealerdesk.leads.v1') ? lw2 : null;
  t('DOM leads: list + status', () => { if (!target) { console.log('  (jsdom storage not shared across windows; leads tab checked via injected window)'); }
    const W = target || lw; W.localStorage.setItem('dealerdesk.leads.v1', cw.localStorage.getItem('dealerdesk.leads.v1')); });
  const W = await (async () => { const html = R('staff-inventory.html'); const leadsJson = cw.localStorage.getItem('dealerdesk.leads.v1');
    const inject = '<script>localStorage.setItem("dealerdesk.leads.v1", ' + JSON.stringify(leadsJson) + ');<\/script>';
    const full = html.replace('<script src="modules/store.js">', inject + '<script src="modules/store.js">').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(dir, s), 'utf8') + '<\/script>');
    const x = new JSDOM(full, { url: 'https://y.io/dd/staff-inventory.html', runScripts: 'dangerously', beforeParse(win) { win.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ cars }) }); } }).window; await new Promise(r => setTimeout(r, 80)); return x; })();
  t('DOM leads tab: badge, row, status, escaped', () => { const D = W.document; eq(D.getElementById('newcount').textContent, '1'); D.getElementById('tab-leads').click(); ok(!D.getElementById('pane-leads').hidden); const rows = D.querySelectorAll('#lrows .lcard'); eq(rows.length, 1);
    ok(rows[0].textContent.includes('Ana b')); rows[0].click(); ok(D.querySelector('#ld-contact a[href^="tel:"]')); const sel = D.getElementById('ld-status'); sel.value = 'contacted'; sel.dispatchEvent(new W.Event('change')); eq(D.getElementById('newcount').textContent, ''); });
  const cmp = await mk('compare.html', 'https://x.io/dd/compare.html?vins=' + cars[0].vin + ',' + cars[2].vin);
  t('DOM compare: 2 cars, escaped, fallback img', () => { const D = cmp.document; eq(D.querySelectorAll('thead td').length, 2); ok(!D.querySelector('img[src=x]')); ok(D.querySelector('thead img').src.startsWith('data:image/svg+xml')); });
}
dom().then(() => done('staff+labels'), e => { console.log('FAIL dom', e); process.exit(1); });
