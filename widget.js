// 국어 대시보드 위젯 (iOS Scriptable 앱용)
// 1) 앱 설정 → 홈 화면 위젯 → '스크립트 복사' → Scriptable에서 새 스크립트에 붙여 넣기
//    (복사할 때 기기 연동 토큰이 자동으로 들어갑니다. 이 스크립트는 다른 사람과 공유하지 마세요)
// 2) 홈 화면(또는 잠금 화면)에 Scriptable 위젯 추가 → 길게 눌러 편집 → Script 선택
// 3) Parameter 칸에 앱에서 만든 위젯 이름을 적기 (예: 위젯 1)
//    위젯 구성 · 글꼴은 앱 설정 → 홈 화면 위젯에서 바꾸면 기기 연동으로 자동 반영됩니다.
// 기록은 앱의 '기기 연동'(깃허브 비공개 Gist)에서 읽어 옵니다.

const APP_URL = 'https://hysdllover.github.io/read./';
const GIST_DESC = 'korean-dashboard-sync';
const SCRIPT_VER = 23;   // 앱의 위젯 기능과 맞는 스크립트 판 (앱이 더 높으면 다시 복사 안내)
const TOKEN = '__KOR_DASH_TOKEN__';   // 앱에서 복사할 때 자동으로 채워짐
const hasToken = () => !!TOKEN && TOKEN.indexOf('__KOR_DASH') !== 0;
const DEF = { accent: '#5b6b85', good: '#7a8465', bad: '#a8868a', hl: '#8f8aae', bg: '#f5f5f7', card: '#ffffff', text: '#1f2023' };
const AREA_DEF = { '독서': '#5b6b85', '문학': '#8f8aae', '선택': '#b3a78a' };

// ---------- 위젯 구성 ----------
const CFG_DEF = {
  kind: 'trend', metric: 'grade', count: 10, shape: 'curve', style: 'card', align: 'left',
  textFont: 'sys', numFont: 'sys', weight: 'light', scale: 1, pad: 'normal',
  design: null,   // style 'custom'일 때 {bg, bg2, grad, text, accent, good, bad, hl}
  blocks: null,   // kind 'custom'일 때 구성요소 목록
  show: { title: true, value: true, delta: true, target: true, labels: true, dates: true, stats: true, exam: true }
};
// 예전 방식(낱말) Parameter도 읽기: 예) 백분위 다크 명조
const OLD = {
  '등급': ['metric', 'grade'], '백분위': ['metric', 'pct'], '원점수': ['metric', 'raw'],
  '행동강령': ['kind', 'rule'], '요약': ['kind', 'summary'], '오답': ['kind', 'wrong'],
  '기본': ['style', 'card'], '배경': ['style', 'bg'], '다크': ['style', 'dark'], '컬러': ['style', 'color'],
  '고딕': ['textFont', 'sys'], '얇게': ['textFont', 'sdlight'], '둥근': ['textFont', 'round'], '명조': ['textFont', 'myungjo'], '모노': ['textFont', 'mono']
};
function getConfig(s, param) {
  const list = Array.isArray(s.widgets) ? s.widgets : [];
  const p = String(param || '').trim();
  let c = list.find((x) => x.name === p) || (!p && list[0]) || null;
  let missing = false;
  if (!c) {
    missing = !!p && !p.split(/[\s,·/]+/).some((w) => OLD[w]);
    c = {};
    p.split(/[\s,·/]+/).forEach((w) => { if (OLD[w]) c[OLD[w][0]] = OLD[w][1]; });
    if (c.textFont === 'myungjo') c.numFont = 'didot';
    if (c.textFont === 'sdlight') c.numFont = 'helv';
  }
  const out = Object.assign({}, CFG_DEF, c);
  out.show = Object.assign({}, CFG_DEF.show, c.show || {});
  out.missing = missing ? p : null;
  return out;
}

