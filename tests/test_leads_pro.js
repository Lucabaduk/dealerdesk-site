const { t, eq, ok, done, genCars } = require('./_h.js');
const fs = require('fs'), path = require('path');
const S = require('../modules/store.js'), L = require('../modules/leads.js');
const H = 3600000, D = 24 * H, T0 = Date.UTC(2026, 9, 30, 12);
let now = T0; const clock = () => now;
const mk = st => L.create({ storage: st || S.memoryStorage(), now: clock, minGapMs: 0 });
const V = '1HGCM82633A004352', g = (x) => Object.assign({ vin: V, name: 'Ana Silva', phone: '3135550100', interest: 'test_drive', message: 'Saturday?' }, x);
// 1 timeline
t('timeline records each status change with time', () => { now = T0; const s = mk(), l = s.submit(g()).lead; eq(l.history, [{ to: 'new', at: T0, by: '' }]);
  now += H; s.setStatus(l.id, 'contacted', null, 'Bo'); now += H; s.setStatus(l.id, 'contacted'); s.setStatus(l.id, 'won');
  eq(s.get(l.id).history.map(h => [h.from, h.to, h.at - T0, h.by]), [[undefined, 'new', 0, ''], ['new', 'contacted', H, 'Bo'], ['contacted', 'won', 2 * H, '']]); });
// 2 notes
t('notes with timestamps, cleaned, empty rejected', () => { now = T0; const s = mk(), l = s.submit(g()).lead; now += 5 * 60000; const r = s.addNote(l.id, '<img src=x onerror=alert(1)> called', 'Bo'); ok(r.ok); eq(r.note.at, T0 + 300000); ok(!/[<>]/.test(r.note.text)); eq(r.note.by, 'Bo');
  eq(s.addNote(l.id, '   ').errors, ['note']); eq(s.addNote('nope', 'x').errors, ['not_found']); s.addNote(l.id, 'second'); eq(s.get(l.id).notesLog.map(n => n.text), ['img src=x onerror=alert(1) called', 'second']); });
// 3 assign
t('assign salesperson, list remembered + deduped', () => { const st = S.memoryStorage(), s = mk(st), a = s.submit(g()).lead, b = s.submit(g({ phone: '3135550101' })).lead;
  s.assign(a.id, ' Maria  Lopez '); s.assign(b.id, 'maria lopez'); s.assign(b.id, 'Ted'); eq(s.salespeople(), ['Maria Lopez', 'Ted']); eq(s.get(a.id).assignee, 'Maria Lopez'); eq(mk(st).salespeople(), ['Maria Lopez', 'Ted']); s.assign(a.id, ''); eq(s.get(a.id).assignee, ''); });
t('salesperson list with proto names', () => { const s = mk(), l = s.submit(g()).lead; ['__proto__', 'constructor', 'toString', 'constructor'].forEach(n => s.assign(l.id, n)); eq(s.salespeople(), ['__proto__', 'constructor', 'toString']); eq({}.constructor, Object); });
// 4 follow-up / overdue
t('follow-up date + overdue only for new/contacted', () => { now = T0; const s = mk(), l = s.submit(g()).lead; ok(s.setFollowUp(l.id, '2026-10-31').ok); eq(s.isOverdue(s.get(l.id)), false);
  now = T0 + 3 * D; ok(s.isOverdue(s.get(l.id))); eq(s.overdueCount(), 1); s.setStatus(l.id, 'contacted'); ok(s.isOverdue(s.get(l.id))); s.setStatus(l.id, 'qualified'); eq(s.isOverdue(s.get(l.id)), false); eq(s.overdueCount(), 0);
  eq(s.setFollowUp(l.id, '2026-02-30').errors, ['date']); eq(s.setFollowUp(l.id, 'soon').errors, ['date']); ok(s.setFollowUp(l.id, null).ok); eq(s.get(l.id).followUpAt, null); });
