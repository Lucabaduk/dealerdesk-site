// Prototype-key hardening: values like __proto__, constructor, toString must behave like any other string.
const { t, eq, ok, done, genCars } = require('./_h.js');
const S = require('../modules/store.js'), I = require('../modules/inventory.js'), L = require('../modules/leads.js'), F = require('../modules/favorites.js'), C = require('../modules/compare.js'), SI = require('../modules/staff-inventory.js');
const BAD = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];
const mk = () => I.create({ storage: S.memoryStorage() });
function evil() { return genCars(BAD.length * 2).map((c, i) => { const b = BAD[i % BAD.length]; return Object.assign(c, i < BAD.length ? { id: b, stock_no: b, make: b, model: b, color: b, trim: b, body_type: b, fuel_type: b, drivetrain: b, features: [b, 'Bluetooth'] } : { make: b, model: 'M' + i }); }); }
t('import JSON with proto-ish values: all cars load', () => { const inv = mk(); const r = inv.importJSON(JSON.stringify(evil())); ok(r.ok, JSON.stringify(r)); eq([r.added, r.skipped], [BAD.length * 2, 0]); eq(inv.size(), BAD.length * 2); ok(!Object.prototype.polluted); eq({}.constructor, Object); });
t('load() with proto-ish values', () => { const r = mk().load({ cars: evil() }); eq([r.count, r.skipped, r.duplicateStock.length], [BAD.length * 2, 0, 0]); });
t('get by proto-ish id', () => { const inv = mk(); inv.load(evil()); BAD.forEach(b => { const c = inv.get(b); ok(c && c.id === b, b); }); eq(inv.get('nope'), null); });
t('filters + facets on proto-ish make/model/color', () => { const inv = mk(); inv.load(evil());
  BAD.forEach(b => { const q = inv.query({ make: b, pageSize: 1e9 }); eq(q.total, 2, 'make ' + b); ok(q.items.every(c => c.make === b)); eq(inv.query({ model: b }).total, 1, 'model ' + b); eq(inv.query({ color: b }).total, 1); });
  const f = inv.facets('make'); eq(f.length, BAD.length); ok(f.every(x => x.count === 2), JSON.stringify(f)); eq(inv.facets('model', { make: '__proto__' }).length, 2); eq(inv.query({ make: 'Velora' }).total, 0); });
t('body/fuel/drivetrain index ignores invalid but never crashes', () => { const inv = mk(); inv.load(evil()); ['body_type', 'fuel_type', 'drivetrain'].forEach(f => BAD.forEach(b => { const q = inv.query({ [f]: b }); ok(q.total >= 0); })); ok(Array.isArray(inv.facets('body_type'))); });
t('features keep proto-ish names', () => { const c = I.normalize({ vin: '1HGCM82633A004352', year: 2020, make: 'A', model: 'B', price: 1, features: BAD.concat(['Bluetooth']) }).car; eq(c.features, BAD.concat(['Bluetooth'])); });
t('sort by proto-ish key falls back, no crash', () => { const inv = mk(); inv.load(genCars(20)); BAD.forEach(b => eq(inv.query({ sort: b }).total, 20)); });
t('duplicate stock check with proto-ish stock numbers', () => { const inv = mk(); inv.load(evil()); const c = genCars(30)[29]; eq(inv.add(Object.assign({}, c, { stock_no: 'constructor' })).errors, ['duplicate_stock']); ok(inv.add(Object.assign({}, c, { stock_no: 'prototype' })).ok);
  const r = inv.importJSON(JSON.stringify([Object.assign({}, genCars(31)[30], { vin: '1DD999999ABCDEFGH', id: 'zz', stock_no: 'toString' })])); eq(r.duplicateStock.map(d => d.stock_no), ['toString']); });
t('memoryStorage stores __proto__ key', () => { const m = S.memoryStorage(); m.setItem('__proto__', 'x'); eq(m.getItem('__proto__'), 'x'); eq(m.getItem('constructor'), null); });
t('leads: proto-ish status/interest rejected, counts intact', () => { const s = L.create({ storage: S.memoryStorage() }); const l = s.submit({ vin: '1HGCM82633A004352', name: '__proto__', phone: '3135550100', interest: 'question' }).lead; ok(l && l.name === '__proto__');
  BAD.forEach(b => eq(s.setStatus(l.id, b).ok, false)); eq(s.submit({ vin: '1HGCM82633A004352', name: 'Al', phone: '3135550101', interest: 'constructor' }).errors, ['interest']); eq(s.counts(), { new: 1, contacted: 0, qualified: 0, won: 0, lost: 0, total: 1 }); eq(s.list({ status: 'constructor' }).length, 0); });
t('leads: imported storage with proto-ish status is dropped', () => { const st = S.memoryStorage(); st.setItem(L.KEY, JSON.stringify(BAD.map((b, i) => ({ id: 'L' + i, status: b, vin: '1HGCM82633A004352', createdAt: 1 })).concat([{ id: 'ok', status: 'won', vin: '1HGCM82633A004352', createdAt: 1 }])));
  const s = L.create({ storage: st }); eq(s.list().map(l => l.id), ['ok']); eq(s.counts().won, 1); ok(s.get('constructor') === null); });
t('favorites + compare unaffected', () => { const f = F.create({ storage: S.memoryStorage() }); BAD.forEach(b => eq(f.add(b), false)); eq(C.parseVins('?vins=__proto__,constructor'), []);
  const cars = evil().slice(0, 2); const r = C.build(cars); ok(r.ok); ok(r.features.some(x => x.name === '__proto__')); });
t('staff errorText with proto-ish codes', () => { eq(SI.errorText(['constructor', '__proto__']), 'Please fix: constructor, __proto__'); });
done('proto hardening');