// ---------- 기록 불러오기 (실패하면 마지막 저장본) ----------
const fm = FileManager.local();
const cachePath = () => fm.joinPath(fm.documentsDirectory(), 'kor-dash.json');
async function gh(path) {
  const r = new Request('https://api.github.com' + path);
  r.headers = { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json' };
  return await r.loadJSON();
}
async function load() {
  try {
    const list = await gh('/gists?per_page=100');
    const g = (list || []).find((x) => x.description === GIST_DESC);
    if (!g) throw new Error('연동 Gist 없음 — 앱에서 기기 연동을 켜 주세요');
    const full = await gh('/gists/' + g.id);
    let f = null, bt = -1;
    Object.keys(full.files || {}).forEach((name) => {
      if (!/^korean-\d\.json$/.test(name)) return;
      let t = 0;
      try { t = JSON.parse(full.files[name].content || '{}').t || 0; } catch (e) { t = 0; }
      if (t >= bt) { bt = t; f = full.files[name]; }
    });
    if (!f) throw new Error('연동된 기록이 없습니다');
    let text = f.content;
    if (f.truncated && f.raw_url) {
      const rr = new Request(f.raw_url);
      rr.headers = { Authorization: 'Bearer ' + TOKEN };
      text = await rr.loadString();
    }
    fm.writeString(cachePath(), text);
    return JSON.parse(text);
  } catch (e) {
    if (fm.fileExists(cachePath())) return JSON.parse(fm.readString(cachePath()));
    throw e;
  }
}

// ---------- 색 ----------
const C = (hex, a) => new Color(hex, a == null ? 1 : a);
function rgb(h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) || 0); }
function mix(a, b, t) { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function palette(theme, style, design) {
  const t = Object.assign({}, DEF, theme || {});
  let p;
  if (style === 'custom') {
    const d = Object.assign({ bg: t.card, text: t.text, accent: t.accent, good: t.good, bad: t.bad, hl: t.hl }, design || {});
    p = { bg: d.bg, text: d.text, accent: d.accent, good: d.good, bad: d.bad, hl: d.hl };
  } else if (style === 'dark') p = { bg: '#1c2029', text: '#e6e7ec', accent: mix(t.accent, '#ffffff', 0.35), good: mix(t.good, '#ffffff', 0.3), bad: mix(t.bad, '#ffffff', 0.25), hl: mix(t.hl, '#ffffff', 0.3) };
  else if (style === 'color') p = { bg: t.accent, text: '#ffffff', accent: '#ffffff', good: mix(t.good, '#ffffff', 0.65), bad: mix(t.bad, '#ffffff', 0.6), hl: '#ffffff' };
  else if (style === 'paper') p = { bg: '#f6f2e9', text: '#2c2a25', accent: mix(t.accent, '#2c2a25', 0.15), good: t.good, bad: t.bad, hl: t.hl };
  else if (style === 'pastel') p = { bg: mix(t.accent, '#ffffff', 0.86), text: mix(t.accent, '#15171c', 0.75), accent: t.accent, good: t.good, bad: t.bad, hl: t.hl };
  else p = { bg: style === 'bg' ? t.bg : t.card, text: t.text, accent: t.accent, good: t.good, bad: t.bad, hl: t.hl };
  p.sub = mix(p.text, p.bg, 0.45);
  p.faint = mix(p.text, p.bg, 0.62);
  p.line = mix(p.bg, p.text, 0.12);
  p.track = mix(p.bg, p.text, 0.08);
  p.dot = p.bg;
  return p;
}

// ---------- 글꼴 ----------
const SYSW = { ul: 'ultraLight', th: 'thin', li: 'light', re: 'regular', me: 'medium', se: 'semibold' };
function sysFont(kind, w, s) {
  const n = SYSW[w] || 'regular';
  if (kind === 'round') return Font[n + 'RoundedSystemFont'](s);
  if (kind === 'mono') return Font[n + 'MonospacedSystemFont'](s);
  return Font[n + 'SystemFont'](s);
}
const strong = (w) => w === 'se' || w === 'me';
// 한글이 들어가는 글자
const TEXT_FONTS = {
  sys: (s, w) => sysFont('sys', w, s),
  round: (s, w) => sysFont('round', w, s),
  mono: (s, w) => sysFont('mono', w, s),
  sdlight: (s, w) => new Font(strong(w) ? 'AppleSDGothicNeo-Medium' : 'AppleSDGothicNeo-Light', s),
  sdthin: (s, w) => new Font(strong(w) ? 'AppleSDGothicNeo-Regular' : 'AppleSDGothicNeo-Thin', s),
  myungjo: (s) => new Font('AppleMyungjo', s)
};
// 숫자 (영문 글꼴도 사용)
const NUM_FONTS = {
  sys: (s, w) => sysFont('sys', w, s),
  round: (s, w) => sysFont('round', w, s),
  mono: (s, w) => sysFont('mono', w, s),
  helv: (s, w) => new Font({ ul: 'HelveticaNeue-UltraLight', th: 'HelveticaNeue-Thin', li: 'HelveticaNeue-Light' }[w] || 'HelveticaNeue', s),
  avenir: (s, w) => new Font({ ul: 'AvenirNext-UltraLight', th: 'AvenirNext-UltraLight', li: 'AvenirNext-Regular' }[w] || 'AvenirNext-Medium', s),
  didot: (s, w) => new Font(strong(w) ? 'Didot-Bold' : 'Didot', s),
  futura: (s, w) => new Font(strong(w) ? 'Futura-Bold' : 'Futura-Medium', s),
  georgia: (s, w) => new Font(strong(w) ? 'Georgia-Bold' : 'Georgia', s),
  optima: (s, w) => new Font(strong(w) ? 'Optima-Bold' : 'Optima-Regular', s),
  gill: (s, w) => new Font(strong(w) ? 'GillSans-SemiBold' : (w === 're' ? 'GillSans' : 'GillSans-Light'), s)
};
const BIGW = { thin: 'ul', light: 'li', regular: 're' };
function fonts(cfg) {
  const k = +cfg.scale || 1, tf = TEXT_FONTS[cfg.textFont] || TEXT_FONTS.sys, nf = NUM_FONTS[cfg.numFont] || NUM_FONTS.sys;
  return {
    txt: (s, w) => tf(s * k, w || 're'),
    num: (s, w) => nf(s * k, w || BIGW[cfg.weight] || 'li'),
    k
  };
}

// ---------- 지표 ----------
const wsum = (e) => ['독서', '문학', '선택'].reduce((a, k) => a + (+((e.w || {})[k]) || 0), 0);
const warea = (k) => (e) => (e.w && e.w[k] != null && e.w[k] !== '' ? +e.w[k] : null);
const METRICS = {
  grade: { get: (e) => e.grade, title: '등급', unit: '등급', invert: true, target: (s) => s.targetGrade },
  pct: { get: (e) => e.pct, title: '백분위', unit: '', target: (s) => s.targetPct },
  raw: { get: (e) => e.raw, title: '원점수', unit: '점', target: () => null },
  wrong: { get: (e) => (e.w ? wsum(e) : null), title: '오답 합계', unit: '개', invert: true, target: () => null },
  w독서: { get: warea('독서'), title: '독서 오답', unit: '개', invert: true, target: () => null },
  w문학: { get: warea('문학'), title: '문학 오답', unit: '개', invert: true, target: () => null },
  w선택: { get: warea('선택'), title: '선택 오답', unit: '개', invert: true, target: () => null }
};
const shortDate = (d) => (d || '').slice(5).replace('.', '/');
const avg = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
function series(ctx, key, n) {
  const M = METRICS[key] || METRICS.grade;
  const rows = ctx.exams.filter((e) => M.get(e) != null);
  const cut = n === 0 ? rows : rows.slice(-n);
  return { M, all: rows, rows: cut, vals: cut.map((e) => +M.get(e)), labels: cut.map((e) => shortDate(e.date)) };
}
function delta(cur, prev, invert) {
  if (cur == null || prev == null || cur === prev) return null;
  const up = cur > prev, good = invert ? !up : up;
  return { s: (up ? '▲' : '▼') + Math.round(Math.abs(cur - prev) * 10) / 10, good };
}
const hitOf = (M, v, tg) => tg != null && (M.invert ? v <= tg : v >= tg);

// 날짜 글자가 겹치지 않게: 마지막 날짜부터 거꾸로, 충분히 떨어진 것만 표시
function dateMarks(xs, minGap) {
  const keep = new Set();
  let lastX = Infinity;
  for (let i = xs.length - 1; i >= 0; i--) {
    if (lastX - xs[i] >= minGap) { keep.add(i); lastX = xs[i]; }
  }
  return keep;
}

// ---------- 그림: 추이 (곡선 · 직선 · 막대 · 점) ----------
function chartImg(vals, labels, o) {
  const { W, H, P, F } = o;
  const dc = new DrawContext();
  dc.size = new Size(W, H); dc.opaque = false; dc.respectScreenScale = true;
  const n = vals.length, shape = o.shape || 'curve', bar = shape === 'bar';
  const L = o.pad == null ? 12 : o.pad, R = L, T = o.values === false ? 4 : 15, B = o.dates ? 15 : 4;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (o.target != null) { lo = Math.min(lo, o.target); hi = Math.max(hi, o.target); }
  const span = (hi - lo) || 2;
  lo -= span * (bar ? 0.6 : 0.22); hi += span * 0.22;
  const gap = n > 1 ? (W - L - R) / (n - 1) : W;
  const X = (i) => n === 1 ? W / 2 : L + i * gap;
  const Y = (v) => { const r = (v - lo) / (hi - lo); return T + (o.invert ? r : 1 - r) * (H - T - B); };
  const pts = vals.map((v, i) => ({ x: X(i), y: Y(v) }));
  const pt = (q) => new Point(q.x, q.y);
  const col = o.color || P.accent;
  let p;
  if (o.base !== false) {
    dc.setStrokeColor(C(P.line)); dc.setLineWidth(0.6);
    p = new Path(); p.move(new Point(0, H - B)); p.addLine(new Point(W, H - B)); dc.addPath(p); dc.strokePath();
  }
  if (o.target != null) {
    dc.setStrokeColor(C(P.good, 0.85)); dc.setLineWidth(0.8);
    for (let x = 0; x < W; x += 5) { p = new Path(); p.move(new Point(x, Y(o.target))); p.addLine(new Point(Math.min(x + 2, W), Y(o.target))); dc.addPath(p); dc.strokePath(); }
  }
  if (bar) {
    const bw = Math.min(12, gap * 0.55);
    pts.forEach((q, i) => {
      const hit = o.target != null && (o.invert ? vals[i] <= o.target : vals[i] >= o.target);
      const top = Math.min(q.y, H - B - 2), h = Math.max(2, H - B - top);
      const path = new Path(); path.addRoundedRect(new Rect(q.x - bw / 2, top, bw, h), 2, 2);
      dc.setFillColor(C(hit ? P.good : col, i === n - 1 ? 1 : 0.7)); dc.addPath(path); dc.fillPath();
    });
  } else if (n > 1 && shape !== 'dot') {
    p = new Path(); p.move(pt(pts[0]));
    for (let i = 0; i < n - 1; i++) {
      if (shape === 'line') p.addLine(pt(pts[i + 1]));
      else {
        const dx = (pts[i + 1].x - pts[i].x) / 2;
        p.addCurve(pt(pts[i + 1]), new Point(pts[i].x + dx, pts[i].y), new Point(pts[i + 1].x - dx, pts[i + 1].y));
      }
    }
    dc.setStrokeColor(C(col)); dc.setLineWidth(o.lw || 1.5); dc.addPath(p); dc.strokePath();
  }
  const marks = dateMarks(pts.map((q) => q.x), 34);
  pts.forEach((q, i) => {
    const last = i === n - 1;
    const hit = o.target != null && (o.invert ? vals[i] <= o.target : vals[i] >= o.target);
    if (!bar) {
      const r = shape === 'dot' ? (last ? 3.6 : 2.8) : (last ? 3.2 : (o.dots === false ? 0 : 2.2));
      if (r) {
        dc.setFillColor(C(hit ? P.good : (last || shape === 'dot' ? col : P.dot)));
        dc.fillEllipse(new Rect(q.x - r, q.y - r, r * 2, r * 2));
        if (!hit && !last && shape !== 'dot') { dc.setStrokeColor(C(col)); dc.setLineWidth(1); dc.strokeEllipse(new Rect(q.x - r, q.y - r, r * 2, r * 2)); }
      }
    }
    if (o.values !== false) {
      dc.setTextAlignedCenter();
      dc.setFont(F.num(8.5, last ? 'se' : 're'));
      dc.setTextColor(C(hit ? P.good : (last ? P.text : P.sub)));
      const ty = bar ? Math.min(q.y, H - B - 2) - 12 : q.y - 15;
      dc.drawTextInRect(String(vals[i]), new Rect(q.x - 14, ty, 28, 11));
    }
    if (o.dates && labels && marks.has(i)) {
      dc.setTextAlignedCenter();
      dc.setFont(F.num(7.5, 're')); dc.setTextColor(C(P.faint));
      dc.drawTextInRect(labels[i], new Rect(q.x - 16, H - B + 4, 32, 10));
    }
  });
  return dc.getImage();
}

// ---------- 그림: 누적 막대 (영역별 오답) ----------
function stackImg(rows, labels, colors, o) {
  const { W, H, P, F } = o;
  const dc = new DrawContext();
  dc.size = new Size(W, H); dc.opaque = false; dc.respectScreenScale = true;
  const n = rows.length, L = 10, R = 10, T = o.values === false ? 3 : 13, B = o.dates ? 15 : 3;
  const tot = rows.map((r) => r.reduce((a, v) => a + (v || 0), 0));
  const mx = Math.max(1, ...tot);
  const gap = n > 1 ? (W - L - R) / (n - 1) : W, bw = Math.min(12, gap * 0.5);
  const X = (i) => n === 1 ? W / 2 : L + i * gap;
  dc.setStrokeColor(C(P.line)); dc.setLineWidth(0.6);
  const p = new Path(); p.move(new Point(0, H - B)); p.addLine(new Point(W, H - B)); dc.addPath(p); dc.strokePath();
  const marks = dateMarks(rows.map((r, i) => X(i)), 34);
  rows.forEach((r, i) => {
    let y = H - B;
    r.forEach((v, j) => {
      if (!v) return;
      const h = v / mx * (H - B - T - 2);
      y -= h;
      const path = new Path(); path.addRoundedRect(new Rect(X(i) - bw / 2, y, bw, Math.max(h - 1, 1)), 2, 2);
      dc.setFillColor(C(colors[j])); dc.addPath(path); dc.fillPath();
    });
    if (o.values !== false) {
      dc.setTextAlignedCenter();
      dc.setFont(F.num(8, i === n - 1 ? 'se' : 're')); dc.setTextColor(C(i === n - 1 ? P.text : P.sub));
      dc.drawTextInRect(String(tot[i]), new Rect(X(i) - 12, y - 12, 24, 10));
    }
    if (o.dates && marks.has(i)) {
      dc.setTextAlignedCenter();
      dc.setFont(F.num(7.5, 're')); dc.setTextColor(C(P.faint));
      dc.drawTextInRect(labels[i], new Rect(X(i) - 16, H - B + 4, 32, 10));
    }
  });
  return dc.getImage();
}

// ---------- 그림: 고리 (목표 달성률) ----------
function ringImg(frac, D, P, lw) {
  const dc = new DrawContext();
  dc.size = new Size(D, D); dc.opaque = false; dc.respectScreenScale = true;
  const c = D / 2, r = c - lw / 2 - 1;
  dc.setStrokeColor(C(P.track)); dc.setLineWidth(lw);
  dc.strokeEllipse(new Rect(c - r, c - r, r * 2, r * 2));
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0) {
    const p = new Path(), steps = Math.max(2, Math.round(90 * f));
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + 2 * Math.PI * f * i / steps;
      const q = new Point(c + r * Math.cos(a), c + r * Math.sin(a));
      if (i === 0) p.move(q); else p.addLine(q);
    }
    dc.setStrokeColor(C(P.good)); dc.setLineWidth(lw); dc.addPath(p); dc.strokePath();
  }
  return dc.getImage();
}

