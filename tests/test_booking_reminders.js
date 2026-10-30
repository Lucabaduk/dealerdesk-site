// Booking reminders: due list, sms:/mailto: links, mark reminded, .ics, settings (window + templates), staff + public UI.
const assert = require('assert'), path = require('path'), fs = require('fs');
let pass = 0, fail = 0;
function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log('FAIL ' + n + ' - ' + e.message); } }
function fake(init) { const m = Object.assign({}, init); return { _m: m, getItem: k => k in m ? m[k] : null, setItem(k, v) { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
const ROOT = path.join(__dirname, '..'), MOD = path.join(ROOT, 'modules', 'booking.js');
const NOW = new Date(2026, 10, 4, 8, 0).getTime(); // Wed Nov 4 2026 08:00 local
const INV = JSON.stringify({ cars: [{ id: 'car-a', stock_no: 'A100', vin: '1HGCM82633A100000', year: 2022, make: 'Honda', model: 'Accord', status: 'available' }, { id: 'car-c', stock_no: 'C300', vin: '3FA6P0H72HR123456', year: 2023, make: 'Ford', model: 'Fusion', status: 'available' }] });
function load(st) { globalThis.localStorage = st || fake({ dealerdesk_data: INV }); delete require.cache[MOD]; const B = require(MOD); B._setClock(() => NOW); return B; }
function throwsCode(f, code) { try { f(); } catch (e) { assert.strictEqual(e.code, code, 'got ' + e.code + ': ' + e.message); return e; } throw new Error('expected ' + code); }
const td = o => Object.assign({ vehicle: 'A100', customer: 'Ann Lee', phone: '313-555-0101', email: 'ann@example.com', salesperson: '', date: '2026-11-04', time: '15:00' }, o);
const sv = o => Object.assign({ customer: 'Bob Ray', phone: '(313) 555-0199', email: '', type: 'oil-change', vehicle: { year: 2018, make: 'Ford', model: 'F-150' }, date: '2026-11-04', time: '17:00' }, o);

let B = load(); B.setDealerName('Motor City Auto');
const a = B.addTestDrive(td()), b = B.addService(sv()), c = B.addTestDrive(td({ vehicle: 'C300', date: '2026-11-05', time: '16:00', customer: 'Cy Day' })), far = B.addTestDrive(td({ date: '2026-11-07', time: '10:00', customer: 'Far Away' }));
t('defaults: 24h window and friendly templates', () => { const s = B.settings(); assert.strictEqual(s.reminderHours, 24); assert.match(s.templates.sms, /\{dealer\}/); assert.match(s.templates.emailBody, /\{code\}/); });
t('new bookings get a confirmation code', () => { assert.match(a.code, /^DD-[0-9A-Z]{3}\d+$/); assert.match(b.code, /^DD-/); assert.notStrictEqual(a.code, b.code); });
t('due list: next 24h only, sorted, both kinds', () => { assert.deepStrictEqual(B.reminders().map(r => r.id), [a.id, b.id]); });
t('48h window adds the next-afternoon booking; >48h never', () => { B.updateSettings({ reminderHours: 48 }); assert.deepStrictEqual(B.reminders().map(r => r.id), [a.id, b.id, c.id]); assert.ok(!B.reminders().some(r => r.id === far.id)); B.updateSettings({ reminderHours: 24 }); });
t('cancelled / completed / started service are not due', () => { const x = B.addTestDrive(td({ vehicle: 'C300', time: '17:00', customer: 'X' })); B.setTestDriveStatus(x.id, 'cancelled'); assert.ok(!B.reminders().some(r => r.id === x.id));
  const y = B.addService(sv({ time: '07:00', date: '2026-11-05', customer: 'Y' }).time === '07:00' ? sv({ date: '2026-11-05', time: '10:00', customer: 'Y' }) : sv()); B.advanceService(y.id); assert.ok(!B.reminders().some(r => r.id === y.id)); });
t('past bookings are not due', () => { B._setClock(() => NOW + 8 * 3600000); assert.ok(!B.reminders().some(r => r.id === a.id)); B._setClock(() => NOW); });
t('text link: sms: with +1 number and filled message', () => { const m = B.reminderMessage('test-drive', a.id);
  assert.ok(m.sms.startsWith('sms:+13135550101?&body=')); const body = decodeURIComponent(m.sms.split('&body=')[1]);
  assert.ok(body.includes('Hi Ann') && body.includes('Motor City Auto') && body.includes('2022 Honda Accord') && body.includes('Wednesday, Nov 4') && body.includes('3:00 PM') && body.includes(a.code), body); });
t('email link: mailto with subject + body; missing email -> no link', () => { const m = B.reminderMessage('test-drive', a.id); assert.ok(m.mailto.startsWith('mailto:ann@example.com?subject='));
  assert.match(decodeURIComponent(m.mailto.split('subject=')[1].split('&body=')[0]), /Reminder: your test drive on Wednesday, Nov 4 at 3:00 PM/); assert.strictEqual(B.reminderMessage('service', b.id).mailto, '');
  assert.match(B.reminderMessage('service', b.id).text, /oil change appointment for the 2018 Ford F-150/); });
t('hostile email/phone never produce a link', () => { const z = B.addTestDrive(td({ vehicle: 'C300', time: '18:00', customer: 'Z', email: 'a@b.co' })); const raw = B.all();
  // simulate tampered storage
  const st = globalThis.localStorage, data = JSON.parse(st.getItem('dealerdesk_booking')); const rec = data.testDrives.find(x => x.id === z.id); rec.email = 'x@y.com?bcc=evil@z.com'; rec.phone = 'javascript:alert(1)'; st.setItem('dealerdesk_booking', JSON.stringify(data));
  const B2 = load(st); const m = B2.reminderMessage('test-drive', z.id); assert.strictEqual(m.mailto, ''); assert.strictEqual(m.sms, ''); B = B2; B.setDealerName('Motor City Auto'); });
t('mark reminded stores a timestamp and removes it from the list; unmark restores', () => { const r = B.markReminded('test-drive', a.id, 'text'); assert.strictEqual(r.remindedAt, NOW); assert.strictEqual(r.remindedVia, 'text');
  assert.ok(!B.reminders().some(x => x.id === a.id)); assert.strictEqual(JSON.parse(globalThis.localStorage.getItem('dealerdesk_booking')).testDrives.find(x => x.id === a.id).remindedAt, NOW);
  B.unmarkReminded('test-drive', a.id); assert.ok(B.reminders().some(x => x.id === a.id)); throwsCode(() => B.markReminded('test-drive', 'nope'), 'not_found'); });
t('templates: validate first, reject unsafe links / unknown placeholders / empty, keep old on error', () => {
  const before = JSON.stringify(B.settings());
  for (const [tpl, code] of [[{ sms: 'Go to javascript:alert(1)' }, 'unsafe_link'], [{ sms: 'See DATA:text/html,<b>' }, 'unsafe_link'], [{ emailBody: 'Visit http://x.example' }, 'unsafe_link'], [{ emailBody: 'ftp://x' }, 'unsafe_link'],
    [{ sms: 'Hi {name}' }, 'bad_placeholder'], [{ sms: '  ' }, 'bad_template'], [{ emailSubject: 'two\nlines' }, 'bad_template'], [{ sms: 'x'.repeat(481) }, 'bad_template']]) {
    throwsCode(() => B.updateSettings({ reminderHours: 48, templates: Object.assign({ sms: 'ok {first}' }, tpl) }), code); assert.strictEqual(JSON.stringify(B.settings()), before, JSON.stringify(tpl)); }
  throwsCode(() => B.updateSettings({ reminderHours: 12 }), 'bad_reminderHours');
  B.updateSettings({ templates: { sms: 'Yo {first}! {what} {date} {time}, code {code}. Map: https://maps.example.com/x' } }); assert.match(B.reminderMessage('test-drive', a.id).text, /^Yo Ann! test drive Wednesday, Nov 4 3:00 PM, code DD-.*https:\/\/maps/);
  B.updateSettings({ templates: B.defaultTemplates() }); });
t('customer text with <script> stays inert in links and HTML', () => { const h = B.addTestDrive(td({ vehicle: 'C300', time: '19:00'.replace('19', '18'), customer: '<img src=x onerror=alert(1)>', date: '2026-11-04' }).time === '18:00' ? td({ vehicle: 'C300', time: '13:00', customer: '<img src=x onerror=alert(1)>' }) : td());
  B._ui.tab = 'reminders'; const html = B.renderHTML(); assert.ok(!html.includes('<img src=x')); assert.ok(html.includes('&lt;img src=x'));
  for (const m of html.match(/href="[^"]*"/g)) assert.ok(/^href="(sms:|mailto:|data:text\/calendar)/.test(m), m); });
t('.ics: valid VCALENDAR, local times, escaped text, CRLF, folded <=75', () => { const s = B.ics('test-drive', a.id); const L = s.split('\r\n');
  assert.strictEqual(L[0], 'BEGIN:VCALENDAR'); assert.ok(L.includes('DTSTART:20261104T150000') && L.includes('DTEND:20261104T153000')); assert.ok(L.some(l => l.startsWith('UID:') && l.endsWith('@dealerdesk')));
  assert.ok(L.some(l => /^SUMMARY:Test drive - 2022 Honda Accord \(Motor City Auto\)$/.test(l))); assert.ok(s.includes('BEGIN:VALARM'));
  for (const l of L) assert.ok(Buffer.byteLength(l) <= 75, l); assert.ok(!/[^\r]\n/.test(s));
  B.setDealerName('A, B; C\\D'); const e = B.ics('service', b.id); assert.ok(e.includes('LOCATION:A\\, B\\; C\\\\D')); assert.ok(e.includes('DTSTART:20261104T170000') && e.includes('DTEND:20261104T174500')); B.setDealerName('Motor City Auto');
  assert.ok(B.icsHref('test-drive', a.id).startsWith('data:text/calendar;charset=utf-8,BEGIN%3AVCALENDAR')); assert.match(B.icsFileName('test-drive', a.id), /^dealerdesk-dd-[0-9a-z]+\.ics$/); });
t('safeHref only allows the three built schemes', () => { for (const h of ['javascript:alert(1)', 'data:text/html,x', 'https://x', 'sms:abc', 'mailto:x']) assert.strictEqual(B.safeHref(h), '', h); });

function opt(n) { for (const d of [process.env.DD_DEV_MODULES, '/tmp/uit/node_modules', '/tmp/qrdev/node_modules', '/tmp/devmods/node_modules'].filter(Boolean)) { try { return require(path.join(d, n)); } catch (e) {} } return null; }
const jsdom = opt('jsdom');
function page(file, url, store) { const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(ROOT, s), 'utf8') + '</script>');
  const dom = new jsdom.JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true }); Object.defineProperty(dom.window, 'localStorage', { value: store, configurable: true }); dom.window.__errors = [];
  dom.window.addEventListener('error', e => dom.window.__errors.push(e.message)); dom.window.setTimeout = f => { f(); return 0; };
  dom.window.eval('(' + ((n) => { const D = Date; window.Date = class extends D { constructor(...a) { a.length ? super(...a) : super(n); } static now() { return n; } }; }) + ')(' + NOW + ')');
  dom.window.document.querySelectorAll('script').forEach(s => dom.window.eval(s.textContent)); return dom; }
