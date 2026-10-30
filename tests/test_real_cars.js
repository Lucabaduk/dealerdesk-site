// Runs against a copy of Grok Master Helper's real cars.json (DD_CARS env or /workspace/dealership/cars.json). Skips if absent.
const { t, eq, ok, done } = require('./_h.js');
const fs = require('fs'), os = require('os'), path = require('path');
const src = process.env.DD_CARS || '/workspace/dealership/cars.json';
if (!fs.existsSync(src)) { console.log('real cars.json not found, skipped'); process.exit(0); }
const copy = path.join(os.tmpdir(), 'dd-cars-copy-' + process.pid + '.json'); fs.copyFileSync(src, copy);
const data = JSON.parse(fs.readFileSync(copy, 'utf8')); fs.unlinkSync(copy);
const S = require('../modules/store.js'), I = require('../modules/inventory.js'), C = require('../modules/compare.js');
const inv = I.create({ storage: S.memoryStorage() }); const r = inv.load(data); const all = inv.list();
t('all cars load', () => { eq(r.skipped, 0); eq(r.count, data.cars.length); ok(r.count >= 5000); });
t('every spec populated', () => { const need = ['body_type', 'engine', 'transmission', 'drivetrain', 'fuel_type', 'horsepower', 'seats', 'doors', 'description'];
  const miss = {}; all.forEach(c => need.forEach(k => { if (c[k] == null || c[k] === '') miss[k] = (miss[k] || 0) + 1; })); eq(miss, {});
  const noEcon = all.filter(c => !(c.mpg_city && c.mpg_highway) && !c.range_miles && !c.mpg_combined); ok(noEcon.every(c => /2500|3500|ProMaster/.test(c.model)), 'only heavy-duty trucks/vans lack EPA numbers (shown as Not EPA-rated)'); });
t('EVs have range, no MPG', () => { const ev = all.filter(c => c.fuel_type === 'electric'); ok(ev.length > 0); ok(ev.every(c => c.range_miles && c.mpg_city == null)); });
t('compare rows never show a dash on real cars', () => { const pick = [all.find(c => c.fuel_type === 'electric'), all.find(c => c.fuel_type === 'plug-in hybrid'), all.find(c => !c.mpg_city && !c.range_miles && !c.mpg_combined), all.find(c => c.fuel_type === 'gasoline')];
  const res = C.build(pick); ok(res.ok); res.rows.forEach(row => row.cells.forEach((cell, i) => ok(!cell.missing, row.label + ' missing for ' + pick[i].fuel_type)));
  for (let i = 0; i + 4 <= 400; i += 4) C.build(all.slice(i, i + 4)).rows.forEach(row => ok(row.cells.every(c => !c.missing), row.label)); });
t('body type facet + filter', () => { const f = inv.facets('body_type'); eq(f.reduce((s, x) => s + x.count, 0), all.length); const q = inv.query({ body_type: 'pickup', pageSize: 1e9 }); ok(q.total > 0 && q.items.every(c => c.body_type === 'pickup')); });
t('perf on real file', () => { const t0 = process.hrtime.bigint(); inv.query({ make: 'Toyota', body_type: 'suv', maxPrice: 40000, sort: 'price', page: 2 }); inv.query({ text: 'awd hybrid', sort: 'mileage' }); const ms = Number(process.hrtime.bigint() - t0) / 1e6; ok(ms < 50, ms + 'ms'); });
done('real cars.json (' + data.cars.length + ')');
