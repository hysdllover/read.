/* ui.js — 공통 UI 부품. 시트는 열 때 만들고 닫을 때 제거(리스너 누적 없음) */
'use strict';

function h(html) {
  var t = document.createElement('template');
  t.innerHTML = String(html).trim();
  return t.content.firstElementChild;
}

function toast(msg) {
  var el = h('<div class="toast">' + esc(msg) + '</div>');
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 1600);
}

/* 시트: opts = {title, body(Element), okLabel, onOk()->bool, onDelete} */
function openSheet(opts) {
  var wrap = h(
    '<div class="sheet-wrap">' +
    '<div class="sheet-dim"></div>' +
    '<div class="sheet" role="dialog" aria-modal="true">' +
    '<div class="sheet-head">' +
    '<button type="button" class="cancel">취소</button>' +
    '<b>' + esc(opts.title || '') + '</b>' +
    '<button type="button" class="ok">' + esc(opts.okLabel || '저장') + '</button>' +
    '</div>' +
    '<div class="sheet-body"></div>' +
    '</div></div>');
  var body = wrap.querySelector('.sheet-body');
  if (opts.body) body.appendChild(opts.body);
  if (opts.onDelete) {
    var del = h('<button type="button" class="btn full warn" style="margin-top:4px">삭제</button>');
    del.onclick = function () {
      confirmSheet('이 기록을 삭제할까요?').then(function (ok) {
        if (!ok) return;
        close(); opts.onDelete();
      });
    };
    body.appendChild(del);
  }
  function close() { wrap.remove(); }
  wrap.querySelector('.cancel').onclick = close;
  wrap.querySelector('.sheet-dim').onclick = close;
  wrap.querySelector('.ok').onclick = function () {
    if (!opts.onOk || opts.onOk() !== false) close();
  };
  document.body.appendChild(wrap);
  body.querySelectorAll('textarea').forEach(grow);
  return { close: close, el: wrap };
}

function confirmSheet(msg, okLabel) {
  return new Promise(function (res) {
    var wrap = h(
      '<div class="sheet-wrap">' +
      '<div class="sheet-dim"></div>' +
      '<div class="sheet">' +
      '<div class="sheet-msg">' + esc(msg) + '</div>' +
      '<div class="sheet-body" style="display:flex;gap:8px">' +
      '<button type="button" class="btn full no">취소</button>' +
      '<button type="button" class="btn full dark yes">' + esc(okLabel || '확인') + '</button>' +
      '</div></div></div>');
    function done(v) { wrap.remove(); res(v); }
    wrap.querySelector('.no').onclick = function () { done(false); };
    wrap.querySelector('.sheet-dim').onclick = function () { done(false); };
    wrap.querySelector('.yes').onclick = function () { done(true); };
    document.body.appendChild(wrap);
  });
}

/* 폼 조립 */
function form(html) { return h('<div>' + html + '</div>'); }

function fText(label, name, val, ph) {
  return '<div class="f"><label>' + esc(label) + '</label>' +
    '<input type="text" data-n="' + name + '" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '"></div>';
}
function fNum(label, name, val, ph) {
  return '<div class="f"><label>' + esc(label) + '</label>' +
    '<input type="text" inputmode="decimal" data-n="' + name + '" value="' + (val == null ? '' : esc(val)) + '" placeholder="' + esc(ph || '') + '"></div>';
}
function fDate(label, name, val) {
  return '<div class="f"><label>' + esc(label) + '</label>' +
    '<input type="text" inputmode="numeric" data-mask="date" data-n="' + name + '" value="' + esc(val || '') + '" placeholder="YYYY.MM.DD" maxlength="10"></div>';
}
function fArea(label, name, val, ph, big) {
  return '<div class="f"><label>' + esc(label) + '</label>' +
    '<textarea' + (big ? ' class="big"' : '') + ' data-n="' + name + '" placeholder="' + esc(ph || '') + '">' + esc(val || '') + '</textarea></div>';
}
function fSeg(label, name, opts, val) {
  var s = '<div class="f"><label>' + esc(label) + '</label><div class="seg" data-seg="' + name + '">';
  opts.forEach(function (o) {
    s += '<button type="button" data-v="' + esc(o) + '"' + (o === val ? ' class="on"' : '') + '>' + esc(o) + '</button>';
  });
  return s + '</div></div>';
}
function fChips(label, name, opts, vals) {
  vals = vals || [];
  var s = '<div class="f"><label>' + esc(label) + '</label><div class="seg" data-multi="' + name + '">';
  opts.forEach(function (o) {
    s += '<button type="button" data-v="' + esc(o) + '"' + (vals.indexOf(o) >= 0 ? ' class="on"' : '') + '>' + esc(o) + '</button>';
  });
  return s + '</div></div>';
}
function fStars(label, name, val) {
  var s = '<div class="f"><label>' + esc(label) + '</label><div class="stars" data-stars="' + name + '">';
  for (var i = 1; i <= 5; i++) s += '<button type="button" data-v="' + i + '"' + (i <= (val || 0) ? ' class="on"' : '') + '>●</button>';
  return s + '</div></div>';
}