if (!jsdom) console.log('  (jsdom not found, UI tests skipped)'); else {
  t('staff UI: Reminders tab with badge, text link marks reminded, Mark reminded button, details have calendar link', () => {
    const st = fake({ dealerdesk_data: INV }), B3 = load(st); B3.addTestDrive(td()); B3.addService(sv({ email: 'bob@example.com' }));
    const dom = page('demo.html', 'http://localhost/demo.html', st), d = dom.window.document, W = dom.window;
    assert.strictEqual(d.querySelector('[data-rem-count]').textContent, '2'); d.querySelector('[data-tab=reminders]').click();
    assert.strictEqual(d.querySelectorAll('.ddb-remitem').length, 2); const txt = d.querySelector('a[data-remind=text]'); assert.ok(txt.getAttribute('href').startsWith('sms:+1'));
    assert.ok(d.querySelector('a[data-remind=email]').getAttribute('href').startsWith('mailto:'));
    txt.addEventListener('click', e => e.preventDefault()); txt.click(); assert.strictEqual(d.querySelectorAll('.ddb-remitem').length, 1); assert.strictEqual(d.querySelector('[data-rem-count]').textContent, '1');
    d.querySelector('[data-mark]').click(); assert.strictEqual(d.querySelectorAll('.ddb-remitem').length, 0); assert.ok(!d.querySelector('[data-rem-count]')); assert.match(d.querySelector('.ddb-rem').textContent, /No reminders due/);
    const saved = JSON.parse(st.getItem('dealerdesk_booking')); assert.strictEqual(saved.testDrives[0].remindedVia, 'text'); assert.strictEqual(saved.services[0].remindedVia, 'manual');
    d.querySelector('[data-tab=drives]').click(); const det = d.querySelector('.ddb-det'); assert.ok(det && /Reminded/.test(det.textContent)); const cal = det.querySelector('a[download]'); assert.ok(cal.getAttribute('href').startsWith('data:text/calendar')); assert.match(cal.getAttribute('download'), /\.ics$/);
    d.querySelector('[data-tab=service]').click(); assert.ok(d.querySelector('.ddb-bay .ddb-det a[download]'));
    assert.deepStrictEqual(W.__errors, []); });
  t('staff UI settings: 48h + template saved; unsafe template rejected with message and nothing changed', () => {
    const st = fake({ dealerdesk_data: INV }), dom = page('demo.html', 'http://localhost/demo.html', st), d = dom.window.document, W = dom.window;
    const sub = vals => { const f = d.querySelector('[data-form=settings]'); for (const k in vals) f.elements[k].value = vals[k]; f.dispatchEvent(new W.Event('submit', { bubbles: true, cancelable: true })); };
    d.querySelector('[data-tab=settings]').click(); assert.ok(d.querySelector('[name=reminderHours]') && d.querySelector('[name=tpl_sms]') && d.querySelector('[name=tpl_emailBody]'));
    sub({ reminderHours: '48', tpl_sms: 'Hi {first}, <b>see you</b> javascript:void(0)' }); assert.match(d.querySelector('.ddb-msg').textContent, /unsafe link/); assert.strictEqual(W.DDBooking.settings().reminderHours, 24);
    d.querySelector('[data-tab=settings]').click(); sub({ reminderHours: '48', tpl_sms: 'Hi {first} <b>bold</b> {code}' }); assert.match(d.querySelector('.ddb-msg').textContent, /saved/i);
    assert.strictEqual(W.DDBooking.settings().reminderHours, 48); assert.strictEqual(W.DDBooking.settings().templates.sms, 'Hi {first} <b>bold</b> {code}');
    assert.ok(d.querySelector('[name=tpl_sms]').value.includes('<b>bold</b>') && !d.querySelector('form b + b'));
    const f = d.querySelector('[data-form=settings]'); f.elements.tpl_reset.checked = true; f.dispatchEvent(new W.Event('submit', { bubbles: true, cancelable: true })); assert.match(W.DDBooking.settings().templates.sms, /friendly reminder/);
    assert.deepStrictEqual(W.__errors, []); });
  t('public booking confirmation shows an Add to calendar .ics', () => {
    const st = fake({ dealerdesk_data: INV }), dom = page('booking.html', 'http://localhost/booking.html?vehicle=A100&name=Motor%20City', st), d = dom.window.document;
    d.getElementById('ddp-date').value = '2026-11-05'; d.getElementById('ddp-date').dispatchEvent(new dom.window.Event('change'));
    d.querySelector('[data-t="11:00"]').click(); const f = d.getElementById('ddp-form'); f.elements.customer.value = 'Eve'; f.elements.phone.value = '313 555 0123';
    f.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    const ic = d.getElementById('ddp-ics'); assert.ok(!ic.hidden, d.getElementById('ddp-err').textContent); const ics = decodeURIComponent(ic.getAttribute('href').split(',').slice(1).join(','));
    assert.ok(ics.includes('DTSTART:20261105T110000') && ics.includes('Motor City') && ics.includes(d.getElementById('ddp-code').textContent)); assert.match(ic.getAttribute('download'), /\.ics$/);
    assert.deepStrictEqual(dom.window.__errors, []); });
}
console.log('booking reminders: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
