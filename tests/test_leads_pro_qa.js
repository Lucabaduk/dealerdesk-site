const { t, eq, ok, done } = require('./_h.js');
const fs = require('fs'), path = require('path');
const L = require('../modules/leads.js');
function mem(o) { const m = Object.assign({}, o); return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; }
const good = { id: 'g', status: 'new', name: 'Good Lead', createdAt: 1.7e12 };
t('one malformed lead no longer wipes every saved lead', () => { const st = mem({ [L.KEY]: JSON.stringify([good, { id: 'c', status: 'new', name: { toString: 1 } }]) });
  const s = L.create({ storage: st }); eq(s.list().length, 1); eq(s.list()[0].name, 'Good Lead'); });
t('out-of-range timestamps are dropped, CSV and dates do not throw', () => { const bad = { id: 'a', status: 'new', name: 'X', createdAt: 1e20, updatedAt: -5, history: [{ to: 'new', at: 1e20 }, { to: 'new', at: 0 }], followUpAt: 1e20, notesLog: [{ text: 'hi', at: 1e20 }] };
  const s = L.create({ storage: mem({ [L.KEY]: JSON.stringify([good, bad]) }) }); const a = s.get('a');
  eq(a.createdAt, 0); eq(a.followUpAt, null); eq(a.history.length, 1); ok(isFinite(new Date(a.notesLog[0].at).getTime())); ok(s.exportCSV().split('\n').length === 3); });
t('parseDate rejects years before 1000 (0001 became 1901)', () => { eq(L.parseDate('0001-01-01'), null); ok(L.parseDate('2026-10-30') > 0); eq(L.parseDate(1e20), null); });
t('drawer: Esc/Back handled, list paged', () => { const s = fs.readFileSync(path.join(__dirname, '..', 'modules/staff-inventory.js'), 'utf8');
  ok(s.includes("$('ldrawer').addEventListener('close'")); ok(s.includes("addEventListener('popstate'")); ok(/LEAD_PAGE = 200/.test(s)); });
done('leads pro QA');
