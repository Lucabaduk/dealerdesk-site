// DealerDesk sales dashboard data. Plain JS, no dependencies, pure functions (no DOM, no storage writes).
// Node: require('./dashboard.js')   Browser: window.DealerDeskDashboard
// Every function takes plain data plus `now` (Date, ms or ISO string; default = current time) and never throws
// on missing/empty/odd input. Money is in cents. "Today/week/month" use the local time zone; weeks start Monday.
(function (root) {
  'use strict';
  var DAY = 86400000;
  var arr = function (v) { return Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object'; }) : []; };
  var cents = function (v) { var n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; };
  var inc = function (o, k) { k = k == null || k === '' ? 'unknown' : String(k); if (!Object.prototype.hasOwnProperty.call(o, k) && k in o) k = 'unknown:' + k; o[k] = (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : 0) + 1; };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  function toDate(v) {
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v === 'number' && Number.isFinite(v)) return new Date(v);
    if (typeof v === 'string' && v.trim()) {
      var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(v.trim()); // local date or local date-time
      if (m) return new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
      var d = new Date(v); return isNaN(d) ? null : d;
    }
    return null;
  }
  function nowDate(now) { return toDate(now == null ? Date.now() : now) || new Date(); }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function startOfWeek(d) { var s = startOfDay(d); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return s; }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

  // When a record was created: createdAt / created_at / listed_at / added_at, else the app's uid() timestamp ("ld-<base36 ms><4 random>").
  function createdTime(r) {
    var v = r.createdAt != null ? r.createdAt : r.created_at != null ? r.created_at : r.listed_at != null ? r.listed_at : r.added_at;
    var d = toDate(v); if (d) return d.getTime();
    var m = /^[a-z]+-([0-9a-z]{7,9})[0-9a-z]{4}$/.exec(String(r.id || ''));
    if (m) { var t = parseInt(m[1], 36); if (t > 1.5e12 && t < 4e12) return t; }
    return null;
  }
  // Appointment time: schema `at` ("YYYY-MM-DDTHH:MM") or booking module `date` + `time`.
  function apptTime(b) { return toDate(b.at || (b.date ? b.date + (b.time ? 'T' + b.time : '') : null)); }
  function customerName(b) { var c = b.customer; return (c && typeof c === 'object' ? c.name : c) || b.name || ''; }

  // Status normalisation across the app (schema names) and the booking module.
  var TD_MAP = { booked: 'requested', 'no-show': 'no_show' };
  var SV_MAP = { scheduled: 'booked', 'checked-in': 'in_progress', 'in-progress': 'in_progress', ready: 'in_progress', 'picked-up': 'done' };
  var tdStatus = function (s) { s = String(s || 'requested').toLowerCase(); return TD_MAP[s] || s; };
  var svStatus = function (s) { s = String(s || 'booked').toLowerCase(); return SV_MAP[s] || s; };

  function pick(data, a, b) { data = data && typeof data === 'object' ? data : {}; return arr(data[a] != null ? data[a] : data[b]); }

  function inventoryStats(cars, now) {
    var n = nowDate(now).getTime(), list = arr(cars);
    var out = { total: list.length, available: 0, hold: 0, sold: 0, by_body_type: {}, by_fuel: {}, by_make: {}, avg_price_cents: 0, avg_age_days: null, stock_value_cents: 0 };
    var priceSum = 0, priceN = 0, ageSum = 0, ageN = 0;
    list.forEach(function (c) {
      var st = String(c.status || 'available').toLowerCase(); if (st === 'pending') st = 'hold';
      if (st === 'available' || st === 'hold' || st === 'sold') out[st]++;
      inc(out.by_body_type, c.body_type); inc(out.by_fuel, c.fuel_type || c.fuel); inc(out.by_make, c.make);
      var p = cents(c.price_cents != null ? c.price_cents : Number(c.price) * 100);
      if (st !== 'sold') { if (p) { priceSum += p; priceN++; } out.stock_value_cents += p; }
      var t = createdTime(c); if (t != null && t <= n && st !== 'sold') { ageSum += (n - t) / DAY; ageN++; }
    });
    out.avg_price_cents = priceN ? Math.round(priceSum / priceN) : 0; // unsold cars only
    out.avg_age_days = ageN ? Math.round(ageSum / ageN * 10) / 10 : null; // null when no car has a listed/created time
    return out;
  }

  function leadStats(leads, now) {
    var d = nowDate(now), day0 = startOfDay(d).getTime(), wk0 = startOfWeek(d).getTime(), list = arr(leads);
    var out = { total: list.length, by_status: { new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 }, by_source: {}, new_today: 0, new_this_week: 0, conversion_rate: 0, win_rate: 0 };
    list.forEach(function (l) {
      inc(out.by_status, String(l.status || 'new').toLowerCase()); inc(out.by_source, l.source || (l.interest ? 'website' : null));
      var t = createdTime(l); if (t != null) { if (t >= day0) out.new_today++; if (t >= wk0) out.new_this_week++; }
    });
    var won = out.by_status.won, lost = out.by_status.lost;
    out.conversion_rate = list.length ? Math.round(won / list.length * 1000) / 1000 : 0; // won / all leads
    out.win_rate = won + lost ? Math.round(won / (won + lost) * 1000) / 1000 : 0;      // won / closed (won+lost)
    return out;
  }

  function bookingStats(list, now, normStatus, inactive) {
    var d = nowDate(now), today = dayKey(d), out = { total: 0, today: [], upcoming: [], by_status: {} };
    arr(list).forEach(function (b) {
      var s = normStatus(b.status); out.total++; inc(out.by_status, s);
      var t = apptTime(b); if (!t || inactive[s]) return;
      var item = { id: b.id, at: t.getTime(), when: dayKey(t) + 'T' + pad(t.getHours()) + ':' + pad(t.getMinutes()), customer: customerName(b), status: s, car_id: b.car_id || b.vin || b.stock || null, service_type: b.service_type || b.type || undefined };
      if (dayKey(t) === today) out.today.push(item); else if (t > d) out.upcoming.push(item);
    });
    var by = function (a, b) { return a.at - b.at; }; out.today.sort(by); out.upcoming.sort(by);
    return out;
  }
  var testDriveStats = function (list, now) { return bookingStats(list, now, tdStatus, { cancelled: 1, completed: 1, no_show: 1 }); };
  var serviceStats = function (list, now) { return bookingStats(list, now, svStatus, { cancelled: 1, done: 1 }); };

  // Deals (app: pending/closed/lost) and orders (any status string) as one pipeline.
  function dealAmount(x) { return cents(x.price_cents != null ? x.price_cents : x.total_cents != null ? x.total_cents : Number(x.price != null ? x.price : x.total) * 100); }
  function pipeline(deals, orders) {
    var out = { stages: {}, open_count: 0, open_value_cents: 0 };
    var add = function (x, kind) {
      var s = String(x.status || x.stage || 'pending').toLowerCase(), a = dealAmount(x);
      var g = out.stages[s] || (out.stages[s] = { count: 0, value_cents: 0, deals: 0, orders: 0 });
      g.count++; g.value_cents += a; g[kind]++;
      if (!/^(closed|won|sold|delivered|completed|lost|cancelled|canceled)$/.test(s)) { out.open_count++; out.open_value_cents += a; }
    };
    arr(deals).forEach(function (x) { add(x, 'deals'); }); arr(orders).forEach(function (x) { add(x, 'orders'); });
    return out;
  }

  function salesTotals(deals, orders, now) {
    var d = nowDate(now), wk0 = startOfWeek(d).getTime(), mo0 = startOfMonth(d).getTime(), end = d.getTime();
    var out = { week_cents: 0, week_count: 0, month_cents: 0, month_count: 0 };
    arr(deals).concat(arr(orders)).forEach(function (x) {
      if (!/^(closed|won|sold|delivered|completed)$/.test(String(x.status || '').toLowerCase())) return;
      var t = toDate(x.closed_at || x.closedAt || x.date || x.created_at || x.createdAt); if (!t) return; t = t.getTime();
      if (t > end) return; // ignore future-dated
      var a = dealAmount(x);
      if (t >= wk0) { out.week_cents += a; out.week_count++; }
      if (t >= mo0) { out.month_cents += a; out.month_count++; }
    });
    return out;
  }

  function needsAttention(data, now) {
    var d = nowDate(now), n = d.getTime(), today = dayKey(d), out = [];
    pick(data, 'leads').forEach(function (l) {
      if (String(l.status || 'new').toLowerCase() !== 'new' || l.contacted_at || l.contactedAt) return;
      var t = createdTime(l); if (t == null || n - t <= DAY) return;
      out.push({ type: 'lead_uncontacted', id: l.id, name: l.name || '', hours_waiting: Math.floor((n - t) / 3600000), message: (l.name || 'A lead') + ' has waited over 24 hours with no contact.' });
    });
    pick(data, 'test_drives', 'testDrives').forEach(function (b) {
      var t = apptTime(b); if (!t || dayKey(t) !== today || tdStatus(b.status) !== 'requested') return;
      out.push({ type: 'test_drive_unconfirmed', id: b.id, name: customerName(b), at: t.getTime(), message: 'Test drive today at ' + pad(t.getHours()) + ':' + pad(t.getMinutes()) + ' for ' + (customerName(b) || 'a customer') + ' is not confirmed.' });
    });
    return out.sort(function (a, b) { return (b.hours_waiting || 0) - (a.hours_waiting || 0) || (a.at || 0) - (b.at || 0); });
  }

  function summary(data, now) {
    var d = nowDate(now);
    var deals = pick(data, 'deals'), orders = pick(data, 'orders');
    return {
      generated_at: d.toISOString(),
      inventory: inventoryStats(pick(data, 'cars'), d),
      leads: leadStats(pick(data, 'leads'), d),
      test_drives: testDriveStats(pick(data, 'test_drives', 'testDrives'), d),
      service: serviceStats(pick(data, 'service_bookings', 'serviceBookings'), d),
      pipeline: pipeline(deals, orders),
      sales: salesTotals(deals, orders, d),
      needs_attention: needsAttention(data, d),
    };
  }

  // Convenience: build `data` from the live app's localStorage (read-only). getItem = key => string|null.
  // baseCars = cars.json `cars`. Keys: 'dealerdesk.v2' (app state), 'dealerdesk.leads.v1' (web leads), 'dealerdesk_booking' (booking module).
  function fromStorage(getItem, baseCars) {
    var read = function (k) { try { var v = getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
    var st = read('dealerdesk.v2') || {}, web = read('dealerdesk.leads.v1'), bk = read('dealerdesk_booking') || {};
    var removed = {};
    (Array.isArray(st.cars_removed) ? st.cars_removed : []).forEach(function (id) { removed[id] = 1; });
    var ov = st.car_overrides && typeof st.car_overrides === 'object' ? st.car_overrides : {};
    var seen = {}, all = arr(baseCars).concat(arr(st.cars_added));
    var cars = all.reverse().filter(function (c) { if (c.id == null) return true; var k = String(c.id); if (seen[k]) return false; seen[k] = 1; return true; }).reverse()
      .filter(function (c) { return !removed[c.id]; })
      .map(function (c) { return ov[c.id] ? Object.assign({}, c, ov[c.id]) : c; });
    return {
      cars: cars,
      leads: arr(st.leads).concat(arr(web)),
      test_drives: arr(st.test_drives).concat(arr(bk.testDrives)),
      service_bookings: arr(st.service_bookings).concat(arr(bk.serviceBookings || bk.services)),
      deals: arr(st.deals),
      orders: arr(st.orders),
    };
  }

  var api = { summary: summary, inventoryStats: inventoryStats, leadStats: leadStats, testDriveStats: testDriveStats, serviceStats: serviceStats,
    pipeline: pipeline, salesTotals: salesTotals, needsAttention: needsAttention, fromStorage: fromStorage, _createdTime: createdTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DealerDeskDashboard = api;
})(typeof self !== 'undefined' ? self : this);
