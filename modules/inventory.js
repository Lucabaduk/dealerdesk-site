/* DealerDesk inventory module — matches Grok Master Helper's car schema (/workspace/dealership/SCHEMA.md).
 * Stored shape = schema INPUT shape (price in dollars); toSchema() gives price_cents via DealerDeskSchema when loaded.
 * Built for 5,000+ cars on a phone: value indexes, precomputed search text, cached sort orders, paging (24/page). */
(function (root) {
  'use strict';
  var S = (typeof module !== 'undefined' && module.exports) ? require('./store.js') : root.DDStore;
  var KEY = 'dealerdesk.inventory.v2';
  var STATUSES = ['available', 'hold', 'sold'], CONDITIONS = ['new', 'used'];
  var VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/, ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  var INDEXED = ['make', 'model', 'color', 'status', 'condition', 'year'];
  function cleanVin(v) { return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function num(v, min, max, int) { if (v === '' || v == null) return null; var n = Number(String(v).replace(/[$,\s]/g, '')); if (!isFinite(n) || n < min || n > max) return null; return int ? Math.round(n) : Math.round(n * 100) / 100; }
  // Same rules as schema.js safeUrl: https URLs or relative image paths only.
  function safeUrl(v) {
    if (typeof v !== 'string') return ''; var u = v.trim();
    if (!u || u.length > 500 || /[\s"'<>\\`]/.test(u) || u.indexOf('..') >= 0) return '';
    if (/^https:\/\/[A-Za-z0-9.-]+(\/[A-Za-z0-9_\/.%~+-]*)?(\?[A-Za-z0-9_=&.%-]*)?$/.test(u)) return u;
    if (/^(\.\/)?[A-Za-z0-9_-][A-Za-z0-9_\/.-]*\.(webp|jpe?g|png|avif)$/i.test(u)) return u;
    return '';
  }
  function list(v, max, itemMax) { var out = [], seen = {}; (Array.isArray(v) ? v : []).forEach(function (x) { var t = S.cleanText(x, itemMax); if (t && !seen[t.toLowerCase()] && out.length < max) { seen[t.toLowerCase()] = 1; out.push(t); } }); return out; }
  function normalize(input, now) {
    input = input || {}; var errors = [];
    var vin = cleanVin(input.vin); if (!VIN_RE.test(vin)) errors.push('vin');
    var id = input.id == null || input.id === '' ? 'car-' + vin.toLowerCase() : String(input.id); if (!ID_RE.test(id)) errors.push('id');
    var stock = S.cleanText(input.stock_no, 20) || ('S' + vin.slice(-6));
    var year = num(input.year, 1900, new Date(now || Date.now()).getFullYear() + 2, true); if (year == null) errors.push('year');
    var make = S.cleanText(input.make, 40); if (!make) errors.push('make');
    var model = S.cleanText(input.model, 60); if (!model) errors.push('model');
    var price = input.price == null && input.price_cents != null ? num(input.price_cents / 100, 0, 1e7) : num(input.price, 0, 1e7); if (price == null) errors.push('price');
    var mileage = input.mileage === '' || input.mileage == null ? 0 : num(input.mileage, 0, 2000000, true); if (mileage == null) errors.push('mileage');
    var status = String(input.status || 'available').toLowerCase(); if (STATUSES.indexOf(status) < 0) errors.push('status');
    var condition = String(input.condition || (mileage < 500 ? 'new' : 'used')).toLowerCase(); if (CONDITIONS.indexOf(condition) < 0) errors.push('condition');
    if (errors.length) return { ok: false, errors: errors };
    var r0 = { id: id, stock_no: stock, vin: vin, year: year, make: make, model: model, trim: S.cleanText(input.trim, 60), price: price, mileage: mileage,
      color: S.cleanText(input.color, 30), condition: condition, status: status,
      photos: (Array.isArray(input.photos) ? input.photos : []).map(safeUrl).filter(Boolean).slice(0, 30), features: list(input.features, 40, 60) };
    // optional spec fields (kept only when present & valid) for detail/compare pages
    var car = r0; ['body', 'engine', 'transmission', 'drivetrain'].forEach(function (k) { var t = S.cleanText(input[k] != null ? input[k] : (k === 'body' ? input.body_type : null), 60); if (t) car[k] = t; });
    [['hp', 1, 2500], ['seats', 1, 15], ['mpg_city', 1, 200], ['mpg_hwy', 1, 200], ['range_mi', 1, 1500]].forEach(function (d) { if (input[d[0]] != null && input[d[0]] !== '') { var n = num(input[d[0]], d[1], d[2], true); if (n != null) car[d[0]] = n; } });
    return { ok: true, car: car };
  }
  function create(opts) {
    opts = opts || {}; var store = opts.storage || S.defaultStorage(), clock = opts.now || Date.now, persist = opts.persist !== false;
    var cars = [], byVin = {}, byId = {}, idx = {}, hay = [], sortCache = {};
    function rebuild() {
      byVin = {}; byId = {}; idx = {}; hay = new Array(cars.length); sortCache = {};
      INDEXED.forEach(function (f) { idx[f] = {}; });
      for (var i = 0; i < cars.length; i++) { var c = cars[i]; byVin[c.vin] = i; byId[c.id] = i;
        INDEXED.forEach(function (f) { var k = String(c[f]).toLowerCase(); (idx[f][k] || (idx[f][k] = [])).push(i); });
        hay[i] = [c.vin, c.stock_no, c.year, c.make, c.model, c.trim, c.color, c.features.join(' ')].join(' ').toLowerCase(); }
    }
    function save() { if (!persist) return true; try { store.setItem(KEY, JSON.stringify(cars)); return true; } catch (e) { /* quota: keep in memory, drop stale copy so a reload doesn't show old data */ try { store.removeItem(KEY); } catch (e2) {} return false; } }
    function ingest(listIn) { var out = [], seen = {}, skipped = 0; (listIn || []).slice(0, 20000).forEach(function (c) { var r = normalize(c, clock()); if (!r.ok || seen[r.car.vin] || seen['#' + r.car.id]) { skipped++; return; } seen[r.car.vin] = seen['#' + r.car.id] = 1; out.push(r.car); }); return { cars: out, skipped: skipped }; }
    try { var raw = JSON.parse(store.getItem(KEY) || 'null'); if (Array.isArray(raw)) cars = ingest(raw).cars; } catch (e) { cars = []; }
    rebuild();
    function copy(c) { return c ? JSON.parse(JSON.stringify(c)) : null; }
    function at(vinOrId) { var v = cleanVin(vinOrId); var i = byVin[v]; if (i == null) i = byId[String(vinOrId)]; return i == null ? -1 : i; }
    function order(field, dir) {
      var k = field + ':' + dir; if (sortCache[k]) return sortCache[k];
      var o = cars.map(function (_, i) { return i; }), d = dir === 'desc' ? -1 : 1;
      o.sort(function (a, b) { var x = cars[a][field], y = cars[b][field]; var r = typeof x === 'string' ? x.localeCompare(y) : x - y; return d * r || (a - b); });
      return (sortCache[k] = o);
    }
    var api = {
      STATUSES: STATUSES.slice(), size: function () { return cars.length; },
      /** Replace inventory from Helper's data file ({cars:[...]} or [...]); keeps nothing old. */
      load: function (data) { var l = Array.isArray(data) ? data : (data && data.cars); if (!Array.isArray(l)) return { ok: false, errors: ['bad_format'] }; var r = ingest(l); cars = r.cars; rebuild(); var saved = save(); return { ok: true, count: cars.length, skipped: r.skipped, saved: saved }; },
      list: function () { return cars.map(copy); },
      get: function (vinOrId) { var i = at(vinOrId); return i < 0 ? null : copy(cars[i]); },
      add: function (input) { var r = normalize(input, clock()); if (!r.ok) return r; if (byVin[r.car.vin] != null || byId[r.car.id] != null) return { ok: false, errors: ['duplicate'] };
        cars.push(r.car); rebuild(); save(); return { ok: true, car: copy(r.car) }; },
      update: function (vinOrId, patch) { var i = at(vinOrId); if (i < 0) return { ok: false, errors: ['not_found'] };
        var r = normalize(Object.assign({}, cars[i], patch || {}, { vin: cars[i].vin, id: cars[i].id }), clock()); if (!r.ok) return r;
        cars[i] = r.car; rebuild(); save(); return { ok: true, car: copy(r.car) }; },
      setStatus: function (v, s) { return api.update(v, { status: s }); },
      remove: function (vinOrId) { var i = at(vinOrId); if (i < 0) return false; cars.splice(i, 1); rebuild(); save(); return true; },
      /** values for filter dropdowns, e.g. facets('make') or facets('model', {make:'Velora'}) */
      facets: function (field, within) { if (INDEXED.indexOf(field) < 0) return []; var res = {};
        (within ? api.query(Object.assign({}, within, { pageSize: 1e9 })).items : cars).forEach(function (c) { res[c[field]] = (res[c[field]] || 0) + 1; });
        return Object.keys(res).sort().map(function (k) { return { value: field === 'year' ? +k : k, count: res[k] }; }); },
      /** q: {text, make, model, color, status, condition, year, minYear, maxYear, minPrice, maxPrice, maxMileage, minMileage, sort, dir, page (1-based), pageSize (24)} */
      query: function (q) {
        q = q || {}; var cand = null;
        INDEXED.forEach(function (f) { if (q[f] == null || q[f] === '') return; var vals = Array.isArray(q[f]) ? q[f] : [q[f]], set = [];
          vals.forEach(function (v) { set = set.concat(idx[f][String(v).toLowerCase()] || []); });
          var m = {}; set.forEach(function (i) { m[i] = 1; }); cand = cand ? cand.filter(function (i) { return m[i]; }) : set; });
        var words = S.cleanText(q.text, 100).toLowerCase().split(' ').filter(Boolean);
        var lo = { year: q.minYear, price: q.minPrice, mileage: q.minMileage }, hi = { year: q.maxYear, price: q.maxPrice, mileage: q.maxMileage };
        function pass(i) { var c = cars[i];
          for (var f in lo) { if (lo[f] != null && lo[f] !== '' && c[f] < +lo[f]) return false; if (hi[f] != null && hi[f] !== '' && c[f] > +hi[f]) return false; }
          for (var w = 0; w < words.length; w++) if (hay[i].indexOf(words[w]) < 0) return false; return true; }
        var sorts = { price: 'price', year: 'year', mileage: 'mileage', make: 'make', model: 'model', stock: 'stock_no' };
        var ids;
        if (sorts[q.sort]) { var keep = null; if (cand) { keep = new Uint8Array(cars.length); cand.forEach(function (i) { keep[i] = 1; }); }
          ids = order(sorts[q.sort], q.dir).filter(function (i) { return (!keep || keep[i]) && pass(i); }); }
        else ids = (cand ? cand.slice().sort(function (a, b) { return a - b; }) : cars.map(function (_, i) { return i; })).filter(pass);
        var size = Math.max(1, Math.min(+q.pageSize || 24, 1e9)), pages = Math.max(1, Math.ceil(ids.length / size)), page = Math.min(Math.max(1, +q.page || 1), pages);
        return { total: ids.length, page: page, pages: pages, pageSize: size, items: ids.slice((page - 1) * size, page * size).map(function (i) { return copy(cars[i]); }) };
      },
      exportJSON: function () { return JSON.stringify({ type: 'dealerdesk-inventory', version: 2, exportedAt: new Date(clock()).toISOString(), cars: cars }); },
      importJSON: function (text, mode) {
        var data; try { data = JSON.parse(text); } catch (e) { return { ok: false, errors: ['bad_json'] }; }
        var l = Array.isArray(data) ? data : (data && Array.isArray(data.cars) ? data.cars : null); if (!l) return { ok: false, errors: ['bad_format'] };
        if (mode === 'replace') return api.load(l);
        var added = 0, updated = 0, skipped = 0;
        l.slice(0, 20000).forEach(function (c) { var r = normalize(c, clock()); if (!r.ok) { skipped++; return; } var i = byVin[r.car.vin];
          if (i != null) { r.car.id = cars[i].id; cars[i] = r.car; updated++; } else if (byId[r.car.id] != null) skipped++; else { cars.push(r.car); byVin[r.car.vin] = cars.length - 1; byId[r.car.id] = cars.length - 1; added++; } });
        rebuild(); save(); return { ok: true, added: added, updated: updated, skipped: skipped };
      },
      toSchema: function (vinOrId) { var c = api.get(vinOrId); var Sc = root.DealerDeskSchema || (typeof require === 'function' ? tryReq() : null); return c && Sc ? Sc.normalizeCar(c) : c; },
      carUrl: function (base, vin) { return String(base || '').replace(/[?#].*$/, '').replace(/[^/]*$/, '') + 'car.html?vin=' + encodeURIComponent(cleanVin(vin)); }
    };
    function tryReq() { try { return require('../src/schema.js'); } catch (e) { return null; } }
    return api;
  }
  var mod = { create: create, normalize: normalize, cleanVin: cleanVin, isValidVin: function (v) { return VIN_RE.test(cleanVin(v)); }, safeUrl: safeUrl, KEY: KEY, STATUSES: STATUSES };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod; else root.DDInventory = mod;
})(typeof self !== 'undefined' ? self : this);
