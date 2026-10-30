/*! DealerDesk public order page controller (order.html). Needs order.js. ?vehicle=STOCK_OR_VIN */
(function () {
  'use strict';
  var O = window.DDOrders, $ = function (id) { return document.getElementById(id); }, M = O.money, M2 = O.money2;
  var q = new URLSearchParams(location.search), car = O.findCar(q.get('vehicle')), s = O.settings(), kind = '', tradeEst = 0;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  if (!car) { $('ddo-flow').hidden = true; $('ddo-missing').hidden = false; $('ddo-missing').textContent = q.get('vehicle') ? 'We could not find that car. It may have been sold - please call us.' : 'No car selected.'; return; }
  $('ddo-title').textContent = O.carLabel(car); document.title = 'Reserve or buy: ' + O.carLabel(car);
  var box = $('ddo-car'), photo = O.photoUrl(car.photos[0]);
  if (photo) { var img = el('img', 'ddo-photo'); img.src = photo; img.alt = O.carLabel(car); img.loading = 'lazy'; box.appendChild(img); } else box.appendChild(el('div', 'ddo-photo ddo-nophoto', 'Photo coming soon'));
  var head = el('div', 'ddo-carhead'); head.appendChild(el('h2', null, O.carLabel(car))); head.appendChild(el('b', 'ddo-price', M(car.price))); box.appendChild(head);
  var specs = el('ul', 'ddo-specs');
  [['Stock', car.stock], ['Mileage', car.mileage.toLocaleString() + ' mi'], ['Condition', car.condition], ['Color', car.color], ['VIN', car.vin]].forEach(function (x) { if (!x[1]) return; var li = el('li'); li.appendChild(el('small', null, x[0])); li.appendChild(el('span', null, x[1])); specs.appendChild(li); });
  box.appendChild(specs);
  if (car.features.length) { var f = el('div', 'ddo-feats'); car.features.slice(0, 8).forEach(function (t) { f.appendChild(el('span', 'ddb-chip', t)); }); box.appendChild(f); }
  if (car.status === 'sold') { $('ddo-flow').hidden = true; $('ddo-missing').hidden = false; $('ddo-missing').textContent = 'Sorry, this car has been sold.'; return; }
  if (car.status === 'hold') box.appendChild(el('p', 'ddo-note', 'This car is on hold for another customer. You can still send a request and we will let you know.'));
  $('ddo-dep').textContent = 'Refundable ' + M(s.depositAmount) + ' deposit';
  $('ddo-formula').textContent = O.FORMULA; $('ddo-tax').textContent = s.taxRate;
  var c = $('ddo-calc'); function cv(n) { return c.querySelector('[name="' + n + '"]'); }
  cv('price').value = car.price; cv('apr').value = s.defaultApr; cv('term').value = String(s.defaultTerm);
  function setKind(k) { kind = k; document.querySelectorAll('[data-kind]').forEach(function (b) { b.classList.toggle('on', b.dataset.kind === k); }); $('ddo-submit').textContent = k === 'reserve' ? 'Request reservation' : 'Send buy request'; }
  function calc() {
    var out = $('ddo-calcout');
    try { var r = O.payment({ price: cv('price').value, down: cv('down').value, trade: cv('trade').value, apr: cv('apr').value, term: cv('term').value });
      out.innerHTML = ''; var m = el('div', 'ddo-monthly'); m.appendChild(el('b', null, M2(r.monthly))); m.appendChild(el('span', null, '/month for ' + r.term + ' months')); out.appendChild(m);
      var dl = el('dl', 'ddo-break'); [['Price', M2(r.price)], ['Tax', M2(r.tax)], ['Down', '-' + M2(r.down)], ['Trade-in', '-' + M2(r.trade)], ['Amount financed', M2(r.financed)], ['Interest', M2(r.interest)], ['Total of payments', M2(r.totalPayments)], ['Total cost (incl. down + trade)', M2(r.totalCost)]].forEach(function (x) { dl.appendChild(el('dt', null, x[0])); dl.appendChild(el('dd', null, x[1])); }); out.appendChild(dl);
    } catch (e) { out.textContent = e.message; }
  }
  var t = $('ddo-trade'); function tv(n) { return t.querySelector('[name="' + n + '"]'); }
  function trade() {
    var out = $('ddo-tradeout'); if (!tv('tyear').value && !tv('tmake').value) { out.textContent = ''; tradeEst = 0; return; }
    try { var r = O.tradeIn({ year: tv('tyear').value, make: tv('tmake').value, model: tv('tmodel').value, mileage: tv('tmiles').value, condition: tv('tcond').value });
      tradeEst = r.estimate; out.innerHTML = ''; out.appendChild(el('b', null, 'Estimated ' + M(r.low) + ' - ' + M(r.high)));
      var use = el('button', 'ddb-btn ddb-sm', 'Use ' + M(r.estimate) + ' in calculator'); use.type = 'button'; use.onclick = function () { cv('trade').value = r.estimate; calc(); }; out.appendChild(use);
    } catch (e) { tradeEst = 0; out.textContent = e.message; }
  }
  c.addEventListener('input', calc); c.addEventListener('change', calc); t.addEventListener('input', trade); t.addEventListener('change', trade);
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-kind]'); if (b) setKind(b.dataset.kind); });
  $('ddo-form').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target.elements, er = $('ddo-err'); er.hidden = true;
    var p = { vehicle: car.stock, kind: kind, name: f.name.value, phone: f.phone.value, email: f.email.value, contact: f.contact.value, notes: f.notes.value,
      calc: { price: cv('price').value, down: cv('down').value, trade: cv('trade').value, apr: cv('apr').value, term: cv('term').value } };
    if (tradeEst) p.trade = { year: tv('tyear').value, make: tv('tmake').value, model: tv('tmodel').value, mileage: tv('tmiles').value, condition: tv('tcond').value };
    try { var r = O.submit(p); $('ddo-flow').hidden = true; $('ddo-done').hidden = false; $('ddo-code').textContent = r.code; $('ddo-book').href = O.bookingLink({ stock: car.stock }); window.scrollTo && window.scrollTo(0, 0); }
    catch (x) { er.textContent = x.message; er.hidden = false; }
  });
  setKind(q.get('kind') === 'buy' ? 'buy' : 'reserve'); calc();
})();