// ---------- 종이 질감 배경 (점·섬유를 직접 그림, 매번 같은 무늬) ----------
function paperImg(W, H, bg, bg2, lv, note, margin, P) {
  const dc = new DrawContext();
  dc.size = new Size(W, H); dc.opaque = true; dc.respectScreenScale = true;
  if (bg2) {
    for (let i = 0; i < 48; i++) { dc.setFillColor(C(mix(bg, bg2, i / 47))); dc.fillRect(new Rect(0, H * i / 48, W, H / 48 + 1)); }
  } else { dc.setFillColor(C(bg)); dc.fillRect(new Rect(0, 0, W, H)); }
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const dark = rgb(bg).reduce((a, v) => a + v, 0) < 384, ink = dark ? '#ffffff' : '#5a4f3c';
  const k = [0, 0.6, 1, 1.5][lv] || 0;
  for (let i = 0; k && i < W * H / 9; i++) {   // 잔 알갱이
    dc.setFillColor(C(rnd() < 0.5 ? ink : (dark ? '#000000' : '#ffffff'), (0.025 + rnd() * 0.05) * k));
    const s = rnd() < 0.85 ? 0.6 : 1.2;
    dc.fillRect(new Rect(rnd() * W, rnd() * H, s, s));
  }
  dc.setLineWidth(0.4);
  for (let i = 0; k && i < W * H / 900; i++) {   // 섬유
    const x = rnd() * W, y = rnd() * H, len = 3 + rnd() * 9, a = rnd() * Math.PI;
    const p = new Path(); p.move(new Point(x, y)); p.addLine(new Point(x + Math.cos(a) * len, y + Math.sin(a) * len));
    dc.setStrokeColor(C(ink, 0.05 * k)); dc.addPath(p); dc.strokePath();
  }
  /* 노트 무늬: 줄 · 모눈 · 점, 왼쪽 여백선 */
  const rule = C(mix(bg, P ? P.accent : ink, dark ? 0.22 : 0.16));
  if (note === 'lined' || note === 'grid') {
    dc.setStrokeColor(rule); dc.setLineWidth(0.5);
    for (let y = 22; y < H; y += 18) { const p = new Path(); p.move(new Point(0, y)); p.addLine(new Point(W, y)); dc.addPath(p); dc.strokePath(); }
    if (note === 'grid') for (let x = 18; x < W; x += 18) { const p = new Path(); p.move(new Point(x, 0)); p.addLine(new Point(x, H)); dc.addPath(p); dc.strokePath(); }
  } else if (note === 'dot') {
    dc.setFillColor(rule);
    for (let y = 16; y < H; y += 16) for (let x = 16; x < W; x += 16) dc.fillEllipse(new Rect(x - 0.8, y - 0.8, 1.6, 1.6));
  }
  if (margin) {
    const p = new Path(); p.move(new Point(10, 0)); p.addLine(new Point(10, H));
    dc.setStrokeColor(C(mix(bg, P ? P.bad : '#b07a80', 0.6))); dc.setLineWidth(0.8); dc.addPath(p); dc.strokePath();
  }
  return dc.getImage();
}

