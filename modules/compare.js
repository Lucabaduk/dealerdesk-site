/* DealerDesk compare: 2-4 cars side by side, differences flagged. Pure data; compare-page.js renders. */
(function (root) {
  'use strict';
  var MIN = 2, MAX = 4, VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
  function cv(v) { return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function parseVins(search) {
    var m = /[?&]vins=([^&#]*)/.exec(String(search || '')), raw = ''; if (m) { raw = m[1].replace(/\+/g, ' '); try { raw = decodeURIComponent(raw); } catch (e) { raw = raw.replace(/%2C/gi, ','); } }
    var out = []; raw.split(/[,\s]+/).forEach(function (v) { v = cv(v); if (VIN_RE.test(v) && out.indexOf(v) < 0 && out.length < MAX) out.push(v); }); return out;
  }
  function shareUrl(base, vins) { return String(base || '').replace(/[?#].*$/, '').replace(/[^/]*$/, '') + 'compare.html?vins=' + vins.map(cv).filter(function (v) { return VIN_RE.test(v); }).slice(0, MAX).join(','); }
  function money(n) { return n == null ? '' : '$' + Math.round(n).toLocaleString('en-US'); }
  function int(n) { return n == null || n === '' ? '' : Number(n).toLocaleString('en-US'); }
  function price(c) { return c.price != null ? +c.price : c.price_cents != null ? c.price_cents / 100 : null; }
  function first(c, keys) { for (var i = 0; i < keys.length; i++) { var v = c[keys[i]]; if (v != null && v !== '') return v; } return null; }
  function economy(c) {
    var r = first(c, ['range_miles', 'range_mi']); if (r != null) return { text: int(r) + ' mi range (EV)', n: null };
    var city = first(c, ['mpg_city']), hwy = first(c, ['mpg_highway', 'mpg_hwy']), comb = first(c, ['mpg_combined', 'mpg']), e = first(c, ['mpge']);
    if (city != null && hwy != null) return { text: city + ' city / ' + hwy + ' hwy MPG', n: (+city + +hwy) / 2 };
    if (comb != null || e != null) return { text: [comb != null ? comb + ' MPG' : '', e != null ? e + ' MPGe' : ''].filter(Boolean).join(' · '), n: comb != null ? +comb : null };
    if (c.fuel_type) return { text: 'Not EPA-rated (' + c.fuel_type + ')', n: null };
    return { text: '', n: null };
  }
  // row: label, value(car) -> {text, n?}, better: 'low'|'high'|null for "best" mark
  var ROWS = [
    ['Price', function (c) { var p = price(c); return { text: money(p), n: p }; }, 'low'],
    ['Year', function (c) { return { text: c.year == null ? '' : String(c.year), n: c.year }; }, 'high'],
    ['Mileage', function (c) { return { text: c.mileage == null ? '' : int(c.mileage) + ' mi', n: c.mileage }; }, 'low'],
    ['Body', function (c) { return { text: String(first(c, ['body_type', 'body']) || '') }; }],
    ['Engine', function (c) { return { text: String(first(c, ['engine']) || '') }; }],
    ['Horsepower', function (c) { var h = first(c, ['horsepower', 'hp']); return { text: h == null ? '' : int(h) + ' hp', n: h == null ? null : +h }; }, 'high'],
    ['MPG / range', economy, 'high'],
    ['Fuel', function (c) { return { text: String(c.fuel_type || '') }; }],
    ['Seats', function (c) { var s = first(c, ['seats', 'seating']); return { text: s == null ? '' : String(s), n: s == null ? null : +s }; }],
    ['Drivetrain', function (c) { return { text: String(first(c, ['drivetrain']) || '') }; }],
    ['Transmission', function (c) { return { text: String(first(c, ['transmission']) || '') }; }],
    ['Color', function (c) { return { text: String(c.color || '') }; }],
    ['Condition', function (c) { return { text: c.condition ? c.condition[0].toUpperCase() + c.condition.slice(1) : '' }; }],
    ['Status', function (c) { return { text: String(c.status || '') }; }]
  ];
  function build(cars) {
    cars = (cars || []).filter(Boolean).slice(0, MAX);
    if (cars.length < MIN) return { ok: false, error: 'need_' + MIN, cars: cars };
    var rows = ROWS.map(function (r) {
      var cells = cars.map(function (c) { var v = r[1](c); return { text: v.text || '\u2014', n: v.n == null || !isFinite(v.n) ? null : +v.n, missing: !v.text }; });
      var known = cells.filter(function (x) { return !x.missing; }).map(function (x) { return x.text; });
      var differs = known.length > 1 && known.some(function (t) { return t !== known[0]; });
      var better = r[2] || cells[0].better || null;
      if (differs && better) { var ns = cells.map(function (x) { return x.n; }).filter(function (n) { return n != null; });
        if (ns.length > 1) { var best = better === 'low' ? Math.min.apply(null, ns) : Math.max.apply(null, ns); cells.forEach(function (x) { x.best = x.n === best; }); } }
      return { label: r[0], cells: cells, differs: differs };
    });
    // features: union, mark which car has each
    var all = []; cars.forEach(function (c) { (c.features || []).forEach(function (f) { if (all.indexOf(f) < 0) all.push(f); }); });
    var features = all.sort().map(function (f) { var has = cars.map(function (c) { return (c.features || []).indexOf(f) >= 0; }); return { name: f, has: has, differs: has.some(function (h) { return h !== has[0]; }) }; });
    return { ok: true, cars: cars.map(function (c) { return { vin: c.vin, id: c.id, title: [c.year, c.make, c.model, c.trim].filter(Boolean).join(' '), photo: (c.photos || [])[0] || '' }; }), rows: rows, features: features };
  }
  var mod = { build: build, parseVins: parseVins, shareUrl: shareUrl, MIN: MIN, MAX: MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod; else root.DDCompare = mod;
})(typeof self !== 'undefined' ? self : this);
