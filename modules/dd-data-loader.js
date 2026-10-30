/* Public pages: load the static car list (data/cars.json, never stored in localStorage), hand it to the modules, then start the page script. */
(function () {
  var me = document.currentScript, next = me && me.getAttribute('data-next');
  function start() { if (!next) return; var s = document.createElement('script'); s.src = next; document.body.appendChild(s); }
  function give(d) { try { if (d && d.cars) d.cars.forEach(function (c) { if (c.price == null && c.price_cents != null) c.price = c.price_cents / 100; }); } catch (e) {}
    ['DDOrders', 'DDBooking'].forEach(function (k) { try { window[k] && window[k].setInventory(d); } catch (e) {} }); }
  if (!window.fetch) return start();
  fetch('data/cars.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(give).catch(function () {}).then(start);
})();
