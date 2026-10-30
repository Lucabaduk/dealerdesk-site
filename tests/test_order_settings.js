// Order settings in the app's Settings view: validate first, apply only on a valid save; order.html picks them up.
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
  if (!JSDOM) { console.log('  (jsdom not found, skipped)'); return done('order settings'); }
  const w = boot('app.html', 'https://x.test/app.html'); await tick(); const d = w.document;
  const set = (vals) => { const f = d.querySelector('[data-form=ordersettings]'); for (const n in vals) f.elements[n].value = vals[n]; f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); };
  d.querySelector('[data-view=settings]').click();
  const f0 = d.querySelector('[data-form=ordersettings]');
  t('Orders section renders in Settings with current values', () => { ok(f0, 'form'); const e = f0.elements; eq([e.depositAmount.value, e.taxRate.value, e.defaultApr.value, e.defaultTerm.value, e.tradeBase.value, e.tradeDepreciation.value, e.tradeMilesPerYear.value, e.tradeMileAdj.value], ['500', '6', '7.9', '72', '32000', '15', '12000', '8']);
    ok(/not an offer/.test(f0.textContent), 'formula shown'); ok(/No payments are taken/.test(f0.textContent)); });
  const before = JSON.stringify(w.DDOrders.settings()), storedBefore = w.localStorage.getItem('dealerdesk_orders');
  t('invalid value: nothing applied, nothing saved, friendly error', () => {
    set({ depositAmount: '900', defaultApr: '55' }); eq(JSON.stringify(w.DDOrders.settings()), before); eq(w.localStorage.getItem('dealerdesk_orders'), storedBefore);
    ok(/Default APR must be between 0 and 40/.test(d.getElementById('toast').textContent), d.getElementById('toast').textContent); });
  t('blank / non-number values rejected without partial changes', () => {
    d.querySelector('[data-view=settings]').click(); set({ depositAmount: '900', tradeBase: '' }); eq(JSON.stringify(w.DDOrders.settings()), before);
    d.querySelector('[data-view=settings]').click(); set({ depositAmount: '900', tradeDepreciation: '80' }); eq(JSON.stringify(w.DDOrders.settings()), before); ok(/depreciation/i.test(d.getElementById('toast').textContent)); });
  t('valid save applies all fields (percent fields converted) and persists', () => {
    d.querySelector('[data-view=settings]').click(); set({ depositAmount: '1000', taxRate: '7.5', defaultApr: '4.9', defaultTerm: '60', tradeBase: '40000', tradeDepreciation: '12', tradeMilesPerYear: '15000', tradeMileAdj: '5' });
    const s = w.DDOrders.settings(); eq([s.depositAmount, s.taxRate, s.defaultApr, s.defaultTerm, s.tradeBase, s.tradeDepreciation, s.tradeMilesPerYear, s.tradeMileAdj], [1000, 7.5, 4.9, 60, 40000, 0.12, 15000, 0.05]);
    eq(JSON.parse(w.localStorage.getItem('dealerdesk_orders')).settings.depositAmount, 1000); eq(w.DealerDesk.state.settings.tax_rate, 7.5, 'app sales tax synced'); ok(/Saved/.test(d.getElementById('toast').textContent));
    d.querySelector('[data-view=settings]').click(); eq(d.querySelector('[data-form=ordersettings]').elements.tradeDepreciation.value, '12', 're-render shows saved'); });
  t('general Settings sales tax keeps orders tax in sync', () => { const f = d.querySelector('[data-form=settings]'); f.elements.tax_rate.value = '6.25'; f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); eq(w.DDOrders.settings().taxRate, 6.25); });
  const stored = w.localStorage.getItem('dealerdesk_orders'), car = data.cars.find(c => c.status === 'available');
  const o = boot('order.html', 'https://x.test/order.html?vehicle=' + car.stock_no, { dealerdesk_orders: stored, dealerdesk_data: JSON.stringify(data) }); await tick(); const od = o.document;
  t('order.html uses the saved settings (deposit, APR, term, tax, trade-in)', () => {
    ok(/\$1,000/.test(od.getElementById('ddo-dep').textContent), od.getElementById('ddo-dep').textContent); const c = od.getElementById('ddo-calc');
    eq([c.querySelector('[name=apr]').value, c.querySelector('[name=term]').value, od.getElementById('ddo-tax').textContent], ['4.9', '60', '6.25']);
    ok(/for 60 months/.test(od.getElementById('ddo-calcout').textContent));
    const tr = od.getElementById('ddo-trade'); const v = { tyear: '2020', tmake: 'Ford', tmodel: 'Escape', tmiles: '60000' }; for (const k in v) tr.querySelector('[name=' + k + ']').value = v[k]; tr.dispatchEvent(new o.Event('input', { bubbles: true }));
    const est = o.DDOrders.tradeIn({ year: 2020, make: 'Ford', model: 'Escape', mileage: 60000, condition: 'good' }); const age = new Date().getFullYear() - 2020;
    const exp = Math.round(Math.max(250, 40000 * Math.pow(0.88, age) * Math.min(1.15, Math.max(0.5, 1 - 0.05 * (60000 - 15000 * age) / 10000)) * 0.9) / 50) * 50; eq(est.estimate, exp); });
  t('no JS errors in app or order page', () => { eq(w.__errors, []); eq(o.__errors, []); });
  done('order settings');
})();