// ---------- 위젯 조각 ----------
// Scriptable(iOS)은 정렬을 안 정하면 가운데로 놓으므로, 모든 줄의 정렬을 직접 정한다.
const HSET = new WeakSet(), LSET = new WeakSet(), CSET = new WeakSet();
function hz(st) { st.layoutHorizontally(); HSET.add(st); return st; }
function vt(st) { st.layoutVertically(); st.topAlignContent(); LSET.add(st); return st; }   // 세로 스택: 왼쪽 정렬
function vbox(parent, center) {   // 위젯 바탕에 세로 묶음을 왼쪽(또는 가운데)에 놓기
  const r = hz(parent.addStack());
  if (center) r.addSpacer();
  const v = r.addStack(); v.layoutVertically();
  if (center) { v.centerAlignContent(); CSET.add(v); } else { v.topAlignContent(); LSET.add(v); }
  r.addSpacer();
  return v;
}
function text(st, s, font, color, lines) {
  let host = st, row = null;
  if (!HSET.has(st) && !LSET.has(st)) {   // 바탕·가운데 묶음에 바로 넣는 글은 줄로 감싸 정렬
    row = hz(st.addStack());
    if (CSET.has(st)) row.addSpacer();
    host = row;
  }
  const t = host.addText(String(s));
  t.font = font; t.textColor = C(color);
  if (lines) t.lineLimit = lines;
  if (row) row.addSpacer();
  return t;
}
function header(w, title, right, ctx) {
  if (!ctx.cfg.show.title && !right) return null;
  const top = w.addStack(); hz(top); top.centerAlignContent();
  if (ctx.cfg.show.title) text(top, title, ctx.F.txt(10), ctx.P.sub);
  top.addSpacer();
  if (right) text(top, right, ctx.F.txt(9.5), ctx.P.accent);
  return top;
}
function image(st, img, W, H) { const i = st.addImage(img); i.imageSize = new Size(W, H); i.centerAlignImage(); return i; }
/* 실제 위젯 크기(pt): 기기 화면 폭에 따라 다름 → 그래프·선이 위젯 폭을 정확히 채우도록 */
const WSIZE = [
  [320, 141, 292, 311], [360, 155, 329, 345], [375, 155, 329, 345], [390, 158, 338, 354], [393, 158, 338, 354],
  [402, 162, 344, 366], [414, 169, 360, 379], [428, 170, 364, 382], [430, 170, 364, 382], [440, 170, 364, 382]
];
function widgetBox(fam) {
  let sw = 390;
  try { sw = Device.screenSize().width; } catch (e) { }
  if (Device.isPad && Device.isPad()) sw = 390;   // 아이패드는 아이폰 기준 크기로
  let best = WSIZE[3];
  WSIZE.forEach((r) => { if (Math.abs(r[0] - sw) < Math.abs(best[0] - sw)) best = r; });
  return fam === 'small' ? [best[1], best[1]] : fam === 'large' ? [best[2], best[3]] : [best[2], best[1]];
}
let CW = 300;   // 위젯 안쪽 폭 (build에서 계산)
const chartW = () => CW;
const lastName = (e) => (e && (e.name || e.org)) || '';

// ---------- 종류별 ----------
function bigValue(st, ctx, S, size) {
  const { P, F, cfg, s } = ctx;
  const last = S.rows[S.rows.length - 1], prev = S.rows[S.rows.length - 2];
  const row = st.addStack(); hz(row); row.bottomAlignContent();
  const v = last ? S.M.get(last) : null;
  text(row, v == null ? '–' : v, F.num(size), P.text);
  if (S.M.unit) text(row, ' ' + S.M.unit, F.txt(10), P.sub);
  const d = cfg.show.delta && last && prev ? delta(v, S.M.get(prev), S.M.invert) : null;
  if (d) { row.addSpacer(5); text(row, d.s, F.num(9, 're'), d.good ? P.good : P.bad); }
  const tg = S.M.target(s);
  if (cfg.show.target && tg != null && last && ctx.fam !== 'small') {
    row.addSpacer(6);
    const ok = hitOf(S.M, v, tg);
    text(row, ok ? '목표 달성' : '목표 ' + tg + S.M.unit, F.txt(9), ok ? P.good : P.bad);
  }
  row.addSpacer();
  return row;
}

function trend(w, ctx) {
  const { P, F, fam, s, cfg } = ctx;
  const n = cfg.count === 0 ? 0 : (fam === 'small' ? Math.min(cfg.count, 6) : cfg.count);
  const S = series(ctx, cfg.metric, n);
  header(w, S.M.title + ' 추이', fam !== 'small' && cfg.show.exam ? lastName(S.rows[S.rows.length - 1]) : '', ctx);
  w.addSpacer(2);
  if (cfg.show.value) bigValue(w, ctx, S, fam === 'small' ? 30 : 34);
  w.addSpacer();
  if (!S.rows.length) { text(w, '기록이 없습니다', F.txt(10), P.sub); return; }
  const H = fam === 'small' ? (cfg.show.value ? 56 : 92) : fam === 'large' ? (cfg.show.stats ? 170 : 210) : (cfg.show.value ? 66 : 100);
  image(w, chartImg(S.vals, S.labels, {
    W: chartW(fam), H, P, F, target: cfg.show.target ? S.M.target(s) : null, invert: S.M.invert, shape: cfg.shape,
    values: cfg.show.labels, dates: cfg.show.dates && fam !== 'small'
  }), chartW(fam), H);
  if (fam === 'large' && cfg.show.stats) {
    w.addSpacer(8);
    const all = S.all.map((e) => +S.M.get(e));
    const best = S.M.invert ? Math.min(...all) : Math.max(...all), worst = S.M.invert ? Math.max(...all) : Math.min(...all);
    const st = w.addStack(); hz(st);
    [['평균', avg(all)], ['최고', best], ['최저', worst], ['기록', all.length + '회']].forEach((kv, i) => {
      if (i) st.addSpacer();
      const c = st.addStack(); vt(c);
      text(c, kv[0], F.txt(8.5), P.faint);
      text(c, kv[1], F.num(15), P.text);
    });
  }
}

