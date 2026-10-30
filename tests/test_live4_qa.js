// QA live-4: impossible dates are rejected (no Feb 31 -> Mar 3 rollover); stock-photo captions are honest.
const path = require('path'), { t, eq, ok, done } = require('./_h.js');
function fake() { const m = {}; return { getItem: k => k in m ? m[k] : null, setItem(k, v) { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
globalThis.localStorage = fake();
const MOD = path.join(__dirname, '..', 'modules', 'booking.js'); const B = require(MOD); B._setClock(() => new Date(2026, 10, 4, 8, 0).getTime());
const D = require('../modules/dashboard.js'), L = require('../modules/leads.js'), I = require('../modules/inventory.js');
const bad = ['2027-02-31', '2027-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-11-00'];
for (const s of bad) {
  t('booking parseDate rejects ' + s, () => eq(B._parseDate(s), null));
  t('dashboard toDate rejects ' + s, () => eq(D._toDate(s), null));
  t('leads parseDate rejects ' + s, () => eq(L.parseDate(s), null));
}
t('booking parseDate accepts leap day', () => eq(B._parseDate('2028-02-29').getDate(), 29));
t('dashboard toDate accepts real date/time', () => { const d = D._toDate('2026-11-01T14:30'); eq([d.getMonth(), d.getDate(), d.getHours()], [10, 1, 14]); });
t('dashboard toDate rejects 24:00 / :60', () => { eq(D._toDate('2026-11-01T24:00'), null); eq(D._toDate('2026-11-01T10:60'), null); });
const td = (o) => Object.assign({ vehicle: { year: 2020, make: 'Ford', model: 'F-150' }, customer: 'Ann Lee', phone: '313-555-0101', salesperson: 'Maria', date: '2027-02-31', time: '10:00' }, o);
t('addTestDrive with Feb 31 throws, does not book Mar 3', () => { let threw = false; try { B.addTestDrive(td()); } catch (e) { threw = true; } ok(threw); ok(!B.all().testDrives.some(x => x.date === '2027-03-03'), 'no rollover booking'); });
t('addService with Apr 31 throws', () => { let threw = false; try { B.addService({ customer: 'Bob', phone: '3135550199', type: 'tires', vehicle: { year: 2018, make: 'Ford', model: 'F-150' }, date: '2027-04-31', time: '09:00' }); } catch (e) { threw = true; } ok(threw); });
t('openSlots on impossible date gives nothing', () => { const r = B.openSlots && B.openSlots('test-drive', '2027-02-31'); ok(!r || !r.length, JSON.stringify(r)); });
const ex = (y) => ({ year: y, make: 'Ford', model: 'Explorer', photos: ['assets/cars/ford-explorer.webp'] });
t('Explorer 2016 caption flags generation', () => ok(/2020\u20132024 model; a 2016 looks different/.test(I.photoCaption(ex(2016)))));
t('Explorer 2025 caption flags generation', () => ok(/a 2025 looks different/.test(I.photoCaption(ex(2025)))));
t('Explorer 2022 caption: representative, no mismatch', () => { const c = I.photoCaption(ex(2022)); ok(/Representative photo/.test(c)); ok(!/looks different/.test(c)); });
t('Explorer 2020 and 2024 boundaries ok', () => { ok(!/different/.test(I.photoCaption(ex(2020)))); ok(!/different/.test(I.photoCaption(ex(2024)))); });
t('dealer-uploaded https photo: no caption', () => eq(I.photoCaption({ year: 2016, make: 'Ford', model: 'Explorer', photos: ['https://img.example.com/a.webp'] }), ''));
t('no photo: no caption', () => { eq(I.photoCaption({ photos: [] }), ''); eq(I.photoCaption(null), ''); });
t('every stock-photo car in cars.json gets a caption', () => { const d = require('../cars.json'); const st = d.cars.filter(c => /^assets\/cars\//.test((c.photos || [])[0] || '')); ok(st.length > 4000, st.length); ok(st.every(c => I.photoCaption(c).length > 0)); const exs = d.cars.filter(c => c.model === 'Explorer' && (c.year < 2020 || c.year > 2024)); ok(exs.length > 0); ok(exs.every(c => /looks different/.test(I.photoCaption(c)))); });
t('caption is plain text (car-page uses textContent via el())', () => { const src = require('fs').readFileSync(path.join(__dirname, '..', 'modules', 'car-page.js'), 'utf8'); ok(/el\('p', 'photo-cap', cap\)/.test(src)); });
t('app.html inlines the fixed dashboard.js', () => { const a = require('fs').readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8'); ok(a.indexOf('no Feb 31 -> Mar 3 rollover') > 0); });
done('live4 qa');
