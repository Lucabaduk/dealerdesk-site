/* DealerDesk storage helper: localStorage when available, in-memory fallback (node tests / private mode). */
(function (root) {
  'use strict';
  function memoryStorage() { var m = {}; return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } }; }
  function defaultStorage() { try { if (root.localStorage) { root.localStorage.setItem('__dd_t', '1'); root.localStorage.removeItem('__dd_t'); return root.localStorage; } } catch (e) {} return memoryStorage(); }
  function cleanText(v, max) { if (v == null) return ''; return String(v).replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 200); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"'`]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]; }); }
  var api = { memoryStorage: memoryStorage, defaultStorage: defaultStorage, cleanText: cleanText, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DDStore = api;
})(typeof self !== 'undefined' ? self : this);
