/* DealerDesk favorites: VINs saved on this device. Heart toggle + count badge + change events. */
(function (root) {
  'use strict';
  var S = (typeof module !== 'undefined' && module.exports) ? require('./store.js') : root.DDStore;
  var KEY = 'dealerdesk.favorites.v1', MAX = 200, VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
  function cv(v) { return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function create(opts) {
    opts = opts || {}; var store = opts.storage || S.defaultStorage(), subs = [], vins = [];
    function read() { try { var a = JSON.parse(store.getItem(KEY) || '[]'); return Array.isArray(a) ? a.map(cv).filter(function (v, i, s) { return VIN_RE.test(v) && s.indexOf(v) === i; }).slice(0, MAX) : []; } catch (e) { return []; } }
    vins = read();
    function emit(type, vin) { var ev = { type: type, vin: vin, count: vins.length, vins: vins.slice() }; subs.slice().forEach(function (f) { try { f(ev); } catch (e) {} }); }
    function save(type, vin) { try { store.setItem(KEY, JSON.stringify(vins)); } catch (e) {} emit(type, vin); }
    var api = {
      list: function () { return vins.slice(); }, count: function () { return vins.length; },
      has: function (v) { return vins.indexOf(cv(v)) >= 0; },
      add: function (v) { v = cv(v); if (!VIN_RE.test(v) || api.has(v)) return false; if (vins.length >= MAX) vins.shift(); vins.push(v); save('add', v); return true; },
      remove: function (v) { v = cv(v); var i = vins.indexOf(v); if (i < 0) return false; vins.splice(i, 1); save('remove', v); return true; },
      toggle: function (v) { return api.has(v) ? (api.remove(v), false) : api.add(v); },
      clear: function () { if (!vins.length) return; vins = []; save('clear', null); },
      onChange: function (f) { subs.push(f); return function () { subs = subs.filter(function (g) { return g !== f; }); }; },
      /** reload after another tab changed storage */
      sync: function () { var n = read(); if (JSON.stringify(n) !== JSON.stringify(vins)) { vins = n; emit('sync', null); } }
    };
    if (opts.listenStorage !== false && root.addEventListener) root.addEventListener('storage', function (e) { if (e.key === KEY) api.sync(); });
    return api;
  }
  /** DOM helpers (browser only): heart button + badge */
  function heart(fav, vin) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'dd-heart';
    function paint() { var on = fav.has(vin); b.textContent = on ? '\u2665' : '\u2661'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', on ? 'Remove from favorites' : 'Save to favorites'); }
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fav.toggle(vin); });
    fav.onChange(paint); paint(); return b;
  }
  function badge(fav, el) { function paint() { var n = fav.count(); el.textContent = n ? String(n) : ''; el.hidden = !n; } fav.onChange(paint); paint(); return el; }
  var mod = { create: create, heart: heart, badge: badge, KEY: KEY, MAX: MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod; else root.DDFavorites = mod;
})(typeof self !== 'undefined' ? self : this);
