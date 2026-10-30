/* compare.html?vins=a,b,c — renders DDCompare.build() with textContent only. */
(function () {
  'use strict';
  var out = document.getElementById('out'), vins = DDCompare.parseVins(location.search);
  function el(t, cls, txt) { var e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function msg(t) { out.textContent = ''; out.appendChild(el('p', 'msg', t)); }
  if (!vins.length) { var fav = DDFavorites.create(); vins = fav.list().slice(-DDCompare.MAX); }
  function setUrl() { history.replaceState(null, '', DDCompare.shareUrl(location.href, vins)); }
  function render(byVin) {
    var cars = vins.map(function (v) { return byVin(v); }).filter(Boolean), r = DDCompare.build(cars);
    if (!r.ok) { msg('Pick at least 2 cars to compare (up to 4). Tap the heart on cars you like, then open Compare.'); return; }
    var t = el('table'), th = el('thead'), hr = el('tr'); hr.appendChild(el('th', 'row', ''));
    r.cars.forEach(function (c) { var td = el('td'), a = el('a'); a.href = 'car.html?vin=' + encodeURIComponent(c.vin);
      var img = el('img'); img.src = c.photo || 'assets/site/no-photo.webp'; img.alt = c.title; img.loading = 'lazy'; a.appendChild(img); a.appendChild(el('div', '', c.title));
      var x = el('button', 'x', 'Remove'); x.type = 'button'; x.addEventListener('click', function () { vins = vins.filter(function (v) { return v !== c.vin; }); setUrl(); render(byVin); });
      td.appendChild(a); td.appendChild(x); hr.appendChild(td); });
    th.appendChild(hr); t.appendChild(th); var tb = el('tbody');
    r.rows.forEach(function (row) { var tr = el('tr', row.differs ? 'diff' : 'same'); tr.appendChild(el('th', 'row', row.label));
      row.cells.forEach(function (c) { tr.appendChild(el('td', (c.best ? 'best' : '') + (c.missing ? ' miss' : ''), c.text + (c.best ? ' \u2713' : ''))); }); tb.appendChild(tr); });
    if (r.features.length) { var fr = el('tr', 'same'); fr.appendChild(el('th', 'row', 'Features')); r.cars.forEach(function () { fr.appendChild(el('td')); }); tb.appendChild(fr);
      r.features.forEach(function (f) { var tr = el('tr', f.differs ? 'diff' : 'same'); tr.appendChild(el('th', 'row', f.name));
        f.has.forEach(function (h) { var td = el('td', h ? '' : 'miss', h ? '\u2713 Yes' : '\u2014'); tr.appendChild(td); }); tb.appendChild(tr); }); }
    t.appendChild(tb); out.textContent = ''; out.appendChild(t);
  }
  var only = document.getElementById('only'); only.addEventListener('change', function () { out.classList.toggle('hide-same', only.checked); });
  document.getElementById('share').addEventListener('click', function () { var u = DDCompare.shareUrl(location.href, vins);
    if (navigator.share) navigator.share({ title: 'Compare cars', url: u }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { document.getElementById('share').textContent = 'Link copied'; }); });
  setUrl();
  var inv = DDInventory.create({ persist: false });
  fetch('data/cars.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) { inv.load(d); }).catch(function () {})
    .then(function () { var local = DDInventory.create(); render(function (v) { return inv.get(v) || local.get(v); }); });
})();