// 5 search + filters
t('search by name, phone, email, VIN; status + source filters', () => { now = T0; const s = mk(); const a = s.submit(g()).lead; now++; const b = s.submit(g({ name: 'Bob Ray', phone: '', email: 'bob@ray.io', vin: '2T1BURHE0JC012345' }), { channel: 'walk_in' }).lead; now++; const c = s.submit(g({ name: 'Cy', phone: '(248) 555-0199' }), { channel: 'web' }).lead;
  eq(s.search({ text: 'ana' }).map(x => x.id), [a.id]); eq(s.search({ text: '555-0199' }).map(x => x.id), [c.id]); eq(s.search({ text: '2485550199' }).map(x => x.id), [c.id]); eq(s.search({ text: 'BOB@RAY' }).map(x => x.id), [b.id]); eq(s.search({ text: '2t1burhe0jc' }).map(x => x.id), [b.id]);
  eq(s.search({ channel: 'qr' }).map(x => x.id), [a.id]); eq(s.search({ channel: 'walk_in' }).map(x => x.id), [b.id]); eq(s.search({ channel: 'web' }).map(x => x.id), [c.id]); s.setStatus(c.id, 'lost'); eq(s.search({ status: 'lost' }).map(x => x.id), [c.id]); eq(s.search({}).length, 3); eq(s.search({ text: 'zzz' }), []);
  eq(s.search({ channel: 'constructor' }), []); eq(s.search({ status: '__proto__' }), []); });
// 6 ago
t('waiting time labels', () => { eq(L.ago(T0, T0 + 20000), 'just now'); eq(L.ago(T0, T0 + 5 * 60000), '5m ago'); eq(L.ago(T0, T0 + 2 * H), '2h ago'); eq(L.ago(T0, T0 + 3 * D), '3d ago'); eq(L.ago(T0, T0 + 90 * D), '3mo ago'); eq(L.ago(T0 + H, T0), 'just now'); });
// 7 CSV export filtered
t('CSV export of filtered list keeps guards', () => { now = T0; const s = mk(); s.submit(g({ name: '=HYPERLINK("x")', phone: '+15551234567' })); s.submit(g({ name: 'Zed', phone: '3135550102' }), { channel: 'walk_in' });
  const l = s.search({ channel: 'qr' }); s.addNote(l[0].id, '@cmd'); const csv = s.exportCSV(s.search({ channel: 'qr' })); eq(csv.split('\n').length, 2); ok(csv.includes('"+15551234567"')); ok(csv.includes('"\'=HYPERLINK(""x"")"')); ok(!csv.includes('Zed'));
  ok(csv.split('\n')[0].includes('assignee,followUpAt')); eq(s.exportCSV().split('\n').length, 3); });
// migration
t('old v1 leads migrate (timeline, staffNote -> note, channel)', () => { const st = S.memoryStorage(); st.setItem(L.KEY, JSON.stringify([{ id: 'Lold1', status: 'contacted', createdAt: T0 - D, updatedAt: T0 - H, vin: V, name: 'Old', phone: '3135550100', email: '', interest: 'price', source: 'website', via: 'qr', notes: 'hi', staffNote: 'called once' }, { id: 'Lold2', status: 'new', createdAt: T0, vin: V, name: 'Walk', source: 'walk_in' }]));
  const s = mk(st), a = s.get('Lold1'); eq(a.history.map(h => h.to), ['new', 'contacted']); eq(a.notesLog.map(n => n.text), ['called once']); eq(a.channel, 'qr'); eq(a.assignee, ''); eq(a.followUpAt, null); eq(a.staffNote, 'called once'); eq(s.get('Lold2').channel, 'walk_in');
  s.addNote('Lold1', 'new note'); const again = mk(st).get('Lold1'); eq(again.notesLog.length, 2); eq(again.history.length, 2); });
