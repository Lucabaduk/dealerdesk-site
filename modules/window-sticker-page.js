/* window-sticker.html?vin=... | ?vins=a,b | ?batch=1 */
(function () {
  'use strict';
  var out = document.getElementById('stickers'), msg = document.getElementById('msg'), parsed = DDSticker.parseVins(location.search), vins = parsed.vins;
  function say(t) { msg.textContent = t; msg.hidden = !t; }
  if (!vins.length) { say('No valid VIN. Open this page from a car (window-sticker.html?vin=…).'); return; }
  var inv = DDInventory.create({ persist: false }), local = DDInventory.create();
  function go() { var cars = [], missing = 0; vins.forEach(function (v) { var c = inv.get(v) || local.get(v); if (c) cars.push(c); else missing++; });
    var r = DDSticker.render(out, cars, { baseUrl: location.href, dealer: DDSticker.dealerName() });
    document.getElementById('count').textContent = r.count === 1 ? '1 sticker' : r.count + ' stickers';
    var capped = parsed.total > vins.length ? 'Showing the first ' + vins.length + ' of ' + parsed.total + ' (max ' + DDSticker.MAX_BATCH + ' per print). ' : '';
    say(capped + (missing ? (missing === 1 ? '1 car not found' : missing + ' cars not found') : (r.count ? '' : 'No stickers to print.')));
    fit();
    document.body.setAttribute('data-ready', '1');
    if (/[?&]print=1/.test(location.search) && r.count) setTimeout(function () { window.print(); }, 300); }
  // stickers are fixed 8.5in (Letter); on narrow screens zoom them down so the page never scrolls sideways (print CSS resets zoom)
  function fit() { var w = Math.min(1, (document.documentElement.clientWidth - 32) / 816); out.style.zoom = w < 1 ? String(Math.max(0.2, w)) : ''; }
  window.addEventListener('resize', fit);
  document.getElementById('print').addEventListener('click', function () { window.print(); });
  fetch('data/cars.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) { inv.load(d); }).catch(function () {}).then(go);
})();
