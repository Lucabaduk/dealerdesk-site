/* Staff helper: QR labels for cars (single label + printable sheet). Uses DDQR + DDInventory + DDStore. textContent only. */
(function (root) {
  'use strict';
  var I = (typeof module !== 'undefined' && module.exports) ? require('./inventory.js') : root.DDInventory;
  var Q = (typeof module !== 'undefined' && module.exports) ? require('./qr.js') : root.DDQR;
  var helper = null; function inv() { return helper || (helper = I.create({ persist: false, storage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} } })); }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  /** pure: text lines + url + svg (or error) for one car */
  function labelData(car, baseUrl) {
    var price = car.price != null ? car.price : (car.price_cents != null ? car.price_cents / 100 : null);
    var url = inv().carUrl(baseUrl || '', car.vin), svg = '', error = '';
    try { svg = Q.toSVG(url, { scale: 6, margin: 4 }); } catch (e) { error = 'QR link too long'; }
    return { title: [car.year, car.make, car.model].filter(Boolean).join(' '), trim: car.trim || '', price: price == null ? '' : money(price),
      vin: 'VIN ' + I.cleanVin(car.vin), stock: car.stock_no ? 'Stock # ' + car.stock_no : '', url: url, svg: svg, error: error };
  }
  function el(t, cls, txt) { var e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function label(car, baseUrl) {
    var d = labelData(car, baseUrl), box = el('div', 'dd-label');
    if (d.svg) { var img = el('img', 'dd-qr'); img.alt = 'QR code for ' + d.title; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(d.svg); box.appendChild(img); } else box.appendChild(el('div', 'dd-qr', d.error));
    var tx = el('div', 'dd-lt'); tx.appendChild(el('div', 'dd-l1', d.title)); if (d.trim) tx.appendChild(el('div', 'dd-l2', d.trim));
    tx.appendChild(el('div', 'dd-l3', d.price)); tx.appendChild(el('div', 'dd-l4', d.vin)); if (d.stock) tx.appendChild(el('div', 'dd-l4', d.stock)); tx.appendChild(el('div', 'dd-l5', 'Scan for details & test drive'));
    box.appendChild(tx); return box;
  }
  /** fill container with a print sheet (CSS in staff-inventory.html: .dd-sheet / @media print) */
  function sheet(container, cars, baseUrl) { container.textContent = ''; var s = el('div', 'dd-sheet'); (cars || []).slice(0, 200).forEach(function (c) { s.appendChild(label(c, baseUrl)); }); container.appendChild(s); return s; }
  function render(container, vin, baseUrl) { var d = labelData({ vin: vin }, baseUrl || location.href); container.textContent = '';
    if (!d.svg) { container.textContent = d.error; return ''; } var img = el('img'); img.alt = 'QR code for VIN ' + I.cleanVin(vin); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(d.svg); container.appendChild(img); return d.url; }
  var api = { labelData: labelData, label: label, sheet: sheet, render: render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DDQRLabel = api;
})(typeof self !== 'undefined' ? self : this);
