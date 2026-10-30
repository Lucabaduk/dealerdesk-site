/* Guest page logic for car.html?vin=... (DOM via textContent only; no innerHTML of user data). */
(function () {
  'use strict';
  var vin = DDInventory.cleanVin(new URLSearchParams(location.search).get('vin'));
  var box = document.getElementById('car'), form = document.getElementById('lead'), msg = document.getElementById('msg');
  var ENDPOINT = (document.querySelector('meta[name="dd-leads-endpoint"]') || {}).content || ''; // optional server, set by Coder
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function money(n) { return '$' + Number(n).toLocaleString('en-US'); }
  function show(car) {
    box.textContent = '';
    if (!car) { box.appendChild(el('h1', '', 'Vehicle not found')); box.appendChild(el('p', 'meta', 'Please ask a salesperson for help.')); return; }
    if (!car.photos.length) car.photos = ['assets/site/no-photo.webp'];
    { var g = el('div', 'gallery'); car.photos.forEach(function (p) { var i = el('img'); i.src = p; i.alt = car.year + ' ' + car.make + ' ' + car.model; i.loading = 'lazy'; g.appendChild(i); }); box.appendChild(g); }
    box.appendChild(el('span', 'badge ' + car.status, car.status === 'available' ? 'Available' : car.status === 'hold' ? 'On hold' : 'Sold'));
    box.appendChild(el('h1', '', [car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')));
    box.appendChild(el('div', 'price', money(car.price)));
    box.appendChild(el('p', 'meta', Number(car.mileage).toLocaleString('en-US') + ' miles' + (car.color ? ' · ' + car.color : '') + ' · VIN ' + car.vin));
    if (car.features && car.features.length) box.appendChild(el('p', '', car.features.join(' · ')));
    form.hidden = false;
  }
  function fromLocal() { return DDInventory.create().get(vin); }
  if (!DDInventory.isValidVin(vin)) { show(null); return; }
  var carId = null;
  fetch('data/cars.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
    var list = Array.isArray(d) ? d : (d && d.cars) || [], hit = null;
    list.some(function (c) { if (DDInventory.cleanVin(c.vin) === vin) { var n = DDInventory.normalize(c); hit = n.ok ? n.car : null; return true; } return false; });
    hit = hit || fromLocal(); carId = hit && hit.id; show(hit);
  }).catch(function () { var h = fromLocal(); carId = h && h.id; show(h); });
  var leads = DDLeads.create();
  form.addEventListener('submit', function (ev) {
    ev.preventDefault(); var f = form.elements;
    var data = { vin: vin, interest_car_id: carId, name: f.name.value, phone: f.phone.value, email: f.email.value, interest: (form.querySelector('input[name=interest]:checked') || {}).value, message: f.message.value, website: f.website.value };
    var r = leads.submit(data);
    if (!r.ok) { var m = { name: 'Please enter your name.', contact: 'Please add a phone number or email.', phone: 'That phone number looks wrong.', email: 'That email looks wrong.', too_soon: 'Thanks, we already got your request.', spam: 'Could not send.' };
      msg.className = 'err'; msg.textContent = m[r.errors[0]] || 'Please check the form.'; return; }
    if (ENDPOINT && /^https:\/\//.test(ENDPOINT)) fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.lead) }).catch(function () {});
    form.reset(); msg.className = 'ok'; msg.textContent = 'Thanks! A team member will contact you soon.';
  });
})();
