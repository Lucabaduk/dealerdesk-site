/*! DealerDesk Booking module - test drives + service appointments.
 *  Plain script, no dependencies. Exposes window.DDBooking (module.exports under node).
 *  Storage: localStorage key "dealerdesk_booking" (own key).
 *  Vehicles: DealerDesk schema cars (/workspace/dealership SCHEMA.md: id, stock_no, vin, year, make, model,
 *  trim, status available|hold|sold). Give them with DDBooking.setInventory(carsOrDataset), or they are read
 *  read-only from localStorage "dealerdesk_data" ({cars:[...]}) if the core app stores them there.
 *  DDBooking.toSchema() exports bookings as schema test_drives / service_bookings. */
(function (root) {
  'use strict';
  var KEY = 'dealerdesk_booking', INV_KEY = 'dealerdesk_data';
  var TD_STATUS = ['booked', 'confirmed', 'completed', 'no-show', 'cancelled'];
  var SV_STATUS = ['scheduled', 'checked-in', 'in-progress', 'ready', 'picked-up'];
  var SV_TYPES = Object.assign(Object.create(null), { 'oil-change': 'Oil change', tires: 'Tires', brakes: 'Brakes', inspection: 'Inspection', other: 'Other' });
  var SV_DEFAULT_MIN = Object.assign(Object.create(null), { 'oil-change': 45, tires: 60, brakes: 120, inspection: 60, other: 60 });
  var ACTIVE_TD = { booked: 1, confirmed: 1 }, DONE_SV = { 'picked-up': 1 };
  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  function defaults() {
    var h = {}; DAYS.forEach(function (d) { h[d] = d === 'sun' ? null : { open: '09:00', close: d === 'sat' ? '16:00' : '19:00' }; });
    return { hours: h, slotMin: 30, testDriveMin: 30, bays: 4, leadTimeMin: 120, maxDaysAhead: 30, publicRequests: true, dealerName: '', reminderHours: 24, templates: defaultTemplates() };
  }
  // ---------- reminder templates ----------
  // Placeholders: {dealer} {customer} {first} {what} {car} {date} {time} {code}
  var PLACEHOLDERS = ['dealer', 'customer', 'first', 'what', 'car', 'date', 'time', 'code'];
  function defaultTemplates() { return {
    sms: 'Hi {first}, this is {dealer}. A friendly reminder of your {what} for the {car} on {date} at {time}. Confirmation {code}. Reply or call us if you need to change it.',
    emailSubject: 'Reminder: your {what} on {date} at {time}',
    emailBody: 'Hi {first},\n\nThis is a friendly reminder of your {what} for the {car} on {date} at {time}.\n\nConfirmation code: {code}\n\nIf you need to change the time, just reply to this email or give us a call.\n\nSee you soon,\n{dealer}' }; }
  var TPL_MAX = { sms: 480, emailSubject: 140, emailBody: 2000 };
  var UNSAFE = /\b(javascript|vbscript|data|file|blob)\s*:/i;
  function checkTemplate(k, v) {
    v = String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
    var name = { sms: 'Text message', emailSubject: 'Email subject', emailBody: 'Email message' }[k];
    if (!v) throw err('bad_template', name + ' cannot be empty.');
    if (v.length > TPL_MAX[k]) throw err('bad_template', name + ' is too long (max ' + TPL_MAX[k] + ' characters).');
    if (k === 'emailSubject' && /\n/.test(v)) throw err('bad_template', 'Email subject must be one line.');
    if (UNSAFE.test(v)) throw err('unsafe_link', name + ' contains an unsafe link. Only https:// links are allowed.');
    var m = v.match(/[a-z][a-z0-9+.-]*:\/\/[^\s]*/gi) || [];
    for (var i = 0; i < m.length; i++) if (!/^https:\/\//i.test(m[i])) throw err('unsafe_link', name + ' contains a link that is not https://.');
    var bad = (v.match(/\{([^}]*)\}/g) || []).map(function (x) { return x.slice(1, -1); }).filter(function (x) { return PLACEHOLDERS.indexOf(x) < 0; });
    if (bad.length) throw err('bad_placeholder', name + ' has an unknown placeholder {' + bad[0] + '}. Use: ' + PLACEHOLDERS.map(function (x) { return '{' + x + '}'; }).join(' '));
    return v;
  }
  function fresh() { return { v: 1, seq: 1, settings: defaults(), testDrives: [], services: [], requests: [], salespeople: [], advisors: [] }; }

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // drop lone UTF-16 surrogates (e.g. an emoji cut in half by slice) so encodeURIComponent never throws
  function wf(s) { return String(s == null ? '' : s).replace(/[\ud800-\udbff](?![\udc00-\udfff])|(^|[^\ud800-\udbff])[\udc00-\udfff]/g, '$1'); }
  function clean(s, max) { return wf(String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 80)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(hhmm) { var m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); return m ? +m[1] * 60 + +m[2] : NaN; }
  function fromMin(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function stamp(date, time) { var d = parseDate(date), m = toMin(time); if (!d || !(m >= 0)) return NaN; d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.getTime(); } // wall-clock time, correct across DST
  function overlap(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }
  function normVin(v) { return clean(v, 17).toUpperCase().replace(/[IOQ\s]/g, function (c) { return c === ' ' ? '' : c; }); }
  function validVin(v) { return /^[A-HJ-NPR-Z0-9]{17}$/.test(v); }
  function validPhone(p) { return String(p || '').replace(/\D/g, '').length >= 10; }
  function validEmail(e) { return !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  function err(code, message) { var e = new Error(message); e.code = code; return e; }

  // ---------- state ----------
  var state = fresh(), saveError = '', listeners = [], clock = function () { return Date.now(); };
  function store() { try { return root.localStorage || null; } catch (e) { return null; } }
  function load() {
    state = fresh(); saveError = '';
    var s = store(); if (!s) { saveError = 'Storage is not available - bookings will not be saved.'; return; }
    try { var raw = s.getItem(KEY); if (raw) { var p = JSON.parse(raw); if (p && p.v === 1) { state = Object.assign(fresh(), p); state.settings = Object.assign(defaults(), p.settings && typeof p.settings === 'object' ? p.settings : {});
      ['testDrives', 'services', 'requests', 'salespeople', 'advisors'].forEach(function (k) { if (!Array.isArray(state[k])) state[k] = []; });
      ['testDrives', 'services', 'requests'].forEach(function (k) { state[k] = state[k].filter(function (x) { return x && typeof x === 'object' && typeof x.id === 'string'; }); });
      var st = state.settings, dt = defaultTemplates(); if (st.reminderHours !== 24 && st.reminderHours !== 48) st.reminderHours = 24;
      if (!st.templates || typeof st.templates !== 'object') st.templates = dt; else Object.keys(dt).forEach(function (k) { if (typeof st.templates[k] !== 'string' || !st.templates[k].trim()) st.templates[k] = dt[k]; });
      if (!st.hours || typeof st.hours !== 'object') st.hours = defaults().hours; } } }
    catch (e) { saveError = 'Saved bookings were unreadable and were reset.'; }
  }
  function save() {
    var s = store(); if (!s) return false;
    try { s.setItem(KEY, JSON.stringify(state)); saveError = ''; } catch (e) { saveError = 'Could not save: ' + e.message; listeners.forEach(function (f) { f(); }); return false; }
    listeners.forEach(function (f) { try { f(); } catch (e) {} }); return true;
  }
  function nid(p) { state.seq += 1; return p + state.seq; }

  // ---------- inventory (read-only) ----------
  var invCache = { raw: null, list: [], byRef: {} }, injected = null;
  function setInventory(x) { injected = x ? (Array.isArray(x) ? x : (x.cars || [])) : null; invCache.raw = {}; return vehicles().length; }
  function vehicles() {
    var raw = injected;
    if (!raw) { var s = store(); try { raw = s && s.getItem(INV_KEY); } catch (e) { raw = null; } }
    if (raw === invCache.raw) return invCache.list;
    var out = injected || []; if (!injected) try { var db = JSON.parse(raw || 'null'); if (db && Array.isArray(db.cars)) out = db.cars; } catch (e) {}
    var byRef = {};
    var list = out.filter(function (v) { return v && v.stock_no; }).map(function (v) {
      var o = { id: v.id, stock: clean(v.stock_no, 20), vin: String(v.vin || '').toUpperCase(), year: v.year, make: v.make, model: v.model, trim: v.trim || '', status: v.status || 'available' };
      o._q = (o.stock + ' ' + o.vin + ' ' + o.year + ' ' + (o.make || '') + ' ' + (o.model || '') + ' ' + o.trim).toLowerCase();
      byRef[o.vin] = o; byRef[String(o.stock).toUpperCase()] = o; return o;
    });
    invCache = { raw: raw, list: list, byRef: byRef }; return list;
  }
  // Fast capped search: every word must match (stock, VIN, year, make, model, trim). Exact stock/VIN first, sold last.
  function searchVehicles(q, limit) {
    limit = limit || 8; var list = vehicles(), words = String(q || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    var exact = invCache.byRef[String(q).trim().toUpperCase()], hits = [], sold = [];
    for (var i = 0; i < list.length && hits.length < limit; i++) {
      var v = list[i], ok = true; if (v === exact) continue;
      for (var w = 0; w < words.length; w++) if (v._q.indexOf(words[w]) < 0) { ok = false; break; }
      if (ok) (v.status === 'sold' ? sold : hits).push(v);
    }
    return (exact ? [exact] : []).concat(hits, sold).slice(0, limit);
  }
  function findVehicle(ref) {
    ref = String(ref || '').trim().toUpperCase(); if (!ref) return null;
    vehicles(); return invCache.byRef[ref] || null;
  }
  function vLabel(v) { return v ? [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') : ''; }

  // ---------- settings / hours ----------
  function settings() { return JSON.parse(JSON.stringify(state.settings)); }
  function updateSettings(p) {
    // validate everything on a copy first; only apply (and save) when all fields are valid
    var prev = state.settings, s = JSON.parse(JSON.stringify(prev));
    if (p.hours) DAYS.forEach(function (d) {
      if (!(d in p.hours)) return; var h = p.hours[d];
      if (h === null) { s.hours[d] = null; return; }
      var o = toMin(h.open), c = toMin(h.close);
      if (!(o >= 0) || !(c > o) || c > 1440) throw err('bad_hours', 'Closing time must be after opening time (' + d + ').');
      s.hours[d] = { open: fromMin(o), close: fromMin(c) };
    });
    function int(k, lo, hi) { if (p[k] === undefined) return; var n = Math.round(+p[k]); if (!(n >= lo && n <= hi)) throw err('bad_' + k, k + ' must be between ' + lo + ' and ' + hi + '.'); s[k] = n; }
    int('slotMin', 10, 240); int('testDriveMin', 15, 240); int('bays', 1, 50); int('leadTimeMin', 0, 10080); int('maxDaysAhead', 1, 365);
    if (p.publicRequests !== undefined) s.publicRequests = !!p.publicRequests;
    if (p.reminderHours !== undefined) { var rh = +p.reminderHours; if (rh !== 24 && rh !== 48) throw err('bad_reminderHours', 'Reminder window must be 24 or 48 hours.'); s.reminderHours = rh; }
    if (p.dealerName !== undefined) s.dealerName = clean(p.dealerName, 80);
    if (p.templates) { s.templates = Object.assign(defaultTemplates(), s.templates || {}); ['sms', 'emailSubject', 'emailBody'].forEach(function (k) { if (p.templates[k] !== undefined) s.templates[k] = checkTemplate(k, p.templates[k]); }); }
    state.settings = s;
    if (!save() && store()) { state.settings = prev; throw err('save_failed', saveError || 'Could not save settings.'); }
    return settings();
  }
  function hoursFor(date) { var d = parseDate(date); if (!d) return null; var h = state.settings.hours[DAYS[d.getDay()]]; return h ? { open: toMin(h.open), close: toMin(h.close) } : null; }
  function checkWindow(date, time, dur, opts) {
    var h = hoursFor(date); if (!h) throw err('closed', 'We are closed that day.');
    var st = toMin(time); if (!(st >= 0)) throw err('bad_time', 'Pick a valid time.');
    if (st < h.open || st + dur > h.close) throw err('outside_hours', 'That time is outside business hours (' + fromMin(h.open) + '-' + fromMin(h.close) + ').');
    if (opts && opts.public) {
      var t = stamp(date, time), now = clock();
      if (t < now + state.settings.leadTimeMin * 60000) throw err('lead_time', 'Please book at least ' + Math.round(state.settings.leadTimeMin / 60 * 10) / 10 + ' hours ahead.');
      if (t > now + state.settings.maxDaysAhead * 86400000) throw err('too_far', 'Please book within ' + state.settings.maxDaysAhead + ' days.');
    } else if (opts && opts.isNew && stamp(date, time) < clock()) throw err('past', 'That time has already passed.');
    else if (stamp(date, time) + dur * 60000 < clock() - 86400000 * 365) throw err('bad_date', 'Date looks wrong.');
  }

  // ---------- test drives ----------
  function vehicleKey(o) { return o.vin || (o.stock ? 'STK:' + String(o.stock).toUpperCase() : ''); }
  function tdConflicts(o, ignoreId) {
    var s1 = stamp(o.date, o.time), s2 = s1 + o.durationMin * 60000, vk = vehicleKey(o), out = [], overlapping = 0;
    state.testDrives.forEach(function (t) {
      if (t.id === ignoreId || !ACTIVE_TD[t.status]) return;
      var t1 = stamp(t.date, t.time), t2 = t1 + t.durationMin * 60000; if (!overlap(s1, s2, t1, t2)) return;
      if (vk && vehicleKey(t) === vk) out.push({ type: 'vehicle', id: t.id, message: 'This vehicle is already booked ' + t.time + '-' + fromMin(toMin(t.time) + t.durationMin) + '.' });
      if (o.salesperson && t.salesperson && t.salesperson.toLowerCase() === o.salesperson.toLowerCase()) out.push({ type: 'salesperson', id: t.id, message: t.salesperson + ' already has a test drive at ' + t.time + '.' });
      overlapping++;
    });
    // capacity: one drive per slot when no salespeople are set up, otherwise one per salesperson
    var cap = state.salespeople.length || 1;
    if (!out.length && overlapping >= cap) out.push({ type: 'capacity', message: cap === 1 ? 'Another test drive is already booked at that time.' : 'All ' + cap + ' salespeople are busy at that time.' });
    return out;
  }
  function normTD(p, base) {
    var o = Object.assign({}, base || {}, {});
    ['customer', 'phone', 'email', 'salesperson', 'notes', 'date', 'time'].forEach(function (k) { if (p[k] !== undefined) o[k] = clean(p[k], k === 'notes' ? 500 : 80); });
    if (p.vehicle !== undefined || p.vin !== undefined || p.stock !== undefined) {
      var ref = p.vehicle || p.vin || p.stock, v = findVehicle(ref);
      if (v) { if (v.status === 'sold') throw err('sold', 'That car has been sold.'); o.carId = v.id; o.vin = v.vin; o.stock = v.stock; o.vehicleLabel = vLabel(v); }
      else { if (String(ref || '').trim() && vehicles().length) throw err('unknown_vehicle', 'We could not find that vehicle. Check the stock number or VIN.'); o.carId = null; var r = normVin(ref); if (validVin(r)) { o.vin = r; o.stock = ''; } else { o.vin = ''; o.stock = clean(ref, 20).toUpperCase(); } o.vehicleLabel = clean(p.vehicleLabel || '', 80); }
    }
    o.durationMin = p.durationMin ? Math.round(+p.durationMin) : (o.durationMin || state.settings.testDriveMin);
    if (o.email) o.email = o.email.toLowerCase();
    if (!o.customer) throw err('need_customer', 'Customer name is required.');
    if (!validPhone(o.phone)) throw err('need_phone', 'A phone number with at least 10 digits is required.');
    if (!validEmail(o.email)) throw err('bad_email', 'That email address does not look right.');
    if (!o.vin && !o.stock) throw err('need_vehicle', 'Choose a vehicle (stock number or VIN).');
    if (!parseDate(o.date)) throw err('bad_date', 'Pick a date.');
    return o;
  }
  function addTestDrive(p, opts) {
    var o = normTD(p); o.status = 'booked';
    checkWindow(o.date, o.time, o.durationMin, Object.assign({ isNew: true }, opts));
    var c = tdConflicts(o); if (c.length) { var e = err('conflict', c[0].message); e.conflicts = c; throw e; }
    o.id = nid('td'); o.code = confCode(o.id); o.createdAt = clock(); o.source = (opts && opts.source) || 'staff';
    state.testDrives.push(o); save(); return o;
  }
  function updateTestDrive(id, p) {
    var t = getTD(id), o = normTD(p, t);
    if (p.status !== undefined) { if (TD_STATUS.indexOf(p.status) < 0) throw err('bad_status', 'Unknown status.'); o.status = p.status; }
    if (ACTIVE_TD[o.status]) { checkWindow(o.date, o.time, o.durationMin); var c = tdConflicts(o, id); if (c.length) { var e = err('conflict', c[0].message); e.conflicts = c; throw e; } }
    Object.assign(t, o); t.updatedAt = clock(); save(); return t;
  }
  function getTD(id) { for (var i = 0; i < state.testDrives.length; i++) if (state.testDrives[i].id === id) return state.testDrives[i]; throw err('not_found', 'Test drive not found.'); }
  function setTDStatus(id, s) { return updateTestDrive(id, { status: s }); }
  function sortKey(a) { return stamp(a.date, a.time); }
  function upcoming(limit) {
    var now = clock(), all = [];
    state.testDrives.forEach(function (t) { if (ACTIVE_TD[t.status] && stamp(t.date, t.time) + t.durationMin * 60000 >= now) all.push(Object.assign({ kind: 'test-drive' }, t)); });
    state.services.forEach(function (s) { if (s.status === 'scheduled' && stamp(s.date, s.time) + s.durationMin * 60000 >= now) all.push(Object.assign({ kind: 'service' }, s)); });
    return all.sort(function (a, b) { return sortKey(a) - sortKey(b); }).slice(0, limit || 50);
  }
  function testDrivesOn(date) { return state.testDrives.filter(function (t) { return t.date === date; }).sort(function (a, b) { return sortKey(a) - sortKey(b); }); }
  function weekOf(date) { var d = parseDate(date), out = []; d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); for (var i = 0; i < 7; i++) { out.push(ymd(d)); d.setDate(d.getDate() + 1); } return out; }

  // ---------- service ----------
  function svOnDay(date, ignoreId) { return state.services.filter(function (s) { return s.date === date && s.id !== ignoreId && !DONE_SV[s.status]; }); }
  function bayLoad(date, startMin, dur, ignoreId) {
    var busy = {}; svOnDay(date, ignoreId).forEach(function (s) { var a = toMin(s.time); if (overlap(startMin, startMin + dur, a, a + s.durationMin)) busy[s.bay] = s; }); return busy;
  }
  function normSV(p, base) {
    var o = Object.assign({}, base || {}), veh = Object.assign({}, (base && base.vehicle) || {});
    ['customer', 'phone', 'email', 'advisor', 'notes', 'date', 'time'].forEach(function (k) { if (p[k] !== undefined) o[k] = clean(p[k], k === 'notes' ? 1000 : 80); });
    if (p.vehicle) {
      var v = p.vehicle;
      if (v.year !== undefined) veh.year = v.year ? Math.round(+v.year) : '';
      ['make', 'model'].forEach(function (k) { if (v[k] !== undefined) veh[k] = clean(v[k], 40); });
      if (v.vin !== undefined) veh.vin = normVin(v.vin);
      if (v.mileage !== undefined) veh.mileage = v.mileage === '' ? '' : Math.max(0, Math.round(+v.mileage) || 0);
    }
    o.vehicle = veh;
    if (p.type !== undefined) o.type = p.type;
    if (typeof o.type !== 'string' || !Object.prototype.hasOwnProperty.call(SV_TYPES, o.type)) throw err('bad_type', 'Choose a service type.');
    o.durationMin = p.durationMin ? Math.round(+p.durationMin) : (o.durationMin || SV_DEFAULT_MIN[o.type]);
    if (!(o.durationMin >= 10 && o.durationMin <= 600)) throw err('bad_duration', 'Duration must be 10-600 minutes.');
    if (p.bay !== undefined) o.bay = p.bay === '' || p.bay == null ? 0 : Math.round(+p.bay);
    if (o.email) o.email = o.email.toLowerCase();
    if (!o.customer) throw err('need_customer', 'Customer name is required.');
    if (!validPhone(o.phone)) throw err('need_phone', 'A phone number with at least 10 digits is required.');
    if (!validEmail(o.email)) throw err('bad_email', 'That email address does not look right.');
    if (veh.vin && !validVin(veh.vin)) throw err('bad_vin', 'VIN must be 17 characters (no I, O or Q).');
    if (veh.year && (veh.year < 1950 || veh.year > new Date(clock()).getFullYear() + 2)) throw err('bad_year', 'Check the vehicle year.');
    if (!veh.year || !veh.make || !veh.model) throw err('need_vehicle', 'Enter the vehicle year, make and model.');
    if (!parseDate(o.date)) throw err('bad_date', 'Pick a date.');
    return o;
  }
  function placeBay(o, ignoreId) {
    var bays = state.settings.bays, busy = bayLoad(o.date, toMin(o.time), o.durationMin, ignoreId);
    if (o.bay) { if (o.bay > bays) throw err('bad_bay', 'There are only ' + bays + ' bays.'); if (busy[o.bay]) throw err('bay_busy', 'Bay ' + o.bay + ' is busy then (' + busy[o.bay].customer + ').'); return; }
    for (var b = 1; b <= bays; b++) if (!busy[b]) { o.bay = b; return; }
    throw err('full', 'All ' + bays + ' bays are full at that time.');
  }
  function addService(p, opts) {
    var o = normSV(p); o.status = 'scheduled';
    checkWindow(o.date, o.time, o.durationMin, Object.assign({ isNew: true }, opts)); placeBay(o);
    o.id = nid('sv'); o.code = confCode(o.id); o.createdAt = clock(); o.source = (opts && opts.source) || 'staff';
    state.services.push(o); save(); return o;
  }
  function getSV(id) { for (var i = 0; i < state.services.length; i++) if (state.services[i].id === id) return state.services[i]; throw err('not_found', 'Appointment not found.'); }
  function updateService(id, p) {
    var s = getSV(id), o = normSV(p, s);
    if (p.status !== undefined) { if (SV_STATUS.indexOf(p.status) < 0) throw err('bad_status', 'Unknown status.'); o.status = p.status; }
    if (!DONE_SV[o.status] && (p.date !== undefined || p.time !== undefined || p.bay !== undefined || p.durationMin !== undefined || p.type !== undefined)) { checkWindow(o.date, o.time, o.durationMin); placeBay(o, id); }
    Object.assign(s, o); s.updatedAt = clock(); save(); return s;
  }
  function advanceService(id) { var s = getSV(id), i = SV_STATUS.indexOf(s.status); if (i < SV_STATUS.length - 1) return updateService(id, { status: SV_STATUS[i + 1] }); return s; }
  function bayBoard(date) {
    var b = [], n = state.settings.bays, h = hoursFor(date);
    for (var i = 1; i <= n; i++) b.push({ bay: i, jobs: [] });
    var unassigned = [];
    state.services.filter(function (s) { return s.date === date; }).sort(function (a, c) { return toMin(a.time) - toMin(c.time); })
      .forEach(function (s) { if (s.bay >= 1 && s.bay <= n) b[s.bay - 1].jobs.push(s); else unassigned.push(s); });
    var open = h ? h.close - h.open : 0;
    b.forEach(function (x) { var used = x.jobs.filter(function (j) { return !DONE_SV[j.status]; }).reduce(function (a, j) { return a + j.durationMin; }, 0); x.usedMin = used; x.pct = open ? Math.min(100, Math.round(used / open * 100)) : 0; });
    return { date: date, open: !!h, hours: h ? { open: fromMin(h.open), close: fromMin(h.close) } : null, bays: b, unassigned: unassigned };
  }

  // ---------- open slots (public + staff) ----------
  function openSlots(kind, date, o) {
    o = o || {}; var h = hoursFor(date), out = []; if (!h) return out;
    var step = state.settings.slotMin, dur = kind === 'service' ? (o.durationMin || SV_DEFAULT_MIN[o.type] || 60) : state.settings.testDriveMin;
    for (var m = h.open; m + dur <= h.close; m += step) {
      var time = fromMin(m);
      try { checkWindow(date, time, dur, { public: o.public !== false }); } catch (e) { continue; }
      if (kind === 'service') { var busy = bayLoad(date, m, dur); if (Object.keys(busy).length >= state.settings.bays) continue; }
      else {
        var probe = { date: date, time: time, durationMin: dur, vin: o.vin || '', stock: o.stock || '', salesperson: o.salesperson || '' };
        if (o.vin || o.stock) { if (tdConflicts(probe).length) continue; }
        else { var active = state.testDrives.filter(function (t) { return ACTIVE_TD[t.status] && t.date === date && overlap(m, m + dur, toMin(t.time), toMin(t.time) + t.durationMin); }).length; if (active >= (state.salespeople.length || 1)) continue; }
      }
      out.push(time);
    }
    return out;
  }

  // ---------- public requests (localStorage now; server later, see docs/SERVER_PROPOSAL.md) ----------
  var RATE = { max: 5, windowMs: 3600000 };
  function submitRequest(kind, p) {
    if (!state.settings.publicRequests) throw err('disabled', 'Online booking is turned off. Please call us.');
    var now = clock(), recent = state.requests.filter(function (r) { return r.phoneDigits === String(p.phone || '').replace(/\D/g, '') && now - r.createdAt < RATE.windowMs; });
    if (recent.length >= RATE.max) throw err('rate_limited', 'Too many requests from this number. Please call us.');
    var rec = kind === 'service' ? addService(p, { public: true, source: 'web' }) : addTestDrive(p, { public: true, source: 'web' });
    var r = { id: nid('rq'), kind: kind, refId: rec.id, createdAt: now, phoneDigits: String(rec.phone).replace(/\D/g, ''), seen: false, code: confCode(rec.id) };
    rec.code = r.code; state.requests.push(r); save(); return { ok: true, code: r.code, id: rec.id, kind: kind, date: rec.date, time: rec.time };
  }
  function confCode(id) { var h = 7; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return 'DD-' + ('000' + (h % 46656).toString(36).toUpperCase()).slice(-3) + id.replace(/\D/g, '').slice(-3); }
  function newRequests() { return state.requests.filter(function (r) { return !r.seen; }); }
  function markSeen(id) { state.requests.forEach(function (r) { if (!id || r.id === id) r.seen = true; }); save(); }

  // ---------- reminders (nothing is sent automatically: staff tap an sms:/mailto: link) ----------
  var dealerOverride = '';
  function setDealerName(n) { dealerOverride = clean(n, 80); }
  function dealerName() { return dealerOverride || state.settings.dealerName || 'our dealership'; }
  function findBooking(kind, id) {
    var list = kind === 'service' ? state.services : state.testDrives;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    throw err('not_found', 'Booking not found.');
  }
  function codeOf(b) { return b.code || confCode(b.id); }
  function carOf(kind, b) { return kind === 'service' ? ([b.vehicle && b.vehicle.year, b.vehicle && b.vehicle.make, b.vehicle && b.vehicle.model].filter(Boolean).join(' ') || 'your vehicle') : (b.vehicleLabel || ('stock ' + (b.stock || b.vin))); }
  function whatOf(kind, b) { return kind === 'service' ? (SV_TYPES[b.type] || 'service').toLowerCase() + ' appointment' : 'test drive'; }
  function niceDate(date) { var d = parseDate(date); if (!d) return date; return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()] + ', ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getDate(); }
  function niceTime(t) { var m = toMin(t); if (!(m >= 0)) return t; var h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ':' + pad(mm) + (h < 12 ? ' AM' : ' PM'); }
  function fill(tpl, kind, b) {
    var v = { dealer: dealerName(), customer: b.customer, first: String(b.customer || '').split(/\s+/)[0] || 'there', what: whatOf(kind, b), car: carOf(kind, b), date: niceDate(b.date), time: niceTime(b.time), code: codeOf(b) };
    return wf(String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(v, k) ? String(v[k]) : m; }));
  }
  function validEmailAddr(e) { return /^[^\s@?&#/\\:;,<>"'()]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(e || '')); }
  // Only ever returns sms:, mailto: or data:text/calendar hrefs built here.
  function safeHref(h) { return /^(sms:\+?\d{7,15}\?&body=|mailto:[^\s?&#]+@[^\s?&#]+\?subject=|data:text\/calendar;charset=utf-8,)/.test(h) ? h : ''; }
  function reminderMessage(kind, id) {
    var b = findBooking(kind, id), t = Object.assign(defaultTemplates(), state.settings.templates || {});
    var digits = String(b.phone || '').replace(/\D/g, ''), smsTo = digits.length === 10 ? '+1' + digits : (digits.length >= 7 && digits.length <= 15 ? '+' + digits : '');
    var text = fill(t.sms, kind, b), subject = fill(t.emailSubject, kind, b), body = fill(t.emailBody, kind, b);
    return { text: text, subject: subject, body: body,
      sms: smsTo ? safeHref('sms:' + smsTo + '?&body=' + encodeURIComponent(text)) : '',
      mailto: validEmailAddr(b.email) ? safeHref('mailto:' + b.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body).replace(/%0A/g, '%0D%0A')) : '' };
  }
  function reminders(hours) {
    var h = hours || state.settings.reminderHours || 24, now = clock(), end = now + h * 3600000, out = [];
    state.testDrives.forEach(function (t) { var at = stamp(t.date, t.time); if (ACTIVE_TD[t.status] && !t.remindedAt && at >= now && at <= end) out.push({ kind: 'test-drive', id: t.id, at: at, b: t }); });
    state.services.forEach(function (sv) { var at = stamp(sv.date, sv.time); if (sv.status === 'scheduled' && !sv.remindedAt && at >= now && at <= end) out.push({ kind: 'service', id: sv.id, at: at, b: sv }); });
    return out.sort(function (a, b) { return a.at - b.at; });
  }
  function markReminded(kind, id, how) { var b = findBooking(kind, id); b.remindedAt = clock(); b.remindedVia = how === 'email' ? 'email' : how === 'text' ? 'text' : 'manual'; save(); return b; }
  function unmarkReminded(kind, id) { var b = findBooking(kind, id); delete b.remindedAt; delete b.remindedVia; save(); return b; }

  // ---------- calendar (.ics, RFC 5545; floating local time) ----------
  function icsEsc(v) { return wf(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n').replace(/[\u0000-\u001f]/g, ''); }
  function u8len(c) { var n = c.codePointAt(0); return n < 0x80 ? 1 : n < 0x800 ? 2 : n < 0x10000 ? 3 : 4; }
  function fold(line) { var out = '', cur = '', curLen = 0, chars = Array.from(String(line).replace(/[\ud800-\udbff](?![\udc00-\udfff])|(^|[^\ud800-\udbff])[\udc00-\udfff]/g, '$1\ufffd')); for (var i = 0; i < chars.length; i++) { var c = chars[i], add = u8len(c); if (curLen + add > 74) { out += cur + '\r\n '; cur = ''; curLen = 0; } cur += c; curLen += add; } return out + cur; }
  function icsStamp(ms) { var d = new Date(ms); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'; }
  function ics(kind, id) {
    var b = findBooking(kind, id), start = toMin(b.time), dur = b.durationMin || 30, what = whatOf(kind, b);
    var title = what.charAt(0).toUpperCase() + what.slice(1) + ' - ' + carOf(kind, b) + ' (' + dealerName() + ')';
    var desc = 'Confirmation code: ' + codeOf(b) + (kind === 'service' && b.notes ? '\nNotes: ' + b.notes : '') + '\nNeed to change it? Contact ' + dealerName() + '.';
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DealerDesk//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + icsEsc(b.id + '-' + codeOf(b)) + '@dealerdesk', 'DTSTAMP:' + icsStamp(clock()), 'DTSTART:' + icsStamp(stamp(b.date, b.time)), 'DTEND:' + icsStamp(stamp(b.date, b.time) + dur * 60000),
      'SUMMARY:' + icsEsc(title), 'DESCRIPTION:' + icsEsc(desc), 'LOCATION:' + icsEsc(dealerName()), 'STATUS:CONFIRMED',
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(title), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
    return lines.map(fold).join('\r\n') + '\r\n';
  }
  function icsHref(kind, id) { return safeHref('data:text/calendar;charset=utf-8,' + encodeURIComponent(ics(kind, id))); }
  function icsFileName(kind, id) { return 'dealerdesk-' + codeOf(findBooking(kind, id)).toLowerCase().replace(/[^a-z0-9-]/g, '') + '.ics'; }

  // ---------- staff lists ----------
  function setStaff(kind, names) { var k = kind === 'advisors' ? 'advisors' : 'salespeople'; state[k] = (names || []).map(function (n) { return clean(n, 40); }).filter(Boolean); save(); return state[k].slice(); }

  // ---------- export to DealerDesk schema ----------
  var TD_MAP = Object.assign(Object.create(null), { booked: 'requested', confirmed: 'confirmed', completed: 'completed', 'no-show': 'no_show', cancelled: 'cancelled' });
  var SV_MAP = Object.assign(Object.create(null), { scheduled: 'booked', 'checked-in': 'in_progress', 'in-progress': 'in_progress', ready: 'done', 'picked-up': 'done' });
  function toSchema() {
    function cust(x) { return { name: x.customer, phone: x.phone, email: x.email || '' }; }
    return {
      test_drives: state.testDrives.filter(function (t) { return t.carId; }).map(function (t) { return { id: t.id, customer: cust(t), car_id: t.carId, at: t.date + 'T' + t.time, status: TD_MAP[t.status], notes: (t.salesperson ? 'Salesperson: ' + t.salesperson + '. ' : '') + (t.notes || '') }; }),
      service_bookings: state.services.map(function (s) { return { id: s.id, customer: cust(s), vehicle: { year: s.vehicle.year, make: s.vehicle.make, model: s.vehicle.model, vin: s.vehicle.vin || '' }, service_type: s.type.replace('-', '_'), at: s.date + 'T' + s.time, status: SV_MAP[s.status], notes: ['Bay ' + s.bay, s.advisor ? 'Advisor: ' + s.advisor : '', s.vehicle.mileage ? s.vehicle.mileage + ' mi' : '', s.notes || ''].filter(Boolean).join('. ') }; })
    };
  }

  // =================== UI (staff) ===================
  var ui = { el: null, tab: 'drives', view: 'day', date: null, msg: '' };
  function fmtStamp(ms) { var d = new Date(ms); return niceDate(ymd(d)) + ' ' + niceTime(pad(d.getHours()) + ':' + pad(d.getMinutes())); }
  function today() { return ymd(new Date(clock())); }
  function opt(list, sel, labels) { return list.map(function (v) { return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(labels ? labels[v] : v) + '</option>'; }).join(''); }
  function chip(s) { return '<span class="ddb-chip ddb-s-' + esc(s) + '">' + esc(s.replace('-', ' ')) + '</span>'; }
  function detailsHTML(kind, b) {
    return '<details class="ddb-det"><summary>Details</summary><div class="ddb-detbody"><div>Code <b>' + esc(codeOf(b)) + '</b></div>' +
      (b.phone ? '<div>Phone ' + esc(b.phone) + '</div>' : '') + (b.email ? '<div>Email ' + esc(b.email) + '</div>' : '') +
      '<div>' + (b.remindedAt ? 'Reminded ' + esc(fmtStamp(b.remindedAt)) + (b.remindedVia && b.remindedVia !== 'manual' ? ' by ' + esc(b.remindedVia) : '') : 'Not reminded yet') + '</div>' +
      '<div class="ddb-actions"><a class="ddb-btn ddb-link" href="' + esc(icsHref(kind, b.id)) + '" download="' + esc(icsFileName(kind, b.id)) + '">Add to calendar</a></div></div></details>';
  }
  function renderReminders() {
    var s = state.settings, list = reminders(), html = '<section class="ddb-card ddb-rem"><h3>Reminders <small>next ' + s.reminderHours + ' hours</small></h3>' +
      '<p class="ddb-empty">Nothing is sent automatically. Tap Text or Email to open your phone\'s app with the message filled in.</p>';
    if (!list.length) return html + '<p class="ddb-empty">No reminders due. Everyone in the next ' + s.reminderHours + ' hours has been reminded.</p></section>';
    return html + list.map(function (r) {
      var b = r.b, m = reminderMessage(r.kind, r.id);
      return '<article class="ddb-item ddb-remitem" data-rem="' + esc(r.id) + '"><b>' + esc(niceDate(b.date) + ' ' + niceTime(b.time)) + '</b> ' + esc(b.customer) +
        '<small>' + esc(r.kind === 'service' ? (SV_TYPES[b.type] || 'Service') : 'Test drive') + ' &middot; ' + esc(carOf(r.kind, b)) + ' &middot; ' + esc(codeOf(b)) + '</small>' +
        '<div class="ddb-actions">' +
        (m.sms ? '<a class="ddb-btn ddb-primary ddb-link" data-remind="text" data-kind="' + r.kind + '" data-id="' + esc(r.id) + '" href="' + esc(m.sms) + '">Text reminder</a>' : '<span class="ddb-empty">No valid phone</span>') +
        (m.mailto ? '<a class="ddb-btn ddb-link" data-remind="email" data-kind="' + r.kind + '" data-id="' + esc(r.id) + '" href="' + esc(m.mailto) + '">Email reminder</a>' : '') +
        '<button type="button" class="ddb-btn" data-mark="' + esc(r.id) + '" data-kind="' + r.kind + '">Mark reminded</button>' +
        '<a class="ddb-btn ddb-link" href="' + esc(icsHref(r.kind, r.id)) + '" download="' + esc(icsFileName(r.kind, r.id)) + '">Add to calendar</a></div></article>';
    }).join('') + '</section>';
  }
  function renderDrives() {
    var d = ui.date, inv = vehicles(), html = '';
    html += '<form class="ddb-card ddb-form" data-form="td"><h3>New test drive</h3><div class="ddb-grid">' +
      '<label class="ddb-pick">Vehicle (search stock, VIN, make, model, year)<input name="vehicle" data-vsearch required autocomplete="off" placeholder="' + (inv.length ? inv.length + ' vehicles' : 'Stock # or VIN') + '"><div class="ddb-results" data-vresults role="listbox"></div></label>' +
      '<label>Customer<input name="customer" required></label><label>Phone<input name="phone" type="tel" required></label><label>Email<input name="email" type="email"></label>' +
      '<label>Salesperson' + (state.salespeople.length ? '<select name="salesperson"><option value="">Any</option>' + opt(state.salespeople) + '</select>' : '<input name="salesperson">') + '</label>' +
      '<label>Date<input name="date" type="date" value="' + esc(d) + '" required></label><label>Time<input name="time" type="time" step="900" required></label></div>' +
      '<button class="ddb-btn ddb-primary">Book test drive</button></form>';
    html += '<div class="ddb-seg"><button data-view="day" class="' + (ui.view === 'day' ? 'on' : '') + '">Day</button><button data-view="week" class="' + (ui.view === 'week' ? 'on' : '') + '">Week</button></div>';
    var days = ui.view === 'week' ? weekOf(d) : [d];
    html += '<div class="ddb-cal ddb-cal-' + ui.view + '">' + days.map(function (day) {
      var list = testDrivesOn(day);
      return '<section class="ddb-day' + (day === today() ? ' ddb-today' : '') + '"><h4>' + esc(day) + '</h4>' + (list.length ? list.map(function (t) {
        return '<article class="ddb-item ddb-s-' + t.status + '" data-id="' + t.id + '"><b>' + esc(t.time) + '</b> ' + esc(t.customer) + '<small>' + esc(t.vehicleLabel || t.stock || t.vin) + (t.salesperson ? ' &middot; ' + esc(t.salesperson) : '') + '</small>' + chip(t.status) +
          '<select data-td-status="' + t.id + '" aria-label="Status">' + opt(TD_STATUS, t.status) + '</select>' + detailsHTML('test-drive', t) + '</article>';
      }).join('') : '<p class="ddb-empty">No test drives</p>') + '</section>';
    }).join('') + '</div>';
    html += '<div class="ddb-card"><h3>Upcoming</h3>' + (upcoming(10).map(function (u) { return '<div class="ddb-row"><b>' + esc(u.date + ' ' + u.time) + '</b> ' + esc(u.customer) + ' <small>' + (u.kind === 'service' ? esc(SV_TYPES[u.type]) : 'Test drive') + '</small></div>'; }).join('') || '<p class="ddb-empty">Nothing upcoming</p>') + '</div>';
    return html;
  }
  function renderService() {
    var b = bayBoard(ui.date), html = '';
    html += '<form class="ddb-card ddb-form" data-form="sv"><h3>New service appointment</h3><div class="ddb-grid">' +
      '<label>Customer<input name="customer" required></label><label>Phone<input name="phone" type="tel" required></label><label>Email<input name="email" type="email"></label>' +
      '<label>Year<input name="year" inputmode="numeric"></label><label>Make<input name="make"></label><label>Model<input name="model"></label><label>VIN<input name="vin" maxlength="17"></label><label>Mileage<input name="mileage" inputmode="numeric"></label>' +
      '<label>Service<select name="type">' + opt(Object.keys(SV_TYPES), 'oil-change', SV_TYPES) + '</select></label>' +
      '<label>Advisor' + (state.advisors.length ? '<select name="advisor"><option value="">-</option>' + opt(state.advisors) + '</select>' : '<input name="advisor">') + '</label>' +
      '<label>Bay<select name="bay"><option value="">Auto</option>' + b.bays.map(function (x) { return '<option>' + x.bay + '</option>'; }).join('') + '</select></label>' +
      '<label>Duration (min)<input name="durationMin" type="number" min="10" max="600" placeholder="auto"></label>' +
      '<label>Date<input name="date" type="date" value="' + esc(ui.date) + '" required></label><label>Time<input name="time" type="time" step="900" required></label>' +
      '<label class="ddb-wide">Notes<textarea name="notes" rows="2"></textarea></label></div><button class="ddb-btn ddb-primary">Schedule</button></form>';
    html += '<h3 class="ddb-h">Bay board &middot; ' + esc(ui.date) + (b.open ? ' <small>' + b.hours.open + '-' + b.hours.close + '</small>' : ' <small>closed</small>') + '</h3><div class="ddb-bays">' +
      b.bays.map(function (x) {
        return '<section class="ddb-bay"><header>Bay ' + x.bay + '<span class="ddb-meter"><i style="width:' + x.pct + '%"></i></span><small>' + x.pct + '%</small></header>' + (x.jobs.map(function (j) {
          return '<article class="ddb-item ddb-s-' + j.status + '"><b>' + j.time + '</b> ' + esc(j.customer) + '<small>' + esc(SV_TYPES[j.type]) + ' &middot; ' + esc([j.vehicle.year, j.vehicle.make, j.vehicle.model].filter(Boolean).join(' ')) + ' &middot; ' + j.durationMin + 'm</small>' + chip(j.status) +
            (j.status !== 'picked-up' ? '<button class="ddb-btn ddb-sm" data-sv-next="' + j.id + '">Next: ' + esc(SV_STATUS[SV_STATUS.indexOf(j.status) + 1].replace('-', ' ')) + '</button>' : '') + detailsHTML('service', j) + '</article>';
        }).join('') || '<p class="ddb-empty">Free</p>') + '</section>';
      }).join('') + '</div>';
    return html;
  }
  function renderSettings() {
    var s = state.settings, tp = Object.assign(defaultTemplates(), s.templates || {});
    return '<form class="ddb-card ddb-form" data-form="settings"><h3>Business hours</h3><div class="ddb-hours">' + DAYS.map(function (d) {
      var h = s.hours[d]; return '<div class="ddb-hrow"><b>' + d.toUpperCase() + '</b><label class="ddb-inline"><input type="checkbox" name="open_' + d + '"' + (h ? ' checked' : '') + '> open</label><input type="time" name="from_' + d + '" value="' + (h ? h.open : '09:00') + '"><input type="time" name="to_' + d + '" value="' + (h ? h.close : '17:00') + '"></div>';
    }).join('') + '</div><h3>Booking rules</h3><div class="ddb-grid">' +
      '<label>Slot length (min)<input type="number" name="slotMin" value="' + s.slotMin + '"></label><label>Test drive length (min)<input type="number" name="testDriveMin" value="' + s.testDriveMin + '"></label>' +
      '<label>Service bays<input type="number" name="bays" value="' + s.bays + '"></label><label>Minimum notice (min)<input type="number" name="leadTimeMin" value="' + s.leadTimeMin + '"></label>' +
      '<label>Book up to (days ahead)<input type="number" name="maxDaysAhead" value="' + s.maxDaysAhead + '"></label><label class="ddb-inline"><input type="checkbox" name="publicRequests"' + (s.publicRequests ? ' checked' : '') + '> Accept online requests</label>' +
      '<label class="ddb-wide">Salespeople (comma separated)<input name="salespeople" value="' + esc(state.salespeople.join(', ')) + '"></label><label class="ddb-wide">Service advisors<input name="advisors" value="' + esc(state.advisors.join(', ')) + '"></label>' +
      '</div><h3>Reminders</h3><div class="ddb-grid">' +
      '<label>Reminder window<select name="reminderHours">' + [24, 48].map(function (h) { return '<option value="' + h + '"' + (s.reminderHours === h ? ' selected' : '') + '>Next ' + h + ' hours</option>'; }).join('') + '</select></label>' +
      '<label class="ddb-wide">Text message<textarea name="tpl_sms" rows="3" maxlength="480">' + esc(tp.sms) + '</textarea></label>' +
      '<label class="ddb-wide">Email subject<input name="tpl_emailSubject" maxlength="140" value="' + esc(tp.emailSubject) + '"></label>' +
      '<label class="ddb-wide">Email message<textarea name="tpl_emailBody" rows="6" maxlength="2000">' + esc(tp.emailBody) + '</textarea></label>' +
      '<p class="ddb-wide ddb-empty">Placeholders: ' + PLACEHOLDERS.map(function (x) { return '{' + x + '}'; }).join(' ') + '. Only https:// links are allowed.</p>' +
      '<label class="ddb-inline ddb-wide"><input type="checkbox" name="tpl_reset"> Reset messages to the defaults</label>' +
      '</div><button class="ddb-btn ddb-primary">Save settings</button></form>';
  }
  function renderHTML() {
    var n = newRequests().length, rc = reminders().length;
    return '<div class="ddb"><header class="ddb-top"><div class="ddb-tabs">' +
      [['drives', 'Test drives'], ['service', 'Service'], ['reminders', 'Reminders'], ['settings', 'Settings']].map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (ui.tab === t[0] ? 'on' : '') + '">' + t[1] + (t[0] === 'reminders' && rc ? ' <span class="ddb-count" data-rem-count>' + rc + '</span>' : '') + '</button>'; }).join('') +
      '</div><div class="ddb-datebar"><button data-shift="-1" aria-label="Previous">&lsaquo;</button><input type="date" data-date value="' + esc(ui.date) + '"><button data-shift="1" aria-label="Next">&rsaquo;</button><button data-today>Today</button></div>' +
      (n ? '<button class="ddb-badge" data-seen>' + n + ' new online request' + (n > 1 ? 's' : '') + '</button>' : '') + '</header>' +
      (ui.msg ? '<div class="ddb-msg" role="status">' + esc(ui.msg) + '</div>' : '') + (saveError ? '<div class="ddb-msg ddb-bad">' + esc(saveError) + '</div>' : '') +
      (ui.tab === 'drives' ? renderDrives() : ui.tab === 'service' ? renderService() : ui.tab === 'reminders' ? renderReminders() : renderSettings()) + '</div>';
  }
  function refresh() { if (!ui.el) return; ui.el.innerHTML = renderHTML(); var i = ui.el.querySelector('[data-vsearch]'); if (i) bindPicker(i, ui.el.querySelector('[data-vresults]')); }
  function formData(f) { var o = {}; Array.prototype.forEach.call(f.elements, function (e) { if (!e.name) return; o[e.name] = e.type === 'checkbox' ? e.checked : e.value; }); return o; }
  function onSubmit(ev) {
    var f = ev.target, kind = f.getAttribute('data-form'); if (!kind) return; ev.preventDefault(); var d = formData(f);
    try {
      if (kind === 'td') { addTestDrive(d); ui.msg = 'Test drive booked.'; }
      else if (kind === 'sv') { var s = addService({ customer: d.customer, phone: d.phone, email: d.email, advisor: d.advisor, notes: d.notes, type: d.type, bay: d.bay, durationMin: d.durationMin, date: d.date, time: d.time, vehicle: { year: d.year, make: d.make, model: d.model, vin: d.vin, mileage: d.mileage } }); ui.msg = 'Scheduled in bay ' + s.bay + '.'; }
      else {
        var h = {}; DAYS.forEach(function (x) { h[x] = d['open_' + x] ? { open: d['from_' + x], close: d['to_' + x] } : null; });
        updateSettings({ hours: h, slotMin: d.slotMin, testDriveMin: d.testDriveMin, bays: d.bays, leadTimeMin: d.leadTimeMin, maxDaysAhead: d.maxDaysAhead, publicRequests: d.publicRequests,
          reminderHours: d.reminderHours, templates: d.tpl_reset ? defaultTemplates() : { sms: d.tpl_sms, emailSubject: d.tpl_emailSubject, emailBody: d.tpl_emailBody } });
        setStaff('salespeople', d.salespeople.split(',')); setStaff('advisors', d.advisors.split(',')); ui.msg = 'Settings saved.';
      }
    } catch (e) { ui.msg = e.message; }
    refresh();
  }
  function onClick(ev) {
    var a = ev.target.closest ? ev.target.closest('a[data-remind]') : null;
    if (a && ui.el.contains(a)) { // let the sms:/mailto: link open, then mark reminded
      if (!safeHref(a.getAttribute('href') || '')) { ev.preventDefault(); return; }
      try { markReminded(a.getAttribute('data-kind'), a.getAttribute('data-id'), a.getAttribute('data-remind')); ui.msg = 'Marked as reminded.'; } catch (e) { ui.msg = e.message; }
      setTimeout(refresh, 0); return;
    }
    var t = ev.target.closest ? ev.target.closest('button') : null; if (!t || !ui.el.contains(t)) return;
    if (t.hasAttribute('data-mark')) { try { markReminded(t.getAttribute('data-kind'), t.getAttribute('data-mark'), 'manual'); ui.msg = 'Marked as reminded.'; } catch (e) { ui.msg = e.message; } refresh(); return; }
    ui.msg = '';
    if (t.dataset.tab) ui.tab = t.dataset.tab; else if (t.dataset.view) ui.view = t.dataset.view;
    else if (t.dataset.shift) { var d = parseDate(ui.date); d.setDate(d.getDate() + (+t.dataset.shift) * (ui.view === 'week' && ui.tab === 'drives' ? 7 : 1)); ui.date = ymd(d); }
    else if (t.hasAttribute('data-today')) ui.date = today(); else if (t.hasAttribute('data-seen')) markSeen();
    else if (t.dataset.svNext) { try { advanceService(t.dataset.svNext); } catch (e) { ui.msg = e.message; } }
    else return;
    refresh();
  }
  function onChange(ev) {
    var e = ev.target;
    if (e.hasAttribute('data-date') && parseDate(e.value)) { ui.date = e.value; refresh(); }
    else if (e.dataset && e.dataset.tdStatus) { try { setTDStatus(e.dataset.tdStatus, e.value); ui.msg = 'Status updated.'; } catch (x) { ui.msg = x.message; } refresh(); }
  }
  function pickerHTML(list) { return list.map(function (v) { return '<button type="button" role="option" data-vpick="' + esc(v.stock) + '"><b>' + esc(v.stock) + '</b> ' + esc(vLabel(v)) + '<small>' + esc(v.vin) + (v.status !== 'available' ? ' &middot; ' + esc(v.status) : '') + '</small></button>'; }).join(''); }
  // Wire a search input + results box (used by staff form and public page)
  function bindPicker(input, box, onPick) {
    var timer = null;
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { box.innerHTML = pickerHTML(searchVehicles(input.value, 8)); }, 80); });
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-vpick]'); if (!b) return; input.value = b.getAttribute('data-vpick'); box.innerHTML = ''; if (onPick) onPick(findVehicle(input.value)); });
  }
  function mount(el) {
    ui.el = el; ui.date = ui.date || today();
    el.addEventListener('submit', onSubmit); el.addEventListener('click', onClick); el.addEventListener('change', onChange);
    refresh(); return { refresh: refresh };
  }

  load();
  var api = {
    KEY: KEY, TD_STATUS: TD_STATUS, SV_STATUS: SV_STATUS, SV_TYPES: SV_TYPES,
    reload: load, settings: settings, updateSettings: updateSettings, setStaff: setStaff,
    setInventory: setInventory, toSchema: toSchema, vehicles: vehicles, findVehicle: findVehicle, searchVehicles: searchVehicles, bindPicker: bindPicker,
    addTestDrive: addTestDrive, updateTestDrive: updateTestDrive, setTestDriveStatus: setTDStatus, testDrivesOn: testDrivesOn, weekOf: weekOf, upcoming: upcoming,
    addService: addService, updateService: updateService, advanceService: advanceService, bayBoard: bayBoard,
    reminders: reminders, reminderMessage: reminderMessage, markReminded: markReminded, unmarkReminded: unmarkReminded, setDealerName: setDealerName,
    ics: ics, icsHref: icsHref, icsFileName: icsFileName, safeHref: safeHref, checkTemplate: checkTemplate, defaultTemplates: defaultTemplates, PLACEHOLDERS: PLACEHOLDERS,
    openSlots: openSlots, submitRequest: submitRequest, newRequests: newRequests, markSeen: markSeen,
    all: function () { return JSON.parse(JSON.stringify(state)); }, lastSaveError: function () { return saveError; },
    onChange: function (f) { listeners.push(f); }, mount: mount, renderHTML: renderHTML,
    _setClock: function (f) { clock = f || function () { return Date.now(); }; }, _ui: ui
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DDBooking = api;
})(typeof window !== 'undefined' ? window : globalThis);
