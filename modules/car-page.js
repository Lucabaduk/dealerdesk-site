/* Guest page logic for car.html?vin=... (DOM via textContent only; no innerHTML of user data). */
(function () {
  'use strict';
  var vin = DDInventory.cleanVin(new URLSearchParams(location.search).get('vin'));
  var box = document.getElementById('car'), form = document.getElementById('lead'), msg = document.getElementById('msg');
  // Leads server: the meta tag is honoured ONLY if it is https and its host is in this allowlist (edit here, not in HTML).
  var LEAD_ENDPOINT_HOSTS = [];
  var ENDPOINT = DDStore.allowedEndpoint((document.querySelector('meta[name="dd-leads-endpoint"]') || {}).content, LEAD_ENDPOINT_HOSTS);
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function money(n) { return '$' + Number(n).toLocaleString('en-US'); }
  function show(car) {
    box.textContent = '';
    if (!car) { box.appendChild(el('h1', '', 'Vehicle not found')); box.appendChild(el('p', 'meta', 'Please ask a salesperson for help.')); return; }
    var NOPHOTO = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240"><rect width="400" height="240" fill="#d9dee6"/><text x="200" y="128" font-family="sans-serif" font-size="22" fill="#5b6577" text-anchor="middle">Photo coming soon</text></svg>');
    if (!car.photos.length) car.photos = [NOPHOTO];
    { var g = el('div', 'gallery'); car.photos.forEach(function (p) { var i = el('img'); i.src = p; i.alt = /^assets\/cars\//.test(p) ? car.make + ' ' + car.model + ' (representative photo)' : car.year + ' ' + car.make + ' ' + car.model; i.loading = 'lazy'; i.onerror = function () { this.onerror = null; this.src = NOPHOTO; }; g.appendChild(i); }); box.appendChild(g); var cap = DDInventory.photoCaption(car); if (cap) box.appendChild(el('p', 'photo-cap', cap)); }
    box.appendChild(el('span', 'badge ' + car.status, car.status === 'available' ? 'Available' : car.status === 'hold' ? 'On hold' : 'Sold'));
    box.appendChild(el('h1', '', [car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')));
    box.appendChild(el('div', 'price', money(car.price)));
    box.appendChild(el('p', 'meta', Number(car.mileage).toLocaleString('en-US') + ' miles' + (car.color ? ' · ' + car.color : '') + ' · VIN ' + car.vin));
    if (car.features && car.features.length) box.appendChild(el('p', '', car.features.join(' · ')));
    // staff device (has a 'You are' name) gets a Print sticker link
    if (window.DDStore && DDStore.getStaffName && DDStore.getStaffName()) { var ps = el('a', 'staff-sticker', 'Print sticker'); ps.href = 'window-sticker.html?vin=' + encodeURIComponent(car.vin) + '&print=1'; ps.target = '_blank'; ps.rel = 'noopener'; box.appendChild(ps); }
    if (window.DDFavorites) { var fav = DDFavorites.create(), bar = el('div', 'favbar'), h = DDFavorites.heart(fav, car.vin), a = el('a', '', 'Compare'), n = el('span', 'n');
      a.href = 'compare.html'; a.appendChild(n); DDFavorites.badge(fav, n); bar.appendChild(h); bar.appendChild(a); box.appendChild(bar); }
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
    var data = { vin: vin, interest_car_id: carId, ref: (new URLSearchParams(location.search).get('src') || ''), name: f.name.value, phone: f.phone.value, email: f.email.value, interest: (form.querySelector('input[name=interest]:checked') || {}).value, message: f.message.value, website: f.website.value };
    var r = leads.submit(data);
    if (!r.ok) { var m = { name: 'Please enter your name.', contact: 'Please add a phone number or email.', phone: 'That phone number looks wrong.', email: 'That email looks wrong.', too_soon: 'Thanks, we already got your request.', spam: 'Could not send.' };
      msg.className = 'err'; msg.textContent = m[r.errors[0]] || 'Please check the form.'; return; }
    if (ENDPOINT) fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.lead) }).catch(function () {});
    form.reset(); msg.className = 'ok'; msg.textContent = 'Thanks! A team member will contact you soon.';
  });
})();
