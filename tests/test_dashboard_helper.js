// Run: node test_dashboard.js
const assert = require('assert');
const D = require('../modules/dashboard.js');
let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL ' + name); throw e; } };
const NOW = new Date(2026, 9, 30, 10, 0); // Fri Oct 30 2026 10:00 local
const H = 3600000, ms = NOW.getTime();
const data = {
  cars: [
    { id: 'c1', make: 'Toyota', body_type: 'suv', fuel_type: 'hybrid', status: 'available', price_cents: 3000000, createdAt: ms - 10 * 24 * H },
    { id: 'c2', make: 'Toyota', body_type: 'sedan', fuel_type: 'gasoline', status: 'hold', price_cents: 2000000, listed_at: '2026-10-20' },
    { id: 'c3', make: 'Ford', body_type: 'pickup', fuel_type: 'electric', status: 'sold', price_cents: 5000000 },
    { id: 'c4', make: 'Ford', status: 'Pending', price: 10000 },
  ],
  leads: [
    { id: 'l1', name: 'Old New', status: 'new', source: 'website', createdAt: ms - 30 * H },
    { id: 'l2', name: 'Fresh', status: 'new', source: 'phone', createdAt: ms - 1 * H },
    { id: 'l3', name: 'Won', status: 'won', source: 'walk_in', created_at: '2026-10-26T09:00' },
    { id: 'l4', name: 'Lost', status: 'lost', source: 'website' },
    { id: 'ld-' + (ms - 48 * H).toString(36) + 'ab12', name: 'Uid lead', status: 'new' }, // app uid() timestamp, no source
  ],
  test_drives: [
    { id: 't1', customer: { name: 'Ann' }, car_id: 'c1', at: '2026-10-30T15:00', status: 'requested' },
    { id: 't2', customer: { name: 'Bob' }, car_id: 'c1', at: '2026-10-30T11:00', status: 'confirmed' },
    { id: 't3', customer: { name: 'Cy' }, car_id: 'c2', at: '2026-11-02T10:00', status: 'requested' },
    { id: 't4', customer: 'Dee', vin: 'X', date: '2026-10-30', time: '16:30', status: 'booked' }, // booking module shape
    { id: 't5', customer: { name: 'Old' }, at: '2026-10-29T10:00', status: 'completed' },
    { id: 't6', customer: { name: 'Gone' }, at: '2026-10-31T10:00', status: 'cancelled' },
  ],
  service_bookings: [
    { id: 's1', customer: { name: 'Eve' }, service_type: 'tires', at: '2026-10-30T08:00', status: 'booked' },
    { id: 's2', customer: 'Fay', type: 'oil', date: '2026-11-03', time: '09:00', status: 'scheduled' },
    { id: 's3', customer: 'Gus', date: '2026-10-30', status: 'picked-up' },
  ],
  deals: [
    { id: 'd1', car_id: 'c3', price_cents: 5000000, status: 'closed', date: '2026-10-28' }, // this week (Mon 26)
    { id: 'd2', car_id: 'c2', price_cents: 2000000, status: 'pending', date: '2026-10-29' },
    { id: 'd3', price_cents: 1500000, status: 'closed', date: '2026-10-05' },                 // this month only
    { id: 'd4', price_cents: 900000, status: 'closed', date: '2026-09-30' },                  // last month
    { id: 'd5', price_cents: 700000, status: 'lost', date: '2026-10-29' },
  ],
  orders: [{ id: 'o1', total: 250.5, status: 'delivered', createdAt: ms - 2 * H }, { id: 'o2', total_cents: 1000, status: 'processing' }],
};
const s = D.summary(data, NOW);
t('inventory counts', () => { const i = s.inventory; assert.deepStrictEqual([i.total, i.available, i.hold, i.sold], [4, 1, 2, 1]); assert.deepStrictEqual(i.by_make, { Toyota: 2, Ford: 2 }); assert.strictEqual(i.by_fuel.unknown, 1); assert.strictEqual(i.by_body_type.suv, 1); });
t('inventory avg price/age (unsold only)', () => { assert.strictEqual(s.inventory.avg_price_cents, Math.round((3000000 + 2000000 + 1000000) / 3)); assert.strictEqual(s.inventory.stock_value_cents, 6000000); assert.strictEqual(s.inventory.avg_age_days, Math.round(((10) + (10 + 10 / 24)) / 2 * 10) / 10); });
t('leads by status/source', () => { assert.deepStrictEqual(s.leads.by_status, { new: 3, contacted: 0, qualified: 0, won: 1, lost: 1 }); assert.strictEqual(s.leads.by_source.website, 2); assert.strictEqual(s.leads.by_source.unknown, 1); });
t('leads new today/week (incl. uid timestamp)', () => { assert.strictEqual(s.leads.new_today, 1); assert.strictEqual(s.leads.new_this_week, 4); });
t('conversion and win rate', () => { assert.strictEqual(s.leads.conversion_rate, 0.2); assert.strictEqual(s.leads.win_rate, 0.5); });
t('test drives today sorted, upcoming, status', () => { assert.deepStrictEqual(s.test_drives.today.map(x => x.id), ['t2', 't1', 't4']); assert.deepStrictEqual(s.test_drives.upcoming.map(x => x.id), ['t3']); assert.strictEqual(s.test_drives.by_status.requested, 3); assert.strictEqual(s.test_drives.today[2].customer, 'Dee'); });
t('service today/upcoming, done excluded', () => { assert.deepStrictEqual(s.service.today.map(x => x.id), ['s1']); assert.deepStrictEqual(s.service.upcoming.map(x => x.id), ['s2']); assert.strictEqual(s.service.by_status.done, 1); assert.strictEqual(s.service.upcoming[0].service_type, 'oil'); });
t('pipeline stages and totals', () => { const p = s.pipeline.stages; assert.deepStrictEqual(p.closed, { count: 3, value_cents: 7400000, deals: 3, orders: 0 }); assert.strictEqual(p.delivered.value_cents, 25050); assert.strictEqual(s.pipeline.open_count, 2); assert.strictEqual(s.pipeline.open_value_cents, 2001000); });
t('sales week and month', () => { assert.deepStrictEqual(s.sales, { week_cents: 5025050, week_count: 2, month_cents: 6525050, month_count: 3 }); });
t('needs attention', () => { const a = s.needs_attention; assert.deepStrictEqual(a.map(x => x.type + ':' + x.id), ['lead_uncontacted:' + data.leads[4].id, 'lead_uncontacted:l1', 'test_drive_unconfirmed:t1', 'test_drive_unconfirmed:t4']); assert.strictEqual(a[1].hours_waiting, 30); });
t('contacted_at suppresses lead alert', () => assert.strictEqual(D.needsAttention({ leads: [{ id: 'x', status: 'new', createdAt: ms - 50 * H, contacted_at: ms - H }] }, NOW).length, 0));
t('empty / missing / junk data never throws', () => {
  for (const d of [undefined, null, {}, [], 'x', { cars: 'nope', leads: [null, 5, {}], deals: {}, test_drives: [{ at: 'garbage' }] }]) {
    const r = D.summary(d, NOW); assert.strictEqual(typeof r, 'object'); assert.ok(Array.isArray(r.needs_attention));
  }
  const e = D.summary({}, NOW); assert.strictEqual(e.inventory.total, 0); assert.strictEqual(e.inventory.avg_age_days, null); assert.strictEqual(e.leads.conversion_rate, 0); assert.deepStrictEqual(e.sales, { week_cents: 0, week_count: 0, month_cents: 0, month_count: 0 });
});
t('now accepts ms and ISO, defaults to current time', () => { assert.deepStrictEqual(D.summary(data, ms).sales, s.sales); assert.ok(D.summary(data).generated_at); });
t('pure: input not mutated', () => { const copy = JSON.stringify(data); D.summary(data, NOW); assert.strictEqual(JSON.stringify(data), copy); });
t('fromStorage merges app, web leads and booking module', () => {
  const store = { 'dealerdesk.v2': JSON.stringify({ leads: [{ id: 'a', status: 'new' }], deals: [{ id: 'd', status: 'pending', price_cents: 5 }], cars_added: [{ id: 'n1', status: 'available' }], cars_removed: ['b2'], car_overrides: { b1: { status: 'sold' } }, test_drives: [], service_bookings: [] }),
    'dealerdesk.leads.v1': JSON.stringify([{ id: 'w', status: 'new', createdAt: ms }]), 'dealerdesk_booking': JSON.stringify({ testDrives: [{ id: 'bt' }], services: [{ id: 'bs' }] }) };
  const d = D.fromStorage(k => store[k] || null, [{ id: 'b1', status: 'available' }, { id: 'b2' }]);
  assert.deepStrictEqual(d.cars.map(c => c.id + ':' + c.status), ['b1:sold', 'n1:available']); assert.strictEqual(d.leads.length, 2); assert.strictEqual(d.test_drives.length, 1); assert.strictEqual(d.service_bookings.length, 1);
  assert.doesNotThrow(() => D.fromStorage(() => '{bad json', null)); assert.doesNotThrow(() => D.fromStorage(() => { throw new Error('blocked'); }));
});
t('works on the real 5000-car inventory', () => { const r = D.summary({ cars: require('../data/cars.json').cars }, NOW); assert.strictEqual(r.inventory.total, 5000); assert.ok(Object.keys(r.inventory.by_make).length >= 20); assert.ok(r.inventory.avg_price_cents > 0); });
t('odd status never corrupts counters', () => { const r = D.inventoryStats([{ status: 'by_make', make: 'A' }, { status: 'avg_age_days' }, { status: 'total' }]); assert.strictEqual(r.by_make.A, 1); assert.strictEqual(r.avg_age_days, null); assert.strictEqual(r.total, 3); });
t('__proto__/constructor keys counted safely', () => { const r = D.inventoryStats([{ make: '__proto__' }, { make: 'constructor' }, { make: 'constructor' }]); assert.strictEqual(Object.getPrototypeOf(r.by_make), Object.prototype); assert.strictEqual(Object.values(r.by_make).reduce((a, b) => a + b, 0), 3); });
t('sales closed tomorrow not counted', () => { const r = D.salesTotals([{ status: 'closed', price_cents: 100, closed_at: '2026-10-31T09:00' }], [], NOW); assert.strictEqual(r.week_count, 0); });
t('fromStorage dedupes car ids (added wins)', () => { const c = D.fromStorage(k => k === 'dealerdesk.v2' ? JSON.stringify({ cars_added: [{ id: 'a', price_cents: 2 }] }) : null, [{ id: 'a', price_cents: 1 }, { id: 'b' }]).cars; assert.strictEqual(c.length, 2); assert.strictEqual(c.find(x => x.id === 'a').price_cents, 2); });
t('25k cars fast', () => { const big = Array.from({ length: 25000 }, (_, i) => ({ id: 'c' + i, price_cents: 1e6 })); const s = Date.now(); assert.strictEqual(D.inventoryStats(big, NOW).stock_value_cents, 25000e6); assert(Date.now() - s < 2000); });
console.log('dashboard tests passed: ' + n);
