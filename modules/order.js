/*! DealerDesk Orders module - reserve/buy requests, trade-in estimate, payment calculator, staff list.
 *  Plain script, no dependencies. Global window.DDOrders (module.exports under node).
 *  Storage: localStorage "dealerdesk_orders" (own key). Cars: DealerDesk schema (/workspace/dealership):
 *  setInventory(datasetOrCars) or read-only from localStorage "dealerdesk_data" ({cars:[...]}).
 *  NO payments are taken and there are no card/bank fields: a dealer contacts the customer. */
(function (root) {
  'use strict';
  var KEY = 'dealerdesk_orders', INV_KEY = 'dealerdesk_data';
  var STATUS = ['new', 'contacted', 'deposit', 'sold', 'cancelled'];
  var CONTACT = { phone: 'Phone call', text: 'Text message', email: 'Email' };
  var CONDITION = { excellent: 1.0, good: 0.9, fair: 0.75, poor: 0.55 };
  var RATE = { max: 5, windowMs: 3600000 };

  function defaults() { return { depositAmount: 500, taxRate: 6, defaultApr: 7.9, defaultTerm: 72, tradeBase: 32000, tradeDepreciation: 0.15, tradeMilesPerYear: 12000, tradeMileAdj: 0.08, taxTradeCredit: true, bookingUrl: 'booking.html', photoBase: '' }; }
  function fresh() { return { v: 1, seq: 100, settings: defaults(), orders: [] }; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clean(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 80); }
  function digits(p) { return String(p || '').replace(/\D/g, ''); }
  function err(code, m) { var e = new Error(m); e.code = code; return e; }
  function money(n) { return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function money2(n) { var s = (Math.round(n * 100) / 100).toFixed(2).split('.'); return '$' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + s[1]; }
  function n(v, d) { var x = parseFloat(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return isFinite(x) ? x : (d || 0); }

  var state = fresh(), saveError = '', listeners = [], clock = function () { return Date.now(); };
  function store() { try { return root.localStorage || null; } catch (e) { return null; } }
  function load() {
    state = fresh(); saveError = ''; var s = store(); if (!s) { saveError = 'Storage is not available.'; return; }
    try { var raw = s.getItem(KEY); if (raw) { var p = JSON.parse(raw); if (p && p.v === 1) { state = Object.assign(fresh(), p); state.settings = Object.assign(defaults(), p.settings || {}); } } }
    catch (e) { saveError = 'Saved orders were unreadable and were reset.'; }
  }
  function save() { var s = store(); if (!s) return false; try { s.setItem(KEY, JSON.stringify(state)); saveError = ''; } catch (e) { saveError = 'Could not save: ' + e.message; return false; } listeners.forEach(function (f) { try { f(); } catch (e) {} }); return true; }

  // ---------- inventory ----------
  var inv = { raw: null, list: [], byRef: {} }, injected = null;
  function setInventory(x) { injected = x ? (Array.isArray(x) ? x : (x.cars || [])) : null; inv.raw = {}; return cars().length; }
  function cars() {
    var raw = injected; if (!raw) { var s = store(); try { raw = s && s.getItem(INV_KEY); } catch (e) { raw = null; } }
    if (raw === inv.raw) return inv.list;
    var src = injected || []; if (!injected) try { var d = JSON.parse(raw || 'null'); if (d && Array.isArray(d.cars)) src = d.cars; } catch (e) {}
    var byRef = {}, list = src.filter(function (c) { return c && c.stock_no; }).map(function (c) {
      var price = c.price_cents != null ? c.price_cents / 100 : n(c.price);
      var o = { id: c.id, stock: clean(c.stock_no, 20), vin: String(c.vin || '').toUpperCase(), year: c.year, make: c.make, model: c.model, trim: c.trim || '', price: price, mileage: +c.mileage || 0, color: c.color || '', condition: c.condition || '', status: c.status || 'available', photos: (c.photos || []).filter(function (p) { return /^https:\/\//.test(p) || /^[\w./-]+\.(webp|jpe?g|png|avif)$/i.test(p) && p.indexOf('..') < 0; }), features: (c.features || []).slice(0, 40) };
      byRef[o.stock.toUpperCase()] = o; if (o.vin) byRef[o.vin] = o; return o;
    });
    inv = { raw: raw, list: list, byRef: byRef }; return list;
  }
  function findCar(ref) { cars(); return inv.byRef[String(ref || '').trim().toUpperCase()] || null; }
  function carLabel(c) { return c ? [c.year, c.make, c.model, c.trim].filter(Boolean).join(' ') : ''; }

  // ---------- settings ----------
  function settings() { return JSON.parse(JSON.stringify(state.settings)); }
  function updateSettings(p) {
    var s = state.settings;
    function num(k, lo, hi) { if (p[k] === undefined) return; var x = n(p[k], NaN); if (!(x >= lo && x <= hi)) throw err('bad_' + k, k + ' must be between ' + lo + ' and ' + hi + '.'); s[k] = x; }
    num('depositAmount', 0, 100000); num('taxRate', 0, 25); num('defaultApr', 0, 40); num('tradeBase', 1000, 500000); num('tradeDepreciation', 0, 0.5); num('tradeMilesPerYear', 1000, 50000); num('tradeMileAdj', 0, 0.5);
    if (p.defaultTerm !== undefined) { var t = Math.round(n(p.defaultTerm)); if (t < 36 || t > 84) throw err('bad_term', 'Term must be 36 to 84 months.'); s.defaultTerm = t; }
    if (p.taxTradeCredit !== undefined) s.taxTradeCredit = !!p.taxTradeCredit;
    if (p.bookingUrl !== undefined) { var u = clean(p.bookingUrl, 200); if (u && !/^(https:\/\/|[\w./-]+$)/.test(u)) throw err('bad_url', 'Booking link must be https:// or a relative path.'); s.bookingUrl = u || 'booking.html'; }
    if (p.photoBase !== undefined) { var b = clean(p.photoBase, 200); if (b && !/^(https:\/\/|[\w./-]+$)/.test(b)) throw err('bad_url', 'Photo base must be https:// or a relative path.'); s.photoBase = b; }
    save(); return settings();
  }

  // ---------- trade-in estimate ----------
  // ESTIMATE FORMULA (rough guide, not an offer):
  //   age      = max(0, this year - vehicle year)
  //   base     = tradeBase x (1 - tradeDepreciation) ^ age          (defaults $32,000, 15%/yr)
  //   milesAdj = 1 - tradeMileAdj x (mileage - tradeMilesPerYear x age) / 10,000, clamped 0.5..1.15
  //   estimate = base x milesAdj x condition (excellent 1.00, good 0.90, fair 0.75, poor 0.55), min $250
  //   range    = estimate -10% .. +10%, rounded to $50
  var FORMULA = 'Estimate = $base x (1 - depreciation)^age x mileage adjustment x condition factor. Rough guide only, not an offer; the final value comes from an in-person appraisal.';
  function tradeIn(p) {
    var s = state.settings, year = Math.round(n(p.year)), nowY = new Date(clock()).getFullYear();
    if (!(year >= 1980 && year <= nowY + 1)) throw err('bad_year', 'Enter the trade-in year.');
    if (!clean(p.make) || !clean(p.model)) throw err('need_vehicle', 'Enter the trade-in make and model.');
    var miles = n(p.mileage, -1); if (!(miles >= 0 && miles <= 1000000)) throw err('bad_mileage', 'Enter the mileage.');
    var cf = CONDITION[p.condition]; if (!cf) throw err('bad_condition', 'Choose a condition.');
    var age = Math.max(0, nowY - year), base = s.tradeBase * Math.pow(1 - s.tradeDepreciation, age);
    var mAdj = Math.min(1.15, Math.max(0.5, 1 - s.tradeMileAdj * (miles - s.tradeMilesPerYear * age) / 10000));
    var est = Math.max(250, base * mAdj * cf), r50 = function (x) { return Math.round(x / 50) * 50; };
    return { estimate: r50(est), low: r50(est * 0.9), high: r50(est * 1.1), age: age, base: Math.round(base), mileageFactor: Math.round(mAdj * 1000) / 1000, conditionFactor: cf, formula: FORMULA };
  }

  // ---------- payment calculator ----------
  function payment(p) {
    var s = state.settings, price = n(p.price), down = Math.max(0, n(p.down)), trade = Math.max(0, n(p.trade)), owed = Math.max(0, n(p.tradeOwed));
    var apr = p.apr === undefined || p.apr === '' ? s.defaultApr : n(p.apr), term = Math.round(p.term === undefined || p.term === '' ? s.defaultTerm : n(p.term));
    var taxRate = p.taxRate === undefined ? s.taxRate : n(p.taxRate);
    if (!(price > 0)) throw err('bad_price', 'Price is required.');
    if (!(apr >= 0 && apr <= 40)) throw err('bad_apr', 'APR must be 0-40%.');
    if (!(term >= 36 && term <= 84)) throw err('bad_term', 'Term must be 36 to 84 months.');
    var taxable = Math.max(0, s.taxTradeCredit ? price - trade : price), tax = taxable * taxRate / 100;
    var financed = Math.max(0, price + tax - down - trade + owed), r = apr / 1200;
    var monthly = financed === 0 ? 0 : r === 0 ? financed / term : financed * r / (1 - Math.pow(1 + r, -term));
    monthly = Math.round(monthly * 100) / 100;
    var totalPayments = Math.round(monthly * term * 100) / 100;
    return { price: price, tax: Math.round(tax * 100) / 100, taxRate: taxRate, down: down, trade: trade, tradeOwed: owed, financed: Math.round(financed * 100) / 100, apr: apr, term: term, monthly: monthly,
      totalPayments: totalPayments, interest: Math.round((totalPayments - financed) * 100) / 100, totalCost: Math.round((totalPayments + down + trade - owed) * 100) / 100 };
  }

  // ---------- requests ----------
  function code(id) { var h = 11; for (var i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0; return 'DO-' + ('0000' + (h % 1679616).toString(36).toUpperCase()).slice(-4) + id.replace(/\D/g, '').slice(-3); }
  function submit(p) {
    var c = findCar(p.vehicle); if (!c) throw err('no_car', 'We could not find that car.');
    if (c.status === 'sold') throw err('sold', 'Sorry, this car has been sold.');
    var kind = p.kind === 'buy' ? 'buy' : p.kind === 'reserve' ? 'reserve' : ''; if (!kind) throw err('need_kind', 'Choose Reserve or Buy.');
    var o = { name: clean(p.name), phone: clean(p.phone, 30), email: clean(p.email, 120).toLowerCase(), contact: p.contact, notes: clean(p.notes, 1000) };
    if (!o.name) throw err('need_name', 'Your name is required.');
    if (digits(o.phone).length < 10) throw err('need_phone', 'A phone number with at least 10 digits is required.');
    if (o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) throw err('bad_email', 'That email address does not look right.');
    if (!CONTACT[o.contact]) o.contact = 'phone';
    if (o.contact === 'email' && !o.email) throw err('need_email', 'Add an email if you want us to email you.');
    var now = clock(), pd = digits(o.phone);
    if (state.orders.filter(function (x) { return x.phoneDigits === pd && now - x.createdAt < RATE.windowMs; }).length >= RATE.max) throw err('rate_limited', 'Too many requests from this number. Please call us.');
    var trade = null; if (p.trade && (p.trade.make || p.trade.year)) { var est = tradeIn(p.trade); trade = { year: Math.round(n(p.trade.year)), make: clean(p.trade.make, 40), model: clean(p.trade.model, 60), mileage: Math.round(n(p.trade.mileage)), condition: p.trade.condition, estimate: est.estimate }; }
    var calc = null; if (p.calc) { try { calc = payment(Object.assign({ price: c.price, trade: trade ? trade.estimate : 0 }, p.calc)); } catch (e) { calc = null; } }
    state.seq += 1; var id = 'or' + state.seq;
    var rec = Object.assign(o, { id: id, code: code(id), kind: kind, deposit: kind === 'reserve' ? state.settings.depositAmount : 0, carId: c.id, stock: c.stock, vin: c.vin, carLabel: carLabel(c), price: c.price, trade: trade, calc: calc, status: 'new', phoneDigits: pd, createdAt: now, history: [{ at: now, status: 'new' }] });
    state.orders.push(rec); save(); return { ok: true, code: rec.code, id: id };
  }
  function get(id) { for (var i = 0; i < state.orders.length; i++) if (state.orders[i].id === id) return state.orders[i]; throw err('not_found', 'Order not found.'); }
  function setStatus(id, s, note) { if (STATUS.indexOf(s) < 0) throw err('bad_status', 'Unknown status.'); var o = get(id); o.status = s; o.history.push({ at: clock(), status: s, note: clean(note, 200) }); save(); return o; }
  function list(f) { f = f || {}; var q = String(f.q || '').toLowerCase(); return state.orders.filter(function (o) { return (!f.status || o.status === f.status) && (!q || (o.name + ' ' + o.phone + ' ' + o.email + ' ' + o.stock + ' ' + o.carLabel + ' ' + o.code).toLowerCase().indexOf(q) >= 0); }).sort(function (a, b) { return b.createdAt - a.createdAt; }); }
  function bookingLink(o) { var b = state.settings.bookingUrl || 'booking.html'; return b + (b.indexOf('?') < 0 ? '?' : '&') + 'vehicle=' + encodeURIComponent(o.stock); }
  function photoUrl(p) { if (!p) return ''; return /^https:\/\//.test(p) ? p : (state.settings.photoBase ? state.settings.photoBase.replace(/\/?$/, '/') : '') + p; }

  // ---------- staff UI ----------
  var ui = { el: null, status: '', q: '', msg: '' };
  function fmtTime(t) { var d = new Date(t); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
  function renderHTML() {
    var rows = list({ status: ui.status, q: ui.q }), counts = {}; state.orders.forEach(function (o) { counts[o.status] = (counts[o.status] || 0) + 1; });
    return '<div class="ddb ddo-staff"><header class="ddb-top"><div class="ddb-tabs">' + [''].concat(STATUS).map(function (s) {
      return '<button data-filter="' + s + '" class="' + (ui.status === s ? 'on' : '') + '">' + (s || 'All') + (s && counts[s] ? ' <small>' + counts[s] + '</small>' : '') + '</button>'; }).join('') +
      '</div><input class="ddo-search" data-q type="search" placeholder="Search name, phone, stock, code" value="' + esc(ui.q) + '"></header>' +
      (ui.msg ? '<div class="ddb-msg" role="status">' + esc(ui.msg) + '</div>' : '') + (saveError ? '<div class="ddb-msg ddb-bad">' + esc(saveError) + '</div>' : '') +
      (rows.length ? rows.map(function (o) {
        return '<article class="ddb-card ddo-row ddb-s-' + o.status + '"><div class="ddo-rowhead"><b>' + esc(o.name) + '</b><span class="ddb-chip">' + esc(o.status) + '</span><span class="ddo-kind">' + (o.kind === 'reserve' ? 'Reserve ' + money(o.deposit) : 'Buy') + '</span></div>' +
          '<div>' + esc(o.carLabel) + ' &middot; ' + esc(o.stock) + ' &middot; ' + money(o.price) + '</div>' +
          '<small>' + esc(o.code) + ' &middot; ' + fmtTime(o.createdAt) + ' &middot; prefers ' + esc(CONTACT[o.contact]) + '</small>' +
          '<div class="ddo-contact"><a href="tel:' + esc(o.phoneDigits) + '">' + esc(o.phone) + '</a>' + (o.email ? ' <a href="mailto:' + esc(o.email) + '">' + esc(o.email) + '</a>' : '') + '</div>' +
          (o.trade ? '<small>Trade-in: ' + esc([o.trade.year, o.trade.make, o.trade.model].join(' ')) + ', ' + o.trade.mileage + ' mi, ' + esc(o.trade.condition) + ' (est. ' + money(o.trade.estimate) + ')</small>' : '') +
          (o.calc ? '<small>Calc: ' + money2(o.calc.monthly) + '/mo, ' + o.calc.term + ' mo @ ' + o.calc.apr + '%, ' + money(o.calc.down) + ' down</small>' : '') +
          (o.notes ? '<p class="ddo-notes">' + esc(o.notes) + '</p>' : '') +
          '<div class="ddo-actions"><select data-status="' + o.id + '" aria-label="Status">' + STATUS.map(function (s) { return '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
          '<a class="ddb-btn ddb-sm" href="' + esc(bookingLink(o)) + '" target="_blank" rel="noopener">Book test drive</a></div></article>';
      }).join('') : '<p class="ddb-empty">No orders yet.</p>') + '</div>';
  }
  function refresh() { if (!ui.el) return; var f = ui.el.querySelector('[data-q]'), had = f && root.document && root.document.activeElement === f; ui.el.innerHTML = renderHTML(); if (had) { var g = ui.el.querySelector('[data-q]'); g.focus(); try { g.setSelectionRange(g.value.length, g.value.length); } catch (e) {} } }
  function mount(el) {
    ui.el = el;
    el.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-filter]'); if (b) { ui.status = b.getAttribute('data-filter'); ui.msg = ''; refresh(); } });
    el.addEventListener('input', function (e) { if (e.target.hasAttribute('data-q')) { ui.q = e.target.value; refresh(); } });
    el.addEventListener('change', function (e) { var id = e.target.getAttribute && e.target.getAttribute('data-status'); if (id) { try { setStatus(id, e.target.value); ui.msg = 'Status updated.'; } catch (x) { ui.msg = x.message; } refresh(); } });
    refresh(); return { refresh: refresh };
  }

  load();
  var api = { KEY: KEY, STATUS: STATUS, CONTACT: CONTACT, CONDITION: CONDITION, FORMULA: FORMULA, reload: load, settings: settings, updateSettings: updateSettings,
    setInventory: setInventory, cars: cars, findCar: findCar, carLabel: carLabel, photoUrl: photoUrl, tradeIn: tradeIn, payment: payment, submit: submit,
    list: list, setStatus: setStatus, bookingLink: bookingLink, all: function () { return JSON.parse(JSON.stringify(state)); }, lastSaveError: function () { return saveError; },
    onChange: function (f) { listeners.push(f); }, mount: mount, renderHTML: renderHTML, money: money, money2: money2, _setClock: function (f) { clock = f || function () { return Date.now(); }; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DDOrders = api;
})(typeof window !== 'undefined' ? window : globalThis);
