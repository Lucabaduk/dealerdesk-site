/*! DealerDesk public booking page controller (booking.html). Needs booking.js.
 *  Query params: ?type=service | ?vehicle=STOCK_OR_VIN (for a QR on a car) | ?name=Dealer+Name */
(function () {
  'use strict';
  var B = window.DDBooking, $ = function (id) { return document.getElementById(id); };
  var q = new URLSearchParams(location.search), kind = q.get('type') === 'service' ? 'service' : 'test-drive', time = '';
  if (q.get('name')) { B.setDealerName(q.get('name')); $('ddp-name').textContent = 'Book with ' + q.get('name').slice(0, 60); document.title = $('ddp-name').textContent; }
  if (q.get('vehicle')) $('ddp-vehicle').value = q.get('vehicle').slice(0, 20);
  B.bindPicker($('ddp-vehicle'), $('ddp-results'), function () { slots(); });
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var d = new Date(); $('ddp-date').value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function setKind(k) {
    kind = k; document.querySelectorAll('[data-kind]').forEach(function (b) { b.classList.toggle('on', b.dataset.kind === k); });
    $('ddp-td').hidden = k !== 'test-drive'; $('ddp-sv').hidden = k !== 'service'; $('ddp-sv').style.display = k === 'service' ? 'grid' : 'none'; slots();
  }
  function slots() {
    var f = $('ddp-form').elements, o = { type: f.type.value };
    if (kind === 'test-drive') { var v = B.findVehicle($('ddp-vehicle').value); if (v) { o.vin = v.vin; o.stock = v.stock; } else if ($('ddp-vehicle').value) o.stock = $('ddp-vehicle').value.toUpperCase(); }
    var list = B.openSlots(kind, $('ddp-date').value, o); if (list.indexOf(time) < 0) time = '';
    $('ddp-slots').innerHTML = list.length ? list.map(function (t) { return '<button type="button" data-t="' + t + '" class="' + (t === time ? 'on' : '') + '">' + t + '</button>'; }).join('') : '<p class="ddb-empty">No open times this day. Try another date.</p>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.kind) setKind(b.dataset.kind); else if (b.dataset.t) { time = b.dataset.t; slots(); }
  });
  ['ddp-date', 'ddp-vehicle'].forEach(function (id) { $(id).addEventListener('change', slots); });
  $('ddp-form').elements.type.addEventListener('change', slots);
  $('ddp-form').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target.elements, err = $('ddp-err'); err.hidden = true;
    if (!time) { err.textContent = 'Pick a time.'; err.hidden = false; return; }
    var p = { customer: f.customer.value, phone: f.phone.value, email: f.email.value, date: f.date.value, time: time };
    if (kind === 'service') { p.type = f.type.value; p.notes = f.notes.value; p.vehicle = { year: f.year.value, make: f.make.value, model: f.model.value, vin: f.vin.value, mileage: f.mileage.value }; }
    else p.vehicle = f.vehicle.value;
    try { var r = B.submitRequest(kind, p); e.target.hidden = true; $('ddp-done').hidden = false; $('ddp-code').textContent = r.code; $('ddp-when').textContent = r.date + ' at ' + r.time; var ic = $('ddp-ics'), href = B.icsHref(r.kind, r.id); if (href) { ic.href = href; ic.setAttribute('download', B.icsFileName(r.kind, r.id)); ic.hidden = false; } }
    catch (x) { err.textContent = x.message; err.hidden = false; slots(); }
  });
  setKind(kind);
})();
