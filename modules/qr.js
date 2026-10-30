/* DealerDesk QR — minimal original QR Code encoder (byte mode, ECC level M, versions 1-10).
 * No dependencies, no network. API: DDQR.encode(text) -> boolean[][] ; DDQR.toSVG(text, {scale, margin}) -> svg string */
(function (root) {
  'use strict';
  var ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(v) { return Math.floor(rawModules(v) / 8) - ECC[v] * BLOCKS[v]; }
  function gmul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
  function rsDivisor(d) {
    var r = []; for (var i = 0; i < d; i++) r.push(0); r[d - 1] = 1; var root = 1;
    for (i = 0; i < d; i++) { for (var j = 0; j < d; j++) { r[j] = gmul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; } root = gmul(root, 2); }
    return r;
  }
  function rsRemainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); for (var i = 0; i < r.length; i++) r[i] ^= gmul(div[i], f); });
    return r;
  }
  function utf8(s) { var out = [], e = unescape(encodeURIComponent(s)); for (var i = 0; i < e.length; i++) out.push(e.charCodeAt(i)); return out; }
  function alignPos(v, size) {
    if (v === 1) return [];
    var n = Math.floor(v / 7) + 2, step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, r = [6];
    for (var p = size - 7; r.length < n; p -= step) r.splice(1, 0, p);
    return r;
  }
  function encode(text) {
    var bytes = utf8(String(text)), v;
    for (v = 1; v <= 10; v++) { var cb = v < 10 ? 8 : 16; if (4 + cb + bytes.length * 8 <= dataCodewords(v) * 8) break; }
    if (v > 10) throw new Error('QR: text too long');
    var cap = dataCodewords(v) * 8, bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = []; for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; data.push(b); }
    // blocks + interleave
    var nb = BLOCKS[v], ec = ECC[v], raw = Math.floor(rawModules(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    var div = rsDivisor(ec), dBlocks = [], eBlocks = [], off = 0;
    for (i = 0; i < nb; i++) { var len = shortLen - ec + (i < nShort ? 0 : 1), blk = data.slice(off, off + len); off += len; dBlocks.push(blk); eBlocks.push(rsRemainder(blk, div)); }
    var cw = [], maxD = shortLen - ec + 1;
    for (i = 0; i < maxD; i++) dBlocks.forEach(function (bk) { if (i < bk.length) cw.push(bk[i]); });
    for (i = 0; i < ec; i++) eBlocks.forEach(function (bk) { cw.push(bk[i]); });
    // matrix
    var size = v * 4 + 17, M = [], F = [];
    for (i = 0; i < size; i++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
    function set(x, y, d) { M[y][x] = d; F[y][x] = true; }
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    function finder(cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue; var d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); } }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var ap = alignPos(v, size), L = ap.length;
    for (i = 0; i < L; i++) for (var j = 0; j < L; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === L - 1) || (i === L - 1 && j === 0)) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    function format(mask) {
      var d = (0 << 3) | mask, r = d; for (var q = 0; q < 10; q++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var fb = ((d << 10) | r) ^ 0x5412; function bt(n) { return ((fb >>> n) & 1) === 1; }
      for (q = 0; q <= 5; q++) set(8, q, bt(q));
      set(8, 7, bt(6)); set(8, 8, bt(7)); set(7, 8, bt(8));
      for (q = 9; q < 15; q++) set(14 - q, 8, bt(q));
      for (q = 0; q < 8; q++) set(size - 1 - q, 8, bt(q));
      for (q = 8; q < 15; q++) set(8, size - 15 + q, bt(q));
      set(8, size - 8, true);
    }
    format(0);
    if (v >= 7) { var r = v; for (i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); var vb = (v << 12) | r;
      for (i = 0; i < 18; i++) { var bit = ((vb >>> i) & 1) === 1, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bit); set(c, a, bit); } }
    var bi = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!F[y][x] && bi < cw.length * 8) { M[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
      }
    }
    var masks = [function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x) { return x % 3 === 0; },
      function (x, y) { return (x + y) % 3 === 0; }, function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
      function (x, y) { return x * y % 2 + x * y % 3 === 0; }, function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; },
      function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }];
    function applyMask(m) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!F[y][x] && masks[m](x, y)) M[y][x] = !M[y][x]; }
    function penalty() {
      var p = 0, dark = 0, x, y;
      for (y = 0; y < size; y++) { var run = 1, runC = 1; for (x = 0; x < size; x++) { if (M[y][x]) dark++;
        if (x > 0) { if (M[y][x] === M[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
          if (M[x][y] === M[x - 1][y]) { runC++; if (runC === 5) p += 3; else if (runC > 5) p++; } else runC = 1; } } }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { var c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
      var P1 = '10111010000', P2 = '00001011101';
      for (y = 0; y < size; y++) { var row = '', col = ''; for (x = 0; x < size; x++) { row += M[y][x] ? 1 : 0; col += M[x][y] ? 1 : 0; }
        [row, col].forEach(function (ln) { ln = '0000' + ln + '0000'; for (var k = 0; k + 11 <= ln.length; k++) { var sub = ln.substr(k, 11); if (sub === P1 || sub === P2) p += 40; } }); }
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    for (var m = 0; m < 8; m++) { applyMask(m); format(m); var pp = penalty(); if (pp < bestP) { bestP = pp; best = m; } applyMask(m); }
    applyMask(best); format(best);
    return M;
  }
  function toSVG(text, opt) {
    opt = opt || {}; var M = encode(text), s = opt.scale || 4, mg = opt.margin == null ? 4 : opt.margin, n = M.length, W = (n + mg * 2) * s, path = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (M[y][x]) path += 'M' + (x + mg) * s + ' ' + (y + mg) * s + 'h' + s + 'v' + s + 'h-' + s + 'z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + W + '" width="' + W + '" height="' + W + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="' + path + '"/></svg>';
  }
  var api = { encode: encode, toSVG: toSVG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DDQR = api;
})(typeof self !== 'undefined' ? self : this);
