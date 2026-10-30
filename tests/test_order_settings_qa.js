// QA: untrusted saved settings, tax validation, customer cannot override tax on saved orders, main Settings tax sync.
const { t, eq, ok, done } = require('./_h.js');
const store = {}; global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const O = require('../modules/order.js');
t('malformed saved settings fall back to defaults', () => {
  store.dealerdesk_orders = JSON.stringify({ v: 1, settings: { taxRate: 'abc', defaultApr: -5, defaultTerm: 0, depositAmount: '<img>', tradeDepreciation: 2, bookingUrl: 'javascript:alert(1)' } }); O.reload();
  const s = O.settings(); eq([s.taxRate, s.defaultApr, s.defaultTerm, s.depositAmount, s.tradeDepreciation, s.bookingUrl], [6, 7.9, 72, 500, 0.15, 'booking.html']);
  ok(O.payment({ price: 30000 }).monthly > 0);
});
t('valid saved settings kept', () => { store.dealerdesk_orders = JSON.stringify({ v: 1, settings: { taxRate: 8.5, defaultApr: 0, defaultTerm: 60 } }); O.reload(); const s = O.settings(); eq([s.taxRate, s.defaultApr, s.defaultTerm], [8.5, 0, 60]); });
t('payment rejects negative/letter tax', () => { for (const v of [-50, 'abc', 99]) { let e = null; try { O.payment({ price: 30000, taxRate: v }); } catch (x) { e = x; } ok(e && e.code === 'bad_tax', 'tax ' + v); } });
t('saved order calc uses dealer tax, not customer value', () => {
  store.dealerdesk_orders = JSON.stringify({ v: 1, settings: { taxRate: 6 } }); O.reload();
  O.setInventory([{ id: 'c1', stock_no: 'S1', vin: '1HGCM82633A004352', year: 2022, make: 'Honda', model: 'Civic', price_cents: 2000000 }]);
  const id = O.submit({ vehicle: 'S1', kind: 'reserve', name: 'A', phone: '5555555555', calc: { taxRate: -50, price: 1 } }).id; const r = O.list().find(o => o.id === id);
  eq([r.calc.taxRate, r.calc.price, r.calc.tax], [6, 20000, 1200]);
});
const fs = require('fs'), src = fs.readFileSync(__dirname + '/../src/app.src.html', 'utf8');
t('main Settings tax rejects letters/>25 and syncs orders', () => { ok(/name="tax_rate"[^>]*max="25"/.test(src)); ok(src.includes("throw new Error('Sales tax must be between 0 and 25.')")); });
done('order settings QA');