function number(w, ctx) {
  const { P, F, fam, s, cfg } = ctx;
  const S = series(ctx, cfg.metric, cfg.count || 0);
  const last = S.rows[S.rows.length - 1];
  const center = cfg.align === 'center';
  const body = vbox(w, center);
  if (cfg.show.title) text(body, S.M.title, F.txt(10.5), P.sub);
  body.addSpacer(fam === 'small' ? 2 : 4);
  const vrow = body.addStack(); hz(vrow); vrow.bottomAlignContent();
  const v = last ? S.M.get(last) : null;
  text(vrow, v == null ? '–' : v, F.num(fam === 'small' ? 52 : fam === 'large' ? 84 : 60), P.text);
  if (S.M.unit) text(vrow, S.M.unit, F.txt(fam === 'small' ? 11 : 13), P.sub);
  const prev = S.rows[S.rows.length - 2];
  const d = cfg.show.delta && last && prev ? delta(v, S.M.get(prev), S.M.invert) : null;
  const info = body.addStack(); hz(info);
  if (d) { text(info, d.s + ' 지난번 대비', F.txt(9.5), d.good ? P.good : P.bad); }
  const tg = S.M.target(s);
  if (cfg.show.target && tg != null && last) {
    if (d) info.addSpacer(8);
    const ok = hitOf(S.M, v, tg);
    text(info, ok ? '목표 달성' : '목표 ' + tg + S.M.unit, F.txt(9.5), ok ? P.good : P.bad);
  }
  if (cfg.show.exam && last) { body.addSpacer(3); text(body, lastName(last) + '  ' + shortDate(last.date), F.txt(9), P.faint); }
  w.addSpacer();
  if (fam !== 'small' && S.rows.length > 1) {
    const H = fam === 'large' ? 120 : 34;
    image(w, chartImg(S.vals.slice(-12), S.labels.slice(-12), {
      W: CW, H, P, F, target: cfg.show.target ? tg : null, invert: S.M.invert, shape: cfg.shape,
      values: fam === 'large' && cfg.show.labels, dates: fam === 'large' && cfg.show.dates, base: fam === 'large', pad: 6
    }), CW, H);
  }
}

function summary(w, ctx) {
  const { P, F, fam, s, cfg, exams } = ctx;
  const last = exams[exams.length - 1] || {}, prev = exams[exams.length - 2] || {};
  header(w, '최근 시험', cfg.show.exam ? lastName(last) : '', ctx);
  w.addSpacer(fam === 'small' ? 4 : 6);
  const keys = fam === 'small' ? ['raw', 'pct', 'grade'] : ['raw', 'pct', 'grade', 'wrong'];
  const cell = (st, key, big) => {
    const M = METRICS[key];
    const c = HSET.has(st) ? vt(st.addStack()) : vbox(st);
    text(c, M.title, F.txt(8.5), P.faint);
    const r = c.addStack(); hz(r); r.bottomAlignContent();
    const v = M.get(last);
    text(r, v == null ? '–' : v, F.num(big), P.text);
    const d = cfg.show.delta ? delta(v, M.get(prev), M.invert) : null;
    if (d) { r.addSpacer(3); text(r, d.s, F.num(8, 're'), d.good ? P.good : P.bad); }
  };
  if (fam === 'small') { keys.forEach((k, i) => { if (i) w.addSpacer(3); cell(w, k, 19); }); w.addSpacer(); return; }
  const row = w.addStack(); hz(row);
  keys.forEach((k, i) => { if (i) row.addSpacer(); cell(row, k, 24); });
  w.addSpacer();
  const S = series(ctx, cfg.metric, fam === 'large' ? (cfg.count || 0) : Math.min(cfg.count || 10, 10));
  if (S.rows.length) {
    if (fam === 'large' && cfg.show.title) text(w, S.M.title, F.txt(8.5), P.faint);
    const H = fam === 'large' ? 100 : 46;
    image(w, chartImg(S.vals, S.labels, { W: CW, H, P, F, target: cfg.show.target ? S.M.target(s) : null, invert: S.M.invert, shape: cfg.shape, dates: fam === 'large' && cfg.show.dates, values: fam === 'large' && cfg.show.labels }), CW, H);
  }
  if (fam === 'large') {
    const other = cfg.metric === 'grade' ? 'pct' : 'grade';
    const G = series(ctx, other, cfg.count || 0);
    if (G.rows.length) {
      w.addSpacer(8);
      if (cfg.show.title) text(w, G.M.title, F.txt(8.5), P.faint);
      image(w, chartImg(G.vals, G.labels, { W: CW, H: 74, P, F, target: cfg.show.target ? G.M.target(s) : null, invert: G.M.invert, shape: cfg.shape, dates: cfg.show.dates, values: cfg.show.labels }), CW, 74);
    }
  }
}

function goal(w, ctx) {
  const { P, F, fam, s, cfg } = ctx;
  const key = METRICS[cfg.metric] && METRICS[cfg.metric].target(s) != null ? cfg.metric : (s.targetPct != null ? 'pct' : 'grade');
  const S = series(ctx, key, cfg.count || 0);
  const tg = S.M.target(s);
  const hits = S.rows.filter((e) => hitOf(S.M, +S.M.get(e), tg)).length;
  const frac = S.rows.length ? hits / S.rows.length : 0;
  const last = S.rows[S.rows.length - 1];
  header(w, S.M.title + ' 목표 달성', fam !== 'small' && tg != null ? '목표 ' + tg + S.M.unit : '', ctx);
  w.addSpacer(fam === 'small' ? 4 : 8);
  const row = w.addStack(); hz(row); row.centerAlignContent();
  if (cfg.align === 'center') row.addSpacer();
  const D = fam === 'small' ? 78 : fam === 'large' ? 130 : 92;
  image(row, ringImg(frac, D, P, fam === 'large' ? 9 : 7), D, D);
  row.addSpacer(fam === 'small' ? 10 : 16);
  const info = row.addStack(); vt(info);
  const pr = info.addStack(); hz(pr); pr.bottomAlignContent();
  text(pr, Math.round(frac * 100), F.num(fam === 'small' ? 26 : 34), P.text);
  text(pr, '%', F.txt(10), P.sub);
  text(info, '달성 ' + hits + '/' + S.rows.length + '회', F.txt(9.5), P.sub);
  if (cfg.show.value && last && fam !== 'small') {
    info.addSpacer(6);
    const v = S.M.get(last), ok = hitOf(S.M, +v, tg);
    text(info, '최근 ' + v + S.M.unit, F.num(13), ok ? P.good : P.text);
    if (cfg.show.exam) text(info, lastName(last), F.txt(9), P.faint);
  }
  row.addSpacer();
  w.addSpacer();
  if (fam === 'large' && S.rows.length) {
    const L = series(ctx, key, cfg.count || 0);
    image(w, chartImg(L.vals, L.labels, { W: CW, H: 110, P, F, target: tg, invert: L.M.invert, shape: cfg.shape, dates: cfg.show.dates, values: cfg.show.labels }), CW, 110);
  }
}

