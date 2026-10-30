/* DealerDesk - per-customer service history (Coder 2).
 * Groups service jobs, test drives, bookings, orders, deals and leads by customer.
 * Sources: localStorage "dealerdesk.v2" (staff app state, passed in), "dealerdesk_booking", "dealerdesk_orders".
 * Match key: phone digits (last 10) > email (lowercased) > name (lowercased, spaces collapsed). Read-only. */
(function (root) {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function str(v, n) { return (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, n || 200) : ''; }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : null; }
  function arr(v) { return Array.isArray(v) ? v.filter(function (x) { return obj(x); }) : []; }
  function digits(p) { var d = str(p, 40).replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
  function nEmail(e) { e = str(e, 120).trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : ''; }
  function nName(n) { return str(n, 80).trim().toLowerCase().replace(/\s+/g, ' '); }
  function parse(get, k) { try { var r = get(k); if (!r) return null; var p = JSON.parse(r); return obj(p); } catch (e) { return null; } }
  function toTime(d) { if (typeof d === 'number' && isFinite(d)) return d; var s = str(d, 40); if (!s) return NaN; var t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00' : s); return t; }
  function cents(v) { v = +v; return isFinite(v) && v >= 0 ? Math.round(v) : null; }
  function lab(s) { return str(s, 40).replace(/[_-]/g, ' ').replace(/^./, function (x) { return x.toUpperCase(); }); }

  function collect(o) {
    o = o || {}; var get = o.getItem || function () { return null; }, app = obj(o.state) || {}, carList = Array.isArray(o.cars) ? o.cars : [];
    var byId = Object.create(null), byStock = Object.create(null);
    carList.forEach(function (c) { if (obj(c)) { if (c.id) byId[c.id] = c; if (c.stock_no) byStock[String(c.stock_no).toUpperCase()] = c; } });
    function carOf(id, stock, fallback) { var c = (id && byId[id]) || (stock && byStock[String(stock).toUpperCase()]); var v = obj(fallback) || {};
      return { stock: str(c ? c.stock_no : stock, 20), model: str(c ? [c.year, c.make, c.model].join(' ') : (typeof fallback === 'string' ? fallback : [v.year, v.make, v.model].filter(Boolean).join(' ')), 80) }; }
    var ev = [];
    function add(p, e) { p = p || {}; var who = { name: str(p.name, 80).trim(), phone: str(p.phone, 30), email: nEmail(p.email) };
      if (!who.name && !digits(who.phone) && !who.email) return; e.who = who; e.t = toTime(e.date); ev.push(e); }
    arr(app.service_bookings).forEach(function (s) { var c = obj(s.customer) || {}, car = carOf(s.car_id, s.stock_no || (obj(s.vehicle) || {}).stock_no, s.vehicle);
      add(c, { kind: 'Service', date: s.at, stock: car.stock, model: car.model, work: lab(s.service_type) + (s.notes ? ' - ' + str(s.notes, 200) : ''), cost: cents(s.cost_cents != null ? s.cost_cents : s.price_cents), status: lab(s.status) }); });
    arr(app.test_drives).forEach(function (s) { var c = obj(s.customer) || {}, car = carOf(s.car_id);
      add(c, { kind: 'Test drive', date: s.at, stock: car.stock, model: car.model, work: 'Test drive', cost: null, status: lab(s.status) }); });
    arr(app.leads).forEach(function (l) { var car = carOf(l.interest_car_id);
      add(l, { kind: 'Lead', date: l.created_at || l.date, stock: car.stock, model: car.model, work: 'Lead' + (l.source ? ' (' + lab(l.source) + ')' : ''), cost: null, status: lab(l.status) }); });
    arr(app.deals).forEach(function (d) { var car = carOf(d.car_id);
      add({ name: d.buyer, phone: d.phone, email: d.email }, { kind: 'Deal', date: d.date, stock: car.stock, model: car.model, work: 'Vehicle sale', cost: cents(d.price_cents), status: lab(d.status === 'closed' ? 'sold' : d.status) }); });
    var bk = parse(get, 'dealerdesk_booking');
    if (bk) {
      arr(bk.services).forEach(function (s) { var car = carOf(s.carId, s.stock, s.vehicle);
        add({ name: s.customer, phone: s.phone, email: s.email }, { kind: 'Service', date: str(s.date, 10) + (s.time ? 'T' + str(s.time, 5) : ''), stock: car.stock, model: car.model, work: lab(s.type) + (s.notes ? ' - ' + str(s.notes, 200) : ''), cost: cents(s.cost_cents), status: lab(s.status) }); });
      arr(bk.testDrives).forEach(function (s) { var car = carOf(s.carId, s.stock, s.vehicleLabel);
        add({ name: s.customer, phone: s.phone, email: s.email }, { kind: 'Test drive', date: str(s.date, 10) + (s.time ? 'T' + str(s.time, 5) : ''), stock: car.stock, model: car.model, work: 'Test drive', cost: null, status: lab(s.status) }); });
      arr(bk.requests).forEach(function (s) { var car = carOf(s.carId, s.stock, s.vehicleLabel);
        add({ name: s.customer, phone: s.phone, email: s.email }, { kind: 'Request', date: s.createdAt || s.date, stock: car.stock, model: car.model, work: 'Booking request' + (s.kind ? ' (' + lab(s.kind) + ')' : ''), cost: null, status: lab(s.status || 'new') }); });
    }
    var od = parse(get, 'dealerdesk_orders');
    if (od) arr(od.orders).forEach(function (x) { var car = carOf(x.carId, x.stock, x.carLabel), p = +x.price;
      add(x, { kind: 'Order', date: x.createdAt, stock: car.stock, model: car.model, work: (x.kind === 'reserve' ? 'Reservation' : 'Order request') + (x.code ? ' ' + str(x.code, 20) : ''), cost: isFinite(p) && p >= 0 ? Math.round(p * 100) : null, status: lab(x.status) }); });
    // union-find over phone/email/name keys
    var parent = Object.create(null);
    function find(k) { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; }
    function uni(a, b) { a = find(a); b = find(b); if (a !== b) parent[b] = a; }
    ev.forEach(function (e, i) { var ks = [], d = digits(e.who.phone), m = e.who.email, n = nName(e.who.name);
      if (d) ks.push('p:' + d); if (m) ks.push('e:' + m); if (!d && !m && n) ks.push('n:' + n);
      if (n && (d || m)) ks.push('n:' + n);
      ks.forEach(function (k) { if (!(k in parent)) parent[k] = k; }); e.keys = ks; for (var j = 1; j < ks.length; j++) uni(ks[0], ks[j]); });
    var groups = Object.create(null), out = [];
    ev.forEach(function (e) { var r = find(e.keys[0]), g = groups[r];
      if (!g) { g = groups[r] = { id: '', name: '', phones: [], emails: [], events: [] }; out.push(g); }
      if (!g.name && e.who.name) g.name = e.who.name;
      if (e.who.phone && g.phones.indexOf(e.who.phone) < 0 && !g.phones.some(function (p) { return digits(p) && digits(p) === digits(e.who.phone); })) g.phones.push(e.who.phone);
      if (e.who.email && g.emails.indexOf(e.who.email) < 0) g.emails.push(e.who.email);
      delete e.keys; g.events.push(e); });
    out.forEach(function (g) { g.events.sort(function (a, b) { return (isNaN(b.t) ? -Infinity : b.t) - (isNaN(a.t) ? -Infinity : a.t); });
      g.id = 'c' + (digits(g.phones[0]) || g.emails[0] || nName(g.name)).replace(/[^a-z0-9@.]/g, '-');
      g.last = g.events.length && !isNaN(g.events[0].t) ? g.events[0].t : NaN;
      g.spent = g.events.reduce(function (s, e) { return s + (e.kind === 'Service' && e.cost ? e.cost : 0); }, 0);
      g.services = g.events.filter(function (e) { return e.kind === 'Service'; }).length; if (!g.name) g.name = g.phones[0] || g.emails[0] || 'Unknown'; });
    out.sort(function (a, b) { return (isNaN(b.last) ? -Infinity : b.last) - (isNaN(a.last) ? -Infinity : a.last) || (a.name < b.name ? -1 : 1); });
    return out;
  }
  function search(list, q) { q = String(q || '').trim().toLowerCase(); if (!q) return list; var qd = q.replace(/\D/g, '');
    return list.filter(function (g) { var h = (g.name + ' ' + g.emails.join(' ') + ' ' + g.events.map(function (e) { return e.stock + ' ' + e.model; }).join(' ')).toLowerCase();
      return h.indexOf(q) >= 0 || (qd.length >= 3 && g.phones.some(function (p) { return String(p).replace(/\D/g, '').indexOf(qd) >= 0; })); }); }
  function money(c) { if (c == null) return '—'; try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(c / 100); } catch (e) { return '$' + Math.round(c / 100); } }
  function fdate(t) { if (isNaN(t)) return '—'; var d = new Date(t); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

  var ui = { q: '', sel: '' }, CSS = '.sh-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:14px}.sh-list{display:grid;gap:6px;align-content:start;max-height:70vh;overflow:auto}.sh-c{text-align:left;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:9px;font:inherit;color:inherit;cursor:pointer;min-height:44px;overflow-wrap:anywhere}.sh-c.on{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}.sh-c small,.sh-tl small{display:block;color:var(--muted)}.sh-tl{list-style:none;margin:0;padding:0;display:grid;gap:8px}.sh-tl li{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--acc);border-radius:8px;padding:9px;overflow-wrap:anywhere}.sh-tl li.k-service{border-left-color:var(--ok)}.sh-tl li.k-order,.sh-tl li.k-deal{border-left-color:var(--warn)}.sh-head{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:baseline}@media(max-width:700px){.sh-wrap{grid-template-columns:1fr}.sh-list{max-height:40vh}}';
  function html(list) {
    var shown = search(list, ui.q), g = list.filter(function (x) { return x.id === ui.sel; })[0] || shown[0];
    var left = shown.length ? shown.map(function (c) { return '<button type="button" class="sh-c' + (g && c.id === g.id ? ' on' : '') + '" data-sh="' + esc(c.id) + '"><b>' + esc(c.name) + '</b><small>' + esc(c.phones[0] || c.emails[0] || '') + '</small><small>' + c.events.length + ' record' + (c.events.length === 1 ? '' : 's') + ' &middot; last ' + esc(fdate(c.last)) + '</small></button>'; }).join('') : '<p class="muted">No customers match.</p>';
    var right = !g ? '<p class="muted">No customer history yet. Service jobs, test drives, bookings and orders show up here.</p>' :
      '<div class="card"><div class="sh-head"><h3 style="margin:0">' + esc(g.name) + '</h3><span class="muted">' + g.services + ' service job' + (g.services === 1 ? '' : 's') + ' &middot; ' + esc(money(g.spent)) + ' service spend</span></div>' +
      '<p class="muted" style="margin:6px 0 10px">' + g.phones.map(function (p) { return '<a href="tel:' + esc(String(p).replace(/[^\d+]/g, '')) + '">' + esc(p) + '</a>'; }).concat(g.emails.map(function (e) { return '<a href="mailto:' + esc(e) + '">' + esc(e) + '</a>'; })).join(' &middot; ') + '</p>' +
      '<ol class="sh-tl">' + g.events.map(function (e) { return '<li class="k-' + esc(e.kind.toLowerCase().replace(/[^a-z]/g, '')) + '"><div class="sh-head"><b>' + esc(e.kind) + ': ' + esc(e.work) + '</b><span class="pill">' + esc(e.status || '—') + '</span></div><small>' + esc(fdate(e.t)) + ' &middot; ' + esc(e.model || 'No car') + (e.stock ? ' &middot; #' + esc(e.stock) : '') + ' &middot; ' + esc(money(e.cost)) + '</small></li>'; }).join('') + '</ol></div>';
    return '<style>' + CSS + '</style><form class="row" data-sh-form onsubmit="return false"><input type="search" data-sh-q placeholder="Search name, phone, email, stock #" value="' + esc(ui.q) + '" aria-label="Search customers"></form>' +
      '<p class="muted" data-sh-count>' + shown.length + ' of ' + list.length + ' customer' + (list.length === 1 ? '' : 's') + '</p><div class="sh-wrap"><div class="sh-list">' + left + '</div><div>' + right + '</div></div>';
  }
  function mount(el, src) {
    if (!el) return; var list = collect(src);
    function draw() { var f = document.activeElement && document.activeElement.hasAttribute && document.activeElement.hasAttribute('data-sh-q'), pos = f ? document.activeElement.selectionStart : 0;
      el.innerHTML = html(list); if (f) { var i = el.querySelector('[data-sh-q]'); i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} } }
    el.oninput = function (e) { if (e.target.hasAttribute('data-sh-q')) { ui.q = String(e.target.value).slice(0, 80); ui.sel = ''; draw(); } };
    el.onclick = function (e) { var b = e.target.closest && e.target.closest('[data-sh]'); if (b) { ui.sel = b.getAttribute('data-sh'); draw(); } };
    draw();
  }
  root.DDServiceHistory = { collect: collect, search: search, mount: mount, ui: ui, open: function (q) { ui.q = String(q || '').slice(0, 80); ui.sel = ''; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DDServiceHistory;
})(typeof window !== 'undefined' ? window : globalThis);