/* 폼 동작 연결 + 값 읽기 */
function bindForm(root) {
  root.querySelectorAll('textarea').forEach(function (t) { t.addEventListener('input', function () { grow(t); }); });
  root.querySelectorAll('[data-mask="date"]').forEach(function (inp) {
    inp.addEventListener('input', function () {
      var v = inp.value.replace(/\D/g, '').slice(0, 8), o = v.slice(0, 4);
      if (v.length > 4) o += '.' + v.slice(4, 6);
      if (v.length > 6) o += '.' + v.slice(6, 8);
      inp.value = o;
    });
  });
  root.querySelectorAll('[data-seg]').forEach(function (g) {
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      g.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      g.dispatchEvent(new CustomEvent('pick', { detail: b.dataset.v, bubbles: true }));
    });
  });
  root.querySelectorAll('[data-multi]').forEach(function (g) {
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      b.classList.toggle('on');
    });
  });
  root.querySelectorAll('[data-stars]').forEach(function (g) {
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var v = +b.dataset.v;
      g.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', +x.dataset.v <= v); });
      g.dataset.val = v;
    });
  });
  return root;
}
function readForm(root) {
  var o = {};
  root.querySelectorAll('[data-n]').forEach(function (i) { o[i.dataset.n] = i.value.trim(); });
  root.querySelectorAll('[data-seg]').forEach(function (g) {
    var on = g.querySelector('button.on');
    o[g.dataset.seg] = on ? on.dataset.v : '';
  });
  root.querySelectorAll('[data-multi]').forEach(function (g) {
    o[g.dataset.multi] = Array.prototype.map.call(g.querySelectorAll('button.on'), function (b) { return b.dataset.v; });
  });
  root.querySelectorAll('[data-stars]').forEach(function (g) {
    var on = g.querySelectorAll('button.on');
    o[g.dataset.stars] = on.length || null;
  });
  return o;
}

/* 입력한 만큼 늘어나는 메모 칸 */
function grow(t) {
  t.style.height = 'auto';
  t.style.height = Math.max(t.scrollHeight + 2, t.classList.contains('big') ? 220 : 140) + 'px';
}

/* 아이패드 가로 등 넓은 화면에서 2단 (좁으면 1단으로 이어짐) */
function cols(root) {
  var c = h('<div class="cols"><div class="col"></div><div class="col"></div></div>');
  root.appendChild(c);
  return [c.children[0], c.children[1]];
}

/* 조각 */
function statCard(k, v, unit) {
  return '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v">' +
    esc(v) + (unit ? '<small>' + esc(unit) + '</small>' : '') + '</div></div>';
}
function barRow(label, val, max, color, suffix) {
  var p = max > 0 ? Math.min(100, (val / max) * 100) : 0;
  return '<div class="bar-row"><div class="lb">' + esc(label) + '</div>' +
    '<div class="tr"><div class="fl" style="width:' + p.toFixed(1) + '%;background:' + (color || 'var(--accent)') + '"></div></div>' +
    '<div class="vl">' + esc(val) + (suffix || '') + '</div></div>';
}
function emptyBox(title, sub) {
  return '<div class="empty"><b>' + esc(title) + '</b>' + esc(sub || '') + '</div>';
}

