// QA: DST wall-clock times, UTC .ics, emoji folding, lone surrogates, template false positives, malformed storage, mailto CRLF.
process.env.TZ = process.env.TZ || "America/Detroit";
const assert = require('assert'), path = require('path');
let pass = 0, fail = 0; function t(n, f) { try { f(); pass++; } catch (e) { fail++; console.log('FAIL ' + n + ' - ' + e.message); } }
function fake(i) { const m = Object.assign({}, i); return { _m: m, getItem: k => k in m ? m[k] : null, setItem(k, v) { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
const MOD = path.join(__dirname, '..', 'modules', 'booking.js');
const INV = JSON.stringify({ cars: [{ id: 'car-a', stock_no: 'A100', vin: '1HGCM82633A100000', year: 2022, make: 'Honda', model: 'Accord', status: 'available' }] });
function load(raw) { const st = { dealerdesk_data: INV }; if (raw !== undefined) st.dealerdesk_booking = raw; globalThis.localStorage = fake(st); delete require.cache[MOD]; const B = require(MOD); B._setClock(() => new Date(2026, 9, 31, 8, 0).getTime()); return B; }
const H = {}; ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].forEach(d => H[d] = { open: '08:00', close: '19:00' });
function setup() { const B = load(); B.updateSettings({ hours: H, leadTimeMin: 0 }); return B; }
const td = o => Object.assign({ vehicle: 'A100', customer: 'Ann Lee', phone: '313-555-0101', email: 'ann@example.com', date: '2026-10-31', time: '15:00' }, o);
t('DST day: 10:00 on Nov 1 is 10:00 wall clock', () => { const B = setup(); const d = B.addTestDrive(td({ date: '2026-11-01', time: '10:00' })); const r = B.reminders(48).find(x => x.id === d.id); assert.strictEqual(new Date(r.at).getHours(), 10); });
t('DST: Sat 10:30 + 24h excludes Sun 10:00 (25 real hours)', () => { const B = setup(); const d = B.addTestDrive(td({ date: '2026-11-01', time: '10:00' })); B._setClock(() => new Date(2026, 9, 31, 10, 30).getTime()); assert.ok(!B.reminders(24).some(x => x.id === d.id)); });
t('.ics DTSTART/DTEND in UTC Z across DST', () => { const B = setup(); const a = B.addTestDrive(td({ date: '2026-10-31', time: '15:00' })), b = B.addTestDrive(td({ date: '2026-11-02', time: '15:00' }));
  const ia = B.ics('test-drive', a.id), ib = B.ics('test-drive', b.id);
  if (new Date(2026, 9, 31).getTimezoneOffset() === 240) { assert.match(ia, /DTSTART:20261031T190000Z\r\n/); assert.match(ib, /DTSTART:20261102T200000Z\r\n/); assert.match(ib, /DTEND:20261102T203000Z\r\n/); }
  else assert.match(ia, /DTSTART:\d{8}T\d{6}Z\r\n/); });
t('.ics with emoji dealer/notes does not throw and folds at 75 octets', () => { const B = setup(); B.setDealerName('Café 😀 Motors ' + '😀'.repeat(40));
  const s = B.addService({ customer: 'E', phone: '3135550111', type: 'oil-change', vehicle: { year: 2018, make: 'Ford', model: 'F' }, notes: 'x😀,;\\\n'.repeat(30), date: '2026-10-31', time: '11:00' });
  const ics = B.ics('service', s.id); ics.split('\r\n').forEach(l => assert.ok(Buffer.byteLength(l) <= 75, l)); assert.ok(!/[\ud800-\udfff](?![\udc00-\udfff])/.test(ics.replace(/[\ud800-\udbff][\udc00-\udfff]/g, '')));
  const unf = ics.replace(/\r\n /g, ''); assert.ok(unf.includes('x😀\\,\\;\\\\\\n')); assert.ok(B.icsHref('service', s.id).startsWith('data:text/calendar')); assert.ok(B.renderHTML().length > 0); });
t('80-char name cut mid-emoji still renders reminders', () => { const B = setup(); const d = B.addTestDrive(td({ customer: 'A' + '😀'.repeat(60), time: '12:00' })); B.updateSettings({ templates: { sms: 'Hi {customer}' } });
  const m = B.reminderMessage('test-drive', d.id); assert.ok(m.sms.startsWith('sms:')); assert.ok(m.mailto.startsWith('mailto:')); });
t('templates: words like profile:/metadata: are not unsafe links; javascript:/data: still are', () => { const B = setup();
  assert.ok(B.checkTemplate('sms', 'Update your profile: {dealer}')); assert.ok(B.checkTemplate('sms', 'metadata: {code}'));
  for (const v of ['javascript:alert(1)', 'go data:text/html,x', 'JaVaScRiPt :x', 'http://x.co']) assert.throws(() => B.checkTemplate('sms', v)); });
t('mailto body uses CRLF (RFC 6068), subject stays encoded', () => { const B = setup(); const d = B.addTestDrive(td({ time: '12:00' })); const m = B.reminderMessage('test-drive', d.id);
  assert.ok(m.mailto.includes('%0D%0A')); assert.ok(!/%0D%0A/.test(m.mailto.split('&body=')[0])); assert.ok(!/[\r\n]/.test(m.mailto)); });
t('malformed storage: non-array lists, bad templates, bad window do not crash', () => {
  for (const raw of ['{"v":1,"testDrives":"x","services":{},"requests":5,"settings":{"templates":{"sms":5},"reminderHours":"x"}}', '{"v":1,"settings":null,"testDrives":[null,1,{"id":"t1","date":"2026-10-31","time":"12:00","status":"booked"}]}']) {
    const B = load(raw); assert.ok(B.renderHTML().length > 100); const s = B.settings(); assert.strictEqual(s.reminderHours, 24); assert.strictEqual(typeof s.templates.sms, 'string'); B.reminders().forEach(r => B.reminderMessage(r.kind, r.id)); } });
t('__proto__ placeholder rejected, and does not pollute', () => { const B = setup(); assert.throws(() => B.checkTemplate('sms', '{__proto__}')); assert.strictEqual({}.polluted, undefined); });
console.log('booking reminders qa: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
