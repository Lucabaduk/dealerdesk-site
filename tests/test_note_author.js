// Notes + timeline are credited to the staff member using the device ("You are:"), not the lead's salesperson.
const { t, eq, ok, done, genCars } = require('./_h.js');
const fs = require('fs'), path = require('path'), S = require('../modules/store.js');
t('DDStore staff name: set/get/clean/clear', () => { const m = S.memoryStorage(); eq(S.getStaffName(m), ''); eq(S.setStaffName('  Dana <b>Reyes</b> ', m), 'Dana b Reyes /b'); eq(S.getStaffName(m), 'Dana b Reyes /b'); S.setStaffName('', m); eq(S.getStaffName(m), ''); });
t('appStaffNames from app state, proto-safe + deduped', () => { const m = S.memoryStorage(); m.setItem('dealerdesk.v2', JSON.stringify({ staff: [{ name: 'Dana Reyes' }, { name: 'dana reyes' }, { name: '__proto__' }, { name: 'constructor' }, { name: '<img src=x>' }, null, { name: 5 }] }));
  eq(S.appStaffNames(m), ['Dana Reyes', '__proto__', 'constructor', 'img src=x', '5']); m.setItem('dealerdesk.v2', '{bad'); eq(S.appStaffNames(m), []); eq({}.constructor, Object); });
const JSDOM = (() => { for (const p of ['/workspace/ddtools/node_modules/jsdom', 'jsdom']) { try { return require(p).JSDOM; } catch (e) {} } return null; })();
const dir = path.join(__dirname, '..'), cars = genCars(3);
function boot(pre) { const seed = [{ id: 'Lg1', status: 'new', createdAt: Date.now() - 3600000, vin: cars[0].vin, name: 'Ana', phone: '3135550100', interest: 'price', source: 'website', via: 'qr', assignee: 'Ted Sales',
    notesLog: [{ id: 'n0', text: 'old note', at: Date.now() - 7200000, by: 'Ted Sales' }], history: [{ to: 'new', at: Date.now() - 3600000 }, { from: 'new', to: 'contacted', at: Date.now() - 3000000, by: 'Ted Sales' }], status2: 0 }];
  seed[0].status = 'contacted';
  const sets = Object.assign({ 'dealerdesk.leads.v1': JSON.stringify(seed), 'dealerdesk.v2': JSON.stringify({ staff: [{ name: 'Dana Reyes' }, { name: 'Marcus Lee' }] }) }, pre || {});
  const inject = '<script>' + Object.keys(sets).map(k => 'localStorage.setItem(' + JSON.stringify(k) + ',' + JSON.stringify(sets[k]).replace(/</g, '\\u003c') + ');').join('') + '<\/script>';
  const html = fs.readFileSync(path.join(dir, 'staff-inventory.html'), 'utf8').replace('<script src="modules/store.js">', inject + '<script src="modules/store.js">').replace(/<script src="([^"]+)"><\/script>/g, (m, s) => '<script>' + fs.readFileSync(path.join(dir, s), 'utf8') + '<\/script>');
  const w = new JSDOM(html, { url: 'https://x.io/dd/staff-inventory.html?lead=Lg1', runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(win) { win.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ cars }) }); win.alert = () => {}; } }).window;
  return new Promise(r => setTimeout(() => r(w), 120)); }
const note = (w, txt) => { const d = w.document; d.getElementById('ld-note').value = txt; d.getElementById('ld-addnote').click(); };
const status = (w, s) => { const el = w.document.getElementById('ld-status'); el.value = s; el.dispatchEvent(new w.Event('change')); };
async function dom() { if (!JSDOM) { console.log('  (jsdom not found, DOM tests skipped)'); return; }
  let w = await boot(), d = w.document;
  t('no name yet: hint shown, app staff offered, fallback "Staff"', () => { ok(d.getElementById('l-me-hint').textContent.includes('Enter your name')); eq([...d.querySelectorAll('#l-me-list option')].map(o => o.value).slice(0, 2), ['Dana Reyes', 'Marcus Lee']);
    note(w, 'first'); ok(d.getElementById('ld-notes').textContent.includes('Staff: first')); ok(!d.getElementById('ld-notes').textContent.includes('Ted Sales: first')); });
  t('"You are" name credited on notes + status, not salesperson', () => { const me = d.getElementById('l-me'); me.value = 'Dana Reyes'; me.dispatchEvent(new w.Event('change')); eq(w.localStorage.getItem('dealerdesk.me.v1'), 'Dana Reyes'); eq(d.getElementById('l-me-hint').textContent, '');
    note(w, 'called her'); status(w, 'qualified'); ok(d.getElementById('ld-notes').textContent.includes('Dana Reyes: called her')); ok(d.getElementById('ld-time').textContent.includes('contacted \u2192 qualified (Dana Reyes)')); eq(d.getElementById('ld-assign').value, 'Ted Sales'); });
  t('old notes/timeline untouched', () => { ok(d.getElementById('ld-notes').textContent.includes('Ted Sales: old note')); ok(d.getElementById('ld-time').textContent.includes('new \u2192 contacted (Ted Sales)')); const l = JSON.parse(w.localStorage.getItem('dealerdesk.leads.v1'))[0]; eq(l.notesLog[0].by, 'Ted Sales'); eq(l.history[1].by, 'Ted Sales'); });
  w = await boot({ 'dealerdesk.me.v1': 'Marcus Lee' }); d = w.document;
  t('remembered across reloads (asked once)', () => { eq(d.getElementById('l-me').value, 'Marcus Lee'); eq(d.getElementById('l-me-hint').textContent, ''); note(w, 'x'); ok(d.getElementById('ld-notes').textContent.includes('Marcus Lee: x')); });
  w = await boot({ 'dealerdesk.me.v1': '<img src=x onerror=alert(1)>Eve' }); d = w.document;
  t('escaped staff name', () => { note(w, '<script>alert(1)</script>hi'); status(w, 'won'); ok(!d.querySelector('#ldrawer img[src=x], #ldrawer script')); ok(d.getElementById('ld-notes').textContent.includes('img src=x onerror=alert(1) Eve: script alert(1) /script hi') || d.getElementById('ld-notes').textContent.includes(': script alert(1) /script hi')); ok(!/[<>]/.test(d.getElementById('l-me').value)); });
  for (const pn of ['__proto__', 'constructor', 'toString']) { w = await boot({ 'dealerdesk.me.v1': pn, 'dealerdesk.v2': JSON.stringify({ staff: [{ name: pn }, { name: 'hasOwnProperty' }] }) }); d = w.document;
    t('proto-ish staff name works: ' + pn, () => { note(w, 'ok'); status(w, 'lost'); ok(d.getElementById('ld-notes').textContent.includes(pn + ': ok')); ok(d.getElementById('ld-time').textContent.includes('(' + pn + ')')); eq(d.querySelectorAll('#l-me-list option').length >= 2, true); eq(w.Object.prototype.polluted, undefined); }); }
}
dom().then(() => done('note author'), e => { console.log('FAIL dom', e); process.exit(1); });
