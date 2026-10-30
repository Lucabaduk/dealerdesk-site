// Run: node tests/order.test.js   (UI tests use jsdom if found; DD_DEV_MODULES=/path/node_modules)
const assert = require('assert'), path = require('path'), fs = require('fs');
let pass = 0, skipped = [];
function t(n, f) { try { f(); pass++; console.log('ok  - ' + n); } catch (e) { console.log('FAIL- ' + n + '\n   ' + e.message); process.exitCode = 1; } }
function fake(init) { const m = Object.assign({}, init); return { _m: m, getItem: k => k in m ? m[k] : null, setItem(k, v) { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
const MOD = path.join(__dirname, '..', 'modules', 'order.js'), ROOT = path.join(__dirname, '..');
const NOW = new Date(2026, 10, 4, 10, 0).getTime();
const SAMPLE = '/workspace/dealership/sample-data.json';
const CARS = fs.existsSync(SAMPLE) ? JSON.parse(fs.readFileSync(SAMPLE, 'utf8')) : { cars: [
  { id: 'car-01', stock_no: 'DD1001', vin: '1DDK000050TD10013', year: 2024, make: 'Velora', model: 'Aster', trim: 'LX', price: 27990, mileage: 12, condition: 'new', status: 'available', photos: ['assets/cars/a.webp'], features: ['Bluetooth'] },
  { id: 'car-10', stock_no: 'DD1010', vin: '1DDK000100TD10137', year: 2019, make: 'Kestrel', model: 'Ridge', price: 18990, mileage: 50000, condition: 'used', status: 'sold', photos: [], features: [] }] };
const avail = CARS.cars.find(c => c.status === 'available'), sold = CARS.cars.find(c => c.status === 'sold'), hold = CARS.cars.find(c => c.status === 'hold');
function load(st) { globalThis.localStorage = st || fake({ dealerdesk_data: JSON.stringify(CARS) }); delete require.cache[MOD]; const O = require(MOD); O._setClock(() => NOW); return O; }
function throwsCode(f, code) { try { f(); } catch (e) { assert.strictEqual(e.code, code, 'got ' + e.code + ': ' + e.message); return e; } throw new Error('expected ' + code); }
const req = o => Object.assign({ vehicle: avail.stock_no, kind: 'reserve', name: 'Ann Lee', phone: '313-555-0101', email: 'ann@example.com', contact: 'text', notes: 'Call after 5' }, o);

let O = load();
t('reads Grok Master Helper car data (stock_no, price, photos)', () => { assert.strictEqual(O.cars().length, CARS.cars.length); const c = O.findCar(avail.stock_no.toLowerCase()); assert.strictEqual(c.id, avail.id); assert.strictEqual(c.price, avail.price); assert.strictEqual(O.findCar(avail.vin).stock, avail.stock_no); });
t('price_cents (normalized schema) also works; unsafe photo paths dropped', () => { O.setInventory([{ id: 'x', stock_no: 'X1', vin: '1DDK000050TD10013', year: 2020, make: 'A', model: 'B', price_cents: 1234500, photos: ['javascript:alert(1)', '../../etc/x.png', 'https://cdn.example.com/a.webp', 'assets/cars/x.webp'] }]);
  const c = O.findCar('X1'); assert.strictEqual(c.price, 12345); assert.deepStrictEqual(c.photos, ['https://cdn.example.com/a.webp', 'assets/cars/x.webp']); O.setInventory(null); });
t('payment: standard amortisation, 6% tax, trade credit', () => {
  const r = O.payment({ price: 30000, down: 3000, apr: 6, term: 60, taxRate: 6 }); assert.strictEqual(r.tax, 1800); assert.strictEqual(r.financed, 28800); assert.strictEqual(r.monthly, 556.78); assert.strictEqual(r.totalPayments, 33406.8); assert.strictEqual(r.totalCost, 36406.8);
  const t2 = O.payment({ price: 30000, trade: 10000, apr: 6, term: 60 }); assert.strictEqual(t2.tax, 1200); assert.strictEqual(t2.financed, 21200); });
t('payment: 0% APR, term 36-84 only, price required, never negative', () => {
  assert.strictEqual(O.payment({ price: 36000, apr: 0, term: 36, taxRate: 0 }).monthly, 1000); throwsCode(() => O.payment({ price: 1, term: 24 }), 'bad_term'); throwsCode(() => O.payment({ price: 1, term: 96 }), 'bad_term');
  throwsCode(() => O.payment({ price: '' }), 'bad_price'); const r = O.payment({ price: 1000, down: 5000, term: 36 }); assert.strictEqual(r.monthly, 0); assert.strictEqual(r.financed, 0);
  assert.strictEqual(O.payment({ price: '$25,000', term: 72 }).price, 25000); assert.strictEqual(O.payment({ price: 25000 }).term, 72); });
t('down payment over the amount owed is capped, with a note, nothing negative', () => {
  const r = O.payment({ price: 20000, down: 25000, apr: 6, term: 60, taxRate: 6 });
  assert.strictEqual(r.down, 21200); assert.strictEqual(r.downEntered, 25000); assert.ok(r.downCapped); assert.match(r.note, /more than the amount owed/);
  assert.strictEqual(r.financed, 0); assert.strictEqual(r.monthly, 0); assert.strictEqual(r.totalCost, 21200);
  const both = O.payment({ price: 20000, down: 8000, trade: 15000, apr: 6, term: 60, taxRate: 6 }); // tax on 5,000 = 300; owed 20,300 -> trade 15,000 + down 5,300
  assert.strictEqual(both.trade, 15000); assert.strictEqual(both.down, 5300); assert.ok(both.downCapped && !both.tradeCapped); assert.strictEqual(both.financed, 0);
  const bigTrade = O.payment({ price: 10000, down: 1000, trade: 14000, term: 36 }); assert.strictEqual(bigTrade.trade, 10000); assert.strictEqual(bigTrade.down, 0); assert.ok(bigTrade.tradeCapped); assert.match(bigTrade.note, /trade-in is worth more/);
  const exact = O.payment({ price: 10000, down: 10600, term: 36, taxRate: 6 }); assert.ok(!exact.downCapped); assert.strictEqual(exact.note, ''); assert.strictEqual(exact.financed, 0);
  const normal = O.payment({ price: 30000, down: 3000, apr: 6, term: 60, taxRate: 6 }); assert.ok(!normal.downCapped && !normal.tradeCapped && normal.note === '');
  for (const p of [{ price: 5000, down: 99999 }, { price: 5000, trade: 99999 }, { price: 5000, down: 99999, trade: 99999, tradeOwed: 100 }, { price: 1, down: -50, trade: -5 }])
    for (const [k, v] of Object.entries(O.payment(Object.assign({ term: 48 }, p)))) if (typeof v === 'number') assert.ok(v >= 0, k + ' = ' + v); });
t('trade-in estimate follows the labelled formula', () => {
  const r = O.tradeIn({ year: 2019, make: 'Ford', model: 'Escape', mileage: 60000, condition: 'good' });
  const base = 32000 * Math.pow(0.85, 7), mAdj = Math.min(1.15, Math.max(0.5, 1 - 0.08 * (60000 - 84000) / 10000));
  assert.strictEqual(r.estimate, Math.round(base * mAdj * 0.9 / 50) * 50); assert.ok(r.low < r.estimate && r.high > r.estimate); assert.match(r.formula, /not an offer/);
  assert.ok(O.tradeIn({ year: 2019, make: 'F', model: 'E', mileage: 60000, condition: 'excellent' }).estimate > O.tradeIn({ year: 2019, make: 'F', model: 'E', mileage: 160000, condition: 'poor' }).estimate);
  assert.strictEqual(O.tradeIn({ year: 1985, make: 'F', model: 'E', mileage: 900000, condition: 'poor' }).estimate, 250);
  throwsCode(() => O.tradeIn({ year: 2019, make: 'F', model: 'E', mileage: 1, condition: 'mint' }), 'bad_condition'); throwsCode(() => O.tradeIn({ year: 2019, make: '', model: 'E', mileage: 1, condition: 'good' }), 'need_vehicle'); });
t('submit reserve: code, deposit from settings, saved to dealerdesk_orders', () => {
  O.updateSettings({ depositAmount: 750 }); const r = O.submit(req({ trade: { year: 2018, make: 'Ford', model: 'Focus', mileage: 70000, condition: 'fair' }, calc: { down: 2000, apr: 5, term: 60 } }));
  assert.match(r.code, /^DO-[0-9A-Z]{4}\d+$/); const saved = JSON.parse(globalThis.localStorage.getItem('dealerdesk_orders')).orders[0];
  assert.strictEqual(saved.deposit, 750); assert.strictEqual(saved.status, 'new'); assert.strictEqual(saved.carId, avail.id); assert.ok(saved.trade.estimate > 0); assert.strictEqual(saved.calc.trade, saved.trade.estimate); assert.strictEqual(saved.calc.term, 60); });
t('submit validation: kind, name, phone, email, sold car, unknown car, email preference', () => {
  throwsCode(() => O.submit(req({ kind: '' })), 'need_kind'); throwsCode(() => O.submit(req({ name: ' ' })), 'need_name'); throwsCode(() => O.submit(req({ phone: '555-1234' })), 'need_phone');
  throwsCode(() => O.submit(req({ email: 'x@' })), 'bad_email'); throwsCode(() => O.submit(req({ vehicle: 'NOPE' })), 'no_car'); throwsCode(() => O.submit(req({ contact: 'email', email: '' })), 'need_email');
  if (sold) throwsCode(() => O.submit(req({ vehicle: sold.stock_no })), 'sold'); });
t('rate limit: 5 requests per phone per hour, other phones fine, resets after an hour', () => {
  const Ox = load(); for (let i = 0; i < 5; i++) Ox.submit(req({ phone: '(248) 555-0000', kind: i % 2 ? 'buy' : 'reserve' }));
  throwsCode(() => Ox.submit(req({ phone: '248.555.0000' })), 'rate_limited'); Ox.submit(req({ phone: '248-555-9999' }));
  Ox._setClock(() => NOW + 3600001); Ox.submit(req({ phone: '2485550000' })); O = Ox; });
t('staff statuses, history, filter/search, booking link', () => {
  const id = O.list()[0].id; for (const s of ['contacted', 'deposit', 'sold']) O.setStatus(id, s); throwsCode(() => O.setStatus(id, 'lost'), 'bad_status');
  const o = O.list({ status: 'sold' })[0]; assert.strictEqual(o.history.length, 4); assert.strictEqual(O.list({ q: '9999' }).length, 1);
  assert.strictEqual(O.bookingLink(o), 'booking.html?vehicle=' + encodeURIComponent(avail.stock_no)); O.updateSettings({ bookingUrl: 'https://dealer.example.com/booking.html?x=1' }); assert.match(O.bookingLink(o), /\?x=1&vehicle=/);
  throwsCode(() => O.updateSettings({ bookingUrl: 'javascript:alert(1)' }), 'bad_url'); O.updateSettings({ bookingUrl: 'booking.html' }); });
t('settings validation', () => { throwsCode(() => O.updateSettings({ defaultTerm: 30 }), 'bad_term'); throwsCode(() => O.updateSettings({ taxRate: 50 }), 'bad_taxRate'); O.updateSettings({ taxRate: 6, defaultTerm: 84 }); assert.strictEqual(load(globalThis.localStorage).settings().defaultTerm, 84); O = load(globalThis.localStorage); });
t('staff HTML escapes customer input and renders statuses + test-drive link', () => { O.submit(req({ phone: '313-555-7777', name: '<img src=x onerror=alert(1)>', notes: '<script>x</script>' })); const h = O.renderHTML();
  assert.ok(!h.includes('<img src=x') && !h.includes('<script>x')); ['new', 'contacted', 'deposit', 'sold', 'cancelled'].forEach(s => assert.ok(h.includes('data-filter="' + s + '"'))); assert.ok(h.includes('Book test drive')); });
t('no payment fields, no tokens/personal emails/TableTop in shipped files', () => {
  for (const f of ['modules/order.js', 'modules/order-public.js', 'order.html', 'modules/order.css', 'orders-demo.html']) { const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/gmail\.com|tabletop|workers\.dev|Bearer|ghp_/i.test(s), f); assert.ok(!/cc-number|cardnumber|card number|cvv|cvc|routing|iban|autocomplete="cc-/i.test(s), 'payment field in ' + f); }
  assert.match(fs.readFileSync(path.join(ROOT, 'order.html'), 'utf8'), /No payment is taken here/); });

function opt(n) { for (const d of [process.env.DD_DEV_MODULES, '/tmp/qrdev/node_modules', '/tmp/devmods/node_modules'].filter(Boolean)) { try { return require(require.resolve(n, { paths: [d] })); } catch (e) {} } return null; }
const jsdom = opt('jsdom');
function page(file, url, store) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(ROOT, s), 'utf8') + '</script>');
  const dom = new jsdom.JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true }); Object.defineProperty(dom.window, 'localStorage', { value: store, configurable: true });
  dom.window.eval('(' + ((n) => { const D = Date; window.Date = class extends D { constructor(...a) { a.length ? super(...a) : super(n); } static now() { return n; } }; }) + ')(' + NOW + ')');
  dom.window.document.querySelectorAll('script').forEach(s => dom.window.eval(s.textContent)); return dom;
}
if (!jsdom) skipped.push('UI tests (jsdom not found)'); else {
  t('order.html: car summary, calculator, trade-in, submit, confirmation', () => {
    const st = fake({ dealerdesk_data: JSON.stringify(CARS) }), dom = page('order.html', 'http://localhost/order.html?vehicle=' + avail.stock_no, st), d = dom.window.document, ev = n => new dom.window.Event(n, { bubbles: true });
    assert.ok(d.querySelector('.ddo-car h2').textContent.includes(avail.model)); assert.ok(d.querySelector('.ddo-price').textContent.startsWith('$'));
    assert.ok(d.querySelector('.ddo-photo')); assert.match(d.getElementById('ddo-dep').textContent, /\$500/);
    assert.match(d.getElementById('ddo-calcout').textContent, /\/month for 72 months/);
    const c = d.getElementById('ddo-calc'); c.querySelector('[name=term]').value = '36'; c.querySelector('[name=apr]').value = '0'; c.querySelector('[name=down]').value = '0'; c.dispatchEvent(ev('input'));
    const exp = O.money2(Math.round(avail.price * 1.06 / 36 * 100) / 100); assert.ok(d.getElementById('ddo-calcout').textContent.includes(exp), d.getElementById('ddo-calcout').textContent + ' vs ' + exp);
    const tr = d.getElementById('ddo-trade'); tr.querySelector('[name=tyear]').value = '2018'; tr.querySelector('[name=tmake]').value = 'Ford'; tr.querySelector('[name=tmodel]').value = 'Focus'; tr.querySelector('[name=tmiles]').value = '80000'; tr.dispatchEvent(ev('input'));
    assert.match(d.getElementById('ddo-tradeout').textContent, /Estimated \$/); d.querySelector('#ddo-tradeout button').click(); assert.ok(+c.querySelector('[name=trade]').value > 0);
    assert.ok(d.getElementById('ddo-formula').textContent.includes('depreciation'));
    d.querySelector('[data-kind=buy]').click(); const f = d.getElementById('ddo-form'); f.elements.name.value = 'Eve'; f.elements.phone.value = '313 555 0123';
    f.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    assert.ok(!d.getElementById('ddo-done').hidden, d.getElementById('ddo-err').textContent); assert.match(d.getElementById('ddo-code').textContent, /^DO-/);
    assert.match(d.getElementById('ddo-book').getAttribute('href'), new RegExp('booking\\.html\\?vehicle=' + avail.stock_no));
    const saved = JSON.parse(st.getItem('dealerdesk_orders')).orders[0]; assert.strictEqual(saved.kind, 'buy'); assert.ok(saved.trade); assert.strictEqual(saved.calc.term, 36);
    assert.strictEqual(d.querySelectorAll('input[autocomplete^="cc-"]').length, 0); });
  t('order.html: down over price shows capped amounts, a note, and no negative numbers', () => {
    const dom = page('order.html', 'http://localhost/order.html?vehicle=' + avail.stock_no, fake({ dealerdesk_data: JSON.stringify(CARS) })), d = dom.window.document;
    const c = d.getElementById('ddo-calc'); c.querySelector('[name=down]').value = String(avail.price * 3); c.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    const out = d.getElementById('ddo-calcout').textContent; assert.ok(d.querySelector('.ddo-capnote'), 'note shown'); assert.match(out, /\$0\.00\/month/);
    assert.ok(!/-\s*\$|\$\s*-|\u2212\s*\$-/.test(out), 'negative amount in: ' + out);
    c.querySelector('[name=down]').value = '1000'; c.dispatchEvent(new dom.window.Event('input', { bubbles: true })); assert.ok(!d.querySelector('.ddo-capnote'), 'note gone'); });
  t('order.html: unknown and sold cars show a message, no form', () => {
    let d = page('order.html', 'http://localhost/order.html?vehicle=NOPE', fake({ dealerdesk_data: JSON.stringify(CARS) })).window.document; assert.ok(d.getElementById('ddo-flow').hidden); assert.match(d.getElementById('ddo-missing').textContent, /could not find/);
    if (sold) { d = page('order.html', 'http://localhost/order.html?vehicle=' + sold.stock_no, fake({ dealerdesk_data: JSON.stringify(CARS) })).window.document; assert.ok(d.getElementById('ddo-flow').hidden); assert.match(d.getElementById('ddo-missing').textContent, /sold/); }
    if (hold) { d = page('order.html', 'http://localhost/order.html?vehicle=' + hold.stock_no, fake({ dealerdesk_data: JSON.stringify(CARS) })).window.document; assert.ok(!d.getElementById('ddo-flow').hidden); assert.match(d.body.textContent, /on hold/); } });
  t('staff orders: mount, filter, search, change status', () => {
    const st = fake({ dealerdesk_data: JSON.stringify(CARS) }); globalThis.localStorage = st; const Oa = load(st); Oa.submit(req()); Oa.submit(req({ name: 'Bob', phone: '313-555-2222', kind: 'buy' }));
    const dom = page('orders-demo.html', 'http://localhost/orders-demo.html', st), d = dom.window.document;
    assert.strictEqual(d.querySelectorAll('.ddo-row').length, 2); const sel = d.querySelector('[data-status]'); sel.value = 'contacted'; sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    d.querySelector('[data-filter="contacted"]').click(); assert.strictEqual(d.querySelectorAll('.ddo-row').length, 1);
    d.querySelector('[data-filter=""]').click(); const q = d.querySelector('[data-q]'); q.value = 'bob'; q.dispatchEvent(new dom.window.Event('input', { bubbles: true })); assert.strictEqual(d.querySelectorAll('.ddo-row').length, 1);
    assert.match(d.querySelector('.ddo-row a.ddb-btn').getAttribute('href'), /^booking\.html\?vehicle=/); assert.strictEqual(JSON.parse(st.getItem('dealerdesk_orders')).orders.filter(o => o.status === 'contacted').length, 1); });
}
t('QA: non-numeric APR/term is an error, not 0%', () => { for (const x of [{ apr: 'abc' }, { term: 'abc' }]) { let c; try { O.payment(Object.assign({ price: 20000 }, x)); } catch (e) { c = e.code; } assert.ok(c === 'bad_apr' || c === 'bad_term', 'got ' + c); } });
t('QA: stored calc uses the real car price, not a typed one', () => { const P = load(); const car = P.cars().find(c => c.status !== 'sold'); P.submit({ vehicle: car.stock, kind: 'buy', name: 'Q', phone: '3135550111', calc: { price: '1', apr: '5', term: '60' } }); assert.strictEqual(P.all().orders.pop().calc.price, car.price); });
console.log('\n' + pass + ' passed' + (skipped.length ? ', skipped: ' + skipped.join('; ') : ''));