t('migration cleans hostile saved data', () => { const st = S.memoryStorage(); st.setItem(L.KEY, JSON.stringify([{ id: 'L1', status: 'new', createdAt: 1, name: '<script>x</script>', history: [{ to: '__proto__', at: 1 }, { to: 'new', at: 'x' }, { to: 'won', at: 5, by: '<b>' }], notesLog: [{ text: '<i>n</i>', at: 2 }, null, { text: 5 }], followUpAt: 'garbage', assignee: { a: 1 }, channel: 'constructor' }]));
  const l = mk(st).get('L1'); ok(!/[<>]/.test(l.name)); eq(l.history.map(h => h.to), ['won']); eq(l.history[0].by, 'b'); eq(l.notesLog.map(n => n.text), ['i n /i'.replace(/ \/i$/, ' /i')]); eq(l.followUpAt, null); eq(l.channel, 'web'); eq(typeof l.assignee, 'string'); });
t('no plain {} maps in leads.js', () => { const src = fs.readFileSync(path.join(__dirname, '../modules/leads.js'), 'utf8'); ok(!/(seen|map|byId|index)\s*=\s*\{\s*\}/.test(src)); ok(src.includes('Object.create(null)')); });
// DOM
let JSDOM = null; for (const p of ['/workspace/ddtools/node_modules/jsdom', '/tmp/devmods/node_modules/jsdom', 'jsdom']) { try { JSDOM = require(p).JSDOM; break; } catch (e) {} }
async function dom() { if (!JSDOM) { console.log('  (jsdom not found, DOM tests skipped)'); return; }
  const dir = path.join(__dirname, '..'), cars = genCars(30); cars[0].vin = V; cars[0].model = 'Camry'; cars[0].price = 24990;
  const seed = [{ id: 'Lx1', status: 'new', createdAt: Date.now() - 2 * H, updatedAt: Date.now() - 2 * H, vin: V, name: '<img src=x onerror=alert(1)>Eve', phone: '3135550100', email: 'e@x.io', interest: 'test_drive', source: 'website', via: 'qr', notes: '<script>alert(1)</script>Need it Sat', staffNote: '', followUpAt: Date.now() - D },
    { id: '__proto__', status: 'contacted', createdAt: Date.now() - 3 * D, vin: '2T1BURHE0JC012345', name: 'constructor', phone: '', email: 'c@x.io', interest: 'price', source: 'walk_in' }];
  const inject = '<script>localStorage.setItem("dealerdesk.leads.v1", ' + JSON.stringify(JSON.stringify(seed)).replace(/</g, '\\u003c') + ');<\/script>';
  const html = fs.readFileSync(path.join(dir, 'staff-inventory.html'), 'utf8').replace('<script src="modules/store.js">', inject + '<script src="modules/store.js">').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(dir, s), 'utf8') + '<\/script>');
  let downloaded = null;
  const w = new JSDOM(html, { url: 'https://x.io/dd/staff-inventory.html', runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(win) { win.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ cars }) }); win.URL.createObjectURL = b => { downloaded = b; return 'blob:x'; }; win.URL.revokeObjectURL = () => {}; win.alert = () => {}; win.innerWidth = 390; } }).window;
  await new Promise(r => setTimeout(r, 120)); const d = w.document;
  d.getElementById('tab-leads').click();
  t('DOM: cards, ago, overdue badge, source, XSS-safe', () => { const cards = d.querySelectorAll('#lrows .lcard'); eq(cards.length, 2); ok(cards[0].textContent.includes('2h ago')); ok(cards[0].querySelector('.od')); ok(cards[1].textContent.includes('3d ago') && cards[1].textContent.includes('Walk-in'));
    ok(!d.querySelector('img[src=x]') && !d.querySelector('#lrows script')); ok(cards[0].textContent.includes('img src=x onerror')); });
  t('DOM: search + filters', () => { const q = d.getElementById('l-q'); q.value = 'c@x.io'; q.dispatchEvent(new w.Event('input')); eq(d.querySelectorAll('#lrows .lcard').length, 1); q.value = ''; q.dispatchEvent(new w.Event('input'));
    const src = d.getElementById('l-source'); src.value = 'walk_in'; src.dispatchEvent(new w.Event('change')); eq(d.querySelectorAll('#lrows .lcard').length, 1); src.value = ''; src.dispatchEvent(new w.Event('change'));
    const od = d.getElementById('l-overdue'); od.checked = true; od.dispatchEvent(new w.Event('change')); eq(d.querySelectorAll('#lrows .lcard').length, 1); od.checked = false; od.dispatchEvent(new w.Event('change')); eq(d.getElementById('l-count').textContent, '2 leads'); });
  t('DOM: drawer shows message, car photo+price, contact', () => { d.querySelector('#lrows .lcard').click(); ok(d.getElementById('ldrawer').hasAttribute('open')); ok(d.getElementById('ld-msg').textContent.includes('Need it Sat')); ok(!d.querySelector('#ldrawer script'));
    ok(d.getElementById('ld-car').textContent.includes('$24,990')); ok(d.querySelector('#ld-car img')); ok(d.querySelector('#ld-contact a[href="tel:3135550100"]')); ok(d.getElementById('ld-overdue').textContent.includes('Overdue')); });
  t('DOM: assign, note, status -> timeline', () => { const a = d.getElementById('ld-assign'); a.value = 'Maria'; a.dispatchEvent(new w.Event('change')); const n = d.getElementById('ld-note'); n.value = '<b>called</b> back'; d.getElementById('ld-addnote').click();
    ok(d.getElementById('ld-notes').textContent.includes('Staff: b called /b back')); ok(!d.querySelector('#ld-notes b')); ok(d.querySelector('#ld-notes time[datetime]'));
    const st = d.getElementById('ld-status'); st.value = 'qualified'; st.dispatchEvent(new w.Event('change')); ok(d.getElementById('ld-time').textContent.includes('new \u2192 qualified (Staff)')); eq(d.getElementById('ld-overdue').textContent, ''); eq(d.querySelectorAll('#ld-staff option').length, 1);
    const f = d.getElementById('ld-follow'); f.value = '2030-01-02'; f.dispatchEvent(new w.Event('change')); d.getElementById('ld-close').click(); ok(!d.getElementById('ldrawer').hasAttribute('open')); ok(d.querySelector('#lrows .lcard').textContent.includes('Maria')); });
  t('DOM: proto-id lead opens', () => { d.querySelectorAll('#lrows .lcard')[1].click(); eq(d.getElementById('ld-name').textContent, 'constructor'); d.getElementById('ld-close').click(); });
  const src = d.getElementById('l-source'); src.value = 'walk_in'; src.dispatchEvent(new w.Event('change')); d.getElementById('csv').click(); const text = downloaded && await downloaded.text();
  t('DOM: CSV = filtered rows only', () => { ok(text); eq(text.split('\n').length, 2); ok(text.includes('constructor')); ok(!text.includes('Eve')); });
  t('CSS: 44px controls, 390px layout', () => { const h = fs.readFileSync(path.join(dir, 'staff-inventory.html'), 'utf8'); ok(/button,select,input,textarea\{[^}]*min-height:44px/.test(h)); ok(/\.lcard\{[^}]*min-height:64px/.test(h)); ok(/#ld-close\{width:44px/.test(h)); ok(/\.ld-contact a\{[^}]*min-height:44px/.test(h)); ok(/\.chk\{[^}]*min-height:44px/.test(h)); ok(/@media \(max-width:420px\)\{\.bar>\*\{flex:1 1 100%\}/.test(h)); ok(/dialog\.drawer\{[^}]*width:min\(480px,100vw\)/.test(h)); });
}
dom().then(() => done('leads pro'), e => { console.log('FAIL dom', e); process.exit(1); });