/* ---- 차트 공통 ---- */
var CHART_ID = 0;
/* 단조 3차 곡선 (점을 넘어가며 출렁이지 않음) */
function smoothPath(P) {
  if (P.length < 2) return '';
  if (P.length === 2) return 'M' + P[0][0] + ',' + P[0][1] + 'L' + P[1][0] + ',' + P[1][1];
  var n = P.length, d = [], m = [], i;
  for (i = 0; i < n - 1; i++) d.push((P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    var a = m[i] / d[i], b = m[i + 1] / d[i], t = a * a + b * b;
    if (t > 9) { t = 3 / Math.sqrt(t); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  var f = function (v) { return v.toFixed(1); };
  var s = 'M' + f(P[0][0]) + ',' + f(P[0][1]);
  for (i = 0; i < n - 1; i++) {
    var h3 = (P[i + 1][0] - P[i][0]) / 3;
    s += 'C' + f(P[i][0] + h3) + ',' + f(P[i][1] + m[i] * h3) + ' ' + f(P[i + 1][0] - h3) + ',' + f(P[i + 1][1] - m[i + 1] * h3) + ' ' + f(P[i + 1][0]) + ',' + f(P[i + 1][1]);
  }
  return s;
}
/* 가로 배치 계산: 간격이 좁으면 날짜 기울임, 더 좁으면 가로 스크롤 */
/* 넓은 화면(아이패드)은 큰 기준폭을 써서 글자가 과하게 커지지 않게 */
function wideChart(opt) { return opt.size === 'lg' || (opt.size !== 'sm' && window.innerWidth >= 700); }
function chartFrame(n, lg) {
  var k = lg ? 1.3 : 1, W0 = lg ? 640 : 320, L = 20 * k, R = 20 * k, MIN = 18 * k, W = W0;
  var gap = n > 1 ? (W - L - R) / (n - 1) : W;
  if (gap < MIN) { gap = MIN; W = L + R + (n - 1) * MIN; }
  var tilt = gap < 30 * k;
  return { k: k, W0: W0, W: W, L: L, gap: gap, tilt: tilt, B: (tilt ? 32 : 18) * k };
}
function chartOpen(fr, H, cls) {
  return '<div class="chart-scroll"><svg class="chart' + (cls ? ' ' + cls : '') + '" viewBox="0 0 ' + fr.W + ' ' + H + '"' +
    (fr.W > fr.W0 ? ' style="min-width:' + (fr.W0 === 640 ? fr.W / 2 : fr.W) + 'px"' : '') + '>';
}
function chartDate(fr, x, H, label) {
  if (!label) return '';
  if (fr.tilt) {
    var ly = H - fr.B + 10 * fr.k, lx = (x + 3 * fr.k).toFixed(1);
    return '<text class="dt" x="' + lx + '" y="' + ly + '" text-anchor="end" transform="rotate(-40 ' + lx + ' ' + ly + ')">' + esc(label) + '</text>';
  }
  return '<text class="dt" x="' + x.toFixed(1) + '" y="' + (H - 5 * fr.k) + '" text-anchor="middle">' + esc(label) + '</text>';
}
function legend(keys, colors) {
  return keys.map(function (k, i) {
    return '<span class="lgd"><i style="background:' + colors[i] + '"></i>' + esc(k) + '</span>';
  }).join('');
}

/* 꺾은선 — 부드러운 곡선 + 옅은 면, 모든 점수·날짜 표시. 마지막 점 강조 */
function lineChart(vals, labels, opt) {
  opt = opt || {};
  if (!vals.length) return '<div class="empty-mini">기록이 쌓이면 추이가 표시됩니다</div>';
  var n = vals.length, lg = wideChart(opt), fr = chartFrame(n, lg), k = fr.k;
  var T = 18 * k, H = (lg ? 186 : 132) + (fr.tilt ? 12 * k : 0), B = fr.B;
  var lo = opt.min != null ? opt.min : Math.min.apply(null, vals);
  var hi = opt.max != null ? opt.max : Math.max.apply(null, vals);
  if (opt.target != null) { lo = Math.min(lo, opt.target); hi = Math.max(hi, opt.target); }
  var span = (hi - lo) || 4;
  lo -= span * 0.18; hi += span * 0.12; span = hi - lo;
  function X(i) { return n === 1 ? fr.W / 2 : fr.L + i * fr.gap; }
  function Y(v) { return T + (1 - (v - lo) / span) * (H - T - B); }
  var id = 'g' + (++CHART_ID), base = H - B;
  var P = vals.map(function (v, i) { return [X(i), Y(v)]; });
  var s = chartOpen(fr, H, lg ? 'lg' : '');
  s += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" style="stop-color:var(--accent);stop-opacity:.16"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>';
  s += '<line class="gd" x1="0" y1="' + base + '" x2="' + fr.W + '" y2="' + base + '"/>';
  if (opt.target != null) {
    var ty = Y(opt.target).toFixed(1);
    s += '<line class="tg" x1="0" y1="' + ty + '" x2="' + fr.W + '" y2="' + ty + '"/>';
  }
  if (n > 1) {
    var path = smoothPath(P);
    s += '<path class="ar" d="' + path + 'L' + P[n - 1][0].toFixed(1) + ',' + base + 'L' + P[0][0].toFixed(1) + ',' + base + 'Z" fill="url(#' + id + ')"/>';
    s += '<path class="ln" d="' + path + '"/>';
  }
  vals.forEach(function (v, i) {
    var x = P[i][0], y = P[i][1], last = i === n - 1;
    var hit = opt.target != null && v >= opt.target;
    var prev = i > 0 ? P[i - 1][1] : null, next = i < n - 1 ? P[i + 1][1] : null;
    var below = n > 1 && (prev == null || y > prev) && (next == null || y > next) && y < base - 16 * k;
    if (last) s += '<circle class="halo" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (6 * k) + '"/>';
    s += '<circle class="pt' + (hit ? ' hit' : '') + (last ? ' last' : '') + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + ((last ? 3 : 2.2) * k) + '"/>';
    s += '<text class="vl' + (last ? ' strong' : '') + (hit ? ' good' : '') + '" x="' + x.toFixed(1) + '" y="' + (below ? y + 12 * k : y - 7 * k).toFixed(1) + '" text-anchor="middle">' + esc(v) + '</text>';
    s += chartDate(fr, x, H, labels && labels[i]);
  });
  return s + '</svg></div>';
}

/* 누적 막대 — rows: [[v1,v2,v3], ...]  위에 합계, 아래 날짜 */
function stackChart(rows, labels, colors, opt) {
  opt = opt || {};
  if (!rows.length) return '<div class="empty-mini">기록이 쌓이면 추이가 표시됩니다</div>';
  var n = rows.length, lg = wideChart(opt), fr = chartFrame(n, lg), k = fr.k;
  var T = 16 * k, H = (lg ? 172 : 124) + (fr.tilt ? 12 * k : 0), B = fr.B, base = H - B;
  var tot = rows.map(function (r) { return r.reduce(function (a, v) { return a + (v || 0); }, 0); });
  var mx = Math.max.apply(null, tot) || 1;
  var bw = Math.min(14 * k, fr.gap * 0.5);
  function X(i) { return n === 1 ? fr.W / 2 : fr.L + i * fr.gap; }
  var s = chartOpen(fr, H, lg ? 'lg' : '');
  s += '<line class="gd" x1="0" y1="' + base + '" x2="' + fr.W + '" y2="' + base + '"/>';
  rows.forEach(function (r, i) {
    var x = X(i) - bw / 2, y = base;
    r.forEach(function (v, j) {
      if (!v) return;
      var hgt = v / mx * (base - T - 4 * k);
      y -= hgt;
      s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(hgt - 1, 1).toFixed(1) + '" rx="' + Math.min(2.5 * k, bw / 3).toFixed(1) + '" fill="' + colors[j] + '"/>';
    });
    s += '<text class="vl' + (i === n - 1 ? ' strong' : '') + '" x="' + X(i).toFixed(1) + '" y="' + (y - 4 * k).toFixed(1) + '" text-anchor="middle">' + esc(tot[i]) + '</text>';
    s += chartDate(fr, X(i), H, labels && labels[i]);
  });
  return s + '</svg></div>';
}
/* 가로 스크롤 차트는 최신(오른쪽 끝)이 보이게 */
function scrollCharts(root) {
  (root || document).querySelectorAll('.chart-scroll').forEach(function (el) { el.scrollLeft = el.scrollWidth; });
}
