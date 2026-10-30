/* DealerDesk window sticker (Monroney-style dealer sticker, US Letter portrait). Uses DDQR (our qr.js), DDInventory, DDStore.
 * All text goes in via textContent. Pure stickerData() is exported for tests. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var I = node ? require('./inventory.js') : root.DDInventory, Q = node ? require('./qr.js') : root.DDQR, S = node ? require('./store.js') : root.DDStore;
  var MAX_BATCH = 500, BATCH_KEY = 'dealerdesk.sticker.batch';
  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function get(o, k) { return has(o, k) ? o[k] : null; }
  function num(v) { return v == null || v === '' || !isFinite(+v) ? null : +v; }
  function money(n) { return n == null ? '' : '$' + Math.round(n).toLocaleString('en-US'); }
  function cap(s) { s = String(s || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function economy(c) {
    var city = num(get(c, 'mpg_city')), hwy = num(get(c, 'mpg_highway')) != null ? num(get(c, 'mpg_highway')) : num(get(c, 'mpg_hwy')), comb = num(get(c, 'mpg_combined')), e = num(get(c, 'mpge')), r = num(get(c, 'range_miles')) != null ? num(get(c, 'range_miles')) : num(get(c, 'range_mi'));
    if (r != null) return { kind: 'ev', big: r + ' mi', label: 'EPA est. range', small: e != null ? e + ' MPGe' : '' };
    if (city != null && hwy != null) return { kind: 'mpg', big: city + ' / ' + hwy, label: 'MPG city / highway', small: comb != null ? comb + ' combined' : '' };
    if (comb != null || e != null) return { kind: 'phev', big: comb != null ? comb + ' MPG' : e + ' MPGe', label: comb != null ? 'Combined (gas)' : 'Electric', small: comb != null && e != null ? e + ' MPGe on electricity' : '' };
    return { kind: 'none', big: 'Not EPA-rated', label: 'Fuel economy', small: get(c, 'fuel_type') ? cap(get(c, 'fuel_type')) + ' \u00b7 heavy-duty vehicles are not EPA-rated' : '' };
  }
  function dealerName(store) { try { var st = JSON.parse((store || S.defaultStorage()).getItem('dealerdesk.v2') || 'null'); var n = S.cleanText(get(get(st, 'settings'), 'dealer_name'), 80); return n || 'DealerDesk'; } catch (e) { return 'DealerDesk'; } }
  /** pure: everything the sticker shows, as plain strings */
  function stickerData(car, opts) {
    opts = opts || {}; var vin = I.cleanVin(get(car, 'vin'));
    if (!car || !I.isValidVin(vin)) return { ok: false, error: 'bad_vin' };
    var price = num(get(car, 'price')) != null ? num(get(car, 'price')) : (num(get(car, 'price_cents')) != null ? num(get(car, 'price_cents')) / 100 : null);
    var base = String(opts.baseUrl || '').replace(/[?#].*$/, '').replace(/[^/]*$/, '');
    var url = base + 'car.html?vin=' + encodeURIComponent(vin) + '&src=sticker', svg = '', qrError = '';
    try { svg = Q.toSVG(url, { scale: 8, margin: 4 }); } catch (e) { qrError = 'QR link too long'; }
    var photos = (Array.isArray(get(car, 'photos')) ? car.photos : []).map(I.safeUrl).filter(Boolean);
    var t = function (k, max) { return S.cleanText(get(car, k), max || 80); };
    var specs = [['Engine', t('engine')], ['Transmission', t('transmission')], ['Drivetrain', t('drivetrain')],
      ['Horsepower', num(get(car, 'horsepower')) != null ? num(get(car, 'horsepower')) + ' hp' : (num(get(car, 'hp')) != null ? num(get(car, 'hp')) + ' hp' : '')],
      ['Fuel', cap(t('fuel_type'))], ['Body', cap(t('body_type') || t('body'))], ['Seats', num(get(car, 'seats')) != null ? String(num(get(car, 'seats'))) : ''],
      ['Doors', num(get(car, 'doors')) != null ? String(num(get(car, 'doors'))) : ''], ['Exterior', t('color')], ['Interior', t('interior_color')],
      ['Mileage', num(get(car, 'mileage')) != null ? Math.round(num(get(car, 'mileage'))).toLocaleString('en-US') + ' mi' : ''], ['Condition', cap(t('condition'))]
    ].filter(function (r) { return r[1]; }).map(function (r) { return { label: r[0], value: r[1] }; });
    return { ok: true, vin: vin, title: [get(car, 'year'), t('make'), t('model')].filter(Boolean).join(' '), trim: t('trim'), price: money(price), stock: t('stock_no', 20),
      photo: photos[0] || '', specs: specs, economy: economy(car), features: (Array.isArray(get(car, 'features')) ? car.features : []).map(function (f) { return S.cleanText(f, 60); }).filter(Boolean).slice(0, 40),
      description: t('description', 900), url: url, svg: svg, qrError: qrError, dealer: S.cleanText(opts.dealer, 80) || 'DealerDesk', status: t('status') };
  }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function sticker(d) {
    var s = el('article', 'ws'); s.setAttribute('data-vin', d.vin);
    var hd = el('header', 'ws-head'); hd.appendChild(el('div', 'ws-dealer', d.dealer)); var h = el('h1', 'ws-title', d.title); hd.appendChild(h); if (d.trim) hd.appendChild(el('div', 'ws-trim', d.trim)); s.appendChild(hd);
    var top = el('section', 'ws-top'), ph = el('div', 'ws-photo');
    if (d.photo) { var img = el('img'); img.alt = d.title; S.setImg(img, d.photo); ph.appendChild(img); } else { var im2 = el('img'); im2.alt = 'Photo coming soon'; im2.src = S.NOPHOTO; ph.appendChild(im2); }
    top.appendChild(ph); var pr = el('div', 'ws-pricebox'); pr.appendChild(el('div', 'ws-plabel', 'Our price')); pr.appendChild(el('div', 'ws-price', d.price || 'Call for price'));
    var ids = el('dl', 'ws-ids'); [['VIN', d.vin], ['Stock #', d.stock]].forEach(function (r) { if (!r[1]) return; ids.appendChild(el('dt', '', r[0])); ids.appendChild(el('dd', r[0] === 'VIN' ? 'mono' : '', r[1])); }); pr.appendChild(ids);
    var ec = el('div', 'ws-econ ' + d.economy.kind); ec.appendChild(el('div', 'ws-elabel', d.economy.label)); ec.appendChild(el('div', 'ws-ebig', d.economy.big)); if (d.economy.small) ec.appendChild(el('div', 'ws-esmall', d.economy.small)); pr.appendChild(ec);
    top.appendChild(pr); s.appendChild(top);
    var mid = el('section', 'ws-mid'), sp = el('div', 'ws-specs'); sp.appendChild(el('h2', '', 'Specifications')); var dl = el('dl');
    d.specs.forEach(function (r) { dl.appendChild(el('dt', '', r.label)); dl.appendChild(el('dd', '', r.value)); }); sp.appendChild(dl); mid.appendChild(sp);
    var ft = el('div', 'ws-feat'); ft.appendChild(el('h2', '', 'Features')); var ul = el('ul'); d.features.forEach(function (f) { ul.appendChild(el('li', '', f)); }); if (!d.features.length) ul.appendChild(el('li', 'muted', 'Ask us about this vehicle')); ft.appendChild(ul); mid.appendChild(ft); s.appendChild(mid);
    if (d.description) s.appendChild(el('p', 'ws-desc', d.description));
    var bot = el('footer', 'ws-foot'), qr = el('div', 'ws-qr');
    if (d.svg) { var q = el('img'); q.alt = 'QR code: scan for details and a test drive'; q.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(d.svg); qr.appendChild(q); } else qr.appendChild(el('div', 'muted', d.qrError));
    bot.appendChild(qr); var cta = el('div', 'ws-cta'); cta.appendChild(el('div', 'ws-scan', 'Scan for photos, a test drive or your best price')); cta.appendChild(el('div', 'ws-dealer2', d.dealer)); bot.appendChild(cta); s.appendChild(bot);
    return s;
  }
  /** render stickers for cars into container; returns {count, bad} */
  function render(container, cars, opts) { container.textContent = ''; var count = 0, bad = 0;
    (cars || []).slice(0, MAX_BATCH).forEach(function (c) { var d = stickerData(c, opts); if (!d.ok) { bad++; return; } container.appendChild(sticker(d)); count++; });
    return { count: count, bad: bad }; }
  /** where staff buttons go: single VIN or a batch stashed in sessionStorage (filtered lists can be thousands long) */
  function urlFor(vin) { var v = I.cleanVin(vin); return I.isValidVin(v) ? 'window-sticker.html?vin=' + v : ''; }
  function batchUrl(vins, session) { var list = []; var seen = Object.create(null); (vins || []).forEach(function (v) { v = I.cleanVin(v); if (I.isValidVin(v) && !seen[v] && list.length < MAX_BATCH) { seen[v] = 1; list.push(v); } });
    try { (session || root.sessionStorage).setItem(BATCH_KEY, JSON.stringify(list)); } catch (e) { return list.length <= 30 ? 'window-sticker.html?vins=' + list.join(',') : ''; } return 'window-sticker.html?batch=1'; }
  function vinsFromUrl(search, session) { var p = new URLSearchParams(String(search || '')), out = [];
    if (p.get('vin')) out = [p.get('vin')]; else if (p.get('vins')) out = String(p.get('vins')).split(','); else if (p.get('batch')) { try { var a = JSON.parse((session || root.sessionStorage).getItem(BATCH_KEY) || '[]'); if (Array.isArray(a)) out = a; } catch (e) {} }
    var seen = Object.create(null); return out.map(function (v) { return I.cleanVin(v); }).filter(function (v) { if (!I.isValidVin(v) || seen[v]) return false; seen[v] = 1; return true; }).slice(0, MAX_BATCH); }
  var api = { stickerData: stickerData, economy: economy, dealerName: dealerName, render: render, urlFor: urlFor, batchUrl: batchUrl, vinsFromUrl: vinsFromUrl, MAX_BATCH: MAX_BATCH, BATCH_KEY: BATCH_KEY };
  if (node) module.exports = api; else root.DDSticker = api;
})(typeof self !== 'undefined' ? self : this);
