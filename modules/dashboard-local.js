/* DealerDesk dashboard summary - local stand-in for Grok Master Helper's dashboard.js (same shape; swapped out automatically when
   Helper's window.DealerDeskDashboard / window.DDDashboard is loaded). Pure functions, no DOM, works in Node.
   summary(data, now) -> { counts, pipeline, sales, attention }
     data: { cars[], deals[], leads[], test_drives[], service_bookings[], staff[] }  (schema.js shapes, prices in cents)
     counts:   { cars, available, hold, sold, stock_value_cents, leads_open, leads_new, bookings_today, bookings_upcoming, deals_pending }
     pipeline: [{ stage, count }]  lead stages in order new, contacted, qualified, won, lost
     sales:    { closed, revenue_cents, avg_cents, pending, by_staff:[{ staff_id, name, deals, revenue_cents }] }
     attention:[{ kind, id, text, severity:'high'|'medium' }]  most urgent first */
(function (root) {
  'use strict';
  var STAGES = ['new', 'contacted', 'qualified', 'won', 'lost'];
  function day(t) { var d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function summary(data, now) {
    data = data || {}; now = now == null ? Date.now() : +now;
    var cars = arr(data.cars), deals = arr(data.deals), leads = arr(data.leads), staff = arr(data.staff);
    var bookings = arr(data.test_drives).map(function (b) { return { k: 'test_drive', b: b }; }).concat(arr(data.service_bookings).map(function (b) { return { k: 'service', b: b }; }));
    var td = day(now), counts = { cars: cars.length, available: 0, hold: 0, sold: 0, stock_value_cents: 0, leads_open: 0, leads_new: 0, bookings_today: 0, bookings_upcoming: 0, deals_pending: 0 };
    cars.forEach(function (c) { if (counts[c.status] != null) counts[c.status]++; if (c.status !== 'sold') counts.stock_value_cents += +c.price_cents || 0; });
    var stage = {}; STAGES.forEach(function (s) { stage[s] = 0; });
    leads.forEach(function (l) { if (stage[l.status] != null) stage[l.status]++; if (l.status !== 'won' && l.status !== 'lost') counts.leads_open++; if (l.status === 'new') counts.leads_new++; });
    var live = bookings.filter(function (x) { return x.b && x.b.at && x.b.status !== 'cancelled' && x.b.status !== 'no_show'; });
    live.forEach(function (x) { var d = String(x.b.at).slice(0, 10); if (d === td) counts.bookings_today++; if (d >= td) counts.bookings_upcoming++; });
    var closed = deals.filter(function (d) { return d.status === 'closed'; }), by = {};
    counts.deals_pending = deals.filter(function (d) { return d.status === 'pending'; }).length;
    closed.forEach(function (d) { var k = d.staff_id || ''; by[k] = by[k] || { deals: 0, revenue_cents: 0 }; by[k].deals++; by[k].revenue_cents += +d.price_cents || 0; });
    var rev = closed.reduce(function (a, d) { return a + (+d.price_cents || 0); }, 0);
    var sales = { closed: closed.length, revenue_cents: rev, avg_cents: closed.length ? Math.round(rev / closed.length) : 0, pending: counts.deals_pending,
      by_staff: staff.map(function (s) { var x = by[s.id] || { deals: 0, revenue_cents: 0 }; return { staff_id: s.id, name: s.name, deals: x.deals, revenue_cents: x.revenue_cents }; })
        .sort(function (a, b) { return b.revenue_cents - a.revenue_cents; }) };
    var att = [];
    leads.forEach(function (l) { if (l.status === 'new') att.push({ kind: 'lead', id: l.id, severity: 'high', text: 'New lead not contacted yet: ' + (l.name || 'Unknown') }); });
    live.forEach(function (x) { var d = String(x.b.at).slice(0, 10), who = (x.b.customer && x.b.customer.name) || 'Customer';
      if (d === td && (x.b.status === 'requested' || x.b.status === 'booked')) att.push({ kind: x.k, id: x.b.id, severity: 'high', text: (x.k === 'service' ? 'Service' : 'Test drive') + ' today not confirmed: ' + who + ' at ' + String(x.b.at).slice(11, 16) });
      else if (d < td && (x.b.status === 'requested' || x.b.status === 'booked' || x.b.status === 'confirmed')) att.push({ kind: x.k, id: x.b.id, severity: 'medium', text: (x.k === 'service' ? 'Service' : 'Test drive') + ' in the past still open: ' + who }); });
    deals.forEach(function (d) { if (d.status === 'pending' && d.date && day(now - 3 * 864e5) > d.date) att.push({ kind: 'deal', id: d.id, severity: 'medium', text: 'Deal pending more than 3 days: ' + (d.buyer || '') }); });
    att.sort(function (a, b) { return (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1); });
    return { counts: counts, pipeline: STAGES.map(function (s) { return { stage: s, count: stage[s] }; }), sales: sales, attention: att.slice(0, 50) };
  }
  var mod = { summary: summary, STAGES: STAGES };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod; else root.DDDashboardLocal = mod;
})(typeof self !== 'undefined' ? self : this);
