/* Staff helper: render a printable QR for a car into a container (uses DDQR + DDInventory). */
(function (root) {
  'use strict';
  function render(container, vin, baseUrl) {
    var inv = root.DDInventory, url = inv.create ? inv.create({ storage: root.DDStore.memoryStorage() }).carUrl(baseUrl || location.href, vin) : '';
    var svg; try { svg = root.DDQR.toSVG(url, { scale: 6, margin: 4 }); } catch (e) { container.textContent = 'QR link too long'; return ''; }
    var img = document.createElement('img'); img.alt = 'QR code for VIN ' + inv.cleanVin(vin); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    container.textContent = ''; container.appendChild(img); return url;
  }
  root.DDQRLabel = { render: render };
})(typeof self !== 'undefined' ? self : this);
