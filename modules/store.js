/* DealerDesk storage helper: localStorage when available, in-memory fallback (node tests / private mode). */
(function (root) {
  'use strict';
  function memoryStorage() { var m = Object.create(null); return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } }; }
  function defaultStorage() { try { if (root.localStorage) { root.localStorage.setItem('__dd_t', '1'); root.localStorage.removeItem('__dd_t'); return root.localStorage; } } catch (e) {} return memoryStorage(); }
  function cleanText(v, max) { if (v == null) return ''; return String(v).replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 200); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"'`]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]; }); }
  var NOPHOTO = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#d9dee6"/><text x="200" y="158" font-family="sans-serif" font-size="22" fill="#5b6577" text-anchor="middle">Photo coming soon</text></svg>');
  /** set src with graceful fallback when the file (e.g. assets/site/no-photo.webp) is missing */
  function setImg(img, src) { img.onerror = function () { img.onerror = null; img.src = NOPHOTO; }; img.src = src || NOPHOTO; return img; }
  /** returns url only if https and host is exactly in the allowlist, else '' */
  function allowedEndpoint(url, hosts) {
    var m = /^https:\/\/([a-z0-9.-]+)(:443)?(\/[A-Za-z0-9_\/.%~-]*)?$/i.exec(String(url || '').trim()); if (!m) return '';
    var h = m[1].toLowerCase(); return (hosts || []).map(function (x) { return String(x).toLowerCase(); }).indexOf(h) >= 0 ? m[0] : '';
  }
  // who is using this staff device (credited on lead notes / status changes). Asked once, remembered here.
  var ME_KEY = 'dealerdesk.me.v1';
  function getStaffName(store) { try { return cleanText((store || defaultStorage()).getItem(ME_KEY), 60); } catch (e) { return ''; } }
  function setStaffName(name, store) { var n = cleanText(name, 60); try { var st = store || defaultStorage(); if (n) st.setItem(ME_KEY, n); else st.removeItem(ME_KEY); } catch (e) {} return n; }
  /** staff names known to the main app (dealerdesk.v2 -> staff[].name), deduped, proto-safe */
  function appStaffNames(store) { var out = [], seen = Object.create(null); try { var st = JSON.parse((store || defaultStorage()).getItem('dealerdesk.v2') || 'null');
    (st && Array.isArray(st.staff) ? st.staff : []).forEach(function (x) { var n = cleanText(x && x.name, 60); if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = 1; out.push(n); } }); } catch (e) {} return out.slice(0, 100); }
  var api = { ME_KEY: ME_KEY, getStaffName: getStaffName, setStaffName: setStaffName, appStaffNames: appStaffNames, NOPHOTO: NOPHOTO, setImg: setImg, allowedEndpoint: allowedEndpoint, memoryStorage: memoryStorage, defaultStorage: defaultStorage, cleanText: cleanText, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DDStore = api;
})(typeof self !== 'undefined' ? self : this);
