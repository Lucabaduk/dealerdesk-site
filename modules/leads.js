/* DealerDesk QR leads module. Schema: see INVENTORY_README.md */
(function (root) {
  'use strict';
  var S = (typeof module !== 'undefined' && module.exports) ? require('./store.js') : root.DDStore;
  var KEY = 'dealerdesk.leads.v1', STAFF_KEY = 'dealerdesk.salespeople.v1';
  var CHANNELS = ['qr', 'web', 'walk_in']; // UI "source" filter: QR code, website, walk-in
  var OPEN = ['new', 'contacted']; // follow-up overdue only applies to these
  var DAY = 86400000, MAXT = 8.64e15;
  function ts(v, d) { v = +v; return isFinite(v) && v > 0 && v <= MAXT ? v : d; } // valid Date range only
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function channelOf(l) { if (l.via === 'qr') return 'qr'; if (l.source === 'walk_in' || l.channel === 'walk_in') return 'walk_in'; return CHANNELS.indexOf(l.channel) >= 0 ? l.channel : 'web'; }
  /** '2h ago', '3d ago' */
  function ago(ts, now) { var d = Math.max(0, (now == null ? Date.now() : now) - ts), m = Math.floor(d / 60000);
    if (!isFinite(m)) return ''; if (m < 1) return 'just now'; if (m < 60) return m + 'm ago'; var h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; var dd = Math.floor(h / 24); if (dd < 60) return dd + 'd ago'; return Math.floor(dd / 30) + 'mo ago'; }
  function parseDate(v) { if (v == null || v === '') return null; if (typeof v === 'number') return ts(v, null);
    var m = /^([1-9]\d{3})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(v)); if (!m) return null; var d = new Date(+m[1], m[2] - 1, +m[3], m[4] ? +m[4] : 23, m[5] ? +m[5] : 59);
    return d.getMonth() === m[2] - 1 && d.getDate() === +m[3] ? d.getTime() : null; }
  function isOverdue(l, now) { return !!(l && l.followUpAt && OPEN.indexOf(l.status) >= 0 && l.followUpAt < (now == null ? Date.now() : now)); }
  /** bring old saved leads (v1, before notes/timeline) up to date without losing anything */
  function migrate(l) {
    var t0 = ts(l.createdAt, 0), tu = ts(l.updatedAt, t0);
    l.createdAt = t0; l.updatedAt = tu;
    if (!Array.isArray(l.history)) { l.history = [{ to: 'new', at: t0 }]; if (l.status !== 'new') l.history.push({ from: 'new', to: l.status, at: tu }); }
    l.history = l.history.filter(function (h) { return h && STATUSES.indexOf(h.to) >= 0 && (+h.at === 0 || ts(h.at, -1) >= 0); }).map(function (h) { return { from: STATUSES.indexOf(h.from) >= 0 ? h.from : undefined, to: h.to, at: ts(h.at, 0), by: S.cleanText(h.by, 60) }; }).slice(-200);
    if (!Array.isArray(l.notesLog)) l.notesLog = l.staffNote ? [{ id: 'n0', text: S.cleanText(l.staffNote, 1000), at: tu, by: '' }] : [];
    l.notesLog = l.notesLog.filter(function (n) { return n && typeof n.text === 'string' && n.text; }).map(function (n, i) { return { id: typeof n.id === 'string' ? n.id.slice(0, 20) : 'n' + i, text: S.cleanText(n.text, 1000), at: ts(n.at, tu), by: S.cleanText(n.by, 60) }; }).slice(-200);
    l.assignee = S.cleanText(l.assignee, 60); l.followUpAt = parseDate(l.followUpAt); l.channel = channelOf(l);
    ['name', 'email', 'notes', 'staffNote'].forEach(function (k) { l[k] = S.cleanText(l[k], k === 'name' ? 80 : 1000); }); l.phone = cleanPhone(l.phone); l.vin = String(l.vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return l;
  }
  var INTERESTS = ['question', 'test_drive', 'price'], STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'] // = schema leadStatus;
  var EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[A-Za-z]{2,24}$/;
  // plain phone numbers (+15551234567, +1 (555) 123-4567) are exported as-is; anything else starting = + - @ gets a ' guard
  var PHONE_RE = /^\+?(\d{1,3}[ .-]?)?(\(\d{1,4}\)[ .-]?)?\d[\d .-]{4,18}\d$/;
  function isPhone(v) { var d = v.replace(/\D/g, '').length; return PHONE_RE.test(v) && d >= 7 && d <= 15; }
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
    return { ok: true, lead: { vin: vin, name: name, phone: phone, email: email, interest: interest, interest_car_id: /^[A-Za-z0-9_-]{1,40}$/.test(String(input.interest_car_id || '')) ? String(input.interest_car_id) : null, source: 'website', via: 'qr', ref: /^[a-z_]{1,20}$/.test(String(input.ref || '')) ? String(input.ref) : '', notes: S.cleanText(input.message, 1000), preferredTime: S.cleanText(input.preferredTime, 60) } };
  }
  function create(opts) {
    opts = opts || {}; var store = opts.storage || S.defaultStorage(), clock = opts.now || Date.now, leads = [], minGapMs = opts.minGapMs == null ? 30000 : opts.minGapMs;
    try { var raw = JSON.parse(store.getItem(KEY) || '[]'); if (Array.isArray(raw)) raw.forEach(function (l) { if (!l || typeof l.id !== 'string' || STATUSES.indexOf(l.status) < 0) return; try { leads.push(migrate(l)); } catch (e) { /* skip just this malformed lead, keep the rest */ } }); } catch (e) { leads = []; }
    function save() { try { store.setItem(KEY, JSON.stringify(leads)); } catch (e) {} }
    var staff = []; try { var sp = JSON.parse(store.getItem(STAFF_KEY) || '[]'); if (Array.isArray(sp)) sp.forEach(function (n) { remember(n, true); }); } catch (e) {}
    function remember(name, quiet) { name = S.cleanText(name, 60); if (!name) return ''; var seen = Object.create(null); staff.forEach(function (n) { seen[n.toLowerCase()] = n; });
      if (seen[name.toLowerCase()]) return seen[name.toLowerCase()]; staff.push(name); staff.sort(function (a, b) { return a.localeCompare(b); }); if (staff.length > 50) staff.length = 50;
      if (!quiet) try { store.setItem(STAFF_KEY, JSON.stringify(staff)); } catch (e) {} return name; }
    function nid() { return 'n' + clock().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
    function copy(l) { return l ? JSON.parse(JSON.stringify(l)) : null; }
    function find(id) { for (var i = 0; i < leads.length; i++) if (leads[i].id === id) return leads[i]; return null; }
    return {
      INTERESTS: INTERESTS.slice(), STATUSES: STATUSES.slice(),
      /** opts2.channel: 'qr' (default, car QR page) | 'web' | 'walk_in' (staff entry) */
      submit: function (input, opts2) {
        var r = validate(input); if (!r.ok) return r; var t = clock();
        var dup = leads.some(function (l) { return l.vin === r.lead.vin && ((r.lead.phone && l.phone === r.lead.phone) || (r.lead.email && l.email === r.lead.email)) && t - l.createdAt < minGapMs; });
        if (dup) return { ok: false, errors: ['too_soon'] };
        var ch = opts2 && CHANNELS.indexOf(opts2.channel) >= 0 ? opts2.channel : 'qr';
        var lead = Object.assign({ id: rid(), status: 'new', createdAt: t, updatedAt: t, staffNote: '' }, r.lead, ch === 'qr' ? {} : { via: ch === 'walk_in' ? 'walk_in' : 'web', source: ch === 'walk_in' ? 'walk_in' : 'website' }); migrate(lead); leads.push(lead); save(); return { ok: true, lead: copy(lead) };
      },
      list: function (q) { q = q || {}; return leads.filter(function (l) { return (!q.status || l.status === q.status) && (!q.vin || l.vin === String(q.vin).toUpperCase()) && (!q.interest || l.interest === q.interest); })
        .sort(function (a, b) { return b.createdAt - a.createdAt; }).map(copy); },
      get: function (id) { return copy(find(id)); },
      setStatus: function (id, status, note, by) { var l = find(id); if (!l || STATUSES.indexOf(status) < 0) return { ok: false, errors: [l ? 'status' : 'not_found'] };
        var t = clock(); if (l.status !== status) { l.history.push({ from: l.status, to: status, at: t, by: S.cleanText(by, 60) }); if (l.history.length > 200) l.history.shift(); l.status = status; }
        if (note != null) l.staffNote = S.cleanText(note, 1000); l.updatedAt = t; save(); return { ok: true, lead: copy(l) }; },
      addNote: function (id, text, by) { var l = find(id); if (!l) return { ok: false, errors: ['not_found'] }; text = S.cleanText(text, 1000); if (!text) return { ok: false, errors: ['note'] };
        var n = { id: nid(), text: text, at: clock(), by: S.cleanText(by, 60) }; l.notesLog.push(n); if (l.notesLog.length > 200) l.notesLog.shift(); l.updatedAt = n.at; save(); return { ok: true, note: copy(n), lead: copy(l) }; },
      assign: function (id, name) { var l = find(id); if (!l) return { ok: false, errors: ['not_found'] }; l.assignee = name ? remember(name) : ''; l.updatedAt = clock(); save(); return { ok: true, lead: copy(l) }; },
      salespeople: function () { return staff.slice(); },
      setFollowUp: function (id, when) { var l = find(id); if (!l) return { ok: false, errors: ['not_found'] }; var t = parseDate(when); if (when != null && when !== '' && t == null) return { ok: false, errors: ['date'] };
        l.followUpAt = t; l.updatedAt = clock(); save(); return { ok: true, lead: copy(l) }; },
      isOverdue: function (l) { return isOverdue(l, clock()); },
      ago: function (ts) { return ago(ts, clock()); },
      /** q: {text (name/phone/email/VIN), status, channel ('qr'|'web'|'walk_in'), overdue: true, assignee} */
      search: function (q) { q = q || {}; var words = S.cleanText(q.text, 100).toLowerCase().split(' ').filter(Boolean), now = clock(), digits = String(q.text || '').replace(/\D/g, '');
        return leads.filter(function (l) {
          if (q.status && l.status !== q.status) return false; if (q.channel && l.channel !== q.channel) return false; if (q.overdue && !isOverdue(l, now)) return false;
          if (q.assignee && l.assignee.toLowerCase() !== String(q.assignee).toLowerCase()) return false;
          if (words.length) { var hay = [l.name, l.email, l.phone, l.vin].join(' ').toLowerCase(); var hit = words.every(function (w) { return hay.indexOf(w) >= 0; }) || (digits.length >= 3 && l.phone.replace(/\D/g, '').indexOf(digits) >= 0); if (!hit) return false; }
          return true; }).sort(function (a, b) { return b.createdAt - a.createdAt; }).map(copy); },
      remove: function (id) { var n = leads.length; leads = leads.filter(function (l) { return l.id !== id; }); if (leads.length !== n) { save(); return true; } return false; },
      counts: function () { var c = { new: 0, contacted: 0, qualified: 0, won: 0, lost: 0, total: leads.length }; leads.forEach(function (l) { if (has(c, l.status) && STATUSES.indexOf(l.status) >= 0) c[l.status]++; }); return c; },
      overdueCount: function () { var now = clock(); return leads.filter(function (l) { return isOverdue(l, now); }).length; },
      exportJSON: function () { return JSON.stringify({ type: 'dealerdesk-leads', version: 1, leads: leads }, null, 2); },
      /** list: optional (e.g. search() result) so the export matches what staff filtered */
      exportCSV: function (list) { var cols = ['id', 'createdAt', 'status', 'channel', 'assignee', 'followUpAt', 'vin', 'interest_car_id', 'name', 'phone', 'email', 'interest', 'notes', 'staffNote', 'notesLog'];
        var rows = Array.isArray(list) ? list : leads;
        function val(l, k) { if (k === 'createdAt') return new Date(l[k]).toISOString(); if (k === 'followUpAt') return l[k] ? new Date(l[k]).toISOString() : ''; if (k === 'notesLog') return (l.notesLog || []).map(function (n) { return new Date(n.at).toISOString() + ' ' + (n.by ? n.by + ': ' : '') + n.text; }).join(' | '); return l[k]; }
        function cell(v, k) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v) && !(k === 'phone' && isPhone(v))) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }
        return [cols.join(',')].concat(rows.map(function (l) { return cols.map(function (k) { return cell(val(l, k), k); }).join(','); })).join('\n'); }
    };
  }
  var LEAD_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  function safeLeadId(id) { return typeof id === 'string' && LEAD_ID_RE.test(id) ? id : ''; }
  /** relative deep link for a lead's drawer on the staff screen ('' if the id is not a safe lead id) */
  function linkFor(id, page) { id = safeLeadId(id); return id ? (page || 'staff-inventory.html') + '?lead=' + encodeURIComponent(id) : ''; }
  /** read ?lead= or #lead= : {present, id} where id is '' when the value is unsafe */
  function leadFromUrl(search, hash) { var raw = null;
    [String(search || '').replace(/^\?/, ''), String(hash || '').replace(/^#/, '')].forEach(function (part) { if (raw != null) return; part.split('&').forEach(function (kv) { if (raw != null) return; var i = kv.indexOf('='); if ((i < 0 ? kv : kv.slice(0, i)) === 'lead') { try { raw = decodeURIComponent((i < 0 ? '' : kv.slice(i + 1)).replace(/\+/g, ' ')); } catch (e) { raw = ''; } } }); });
    return raw == null ? { present: false, id: '' } : { present: true, id: safeLeadId(raw) }; }
  /** URL with ?lead= set (id) or removed (null); #lead= always removed */
  function withLead(href, id) { var m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(String(href || '')), qs = (m[2] || '').replace(/^\?/, '').split('&').filter(function (kv) { return kv && kv.split('=')[0] !== 'lead'; });
    var h = (m[3] || '').replace(/^#/, '').split('&').filter(function (kv) { return kv && kv.split('=')[0] !== 'lead'; }); id = safeLeadId(id); if (id) qs.push('lead=' + encodeURIComponent(id));
    return m[1] + (qs.length ? '?' + qs.join('&') : '') + (h.length ? '#' + h.join('&') : ''); }
  var mod = { linkFor: linkFor, leadFromUrl: leadFromUrl, withLead: withLead, safeLeadId: safeLeadId, create: create, validate: validate, cleanPhone: cleanPhone, migrate: migrate, ago: ago, parseDate: parseDate, isOverdue: isOverdue, channelOf: channelOf, CHANNELS: CHANNELS, KEY: KEY, STAFF_KEY: STAFF_KEY, INTERESTS: INTERESTS, STATUSES: STATUSES };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod; else root.DDLeads = mod;
})(typeof self !== 'undefined' ? self : this);
