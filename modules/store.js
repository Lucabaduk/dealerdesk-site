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
  var api = { NOPHOTO: NOPHOTO, setImg: setImg, allowedEndpoint: allowedEndpoint, memoryStorage: memoryStorage, defaultStorage: defaultStorage, cleanText: cleanText, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DDStore = api;
})(typeof self !== 'undefined' ? self : this);
