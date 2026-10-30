/* Public pages: load the static car list (data/cars.json, never stored in localStorage) and hand it to DDOrders/DDBooking
   before the page script starts. Synchronous on purpose so the page script sees the cars on first paint. */
(function () {
  try {
    var x = new XMLHttpRequest(); x.open('GET', 'data/cars.json', false); x.send(null);
    if (x.status !== 200) return;
    var d = JSON.parse(x.responseText);
    (d.cars || []).forEach(function (c) { if (c.price == null && c.price_cents != null) c.price = c.price_cents / 100; });
    ['DDOrders', 'DDBooking'].forEach(function (k) { try { if (window[k]) window[k].setInventory(d); } catch (e) {} });
  } catch (e) {}
})();
