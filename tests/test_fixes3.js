const { t, eq, ok, done, genCars } = require('./_h.js');
const fs = require('fs'), path = require('path');
const S = require('../modules/store.js'), I = require('../modules/inventory.js'), L = require('../modules/leads.js'), QL = require('../modules/qr-label.js');
// (1) print sheet: 24 labels -> exactly 2 Letter pages of 12
t('pages(): 24 -> [12,12], 25 -> [12,12,1], 0 -> []', () => { const c = genCars(25); eq(QL.pages(c.slice(0, 24)).map(p => p.length), [12, 12]); eq(QL.pages(c).map(p => p.length), [12, 12, 1]); eq(QL.pages([]), []); eq(QL.PER_PAGE, 12); });
t('print CSS: Letter, 4 rows fit, break only between pages', () => { const h = fs.readFileSync(path.join(__dirname, '../staff-inventory.html'), 'utf8');
  ok(/@page\{size:letter;margin:10mm\}/.test(h)); ok(/\.dd-page\{[^}]*break-after:page/.test(h)); ok(/\.dd-page:last-child\{break-after:auto;page-break-after:auto\}/.test(h)); ok(/\.dd-label\{[^}]*break-inside:avoid/.test(h));
  const rowMm = +/grid-template-rows:repeat\(4,(\d+)mm\)/.exec(h)[1], widthMm = +/\.dd-page\{[^}]*width:(\d+)mm/.exec(h)[1]; ok(rowMm * 4 <= 279.4 - 20, 'rows fit Letter height'); ok(widthMm <= 215.9 - 20, 'fits Letter width'); ok(/\.dd-label\{[^}]*height:63mm/.test(h)); });
// (2) import duplicate stock numbers
const mk = () => I.create({ storage: S.memoryStorage() });
t('import merge skips + reports duplicate stock #', () => { const inv = mk(); const c = genCars(5); inv.load(c);
  const incoming = [Object.assign({}, genCars(6)[5], { stock_no: c[0].stock_no }), Object.assign({}, c[1], { price: 1234 }), Object.assign({}, genCars(7)[6], { vin: '1DD999999ABCDEFGH', id: 'car-x', stock_no: 'NEW1' }), Object.assign({}, genCars(7)[6], { vin: '1DD999998ABCDEFGH', id: 'car-y', stock_no: 'new1' })];
  const r = inv.importJSON(JSON.stringify(incoming)); eq([r.added, r.updated, r.skipped], [1, 1, 2]); eq(r.duplicateStock.map(d => d.stock_no), [c[0].stock_no, 'new1']); eq(r.duplicateStock[0].usedBy, c[0].vin); eq(inv.size(), 6); eq(inv.get(c[1].vin).price, 1234); });
t('import: same car keeps its own stock #, can swap to a free one', () => { const inv = mk(); const c = genCars(2); inv.load(c); const r = inv.importJSON(JSON.stringify([Object.assign({}, c[0], { stock_no: 'FREE9' })])); eq([r.updated, r.duplicateStock.length], [1, 0]); eq(inv.get(c[0].vin).stock_no, 'FREE9'); });
t('load/replace skips + reports duplicate stock #', () => { const c = genCars(3); c[2].stock_no = c[0].stock_no; const r = mk().load(c); eq([r.count, r.skipped], [2, 1]); eq(r.duplicateStock, [{ stock_no: c[0].stock_no, vin: c[2].vin }]); const r2 = mk().importJSON(JSON.stringify(c), 'replace'); eq(r2.duplicateStock.length, 1); });
t('staff import message mentions duplicates', () => ok(/Duplicate stock # skipped/.test(fs.readFileSync(path.join(__dirname, '../modules/staff-inventory.js'), 'utf8'))));
// (3) CSV phone vs formula guard
t('CSV: phones not prefixed, formulas still guarded', () => { let now = 1e6; const s = L.create({ storage: S.memoryStorage(), now: () => (now += 60000), minGapMs: 0 });
  const base = { vin: '1HGCM82633A004352', interest: 'question' };
  s.submit(Object.assign({ name: 'Al', phone: '+15551234567' }, base)); s.submit(Object.assign({ name: '=1+2', email: 'a@b.co' }, base)); s.submit(Object.assign({ name: '@SUM(A1)', email: 'c@b.co' }, base)); s.submit(Object.assign({ name: '-2+3', email: 'd@b.co' }, base)); s.submit(Object.assign({ name: '+1 (555) 123-4567', email: 'e@b.co' }, base)); s.submit(Object.assign({ name: '+cmd|calc', email: 'f@b.co' }, base));
  const csv = s.exportCSV(); ok(csv.includes('"+15551234567"'), 'e164'); ok(!csv.includes("'+15551234567")); ok(csv.includes('"\'+1 (555) 123-4567"'), 'phone-like text outside phone column is guarded'); ok(csv.includes('"\'=1+2"')); ok(csv.includes('"\'@SUM(A1)"')); ok(csv.includes('"\'-2+3"')); ok(csv.includes('"\'+cmd|calc"')); });
t('CSV: short or odd +numbers still guarded', () => { let now = 1e6; const s = L.create({ storage: S.memoryStorage(), now: () => (now += 60000) });
  ['+1-2', '+12)(34567', '+1234567+1'].forEach((n, i) => s.submit({ vin: '1HGCM82633A004352', interest: 'price', name: n, email: 'z' + i + '@b.co' })); const csv = s.exportCSV(); ok(csv.includes('"\'+1-2"')); ok(csv.includes('"\'+12)(34567"')); ok(csv.includes('"\'+1234567+1"')); });
done('fixes-3');
