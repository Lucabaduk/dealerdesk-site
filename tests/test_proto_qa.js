// QA: more proto-ish values (prototype/valueOf/hasOwnProperty, status/VIN, CSV, dashboard maps, order counts); never pollute Object.prototype.
const { t, eq, ok, done, genCars } = require('./_h.js');
const S = require('../modules/store.js'), I = require('../modules/inventory.js'), L = require('../modules/leads.js'), D = require('../modules/dashboard.js');
const BAD = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'prototype'];
const clean = () => { ok(Object.keys(Object.prototype).length === 0 && {}.status === undefined && typeof {}.toString === 'function' && {}.constructor === Object, 'prototype clean'); };
function evil() { return genCars(BAD.length * 2).map((c, i) => { const b = BAD[i % BAD.length]; return Object.assign(c, i < BAD.length ? { id: b, stock_no: b, make: b, model: b, color: b, trim: b, body_type: b, fuel_type: b } : { make: b, model: 'M' + i }); }); }
t('inventory: every field proto-ish incl prototype/status, search + facets, no false dup', () => { const inv = I.create({ storage: S.memoryStorage() }); const r = inv.load({ cars: evil() });
  eq(r.duplicateStock.length, 0); eq([r.count, r.skipped], [BAD.length * 2, 0]);
  BAD.forEach(b => { ok(inv.query({ text: b, pageSize: 1e9 }).total >= 1, 'text ' + b); eq(inv.query({ make: b, pageSize: 1e9 }).total, 2, 'make ' + b); });
  const g = inv.facets('model', { make: 'prototype' }); eq(g.length, 2); clean(); });
t('inventory: status proto-ish is rejected, not crash', () => { const inv = I.create({ storage: S.memoryStorage() }); BAD.forEach(b => { const r = inv.load({ cars: [Object.assign(genCars(1)[0], { status: b })] }); eq(r.skipped, 1, b); }); clean(); });
t('inventory: export/import JSON round-trip keeps proto-ish cars', () => { const a = I.create({ storage: S.memoryStorage() }); a.load(evil()); const b = I.create({ storage: S.memoryStorage() });
  const js = a.exportJSON ? a.exportJSON() : JSON.stringify(a.query({ pageSize: 1e9 }).items); const r = b.importJSON(js); ok(r.ok, JSON.stringify(r)); eq(b.size(), a.size()); clean(); });
t('leads CSV export with proto-ish names', () => { const s = L.create({ storage: S.memoryStorage() }); BAD.forEach((b, i) => s.submit({ vin: '1HGCM82633A004352', name: b, phone: '313555010' + i, interest: 'question' }));
  const csv = s.exportCSV(); BAD.forEach(b => ok(csv.indexOf(b) >= 0, b)); clean(); });
t('dashboard: proto-ish booking statuses not mapped to functions', () => { const td = D.testDriveStats(BAD.map((b, i) => ({ id: 't' + i, status: b, at: '2026-11-04T10:00' })), Date.parse('2026-11-01'));
  ok(!/function|native/.test(JSON.stringify(td)), JSON.stringify(td)); const sv = D.serviceStats(BAD.map((b, i) => ({ id: 's' + i, status: b, at: '2026-11-04T10:00' })), Date.parse('2026-11-01'));
  ok(!/function|native/.test(JSON.stringify(sv)), JSON.stringify(sv)); clean(); });
t('orders staff list: stored proto-ish status does not break counts', () => { const mem = {}; globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const O = require('../modules/order.js'); mem[O.KEY] = JSON.stringify({ v: 1, orders: BAD.map((b, i) => ({ id: 'o' + i, status: b, name: b, phone: '', email: '', stock: b, carLabel: b, code: 'C' + i, createdAt: i, history: [] })) }); O.reload();
  const h = O.renderHTML(); ok(!/function Object|native code/.test(h), 'no function source in tabs'); clean(); });
done('proto QA');