function recent(w, ctx) {
  const { P, F, fam, cfg, exams } = ctx;
  const N = fam === 'small' ? 4 : fam === 'large' ? Math.min(cfg.count || 12, 12) : 4;
  const rows = exams.slice(-N).reverse();
  header(w, '최근 기록', '', ctx);
  w.addSpacer(5);
  if (!rows.length) { text(w, '기록이 없습니다', F.txt(10), P.sub); return; }
  if (fam !== 'small') {
    const hd = w.addStack(); hz(hd);
    const c0 = hd.addStack(); c0.size = new Size(cfg.show.exam ? 130 : 60, 0); text(c0, '시행일', F.txt(8), P.faint);
    hd.addSpacer();
    ['원점수', '백분위', '등급'].forEach((k) => { const c = hd.addStack(); c.size = new Size(44, 0); hd.addSpacer(0); text(c, k, F.txt(8), P.faint); });
    w.addSpacer(3);
  }
  rows.forEach((e, i) => {
    if (i) w.addSpacer(fam === 'large' ? 6 : 3);
    const r = w.addStack(); hz(r); r.centerAlignContent();
    if (fam === 'small') {
      text(r, shortDate(e.date), F.num(10, 're'), P.sub);
      r.addSpacer();
      text(r, e.raw == null ? '–' : e.raw, F.num(13), P.text);
      r.addSpacer(6);
      text(r, e.grade == null ? '–' : e.grade + '등급', F.txt(9.5), P.sub);
      return;
    }
    const c0 = r.addStack(); c0.size = new Size(cfg.show.exam ? 130 : 60, 0); hz(c0);
    text(c0, shortDate(e.date), F.num(10.5, 're'), P.sub);
    if (cfg.show.exam) { c0.addSpacer(6); text(c0, lastName(e), F.txt(10), P.text, 1); }
    r.addSpacer();
    [e.raw, e.pct, e.grade].forEach((v) => { const c = r.addStack(); c.size = new Size(44, 0); text(c, v == null ? '–' : v, F.num(14), P.text); });
  });
  w.addSpacer();
}

function wrong(w, ctx) {
  const { P, F, fam, s, cfg, exams } = ctx;
  const keys = ['독서', '문학', '선택'];
  const cols = keys.map((k) => (s.colors || {})['영역:' + k] || AREA_DEF[k]);
  const N = cfg.count === 0 ? exams.length : (fam === 'small' ? Math.min(cfg.count, 5) : cfg.count);
  const rows = exams.slice(-N);
  const lg = header(w, '영역별 오답', '', ctx) || (() => { const r = hz(w.addStack()); r.addSpacer(); return r; })();
  if (fam !== 'small') {
    keys.forEach((k, i) => {
      lg.addSpacer(6);
      const dot = lg.addStack(); dot.size = new Size(6, 6); dot.cornerRadius = 1.5; dot.backgroundColor = C(cols[i]);
      lg.addSpacer(3); text(lg, k, F.txt(8.5), P.sub);
    });
  }
  w.addSpacer(4);
  if (!rows.length) { text(w, '기록이 없습니다', F.txt(10), P.sub); return; }
  const H = fam === 'small' ? 92 : fam === 'large' ? 210 : 82;
  image(w, stackImg(rows.map((e) => keys.map((k) => +((e.w || {})[k]) || 0)), rows.map((e) => shortDate(e.date)), cols, { W: chartW(fam), H, P, F, dates: cfg.show.dates && fam !== 'small', values: cfg.show.labels }), chartW(fam), H);
  w.addSpacer();
  if (fam !== 'small' && cfg.show.stats) {
    const av = w.addStack(); hz(av);
    keys.forEach((k, i) => {
      if (i) av.addSpacer();
      text(av, k + ' 평균 ', F.txt(8.5), P.faint);
      text(av, avg(exams.map((e) => +((e.w || {})[k]) || 0)) + '개', F.num(9, 'me'), P.text);
    });
  }
}

function weak(w, ctx) {
  const { P, F, fam, s, data } = ctx;
  const ps = data.passages || [];
  const by = {};
  ps.forEach((p) => {
    if (!p.genre) return;
    const o = by[p.genre] || (by[p.genre] = { q: 0, w: 0 });
    o.q += +p.qn || 0; o.w += +p.wrong || 0;
  });
  const list = Object.keys(by).filter((g) => by[g].q >= 4).map((g) => ({ g, r: by[g].w / by[g].q }))
    .sort((a, b) => b.r - a.r).slice(0, fam === 'small' ? 3 : fam === 'large' ? 8 : 4);
  header(w, '오답률 높은 제재', '', ctx);
  w.addSpacer(6);
  if (!list.length) { text(w, '지문 기록이 쌓이면 표시됩니다', F.txt(10), P.sub); return; }
  const BW = Math.max(40, CW - (fam === 'small' ? 84 : 110));
  list.forEach((x, i) => {
    if (i) w.addSpacer(fam === 'large' ? 9 : 5);
    const r = w.addStack(); hz(r); r.centerAlignContent();
    const lb = r.addStack(); lb.size = new Size(fam === 'small' ? 40 : 56, 0); text(lb, x.g, F.txt(9.5), P.sub, 1);
    r.addSpacer(4);
    const track = r.addStack(); track.size = new Size(BW, 4); track.cornerRadius = 2; track.backgroundColor = C(P.track); hz(track);
    const fill = track.addStack(); fill.size = new Size(Math.max(3, BW * x.r), 4); fill.cornerRadius = 2;
    fill.backgroundColor = C((s.colors || {})[x.g] || P.bad);
    track.addSpacer();
    r.addSpacer();
    text(r, Math.round(x.r * 100) + '%', F.num(10.5, 're'), P.text);
  });
  w.addSpacer();
}

function rule(w, ctx) {
  const { P, F, fam, cfg, exams } = ctx;
  const rl = [...exams].reverse().find((e) => e.rule);
  header(w, '다음 시험 행동강령', rl && fam !== 'small' && cfg.show.exam ? lastName(rl) : '', ctx);
  w.addSpacer(3);
  const dr = hz(w.addStack());
  const dot = dr.addStack(); dot.size = new Size(14, 2); dot.cornerRadius = 1; dot.backgroundColor = C(P.hl);
  dr.addSpacer();
  w.addSpacer(7);
  const t = text(cfg.align === 'center' ? vbox(w, true) : w, rl ? rl.rule : '모의고사 기록에 행동강령을 적어 보세요', F.txt(fam === 'small' ? 11 : fam === 'large' ? 15 : 12.5), rl ? P.text : P.sub, fam === 'small' ? 7 : fam === 'large' ? 16 : 5);
  if (cfg.align === 'center') t.centerAlignText();
  w.addSpacer();
}


