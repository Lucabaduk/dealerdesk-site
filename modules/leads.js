/* DealerDesk QR leads module. Schema: see INVENTORY_README.md */
(function (root) {
  'use strict';
  var S = (typeof module !== 'undefined' && module.exports) ? require('./store.js') : root.DDStore;
  var KEY = 'dealerdesk.leads.v1';
  var INTERESTS = ['question', 'test_drive', 'price'], STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'] // = schema leadStatus;
  var EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[A-Za-z]{2,24}$/;
  function cleanPhone(p) { p = String(p == null ? '' : p).replace(/[^0-9+]/g, ''); p = p.replace(/(?!^)\+/g, ''); var d = p.replace(/\D/g, ''); return d.length >= 7 && d.length <= 15 ? p : ''; }
  function rid() { var a = 'abcdefghijkmnpqrstuvwxyz23456789', s = '', i; for (i = 0; i < 10; i++) s += a[Math.floor(Math.random() * a.length)]; return 'L' + s; }
  function validate(input) {
    input = input || {}; var errors = [];
    if (input.website) errors.push('spam'); // honeypot field
    var name = S.cleanText(input.name, 80); if (name.length < 2) errors.push('name');
    var phone = cleanPhone(input.phone), emailRaw = S.cleanText(input.email, 254), email = EMAIL_RE.test(emailRaw) ? emailRaw.toLowerCase() : '';
    if (input.phone && !phone) errors.push('phone'); if (emailRaw && !email) errors.push('email'); if (!phone && !email && errors.indexOf('phone') < 0 && errors.indexOf('email') < 0) errors.push('contact');
    var interest = String(input.interest || '').toLowerCase().replace(/[\s-]/g, '_'); if (INTERESTS.indexOf(interest) < 0) errors.push('interest');
    var vin = String(input.vin || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) errors.push('vin');
    if (errors.length) return { ok: false, errors: errors };
    return { ok: true, lead: { vin: vin, name: name, phone: phone, email: email, interest: interest, interest_car_id: /^[A-Za-z0-9_-]{1,40}$/.test(String(input.interest_car_id || '')) ? String(input.interest_car_id) : null, source: 'website', via: 'qr', notes: S.cleanText(input.message, 1000), preferredTime: S.cleanText(input.preferredTime, 60) } };
  }
  function create(opts) {
    opts = opts || {}; var store = opts.storage || S.defaultStorage(), clock = opts.now || Date.now, leads = [], minGapMs = opts.minGapMs == null ? 30000 : opts.minGapMs;
    try { var raw = JSON.parse(store.getItem(KEY) || '[]'); if (Array.isArray(raw)) leads = raw.filter(function (l) { return l && typeof l.id === 'string' && STATUSES.indexOf(l.status) >= 0; }); } catch (e) { leads = []; }
    function save() { store.setItem(KEY, JSON.stringify(leads)); }
    function copy(l) { return l ? JSON.parse(JSON.stringify(l)) : null; }
    function find(id) { for (var i = 0; i < leads.length; i++) if (leads[i].id === id) return leads[i]; return null; }
    return {
      INTERESTS: INTERESTS.slice(), STATUSES: STATUSES.slice(),
      submit: function (input) {
        var r = validate(input); if (!r.ok) return r; var t = clock();
        var dup = leads.some(function (l) { return l.vin === r.lead.vin && ((r.lead.phone && l.phone === r.lead.phone) || (r.lead.email && l.email === r.lead.email)) && t - l.createdAt < minGapMs; });
        if (dup) return { ok: false, errors: ['too_soon'] };
        var lead = Object.assign({ id: rid(), status: 'new', createdAt: t, updatedAt: t, staffNote: '' }, r.lead); leads.push(lead); save(); return { ok: true, lead: copy(lead) };
      },
      list: function (q) { q = q || {}; return leads.filter(function (l) { return (!q.status || l.status === q.status) && (!q.vin || l.vin === String(q.vin).toUpperCase()) && (!q.interest || l.interest === q.interest); })
        .sort(function (a, b) { return b.createdAt - a.createdAt; }).map(copy); },
      get: function (id) { return copy(find(id)); },
      setStatus: function (id, status, note) { var l = find(id); if (!l || STATUSES.indexOf(status) < 0) return { ok: false, errors: [l ? 'status' : 'not_found'] };
        l.status = status; if (note != null) l.staffNote = S.cleanText(note, 1000); l.updatedAt = clock(); save(); return { ok: true, lead: copy(l) }; },
      remove: function (id) { var n = leads.length; leads = leads.filter(function (l) { return l.id !== id; }); if (leads.length !== n) { save(); return true; } return false; },
      counts: function () { var c = { new: 0, contacted: 0, qualified: 0, won: 0, lost: 0, total: leads.length }; leads.forEach(function (l) { c[l.status]++; }); return c; },
      exportJSON: function () { return JSON.stringify({ type: 'dealerdesk-leads', version: 1, leads: leads }, null, 2); },
      exportCSV: function () { var cols = ['id', 'createdAt', 'status', 'vin', 'interest_car_id', 'name', 'phone', 'email', 'interest', 'notes', 'staffNote'];
        function cell(v) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
        return [cols.join(',')].concat(leads.map(function (l) { return cols.map(function (k) { return cell(k === 'createdAt' ? new Date(l[k]).toISOString() : l[k]); }).join(','); })).join('\n'); }
    };
  }
  var mod = { create: create, validate: validate, cleanPhone: cleanPhone, KEY: KEY, INTERESTS: INTERESTS, STATUSES: STATUSES };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod; else root.DDLeads = mod;
})(typeof self !== 'undefined' ? self : this);
