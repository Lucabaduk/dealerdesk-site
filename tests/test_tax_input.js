// Tax % inputs: 0 < value < 1 is a decimal rate (0.06 -> 6%), with a hint.
const { t, eq, ok, done } = require('./_h.js');
const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..');
let JSDOM = null; for (const p of ['/tmp/uit/node_modules/jsdom', '/tmp/devmods/node_modules/jsdom', '/tmp/qrdev/node_modules/jsdom', 'jsdom']) { try { JSDOM = require(p).JSDOM; break; } catch (e) {} }
const data = JSON.parse(fs.readFileSync(path.join(dir, 'src/sample-data.json'), 'utf8'));
const inline = f => fs.readFileSync(path.join(dir, f), 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(dir, s), 'utf8') + '<\/script>');
const tick = (ms) => new Promise(r => setTimeout(r, ms || 60));
function boot(file, url, seed) { const errors = [];
  const w = new JSDOM(inline(file), { url, runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(win) {
    for (const k in (seed || {})) win.localStorage.setItem(k, seed[k]); win.confirm = () => true; win.scrollTo = () => {};
    win.fetch = u => String(u).startsWith('version') ? new Promise(() => {}) : Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(data))) });
    win.addEventListener('error', e => errors.push(e.message)); } }).window; w.__errors = errors; return w; }
(async () => {
  if (!JSDOM) { console.log('  (jsdom not found, skipped)'); return done('tax input'); }
  const w = boot('app.html', 'https://x.test/app.html'); await tick(); const d = w.document;
  const go = () => d.querySelector('[data-view=settings]').click();
  const sub = (form, vals) => { const f = d.querySelector('[data-form=' + form + ']'); for (const n in vals) f.elements[n].value = vals[n]; f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); };
  const typeIn = (form, name, v) => { const i = d.querySelector('[data-form=' + form + '] [name=' + name + ']'); i.value = v; i.dispatchEvent(new w.Event('input', { bubbles: true })); return i.parentNode.querySelector('[data-tax-hint]').textContent; };
  go();
  t('Settings: typing 0.06 shows a live hint "Read as 6%"', () => { ok(/Read as 6%/.test(typeIn('settings', 'tax_rate', '0.06'))); eq(typeIn('settings', 'tax_rate', '6'), ''); eq(typeIn('settings', 'tax_rate', '0'), ''); eq(typeIn('settings', 'tax_rate', '1'), ''); });
  t('Settings: saving 0.06 stores 6% (app + orders) and the toast says so', () => { go(); sub('settings', { tax_rate: '0.06' }); eq(w.DealerDesk.state.settings.tax_rate, 6); eq(w.DDOrders.settings().taxRate, 6);
    ok(/read as 6%/.test(d.getElementById('toast').textContent), d.getElementById('toast').textContent); eq(d.querySelector('[data-form=settings] [name=tax_rate]').value, '6'); });
  t('Settings: 0.0625 -> 6.25%, 6.5 stays 6.5%, 0 stays 0, 1 stays 1%', () => { for (const [i, o] of [['0.0625', 6.25], ['6.5', 6.5], ['0', 0], ['1', 1], ['.07', 7]]) { go(); sub('settings', { tax_rate: i }); eq(w.DealerDesk.state.settings.tax_rate, o, i); }
    go(); sub('settings', { tax_rate: '6.5' }); ok(d.getElementById('toast').textContent === 'Saved', 'no note for normal value'); });
  t('Settings: invalid still rejected (blank, letters, 30)', () => { for (const v of ['', 'abc', '30']) { go(); sub('settings', { tax_rate: v }); eq(w.DealerDesk.state.settings.tax_rate, 6.5, v); } });
  t('Orders: typing 0.06 shows hint; saving stores 6% and syncs app', () => { go(); ok(/Read as 6%/.test(typeIn('ordersettings', 'taxRate', '0.06'))); sub('ordersettings', { taxRate: '0.06' });
    eq(w.DDOrders.settings().taxRate, 6); eq(w.DealerDesk.state.settings.tax_rate, 6); ok(/read as 6%/.test(d.getElementById('toast').textContent));
    go(); eq(d.querySelector('[data-form=ordersettings] [name=taxRate]').value, '6'); eq(d.querySelector('[data-form=ordersettings] [data-tax-hint]').textContent, ''); });
  t('Orders: 0.06 together with an invalid field saves nothing', () => { go(); const before = JSON.stringify(w.DDOrders.settings()); sub('ordersettings', { taxRate: '0.08', defaultApr: '99' }); eq(JSON.stringify(w.DDOrders.settings()), before); ok(!/read as/.test(d.getElementById('toast').textContent)); });
  const car = data.cars.find(c => c.status === 'available'); const o = boot('order.html', 'https://x.test/order.html?vehicle=' + car.stock_no, { dealerdesk_orders: w.localStorage.getItem('dealerdesk_orders'), dealerdesk_data: JSON.stringify(data) }); await tick();
  t('order.html shows tax 6%', () => eq(o.document.getElementById('ddo-tax').textContent, '6'));
  t('no JS errors', () => { eq(w.__errors, []); eq(o.__errors, []); });
  done('tax input');
})();
