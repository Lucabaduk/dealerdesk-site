/* Staff inventory screen (staff-inventory.html). Pure helpers exported for tests; UI uses textContent only. */
(function (root) {
  'use strict';
  var FIELD_LABELS = { vin: 'VIN (17 chars, no I/O/Q)', year: 'Year', make: 'Make', model: 'Model', price: 'Price', mileage: 'Mileage', status: 'Status', condition: 'Condition', id: 'ID', duplicate: 'A car with this VIN already exists', duplicate_stock: 'Another car already uses this stock #', not_found: 'Car not found' };
  function formToCar(v) { v = v || {}; return { vin: v.vin, stock_no: v.stock_no, year: v.year, make: v.make, model: v.model, trim: v.trim, price: v.price, mileage: v.mileage, color: v.color, condition: v.condition, status: v.status, body_type: v.body_type,
    photos: String(v.photos || '').split(/\s*\n\s*|\s+/).filter(Boolean), features: String(v.features || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean) }; }
  function errorText(errors) { return 'Please fix: ' + (errors || []).map(function (e) { return Object.prototype.hasOwnProperty.call(FIELD_LABELS, e) ? FIELD_LABELS[e] : String(e); }).join(', '); }
  function buildQuery(s) { s = s || {}; var sort = String(s.sort || '').split(':'); var q = { text: s.text || '', make: s.make || '', body_type: s.body_type || '', status: s.status || '', sort: sort[0] || '', dir: sort[1] || 'asc', page: s.page || 1, pageSize: 24 };
    if (s.maxPrice !== '' && s.maxPrice != null && isFinite(+s.maxPrice)) q.maxPrice = +s.maxPrice; return q; }
  function fmtWhen(t) { var d = new Date(t); return isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  var api = { formToCar: formToCar, errorText: errorText, buildQuery: buildQuery, fmtWhen: fmtWhen };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.DDStaffInventory = api;
  var $ = function (id) { return document.getElementById(id); };
  function el(t, cls, txt) { var e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function btn(txt, fn, cls) { var b = el('button', 'small' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; b.addEventListener('click', fn); return b; }
  var inv = DDInventory.create(), leads = DDLeads.create(), page = 1, editing = null, last = null;
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function fillMakes() { fillFacet('f-body', 'body_type'); var s = $('f-make'), cur = s.value; while (s.options.length > 1) s.remove(1); inv.facets('make').forEach(function (f) { var o = el('option', '', f.value + ' (' + f.count + ')'); o.value = f.value; s.appendChild(o); }); s.value = cur; }
  function fillFacet(id, field) { var s = $(id), cur = s.value; while (s.options.length > 1) s.remove(1); inv.facets(field).forEach(function (f) { var o = el('option', '', f.value + ' (' + f.count + ')'); o.value = f.value; s.appendChild(o); }); s.value = cur; }
  function state() { return { text: $('q').value, make: $('f-make').value, body_type: $('f-body').value, status: $('f-status').value, maxPrice: $('f-max').value, sort: $('sort').value, page: page }; }
  function draw() {
    last = inv.query(buildQuery(state())); page = last.page; var tb = $('rows'); tb.textContent = '';
    last.items.forEach(function (c) { var tr = el('tr'), td0 = el('td'), img = el('img'); img.alt = ''; img.loading = 'lazy'; DDStore.setImg(img, c.photos[0]); td0.appendChild(img); tr.appendChild(td0);
      var t = el('td'); t.appendChild(el('div', '', [c.year, c.make, c.model].join(' '))); t.appendChild(el('div', 'muted', [c.trim, c.color].filter(Boolean).join(' · '))); tr.appendChild(t);
      tr.appendChild(el('td', 'hide-sm', c.stock_no)); tr.appendChild(el('td', 'hide-sm muted', c.vin)); tr.appendChild(el('td', 'num', money(c.price))); tr.appendChild(el('td', 'num hide-sm', c.mileage.toLocaleString('en-US')));
      var st = el('td'), sel = el('select'); sel.setAttribute('aria-label', 'Status for ' + c.vin); inv.STATUSES.forEach(function (s) { var o = el('option', '', s); o.value = s; sel.appendChild(o); }); sel.value = c.status;
      sel.addEventListener('change', function () { inv.setStatus(c.vin, sel.value); }); st.appendChild(sel); tr.appendChild(st);
      var act = el('td'); act.appendChild(btn('Edit', function () { openForm(c); })); act.appendChild(document.createTextNode(' ')); act.appendChild(btn('QR', function () { printLabels([c]); }));
      act.appendChild(document.createTextNode(' ')); act.appendChild(btn('Remove', function () { if (confirm('Remove ' + c.year + ' ' + c.make + ' ' + c.model + ' (' + c.vin + ')?')) { inv.remove(c.vin); fillMakes(); draw(); } })); tr.appendChild(act);
      tb.appendChild(tr); });
    if (!last.items.length) { var tr = el('tr'), td = el('td', 'muted', inv.size() ? 'No cars match.' : 'No cars yet. Add one or import JSON.'); td.colSpan = 8; tr.appendChild(td); tb.appendChild(tr); }
    $('count').textContent = last.total.toLocaleString('en-US') + (last.total === 1 ? ' car' : ' cars'); $('pageinfo').textContent = 'Page ' + last.page + ' of ' + last.pages; $('prev').disabled = last.page <= 1; $('next').disabled = last.page >= last.pages;
  }
  function openForm(car) { editing = car ? car.vin : null; var f = $('carform'); f.reset(); $('formerr').textContent = ''; $('dlg-title').textContent = car ? 'Edit car' : 'Add car'; f.elements.vin.readOnly = !!car;
    if (car) ['vin', 'stock_no', 'year', 'make', 'model', 'trim', 'price', 'mileage', 'color', 'condition', 'status', 'body_type'].forEach(function (k) { if (car[k] != null) f.elements[k].value = car[k]; });
    if (car) { f.elements.photos.value = car.photos.join('\n'); f.elements.features.value = car.features.join(', '); } showDlg(true); }
  $('carform').addEventListener('submit', function (e) { e.preventDefault(); var f = e.target.elements, v = {}; Array.prototype.forEach.call(f, function (x) { if (x.name) v[x.name] = x.value; });
    var r = editing ? inv.update(editing, formToCar(v)) : inv.add(formToCar(v)); if (!r.ok) { $('formerr').textContent = errorText(r.errors); return; } $('formerr').textContent = ''; showDlg(false); fillMakes(); draw(); });
  $('cancel').addEventListener('click', function () { showDlg(false); });
  function showDlg(on) { var d = $('dlg'); if (on) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); } else { if (d.close) d.close(); else d.removeAttribute('open'); } }
  function printLabels(cars) { DDQRLabel.sheet($('print'), cars, location.href); setTimeout(function () { root.print(); }, 50); }
  $('print-page').addEventListener('click', function () { if (last && last.items.length) printLabels(last.items); });
  ['q', 'f-make', 'f-body', 'f-status', 'f-max', 'sort'].forEach(function (id) { $(id).addEventListener(id === 'q' || id === 'f-max' ? 'input' : 'change', function () { page = 1; draw(); }); });
  $('prev').addEventListener('click', function () { page--; draw(); }); $('next').addEventListener('click', function () { page++; draw(); });
  $('add').addEventListener('click', function () { openForm(null); });
  function download(name, text, type) { var a = el('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  $('export').addEventListener('click', function () { download('dealerdesk-inventory.json', inv.exportJSON(), 'application/json'); });
  $('import').addEventListener('change', function (e) { var file = e.target.files[0]; if (!file) return; if (file.size > 20e6) { alert('File too large'); return; }
    file.text().then(function (t) { var r = inv.importJSON(t, 'merge'); alert(r.ok ? 'Imported: ' + r.added + ' added, ' + r.updated + ' updated, ' + r.skipped + ' skipped' + (r.duplicateStock && r.duplicateStock.length ? '\nDuplicate stock # skipped: ' + r.duplicateStock.slice(0, 10).map(function (d) { return d.stock_no + ' (' + d.vin + ')'; }).join(', ') + (r.duplicateStock.length > 10 ? ' +' + (r.duplicateStock.length - 10) + ' more' : '') : '') : 'Import failed: ' + r.errors.join(', ')); fillMakes(); draw(); e.target.value = ''; }); });
  // leads tab
  var SRC = Object.assign(Object.create(null), { qr: 'QR code', web: 'Website', walk_in: 'Walk-in' }), openId = null;
  function lq() { return { text: $('l-q').value, status: $('l-status').value, channel: $('l-source').value, overdue: $('l-overdue').checked }; }
  function when(t) { return fmtWhen(t); }
  var LEAD_PAGE = 200, leadShow = LEAD_PAGE; // QA: 5,000 cards per keystroke took ~400 ms on a phone
  function drawLeads(more) { var box = $('lrows'); box.textContent = ''; var list = leads.search(lq()); if (more !== true) leadShow = LEAD_PAGE;
    $('l-count').textContent = list.length === 1 ? '1 lead' : list.length + ' leads';
    var rest = list.length - leadShow; list.slice(0, leadShow).forEach(function (l) { var b = el('button', 'lcard'); b.type = 'button'; var top = el('div', 'top');
      top.appendChild(el('b', '', l.name)); if (leads.isOverdue(l)) top.appendChild(el('span', 'od', 'Overdue')); top.appendChild(el('span', 'pill ' + l.status, l.status)); b.appendChild(top);
      var car = inv.get(l.vin); b.appendChild(el('div', '', String(l.interest).replace('_', ' ') + ' \u00b7 ' + (car ? car.year + ' ' + car.make + ' ' + car.model : l.vin)));
      b.appendChild(el('div', 'src', leads.ago(l.createdAt) + ' \u00b7 ' + (SRC[l.channel] || 'Website') + (l.assignee ? ' \u00b7 ' + l.assignee : '')));
      b.addEventListener('click', function () { openLead(l.id); }); box.appendChild(b); });
    if (rest > 0) { var mb = el('button', 'lcard', 'Show ' + Math.min(rest, LEAD_PAGE) + ' more of ' + rest); mb.type = 'button'; mb.id = 'l-more'; mb.addEventListener('click', function () { leadShow += LEAD_PAGE; drawLeads(true); }); box.appendChild(mb); }
    if (!list.length) box.appendChild(el('p', 'muted', leads.counts().total ? 'No leads match.' : 'No leads yet. Leads from car QR pages appear here.')); }
  function badge() { var n = leads.counts().new; $('newcount').textContent = n ? String(n) : ''; }
  function li(time, text) { var x = el('li'); var tm = el('time', '', when(time)); tm.setAttribute('datetime', new Date(time).toISOString()); x.appendChild(tm); x.appendChild(document.createTextNode(text)); return x; }
  function isoDay(t) { var d = new Date(t); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fillLead() { var l = leads.get(openId); if (!l) return; $('ld-name').textContent = l.name;
    $('ld-meta').textContent = (SRC[l.channel] || 'Website') + ' \u00b7 ' + leads.ago(l.createdAt) + ' \u00b7 ' + when(l.createdAt);
    var ct = $('ld-contact'); ct.textContent = ''; if (l.phone) { var a = el('a', '', 'Call ' + l.phone); a.href = 'tel:' + l.phone; ct.appendChild(a); } if (l.email) { var m = el('a', '', 'Email ' + l.email); m.href = 'mailto:' + encodeURIComponent(l.email).replace('%40', '@'); ct.appendChild(m); }
    $('ld-msg').textContent = String(l.interest).replace('_', ' ') + (l.preferredTime ? ' \u00b7 ' + l.preferredTime : '') + (l.notes ? '\n\n' + l.notes : '');
    var cb = $('ld-car'); cb.textContent = ''; var car = inv.get(l.vin) || (l.interest_car_id ? inv.get(l.interest_car_id) : null);
    if (car) { var img = el('img'); img.alt = ''; DDStore.setImg(img, car.photos[0]); cb.appendChild(img); var tx = el('div'); tx.appendChild(el('div', '', [car.year, car.make, car.model, car.trim].filter(Boolean).join(' '))); tx.appendChild(el('b', '', money(car.price))); tx.appendChild(el('div', 'muted', 'VIN ' + car.vin + ' \u00b7 ' + car.status)); cb.appendChild(tx); }
    else cb.appendChild(el('p', 'muted', 'VIN ' + (l.vin || 'unknown') + ' (not in inventory)'));
    var ss = $('ld-status'); ss.textContent = ''; leads.STATUSES.forEach(function (s) { var o = el('option', '', s); o.value = s; ss.appendChild(o); }); ss.value = l.status;
    $('ld-assign').value = l.assignee || ''; var dl = $('ld-staff'); dl.textContent = ''; leads.salespeople().forEach(function (n) { var o = el('option'); o.value = n; dl.appendChild(o); });
    $('ld-follow').value = l.followUpAt ? isoDay(l.followUpAt) : ''; $('ld-overdue').textContent = ''; if (leads.isOverdue(l)) $('ld-overdue').appendChild(el('span', 'od', 'Overdue'));
    var nl = $('ld-notes'); nl.textContent = ''; l.notesLog.slice().reverse().forEach(function (n) { nl.appendChild(li(n.at, (n.by ? n.by + ': ' : '') + n.text)); }); if (!l.notesLog.length) nl.appendChild(el('li', 'muted', 'No notes yet.'));
    var tl = $('ld-time'); tl.textContent = ''; l.history.slice().reverse().forEach(function (h) { tl.appendChild(li(h.at, h.from ? h.from + ' \u2192 ' + h.to + (h.by ? ' (' + h.by + ')' : '') : 'Lead received (' + h.to + ')')); }); }
  // drawer: Esc, the close button and the phone Back button all close it the same way (QA: Esc left openId set, Back left the page)
  var pushed = false;
  function openLead(id) { openId = id; fillLead(); var d = $('ldrawer'); if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); try { history.pushState({ ddLead: id }, ''); pushed = true; } catch (e) {} } }
  function onClosed() { if (openId == null) return; openId = null; drawLeads(); if (pushed) { pushed = false; try { history.back(); } catch (e) {} } }
  function closeLead() { var d = $('ldrawer'); if (d.close && d.open) d.close(); else { d.removeAttribute('open'); onClosed(); } }
  $('ldrawer').addEventListener('close', onClosed);
  window.addEventListener('popstate', function () { if (openId == null) return; pushed = false; closeLead(); });
  function me() { return $('ld-assign').value; }
  $('ld-close').addEventListener('click', closeLead);
  $('ld-status').addEventListener('change', function () { leads.setStatus(openId, $('ld-status').value, null, me()); badge(); fillLead(); drawLeads(); });
  $('ld-assign').addEventListener('change', function () { leads.assign(openId, $('ld-assign').value); fillLead(); drawLeads(); });
  $('ld-follow').addEventListener('change', function () { leads.setFollowUp(openId, $('ld-follow').value || null); fillLead(); drawLeads(); });
  $('ld-addnote').addEventListener('click', function () { var r = leads.addNote(openId, $('ld-note').value, me()); if (r.ok) { $('ld-note').value = ''; fillLead(); } });
  ['l-status', 'l-source', 'l-overdue'].forEach(function (id) { $(id).addEventListener('change', function () { drawLeads(); }); }); $('l-q').addEventListener('input', function () { drawLeads(); });
  $('csv').addEventListener('click', function () { download('dealerdesk-leads.csv', leads.exportCSV(leads.search(lq())), 'text/csv'); });
  function tab(which) { var isInv = which === 'inv'; $('pane-inv').hidden = !isInv; $('pane-leads').hidden = isInv; $('tab-inv').setAttribute('aria-selected', String(isInv)); $('tab-leads').setAttribute('aria-selected', String(!isInv)); if (!isInv) drawLeads(); }
  $('tab-inv').addEventListener('click', function () { tab('inv'); }); $('tab-leads').addEventListener('click', function () { tab('leads'); });
  function start() { fillMakes(); draw(); badge(); }
  if (inv.size()) start(); else fetch('data/cars.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) { inv.load(d); }).catch(function () {}).then(start);
})(typeof self !== 'undefined' ? self : this);