// ---------- 직접 구성 (구성요소 블록) ----------
const SZ = { s: 0, m: 1, l: 2 };
const pick3 = (v, a) => a[SZ[v] == null ? 1 : SZ[v]];
function alignRow(st, center, fn) {
  const r = st.addStack(); hz(r); r.bottomAlignContent();
  if (center) r.addSpacer();
  fn(r);
  r.addSpacer();
  return r;
}
const BLOCKS = {
  title(w, ctx, b) {
    const { P, F } = ctx;
    alignRow(w, b.align === 'center', (r) => {
      text(r, b.text || '국어', F.txt(pick3(b.size, [10, 13, 17]), b.bold ? 'se' : 're'), b.color === 'accent' ? P.accent : b.color === 'text' ? P.text : P.sub, 1);
    });
  },
  big(w, ctx, b) {
    const { P, F, s } = ctx;
    const S = series(ctx, b.metric || 'pct', 0);
    const last = S.rows[S.rows.length - 1], prev = S.rows[S.rows.length - 2];
    const v = last ? S.M.get(last) : null;
    if (b.label !== false) alignRow(w, b.align === 'center', (r) => text(r, S.M.title, F.txt(9.5), P.sub));
    alignRow(w, b.align === 'center', (r) => {
      text(r, v == null ? '–' : v, F.num(pick3(b.size, [28, 42, 60])), P.text);
      if (S.M.unit) text(r, ' ' + S.M.unit, F.txt(10), P.sub);
      const d = b.delta !== false && last && prev ? delta(v, S.M.get(prev), S.M.invert) : null;
      if (d) { r.addSpacer(5); text(r, d.s, F.num(9, 're'), d.good ? P.good : P.bad); }
      const tg = S.M.target(s);
      if (b.target !== false && tg != null && last) {
        r.addSpacer(6);
        const ok = hitOf(S.M, v, tg);
        text(r, ok ? '목표 달성' : '목표 ' + tg + S.M.unit, F.txt(9), ok ? P.good : P.bad);
      }
    });
  },
  chart(w, ctx, b) {
    const { P, F, s, fam } = ctx;
    const S = series(ctx, b.metric || 'grade', b.count == null ? (fam === 'small' ? 6 : 10) : b.count);
    if (!S.rows.length) { text(w, '기록이 없습니다', F.txt(9.5), P.sub); return; }
    const H = pick3(b.h, fam === 'small' ? [34, 52, 80] : [40, 70, 120]);
    image(w, chartImg(S.vals, S.labels, {
      W: chartW(fam), H, P, F, target: b.target !== false ? S.M.target(s) : null, invert: S.M.invert, shape: b.shape || 'curve',
      values: b.labels !== false, dates: b.dates !== false && fam !== 'small'
    }), chartW(fam), H);
  },
  tiles(w, ctx, b) {
    const { P, F, exams, fam } = ctx;
    const last = exams[exams.length - 1] || {}, prev = exams[exams.length - 2] || {};
    const keys = (b.keys && b.keys.length ? b.keys : ['raw', 'pct', 'grade']).slice(0, fam === 'small' ? 2 : 4);
    const row = w.addStack(); hz(row);
    keys.forEach((k, i) => {
      if (i) row.addSpacer();
      const M = METRICS[k] || METRICS.raw;
      const c = row.addStack(); vt(c);
      text(c, M.title, F.txt(8.5), P.faint);
      const r = c.addStack(); hz(r); r.bottomAlignContent();
      const v = M.get(last);
      text(r, v == null ? '–' : v, F.num(pick3(b.size, [15, 21, 27])), P.text);
      const d = b.delta !== false ? delta(v, M.get(prev), M.invert) : null;
      if (d) { r.addSpacer(3); text(r, d.s, F.num(8, 're'), d.good ? P.good : P.bad); }
    });
  },
  ring(w, ctx, b) {
    const { P, F, s, fam } = ctx;
    const key = METRICS[b.metric] && METRICS[b.metric].target(s) != null ? b.metric : (s.targetPct != null ? 'pct' : 'grade');
    const S = series(ctx, key, 0), tg = S.M.target(s);
    const hits = S.rows.filter((e) => hitOf(S.M, +S.M.get(e), tg)).length, frac = S.rows.length ? hits / S.rows.length : 0;
    const row = w.addStack(); hz(row); row.centerAlignContent();
    if (b.align === 'center') row.addSpacer();
    const D = pick3(b.size, fam === 'small' ? [44, 60, 76] : [52, 72, 96]);
    image(row, ringImg(frac, D, P, D > 70 ? 8 : 6), D, D);
    row.addSpacer(10);
    const info = row.addStack(); vt(info);
    text(info, S.M.title + ' 목표 ' + (tg == null ? '–' : tg + S.M.unit), F.txt(9), P.sub);
    const pr = info.addStack(); hz(pr); pr.bottomAlignContent();
    text(pr, Math.round(frac * 100), F.num(pick3(b.size, [18, 24, 32])), P.text); text(pr, '%', F.txt(9), P.sub);
    text(info, '달성 ' + hits + '/' + S.rows.length + '회', F.txt(8.5), P.faint);
    row.addSpacer();
  },
  recent(w, ctx, b) {
    const { P, F, exams, fam } = ctx;
    const rows = exams.slice(-(b.n || 3)).reverse();
    rows.forEach((e, i) => {
      if (i) w.addSpacer(3);
      const r = w.addStack(); hz(r); r.centerAlignContent();
      text(r, shortDate(e.date), F.num(10, 're'), P.sub);
      if (fam !== 'small' && b.exam !== false) { r.addSpacer(6); text(r, lastName(e), F.txt(10), P.text, 1); }
      r.addSpacer();
      text(r, e.raw == null ? '–' : e.raw, F.num(12.5), P.text);
      if (fam !== 'small') { r.addSpacer(10); text(r, e.pct == null ? '–' : e.pct, F.num(12.5), P.text); }
      r.addSpacer(8);
      text(r, e.grade == null ? '–' : e.grade + '등급', F.txt(9.5), P.sub);
    });
  },
  wrong(w, ctx, b) {
    const { P, F, s, fam, exams } = ctx;
    const keys = ['독서', '문학', '선택'];
    const cols = keys.map((k) => (s.colors || {})['영역:' + k] || AREA_DEF[k]);
    const rows = exams.slice(-(b.count || (fam === 'small' ? 5 : 10)));
    if (!rows.length) return;
    const H = pick3(b.h, fam === 'small' ? [40, 60, 90] : [44, 74, 120]);
    image(w, stackImg(rows.map((e) => keys.map((k) => +((e.w || {})[k]) || 0)), rows.map((e) => shortDate(e.date)), cols, { W: chartW(fam), H, P, F, dates: b.dates !== false && fam !== 'small', values: b.labels !== false }), chartW(fam), H);
  },
  weak(w, ctx, b) {
    const { P, F, s, fam, data } = ctx;
    const by = {};
    (data.passages || []).forEach((p) => { if (!p.genre) return; const o = by[p.genre] || (by[p.genre] = { q: 0, w: 0 }); o.q += +p.qn || 0; o.w += +p.wrong || 0; });
    const list = Object.keys(by).filter((g) => by[g].q >= 4).map((g) => ({ g, r: by[g].w / by[g].q })).sort((a, c) => c.r - a.r).slice(0, b.n || 3);
    const BW = Math.max(40, CW - (fam === 'small' ? 84 : 110));
    list.forEach((x, i) => {
      if (i) w.addSpacer(4);
      const r = w.addStack(); hz(r); r.centerAlignContent();
      const lb = r.addStack(); lb.size = new Size(fam === 'small' ? 40 : 56, 0); text(lb, x.g, F.txt(9.5), P.sub, 1);
      r.addSpacer(4);
      const track = r.addStack(); track.size = new Size(BW, 4); track.cornerRadius = 2; track.backgroundColor = C(P.track); hz(track);
      const fill = track.addStack(); fill.size = new Size(Math.max(3, BW * x.r), 4); fill.cornerRadius = 2; fill.backgroundColor = C((s.colors || {})[x.g] || P.bad);
      track.addSpacer();
      r.addSpacer();
      text(r, Math.round(x.r * 100) + '%', F.num(10.5, 're'), P.text);
    });
  },
  rule(w, ctx, b) {
    const { P, F, exams } = ctx;
    const rl = [...exams].reverse().find((e) => e.rule);
    const t = text(b.align === 'center' ? vbox(w, true) : w, rl ? rl.rule : '모의고사 기록에 행동강령을 적어 보세요', F.txt(pick3(b.size, [10.5, 12.5, 15])), rl ? P.text : P.sub, b.lines || 4);
    if (b.align === 'center') t.centerAlignText();
  },
  note(w, ctx, b) {
    const { P, F } = ctx;
    const t = text(b.align === 'center' ? vbox(w, true) : w, b.text || '', F.txt(pick3(b.size, [10.5, 13, 17]), b.bold ? 'se' : 're'), b.color === 'text' ? P.text : b.color === 'sub' ? P.sub : P.hl, 3);
    if (b.align === 'center') t.centerAlignText();
  },
  line(w, ctx) {
    const lr = hz(w.addStack()); const l = lr.addStack(); l.size = new Size(CW, 1); l.backgroundColor = C(ctx.P.line); lr.addSpacer();
  },
  gap(w, ctx, b) { if (b.flex) w.addSpacer(); else w.addSpacer(pick3(b.size, [4, 10, 20])); }
};
function custom(w, ctx) {
  const list = ctx.cfg.blocks && ctx.cfg.blocks.length ? ctx.cfg.blocks : [{ t: 'title', text: '국어' }, { t: 'big', metric: 'pct' }, { t: 'chart', metric: 'grade' }];
  const flex = list.some((b) => b.t === 'gap' && b.flex);
  list.forEach((b, i) => {
    if (i && b.t !== 'gap' && list[i - 1].t !== 'gap') w.addSpacer(ctx.fam === 'small' ? 4 : 6);
    (BLOCKS[b.t] || (() => {}))(w, ctx, b);
  });
  if (!flex) w.addSpacer();
}

