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
function fArea(label, name, val, ph) {
  return '<div class="f"><label>' + esc(label) + '</label>' +
    '<textarea data-n="' + name + '" placeholder="' + esc(ph || '') + '">' + esc(val || '') + '</textarea></div>';
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

/* 꺾은선 차트 (SVG) */
function lineChart(vals, labels, opt) {
  opt = opt || {};
  if (!vals.length) return '<div class="empty-mini">기록이 쌓이면 추이가 표시됩니다</div>';
  var W = 320, H = 118, L = 20, R = 8, T = 10, B = 18;
  var lo = opt.min != null ? opt.min : Math.min.apply(null, vals);
  var hi = opt.max != null ? opt.max : Math.max.apply(null, vals);
  if (opt.target != null) { lo = Math.min(lo, opt.target); hi = Math.max(hi, opt.target); }
  var span = (hi - lo) || 1;
  lo -= span * 0.12; hi += span * 0.12; span = hi - lo;
  var inv = !!opt.invert;
  function X(i) { return vals.length === 1 ? (L + (W - L - R) / 2) : L + i * (W - L - R) / (vals.length - 1); }
  function Y(v) { var r = (v - lo) / span; return T + (inv ? r : 1 - r) * (H - T - B); }
  var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '">';
  s += '<line class="gd" x1="' + L + '" y1="' + (H - B) + '" x2="' + W + '" y2="' + (H - B) + '"/>';
  if (opt.target != null) {
    s += '<line class="tg" x1="' + L + '" y1="' + Y(opt.target).toFixed(1) + '" x2="' + W + '" y2="' + Y(opt.target).toFixed(1) + '"/>';
  }
  var pts = vals.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ');
  if (vals.length > 1) s += '<polyline class="ln" points="' + pts + '"/>';
  vals.forEach(function (v, i) {
    s += '<circle class="pt" cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="2.4"/>';
    s += '<text x="' + X(i).toFixed(1) + '" y="' + (Y(v) - 6).toFixed(1) + '" text-anchor="middle">' + esc(v) + '</text>';
    if (labels && labels[i]) {
      s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(labels[i]) + '</text>';
    }
  });
  return s + '</svg>';
}
