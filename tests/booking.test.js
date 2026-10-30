// Run: node tests/booking.test.js   (UI tests use jsdom if found; set DD_DEV_MODULES=/path/node_modules)
const assert = require('assert'), path = require('path'), fs = require('fs');
let pass = 0, skipped = [];
function t(n, f) { try { f(); pass++; console.log('ok  - ' + n); } catch (e) { console.log('FAIL- ' + n + '\n   ' + e.message); process.exitCode = 1; } }
function fake(init) { const m = Object.assign({}, init); return { _m: m, getItem: k => k in m ? m[k] : null, setItem(k, v) { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
const MOD = path.join(__dirname, '..', 'modules', 'booking.js');
const NOW = new Date(2026, 10, 4, 8, 0).getTime(); // Wed Nov 4 2026 08:00 local
const INV = JSON.stringify({ cars: [{ id: 'car-a', stock_no: 'A100', vin: '1HGCM82633A100000', year: 2022, make: 'Honda', model: 'Accord', status: 'available' }, { id: 'car-b', stock_no: 'B200', vin: '2T1BURHE0JC123456', year: 2021, make: 'Toyota', model: 'Corolla', status: 'sold' }, { id: 'car-x', stock_no: 'XYZ9', vin: '', year: 2020, make: 'Kia', model: 'Soul', status: 'available' }, { id: 'car-c', stock_no: 'C3', vin: '', year: 2019, make: 'Ford', model: 'Focus', status: 'available' }] });
function load(st) { globalThis.localStorage = st || fake({ dealerdesk_data: INV }); delete require.cache[MOD]; const B = require(MOD); B._setClock(() => NOW); return B; }
function throwsCode(f, code) { try { f(); } catch (e) { assert.strictEqual(e.code, code, 'got ' + e.code + ': ' + e.message); return e; } throw new Error('expected ' + code); }
const td = (o) => Object.assign({ vehicle: 'A100', customer: 'Ann Lee', phone: '313-555-0101', email: 'ann@example.com', salesperson: 'Maria', date: '2026-11-04', time: '10:00' }, o);
const sv = (o) => Object.assign({ customer: 'Bob Ray', phone: '(313) 555-0199', type: 'oil-change', vehicle: { year: 2018, make: 'Ford', model: 'F-150', mileage: 61000 }, date: '2026-11-04', time: '09:00' }, o);

let B = load();
t('QA: unknown vehicle is rejected when inventory is loaded', () => { throwsCode(() => B.addTestDrive(td({ vehicle: 'NOPE999', salesperson: 'Zed' })), 'unknown_vehicle'); });
t('QA: new staff booking in the past is rejected', () => { throwsCode(() => B.addTestDrive(td({ date: '2026-11-03', salesperson: 'Zed' })), 'past'); throwsCode(() => B.addService(sv({ date: '2026-11-02' })), 'past'); });
t('defaults: Mon-Fri 9-7, Sat 9-4, Sun closed, 4 bays', () => { const s = B.settings(); assert.strictEqual(s.hours.sun, null); assert.deepStrictEqual(s.hours.sat, { open: '09:00', close: '16:00' }); assert.strictEqual(s.bays, 4); });
t('vehicle picker reads DealerDesk inventory; lookup by stock and VIN', () => { assert.strictEqual(B.vehicles().length, 4); assert.strictEqual(B.findVehicle('a100').model, 'Accord'); assert.strictEqual(B.findVehicle('2t1burhe0jc123456').stock, 'B200'); });
t('book test drive by stock number fills VIN + label, status booked', () => { const r = B.addTestDrive(td()); assert.strictEqual(r.vin, '1HGCM82633A100000'); assert.strictEqual(r.vehicleLabel, '2022 Honda Accord'); assert.strictEqual(r.status, 'booked'); });
t('blocks double-booking the same car (overlapping)', () => { const e = throwsCode(() => B.addTestDrive(td({ vehicle: '1HGCM82633A100000', salesperson: 'Ken', time: '10:15' })), 'conflict'); assert.strictEqual(e.conflicts[0].type, 'vehicle'); });
t('blocks double-booking the same salesperson (case-insensitive)', () => { const e = throwsCode(() => B.addTestDrive(td({ vehicle: 'XYZ9', salesperson: 'maria', time: '10:00' })), 'conflict'); assert.strictEqual(e.conflicts[0].type, 'salesperson'); });
t('back-to-back slot is fine', () => { B.addTestDrive(td({ time: '10:30' })); });
t('cancelled drive frees the slot', () => { const r = B.addTestDrive(td({ vehicle: 'C3', salesperson: 'Ken', time: '13:00' })); B.setTestDriveStatus(r.id, 'cancelled'); B.addTestDrive(td({ vehicle: 'C3', salesperson: 'Ken', time: '13:00' })); });
t('status flow + rejects unknown status', () => { const r = B.testDrivesOn('2026-11-04')[0]; ['confirmed', 'completed'].forEach(s => B.setTestDriveStatus(r.id, s)); throwsCode(() => B.setTestDriveStatus(r.id, 'lost'), 'bad_status'); B.setTestDriveStatus(r.id, 'no-show'); });
t('validation: name, phone, email, vehicle, hours, closed day', () => {
  throwsCode(() => B.addTestDrive(td({ customer: '' })), 'need_customer'); throwsCode(() => B.addTestDrive(td({ phone: '555' })), 'need_phone');
  throwsCode(() => B.addTestDrive(td({ email: 'nope' })), 'bad_email'); throwsCode(() => B.addTestDrive(td({ vehicle: '' })), 'need_vehicle');
  throwsCode(() => B.addTestDrive(td({ time: '18:45' })), 'outside_hours'); throwsCode(() => B.addTestDrive(td({ date: '2026-11-08' })), 'closed'); });
t('week view: Monday-first 7 days', () => { assert.deepStrictEqual(B.weekOf('2026-11-04'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']); });
t('service: auto bay, default duration by type', () => { const r = B.addService(sv()); assert.strictEqual(r.bay, 1); assert.strictEqual(r.durationMin, 45); assert.strictEqual(r.status, 'scheduled'); });
t('service: VIN check + year check', () => { throwsCode(() => B.addService(sv({ vehicle: { make: 'Ford', vin: 'SHORT' } })), 'bad_vin'); throwsCode(() => B.addService(sv({ vehicle: { make: 'Ford', year: 1900 } })), 'bad_year'); throwsCode(() => B.addService(sv({ type: 'wash' })), 'bad_type'); });
t('service: explicit busy bay rejected; capacity full rejected', () => {
  throwsCode(() => B.addService(sv({ bay: 1 })), 'bay_busy'); [2, 3, 4].forEach(() => B.addService(sv({ type: 'brakes' })));
  throwsCode(() => B.addService(sv({ time: '09:30' })), 'full'); throwsCode(() => B.addService(sv({ bay: 9, time: '15:00' })), 'bad_bay'); });
t('service status advances scheduled -> picked up; picked-up frees bay', () => {
  const id = B.bayBoard('2026-11-04').bays[0].jobs[0].id; const seen = [];
  for (let i = 0; i < 4; i++) seen.push(B.advanceService(id).status);
  assert.deepStrictEqual(seen, ['checked-in', 'in-progress', 'ready', 'picked-up']); assert.strictEqual(B.addService(sv({ time: '09:15', durationMin: 30 })).bay, 1); });
t('bay board groups by bay with utilisation %', () => { const b = B.bayBoard('2026-11-04'); assert.strictEqual(b.bays.length, 4); assert.ok(b.bays[1].pct > 0); assert.strictEqual(b.hours.open, '09:00'); });
t('upcoming merges drives and service, sorted', () => { const u = B.upcoming(); assert.ok(u.length >= 3); for (let i = 1; i < u.length; i++) assert.ok((u[i - 1].date + u[i - 1].time) <= (u[i].date + u[i].time)); assert.ok(u.some(x => x.kind === 'service')); });
t('settings: validation and persistence', () => {
  throwsCode(() => B.updateSettings({ hours: { mon: { open: '18:00', close: '09:00' } } }), 'bad_hours'); throwsCode(() => B.updateSettings({ bays: 0 }), 'bad_bays');
  B.updateSettings({ bays: 6, slotMin: 15, leadTimeMin: 90 }); const B2 = load(globalThis.localStorage); assert.strictEqual(B2.settings().bays, 6); assert.strictEqual(B2.settings().slotMin, 15); B = B2; });
t('public open slots respect lead time and taken car', () => {
  const s = B.openSlots('test-drive', '2026-11-04', { vin: '1HGCM82633A100000' }); assert.ok(!s.includes('09:00') && !s.includes('09:15') && s.includes('09:30'), 'lead time'); assert.ok(!s.includes('10:30') && !s.includes('10:45')); assert.ok(s.includes('11:00'));
  assert.deepStrictEqual(B.openSlots('service', '2026-11-08', {}), []); });
t('public request saves booking + code; staff sees it as new', () => {
  const r = B.submitRequest('test-drive', td({ salesperson: '', vehicle: 'A100', time: '15:00' })); assert.match(r.code, /^DD-[0-9A-Z]{3}\d+$/);
  assert.strictEqual(B.newRequests().length, 1); B.markSeen(); assert.strictEqual(B.newRequests().length, 0);
  throwsCode(() => B.submitRequest('service', sv({ time: '08:30' })), 'outside_hours'); throwsCode(() => B.submitRequest('service', sv({ time: '09:00' })), 'lead_time'); });
t('public: rate limit per phone and off switch', () => {
  for (let i = 0; i < 4; i++) B.submitRequest('service', sv({ date: '2026-11-05', time: '1' + i + ':00', phone: '313-555-0101' }));
  throwsCode(() => B.submitRequest('service', sv({ date: '2026-11-05', time: '15:00', phone: '313-555-0101' })), 'rate_limited');
  B.updateSettings({ publicRequests: false }); throwsCode(() => B.submitRequest('service', sv({ date: '2026-11-06' })), 'disabled'); B.updateSettings({ publicRequests: true }); });
t('corrupt storage resets safely; HTML is escaped', () => { const B3 = load(fake({ dealerdesk_booking: '{bad' })); assert.ok(B3.lastSaveError()); B3.addTestDrive(td({ customer: '<img src=x onerror=alert(1)>' })); assert.ok(!B3.renderHTML().includes('<img src=x')); B = load(globalThis.localStorage); });
t('no tokens / personal emails / TableTop server in shipped files', () => { for (const f of ['modules/booking.js', 'modules/booking-public.js', 'booking.html', 'modules/booking.css']) { const s = fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); assert.ok(!/gmail\.com|tabletop|workers\.dev|Bearer|ghp_/i.test(s), f); } });

t('sold car cannot be test-driven', () => throwsCode(() => load().addTestDrive(td({ vehicle: 'B200', time: '16:00', salesperson: 'Zed' })), 'sold'));
t('5,000-car inventory: search by stock, VIN, make, model, year is capped and fast', () => {
  const makes = [['Velora', 'Aster'], ['Kestrel', 'Ridge'], ['Norvik', 'Pulse'], ['Ardent', 'Vale']], cars = [];
  for (let i = 0; i < 5000; i++) { const m = makes[i % 4]; cars.push({ id: 'c' + i, stock_no: 'DD' + (10000 + i), vin: ('1DDK' + String(i).padStart(6, '0') + 'TD12345').slice(0, 17), year: 2015 + (i % 11), make: m[0], model: m[1], status: i % 50 ? 'available' : 'sold' }); }
  assert.strictEqual(B.setInventory({ cars }), 5000);
  let t0 = process.hrtime.bigint(); let r;
  for (let k = 0; k < 100; k++) r = B.searchVehicles('kestrel ridge 2020', 8);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 100;
  assert.strictEqual(r.length, 8); assert.ok(r.every(v => v.make === 'Kestrel' && v.year === 2020)); assert.ok(ms < 20, 'avg ' + ms.toFixed(2) + 'ms');
  assert.strictEqual(B.searchVehicles('DD14321')[0].stock, 'DD14321'); assert.strictEqual(B.searchVehicles(cars[777].vin)[0].id, 'c777');
  assert.strictEqual(B.searchVehicles('dd1', 8).length, 8); assert.deepStrictEqual(B.searchVehicles('', 8), []); assert.deepStrictEqual(B.searchVehicles('zzzz'), []);
  t0 = process.hrtime.bigint(); assert.strictEqual(B.findVehicle('DD14999').id, 'c4999'); assert.ok(Number(process.hrtime.bigint() - t0) / 1e6 < 5);
  const html = B.renderHTML(); assert.ok(!html.includes('<datalist') && html.includes('5000 vehicles'), 'no full list rendered');
  B.setInventory(null); });
const schemaPath = '/workspace/dealership/schema.js';
if (!fs.existsSync(schemaPath)) skipped.push('schema export (no /workspace/dealership)'); else t('toSchema() passes DealerDesk schema validation', () => {
  const S = require(schemaPath), sample = JSON.parse(fs.readFileSync('/workspace/dealership/sample-data.json', 'utf8'));
  const Bs = load(fake({ dealerdesk_data: JSON.stringify(sample) })); const car = sample.cars.find(c => c.status !== 'sold');
  assert.strictEqual(Bs.vehicles().length, sample.cars.length); Bs.addTestDrive(td({ vehicle: car.stock_no })); Bs.addService(sv({ vehicle: { year: 2019, make: 'Ford', model: 'Escape', mileage: 50000 } }));
  const ex = Bs.toSchema(); const ds = S.normalizeDealership({ dealer_name: sample.dealer_name, cars: sample.cars, test_drives: ex.test_drives, service_bookings: ex.service_bookings, leads: [] });
  assert.strictEqual(ds.test_drives[0].car_id, car.id); assert.strictEqual(ds.service_bookings[0].service_type, 'oil_change'); B = load(globalThis.localStorage); });

t('invalid settings change nothing in memory or storage (validate first, then apply)', () => {
  const st = fake({ dealerdesk_data: INV }), Bx = load(st); const before = JSON.stringify(Bx.settings());
  throwsCode(() => Bx.updateSettings({ hours: { mon: { open: '08:00', close: '20:00' }, tue: { open: '18:00', close: '09:00' } }, bays: 8 }), 'bad_hours');
  assert.strictEqual(JSON.stringify(Bx.settings()), before); throwsCode(() => Bx.updateSettings({ hours: { mon: { open: '07:00', close: '21:00' } }, slotMin: 5 }), 'bad_slotMin');
  assert.strictEqual(JSON.stringify(Bx.settings()), before); assert.strictEqual(st.getItem('dealerdesk_booking'), null);
  const failing = fake({ dealerdesk_data: INV }), By = load(failing); failing.setItem = () => { throw new Error('QuotaExceededError'); };
  throwsCode(() => By.updateSettings({ bays: 9 }), 'save_failed'); assert.strictEqual(By.settings().bays, 4); });
t('no salespeople set: at most one test drive per slot (booking + open slots)', () => {
  const Bz = load(fake({ dealerdesk_data: INV })); Bz.addTestDrive(td({ vehicle: 'A100', salesperson: '', time: '14:00' }));
  const e = throwsCode(() => Bz.addTestDrive(td({ vehicle: 'XYZ9', salesperson: '', time: '14:15' })), 'conflict'); assert.strictEqual(e.conflicts[0].type, 'capacity');
  assert.ok(!Bz.openSlots('test-drive', '2026-11-04', {}).includes('14:00')); Bz.addTestDrive(td({ vehicle: 'XYZ9', salesperson: '', time: '14:30' }));
  Bz.setStaff('salespeople', ['Maria', 'Ken']); Bz.addTestDrive(td({ vehicle: 'C3', salesperson: 'Ken', time: '14:30' }));
  assert.strictEqual(throwsCode(() => Bz.addTestDrive(td({ vehicle: 'A100', salesperson: '', time: '14:45' })), 'conflict').conflicts[0].type, 'capacity'); });

// ---------- UI (jsdom) ----------
function opt(n) { for (const d of [process.env.DD_DEV_MODULES, '/tmp/qrdev/node_modules', '/tmp/devmods/node_modules'].filter(Boolean)) { try { return require(require.resolve(n, { paths: [d] })); } catch (e) {} } return null; }
const jsdom = opt('jsdom');
function await0() {} // picker debounce is replaced by sync timers in UI tests
if (!jsdom) skipped.push('UI tests (jsdom not found)'); else {
  const root = path.join(__dirname, '..');
  const mk = (file, url, store) => { const html = fs.readFileSync(path.join(root, file), 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(root, s), 'utf8') + '</script>');
    const dom = new jsdom.JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true }); Object.defineProperty(dom.window, 'localStorage', { value: store, configurable: true });
    dom.window.setTimeout = (f) => { f(); return 0; }; dom.window.clearTimeout = () => {}; dom.window.Date.now = () => NOW; const RD = dom.window.Date; dom.window.eval('(' + ((n) => { const O = Date; window.Date = class extends O { constructor(...a) { a.length ? super(...a) : super(n); } static now() { return n; } }; }) + ')(' + NOW + ')');
    dom.window.document.querySelectorAll('script').forEach(s => dom.window.eval(s.textContent)); return dom; };
  t('staff UI: mount, book via form, switch tabs, week view, bay advance', () => {
    const st = fake({ dealerdesk_data: INV }); const dom = mk('demo.html', 'http://localhost/demo.html', st), d = dom.window.document;
    assert.ok(d.querySelector('[data-form="td"]')); const f = d.querySelector('[data-form="td"]');
    const inp = f.elements.vehicle; inp.value = 'acc'; inp.dispatchEvent(new dom.window.Event('input')); await0(); d.querySelector('[data-vpick="A100"]').click(); assert.strictEqual(inp.value, 'A100'); f.elements.customer.value = 'Cy'; f.elements.phone.value = '3135550000'; f.elements.time.value = '11:00'; f.elements.date.value = '2026-11-04';
    f.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); assert.match(d.querySelector('.ddb-msg').textContent, /booked/);
    d.querySelector('[data-view="week"]').click(); assert.strictEqual(d.querySelectorAll('.ddb-day').length, 7);
    d.querySelector('[data-tab="service"]').click(); const g = d.querySelector('[data-form="sv"]'); g.elements.customer.value = 'Di'; g.elements.phone.value = '3135550001'; g.elements.make.value = 'Kia'; g.elements.model.value = 'Soul'; g.elements.year.value = '2020'; g.elements.time.value = '10:00'; g.elements.date.value = '2026-11-04';
    g.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); assert.match(d.querySelector('.ddb-msg').textContent, /bay 1/);
    d.querySelector('[data-sv-next]').click(); assert.ok(d.querySelector('.ddb-s-checked-in'));
    d.querySelector('[data-tab="settings"]').click(); assert.strictEqual(d.querySelectorAll('.ddb-hrow').length, 7); });
  t('public page: QR vehicle param, pick slot, submit, confirmation', () => {
    const st = fake({ dealerdesk_data: INV }); const dom = mk('booking.html', 'http://localhost/booking.html?vehicle=A100&name=Motor%20City', st), d = dom.window.document;
    assert.match(d.title, /Motor City/); assert.strictEqual(d.getElementById('ddp-vehicle').value, 'A100');
    d.getElementById('ddp-date').value = '2026-11-05'; d.getElementById('ddp-date').dispatchEvent(new dom.window.Event('change'));
    d.querySelector('[data-t="11:00"]').click(); const f = d.getElementById('ddp-form'); f.elements.customer.value = 'Eve'; f.elements.phone.value = '313 555 0123';
    f.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    assert.ok(!d.getElementById('ddp-done').hidden, d.getElementById('ddp-err').textContent); assert.match(d.getElementById('ddp-code').textContent, /^DD-/);
    const saved = JSON.parse(st.getItem('dealerdesk_booking')); assert.strictEqual(saved.requests.length, 1); assert.strictEqual(saved.testDrives[0].source, 'web'); });
}
console.log('\n' + pass + ' passed' + (skipped.length ? ', skipped: ' + skipped.join('; ') : ''));