// ---------- 잠금 화면 ----------
function lock(w, ctx) {
  const { F, fam, cfg } = ctx;
  const White = new Color('#ffffff');
  const S = series(ctx, cfg.metric, 8);
  const last = S.rows[S.rows.length - 1];
  const v = last ? S.M.get(last) : null;
  if (fam === 'accessoryInline') {
    const L = ctx.exams[ctx.exams.length - 1] || {};
    const parts = [];
    if (L.grade != null) parts.push(L.grade + '등급');
    if (L.pct != null) parts.push('백분위 ' + L.pct);
    if (L.raw != null) parts.push(L.raw + '점');
    const t = w.addText(parts.join(' · ') || '국어'); t.font = F.txt(12);
    return;
  }
  if (fam === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true;
    const a = w.addText(S.M.title.slice(0, 3)); a.font = F.txt(9); a.textColor = White; a.centerAlignText();
    const b = w.addText(v == null ? '–' : String(v)); b.font = F.num(22); b.textColor = White; b.centerAlignText(); b.minimumScaleFactor = 0.5;
    return;
  }
  const top = w.addStack(); hz(top);
  const tt = top.addText(S.M.title); tt.font = F.txt(10);
  top.addSpacer();
  const vv = top.addText(v == null ? '–' : v + S.M.unit); vv.font = F.num(13, 'me');
  if (S.rows.length > 1) {
    const P = { line: '#ffffff', good: '#ffffff', accent: '#ffffff', dot: '#000000', text: '#ffffff', sub: '#ffffff', faint: '#ffffff', track: '#ffffff' };
    const img = w.addImage(chartImg(S.vals, null, { W: 150, H: 34, P, F, invert: S.M.invert, shape: cfg.shape === 'bar' ? 'bar' : 'curve', values: false, dates: false, base: false, dots: false, pad: 4, lw: 2 }));
    img.imageSize = new Size(150, 34);
  }
}

// ---------- 조립 ----------
const KINDS = { trend, number, summary, goal, recent, wrong, weak, rule, custom };
async function build(param) {
  const fam = config.widgetFamily || 'medium';
  const w = new ListWidget();
  w.url = APP_URL;
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);
  let data;
  try {
    if (!hasToken()) throw new Error('앱에서 기기 연동을 켠 뒤 설정 → 홈 화면 위젯에서 스크립트를 다시 복사해 주세요');
    data = await load();
  } catch (e) {
    w.backgroundColor = C(DEF.card);
    const t = w.addText(String(e.message || e)); t.font = Font.systemFont(11); t.textColor = C('#6c6d73');
    return w;
  }
  const s = data.settings || {};
  const cfg = getConfig(s, param);
  const exams = (data.exams || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const ctx = { cfg, fam, s, exams, data, F: fonts(cfg) };
  if (fam.indexOf('accessory') === 0) { lock(w, ctx); return w; }
  ctx.P = palette(s.theme, cfg.style, cfg.design);
  w.backgroundColor = C(ctx.P.bg);
  if (cfg.style === 'custom' && cfg.design && cfg.design.grad && cfg.design.bg2) {
    const g = new LinearGradient();
    g.colors = [C(ctx.P.bg), C(cfg.design.bg2)];
    g.locations = [0, 1];
    w.backgroundGradient = g;
  }
  if (+cfg.texture || cfg.note || cfg.margin) {
    const box = widgetBox(fam), grad = cfg.style === 'custom' && cfg.design && cfg.design.grad && cfg.design.bg2;
    w.backgroundImage = paperImg(box[0], box[1], ctx.P.bg, grad ? cfg.design.bg2 : null, +cfg.texture || 0, cfg.note, cfg.margin, ctx.P);
  }
  const pd = { tight: [9, 11], normal: [13, 15], wide: [18, 20] }[cfg.pad] || [13, 15];
  w.setPadding(pd[0], pd[1], pd[0] - 2, pd[1]);
  CW = Math.floor(widgetBox(fam)[0] - pd[1] * 2);
  (KINDS[cfg.kind] || trend)(w, ctx);
  /* 안내: 스크립트가 예전 판이거나, Parameter 이름의 위젯을 못 찾았을 때 */
  const note = (s.widgetScriptVer || 0) > SCRIPT_VER ? '앱에서 스크립트를 다시 복사해 주세요'
    : cfg.missing ? '‘' + cfg.missing + '’ 위젯을 못 찾음 · 앱에서 이름 확인 후 동기화' : '';
  if (note) { const t = text(w, note, Font.systemFont(8), ctx.P.bad, 1); t.minimumScaleFactor = 0.7; }
  return w;
}

async function main() {
  let param = args.widgetParameter;
  if (!config.runsInWidget && !param) {
    const a = new Alert();
    a.title = '국어 대시보드 위젯';
    a.message = '미리볼 위젯 이름을 적으세요 (앱 설정 → 홈 화면 위젯의 이름). 비우면 첫 번째 위젯.';
    a.addTextField('위젯 이름', '');
    a.addAction('미리보기');
    a.addCancelAction('닫기');
    if (await a.present() === -1) return;
    param = a.textFieldValue(0);
  }
  const widget = await build(param);
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentMedium();
}

await main();
Script.complete();
