// Coder's rule (848233d): lists over 1,000 cars are never saved to localStorage, and any old big copy is removed.
const { t, eq, ok, done, genCars } = require('./_h.js');
const S = require('../modules/store.js'), I = require('../modules/inventory.js');
function spy() { const m = S.memoryStorage(), log = []; return { log, getItem: k => m.getItem(k), setItem: (k, v) => { log.push(['set', k, v.length]); m.setItem(k, v); }, removeItem: k => { log.push(['remove', k]); m.removeItem(k); } }; }
t('1,000 cars are saved', () => { const st = spy(), r = I.create({ storage: st }).load(genCars(1000)); eq(r.saved, true); eq(JSON.parse(st.getItem(I.KEY)).length, 1000); eq(I.create({ storage: st }).size(), 1000); });
t('1,001 cars are never saved, old copy removed', () => { const st = spy(); st.setItem(I.KEY, JSON.stringify(genCars(50))); st.log.length = 0;
  const inv = I.create({ storage: st }); eq(inv.size(), 50); const r = inv.load(genCars(1001)); eq(r.saved, false); eq(r.count, 1001); eq(st.getItem(I.KEY), null); ok(!st.log.some(x => x[0] === 'set')); ok(st.log.some(x => x[0] === 'remove')); eq(inv.query({ pageSize: 1e9 }).total, 1001); });
t('5,000 + edits/import keep it out of storage', () => { const st = spy(), inv = I.create({ storage: st }); inv.load(genCars(5000)); const v = inv.list()[0].vin;
  ok(inv.setStatus(v, 'sold').ok); eq(inv.get(v).status, 'sold'); inv.importJSON(JSON.stringify(genCars(5000).slice(0, 10))); eq(st.getItem(I.KEY), null); ok(!st.log.some(x => x[0] === 'set')); });
t('removing down to 1,000 saves again', () => { const st = spy(), inv = I.create({ storage: st }); inv.load(genCars(1001)); eq(st.getItem(I.KEY), null); inv.remove(inv.list()[0].vin); eq(JSON.parse(st.getItem(I.KEY)).length, 1000); });
t('persist:false never touches storage', () => { const st = spy(); I.create({ storage: st, persist: false }).load(genCars(10)); eq(st.log, []); });
done('persist limit');
