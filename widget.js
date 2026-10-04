// 국어 대시보드 위젯 (iOS Scriptable 앱용)
// 1) 앱 설정 → 홈 화면 위젯 → '스크립트 복사' → Scriptable에서 새 스크립트에 붙여 넣기
//    (복사할 때 기기 연동 토큰이 자동으로 들어갑니다. 이 스크립트는 다른 사람과 공유하지 마세요)
// 2) 홈 화면(또는 잠금 화면)에 Scriptable 위젯 추가 → 길게 눌러 편집 → Script 선택
// 3) Parameter 칸에 원하는 구성을 적기 (앱 설정 → 홈 화면 위젯에서 골라 복사)
//    종류: 등급 · 백분위 · 원점수 · 행동강령 · 요약 · 오답
//    디자인: 기본 · 배경 · 다크 · 컬러      글꼴: 고딕 · 얇게 · 둥근 · 명조 · 모노
//    예) 백분위 다크 명조
// 기록은 앱의 '기기 연동'(깃허브 비공개 Gist)에서 읽어 옵니다.

const APP_URL = 'https://hysdllover.github.io/read./';
const GIST_DESC = 'korean-dashboard-sync';
const TOKEN = '__KOR_DASH_TOKEN__';   // 앱에서 복사할 때 자동으로 채워짐
const hasToken = () => !!TOKEN && TOKEN.indexOf('__KOR_DASH') !== 0;
const DEF = { accent: '#5b6b85', good: '#7a8465', bad: '#a8868a', hl: '#8f8aae', bg: '#f5f5f7', card: '#ffffff', text: '#1f2023' };
const AREA_DEF = { '독서': '#5b6b85', '문학': '#8f8aae', '선택': '#b3a78a' };

// ---------- 구성 읽기 ----------
const TYPES = { '등급': 'grade', '백분위': 'pct', '원점수': 'raw', '점수': 'raw', '행동강령': 'rule', '강령': 'rule', '요약': 'summary', '오답': 'wrong' };
const STYLES = { '기본': 'card', '카드': 'card', '배경': 'bg', '다크': 'dark', '어둡게': 'dark', '컬러': 'color', '색': 'color' };
const FACES = { '고딕': 'sans', '얇게': 'thin', '가는': 'thin', '둥근': 'round', '명조': 'serif', '모노': 'mono' };
function parseParam(p) {
  const o = { type: 'grade', style: 'card', face: 'sans' };
  String(p || '').toLowerCase().split(/[\s,·/]+/).forEach((w) => {
    if (TYPES[w]) o.type = TYPES[w];
    else if (STYLES[w]) o.style = STYLES[w];
    else if (FACES[w]) o.face = FACES[w];
  });
  return o;
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

// ---------- 색 · 글꼴 ----------
const C = (hex, a) => new Color(hex, a == null ? 1 : a);
function rgb(h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) || 0); }
function mix(a, b, t) { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); }

function palette(theme, style) {
  const t = Object.assign({}, DEF, theme || {});
  let p;
  if (style === 'dark') p = { bg: '#1c2029', text: '#e6e7ec', accent: mix(t.accent, '#ffffff', 0.35), good: mix(t.good, '#ffffff', 0.3), bad: mix(t.bad, '#ffffff', 0.25), hl: mix(t.hl, '#ffffff', 0.3) };
  else if (style === 'color') p = { bg: t.accent, text: '#ffffff', accent: '#ffffff', good: mix(t.good, '#ffffff', 0.65), bad: mix(t.bad, '#ffffff', 0.6), hl: '#ffffff' };
  else p = { bg: style === 'bg' ? t.bg : t.card, text: t.text, accent: t.accent, good: t.good, bad: t.bad, hl: t.hl };
  p.sub = mix(p.text, p.bg, 0.45);
  p.faint = mix(p.text, p.bg, 0.62);
  p.line = mix(p.bg, p.text, 0.12);
  p.dot = p.bg;
  return p;
}

const W8 = { ul: 'ultraLight', th: 'thin', li: 'light', re: 'regular', me: 'medium', se: 'semibold' };
function sysFont(kind, w, s) {
  const n = W8[w] || 'regular';
  if (kind === 'round') return Font[n + 'RoundedSystemFont'](s);
  if (kind === 'mono') return Font[n + 'MonospacedSystemFont'](s);
  return Font[n + 'SystemFont'](s);
}
function fonts(face) {
  if (face === 'serif') return { num: (s, w) => new Font(w === 'se' || w === 'me' ? 'Didot-Bold' : 'Didot', s), txt: (s) => new Font('AppleMyungjo', s) };
  if (face === 'thin') return { num: (s, w) => new Font(w === 'se' || w === 'me' ? 'HelveticaNeue-Light' : 'HelveticaNeue-Thin', s), txt: (s, w) => new Font(w === 'se' || w === 'me' ? 'AppleSDGothicNeo-Regular' : 'AppleSDGothicNeo-Light', s) };
  const k = face === 'round' ? 'round' : face === 'mono' ? 'mono' : 'sys';
  return { num: (s, w) => sysFont(k, w || 'ul', s), txt: (s, w) => sysFont(k, w || 're', s) };
}

// ---------- 데이터 도우미 ----------
const shortDate = (d) => (d || '').slice(5).replace('.', '/');
const SERIES = {
  grade: { key: 'grade', title: '등급 추이', unit: '등급', invert: true, target: (s) => s.targetGrade },
  pct: { key: 'pct', title: '백분위 추이', unit: '', invert: false, target: (s) => s.targetPct },
  raw: { key: 'raw', title: '원점수 추이', unit: '점', invert: false, target: () => null }
};
const avg = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;

// ---------- 그림: 꺾은선 ----------
function lineImg(vals, labels, o) {
  const { W, H, P, F } = o;
  const dc = new DrawContext();
  dc.size = new Size(W, H); dc.opaque = false; dc.respectScreenScale = true;
  const n = vals.length, L = o.pad == null ? 12 : o.pad, R = L, T = o.values === false ? 4 : 15, B = o.dates ? 15 : 4;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (o.target != null) { lo = Math.min(lo, o.target); hi = Math.max(hi, o.target); }
  const span = (hi - lo) || 2;
  lo -= span * 0.22; hi += span * 0.22;
  const gap = n > 1 ? (W - L - R) / (n - 1) : W;
  const X = (i) => n === 1 ? W / 2 : L + i * gap;
  const Y = (v) => { const r = (v - lo) / (hi - lo); return T + (o.invert ? r : 1 - r) * (H - T - B); };
  const pts = vals.map((v, i) => ({ x: X(i), y: Y(v) }));
  const pt = (q) => new Point(q.x, q.y);
  let p;
  if (o.base !== false) {
    dc.setStrokeColor(C(P.line)); dc.setLineWidth(0.6);
    p = new Path(); p.move(new Point(0, H - B)); p.addLine(new Point(W, H - B)); dc.addPath(p); dc.strokePath();
  }
  if (o.target != null) {
    dc.setStrokeColor(C(P.good, 0.85)); dc.setLineWidth(0.8);
    for (let x = 0; x < W; x += 5) { p = new Path(); p.move(new Point(x, Y(o.target))); p.addLine(new Point(Math.min(x + 2, W), Y(o.target))); dc.addPath(p); dc.strokePath(); }
  }
  if (n > 1) {
    p = new Path(); p.move(pt(pts[0]));
    for (let i = 0; i < n - 1; i++) {
      const dx = (pts[i + 1].x - pts[i].x) / 2;
      p.addCurve(pt(pts[i + 1]), new Point(pts[i].x + dx, pts[i].y), new Point(pts[i + 1].x - dx, pts[i + 1].y));
    }
    dc.setStrokeColor(C(o.color || P.accent)); dc.setLineWidth(o.lw || 1.5); dc.addPath(p); dc.strokePath();
  }
  pts.forEach((q, i) => {
    const last = i === n - 1;
    const hit = o.target != null && (o.invert ? vals[i] <= o.target : vals[i] >= o.target);
    const r = last ? 3.2 : (o.dots === false ? 0 : 2.2);
    if (r) {
      dc.setFillColor(C(hit ? P.good : (last ? (o.color || P.accent) : P.dot)));
      dc.fillEllipse(new Rect(q.x - r, q.y - r, r * 2, r * 2));
      if (!hit && !last) { dc.setStrokeColor(C(o.color || P.accent)); dc.setLineWidth(1); dc.strokeEllipse(new Rect(q.x - r, q.y - r, r * 2, r * 2)); }
    }
    if (o.values !== false) {
      dc.setTextAlignedCenter();
      dc.setFont(F.txt(8.5, last ? 'se' : 're'));
      dc.setTextColor(C(hit ? P.good : (last ? P.text : P.sub)));
      dc.drawTextInRect(String(vals[i]), new Rect(q.x - 14, q.y - 15, 28, 11));
    }
    if (o.dates && labels && (gap >= 26 || i % 2 === 0 || last)) {
      dc.setTextAlignedCenter();
      dc.setFont(F.txt(7.5)); dc.setTextColor(C(P.faint));
      dc.drawTextInRect(labels[i], new Rect(q.x - 16, H - B + 4, 32, 10));
    }
  });
  return dc.getImage();
}

// ---------- 그림: 누적 막대 ----------
function barsImg(rows, labels, colors, o) {
  const { W, H, P, F } = o;
  const dc = new DrawContext();
  dc.size = new Size(W, H); dc.opaque = false; dc.respectScreenScale = true;
  const n = rows.length, L = 10, R = 10, T = 13, B = o.dates ? 15 : 3;
  const tot = rows.map((r) => r.reduce((a, v) => a + (v || 0), 0));
  const mx = Math.max(1, ...tot);
  const gap = n > 1 ? (W - L - R) / (n - 1) : W, bw = Math.min(12, gap * 0.5);
  const X = (i) => n === 1 ? W / 2 : L + i * gap;
  dc.setStrokeColor(C(P.line)); dc.setLineWidth(0.6);
  const p = new Path(); p.move(new Point(0, H - B)); p.addLine(new Point(W, H - B)); dc.addPath(p); dc.strokePath();
  rows.forEach((r, i) => {
    let y = H - B;
    r.forEach((v, j) => {
      if (!v) return;
      const h = v / mx * (H - B - T - 2);
      y -= h;
      const path = new Path(); path.addRoundedRect(new Rect(X(i) - bw / 2, y, bw, Math.max(h - 1, 1)), 2, 2);
      dc.setFillColor(C(colors[j])); dc.addPath(path); dc.fillPath();
    });
    dc.setTextAlignedCenter();
    dc.setFont(F.txt(8, i === n - 1 ? 'se' : 're')); dc.setTextColor(C(i === n - 1 ? P.text : P.sub));
    dc.drawTextInRect(String(tot[i]), new Rect(X(i) - 12, y - 12, 24, 10));
    if (o.dates && (gap >= 26 || i % 2 === 0 || i === n - 1)) {
      dc.setFont(F.txt(7.5)); dc.setTextColor(C(P.faint));
      dc.drawTextInRect(labels[i], new Rect(X(i) - 16, H - B + 4, 32, 10));
    }
  });
  return dc.getImage();
}

// ---------- 위젯 조각 ----------
function text(st, s, font, color, lines) {
  const t = st.addText(String(s));
  t.font = font; t.textColor = C(color);
  if (lines) t.lineLimit = lines;
  return t;
}
function header(w, title, right, ctx) {
  const top = w.addStack(); top.layoutHorizontally(); top.centerAlignContent();
  text(top, title, ctx.F.txt(10), ctx.P.sub);
  top.addSpacer();
  if (right) text(top, right, ctx.F.num(10, 'li'), ctx.P.accent);
  return top;
}
function image(st, img, W, H) { const i = st.addImage(img); i.imageSize = new Size(W, H); i.centerAlignImage(); return i; }
function delta(cur, prev, invert) {
  if (cur == null || prev == null || cur === prev) return null;
  const up = cur > prev, good = invert ? !up : up;
  return { s: (up ? '▲' : '▼') + Math.round(Math.abs(cur - prev) * 10) / 10, good };
}

// ---------- 종류별 ----------
function trend(w, ctx, kind) {
  const { P, F, fam, s, exams } = ctx, S = SERIES[kind];
  const rowsAll = exams.filter((e) => e[S.key] != null);
  const N = fam === 'small' ? 6 : fam === 'large' ? 16 : 10;
  const rows = rowsAll.slice(-N), vals = rows.map((e) => e[S.key]);
  const last = rows[rows.length - 1], prev = rows[rows.length - 2];
  const tg = S.target(s);
  header(w, S.title, fam !== 'small' && rowsAll.length ? rowsAll.length + '회' : '', ctx);
  w.addSpacer(2);
  const row = w.addStack(); row.layoutHorizontally(); row.bottomAlignContent();
  text(row, last ? last[S.key] : '–', F.num(fam === 'small' ? 30 : 34, 'ul'), P.text);
  if (S.unit) text(row, ' ' + S.unit, F.txt(10), P.sub);
  const d = last && prev ? delta(last[S.key], prev[S.key], S.invert) : null;
  if (d) { row.addSpacer(5); text(row, d.s, F.txt(9), d.good ? P.good : P.bad); }
  if (tg != null && last && fam !== 'small') {
    row.addSpacer(6);
    const ok = S.invert ? last[S.key] <= tg : last[S.key] >= tg;
    text(row, ok ? '목표 달성' : '목표 ' + tg + S.unit, F.txt(9), ok ? P.good : P.bad);
  }
  w.addSpacer();
  if (!rows.length) { text(w, '기록이 없습니다', F.txt(10), P.sub); return; }
  const size = fam === 'small' ? [130, 56] : fam === 'large' ? [300, 170] : [300, 66];
  image(w, lineImg(vals, rows.map((e) => shortDate(e.date)), { W: size[0], H: size[1], P, F, target: tg, invert: S.invert, dates: fam !== 'small' }), size[0], size[1]);
  if (fam === 'large') {
    w.addSpacer(8);
    const all = rowsAll.map((e) => e[S.key]);
    const st = w.addStack(); st.layoutHorizontally();
    [['평균', avg(all)], ['최고', S.invert ? Math.min(...all) : Math.max(...all)], ['최저', S.invert ? Math.max(...all) : Math.min(...all)], ['기록', all.length + '회']].forEach((kv, i) => {
      if (i) st.addSpacer();
      const c = st.addStack(); c.layoutVertically();
      text(c, kv[0], F.txt(8.5), P.faint);
      text(c, kv[1], F.num(15, 'li'), P.text);
    });
  }
}

function rule(w, ctx) {
  const { P, F, fam, exams } = ctx;
  const rl = [...exams].reverse().find((e) => e.rule);
  header(w, '다음 시험 행동강령', rl && fam !== 'small' ? (rl.name || '') : '', ctx);
  w.addSpacer(3);
  const dot = w.addStack(); dot.size = new Size(14, 2); dot.cornerRadius = 1; dot.backgroundColor = C(P.hl);
  w.addSpacer(7);
  text(w, rl ? rl.rule : '모의고사 기록에 행동강령을 적어 보세요', F.txt(fam === 'small' ? 11 : fam === 'large' ? 15 : 12.5), rl ? P.text : P.sub, fam === 'small' ? 7 : fam === 'large' ? 16 : 5);
  w.addSpacer();
}

function summary(w, ctx) {
  const { P, F, fam, s, exams } = ctx;
  const last = exams[exams.length - 1] || {}, prev = exams[exams.length - 2] || {};
  header(w, '최근 시험', last.name || '', ctx);
  w.addSpacer(fam === 'small' ? 4 : 6);
  const items = [['원점수', 'raw', '점', false], ['백분위', 'pct', '', false], ['등급', 'grade', '등급', true]];
  const cell = (st, kv, big) => {
    const c = st.addStack(); c.layoutVertically();
    text(c, kv[0], F.txt(8.5), P.faint);
    const r = c.addStack(); r.layoutHorizontally(); r.bottomAlignContent();
    text(r, last[kv[1]] == null ? '–' : last[kv[1]], F.num(big, 'li'), P.text);
    const d = delta(last[kv[1]], prev[kv[1]], kv[3]);
    if (d) { r.addSpacer(3); text(r, d.s, F.txt(8), d.good ? P.good : P.bad); }
  };
  if (fam === 'small') {
    items.forEach((kv, i) => { if (i) w.addSpacer(3); cell(w, kv, 19); });
    w.addSpacer();
    return;
  }
  const row = w.addStack(); row.layoutHorizontally();
  items.forEach((kv, i) => { if (i) row.addSpacer(); cell(row, kv, 24); });
  w.addSpacer();
  const pc = exams.filter((e) => e.pct != null).slice(fam === 'large' ? -16 : -10);
  if (pc.length) {
    if (fam === 'large') text(w, '백분위', F.txt(8.5), P.faint);
    image(w, lineImg(pc.map((e) => e.pct), pc.map((e) => shortDate(e.date)), { W: 300, H: fam === 'large' ? 100 : 46, P, F, target: s.targetPct, dates: fam === 'large', values: fam === 'large' }), 300, fam === 'large' ? 100 : 46);
  }
  if (fam === 'large') {
    const gc = exams.filter((e) => e.grade != null).slice(-16);
    if (gc.length) {
      w.addSpacer(8);
      text(w, '등급', F.txt(8.5), P.faint);
      image(w, lineImg(gc.map((e) => e.grade), gc.map((e) => shortDate(e.date)), { W: 300, H: 74, P, F, target: s.targetGrade, invert: true, dates: true }), 300, 74);
    }
  }
}

function wrong(w, ctx) {
  const { P, F, fam, s, exams } = ctx;
  const keys = ['독서', '문학', '선택'];
  const cols = keys.map((k) => (s.colors || {})['영역:' + k] || AREA_DEF[k]);
  const N = fam === 'small' ? 5 : fam === 'large' ? 16 : 10;
  const rows = exams.slice(-N);
  const lg = header(w, '영역별 오답', '', ctx);
  if (fam !== 'small') {
    keys.forEach((k, i) => {
      lg.addSpacer(6);
      const dot = lg.addStack(); dot.size = new Size(6, 6); dot.cornerRadius = 1.5; dot.backgroundColor = C(cols[i]);
      lg.addSpacer(3); text(lg, k, F.txt(8.5), P.sub);
    });
  }
  w.addSpacer(4);
  if (!rows.length) { text(w, '기록이 없습니다', F.txt(10), P.sub); return; }
  const size = fam === 'small' ? [130, 92] : fam === 'large' ? [300, 210] : [300, 82];
  image(w, barsImg(rows.map((e) => keys.map((k) => +((e.w || {})[k]) || 0)), rows.map((e) => shortDate(e.date)), cols, { W: size[0], H: size[1], P, F, dates: fam !== 'small' }), size[0], size[1]);
  w.addSpacer();
  if (fam !== 'small') {
    const av = w.addStack(); av.layoutHorizontally();
    keys.forEach((k, i) => {
      if (i) av.addSpacer();
      text(av, k + ' 평균 ', F.txt(8.5), P.faint);
      text(av, avg(exams.map((e) => +((e.w || {})[k]) || 0)) + '개', F.txt(8.5, 'me'), P.text);
    });
  }
}

// ---------- 잠금 화면 ----------
function lock(w, ctx) {
  const { F, fam, s, exams, o } = ctx;
  const W = new Color('#ffffff');
  const last = exams[exams.length - 1] || {};
  const S = SERIES[o.type] || SERIES.grade;
  if (fam === 'accessoryInline') {
    const parts = [];
    if (last.grade != null) parts.push(last.grade + '등급');
    if (last.pct != null) parts.push('백분위 ' + last.pct);
    const t = w.addText(parts.join(' · ') || '국어'); t.font = F.txt(12);
    return;
  }
  if (fam === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true;
    const a = w.addText(S.title.slice(0, S.key === 'grade' ? 2 : 3)); a.font = F.txt(9); a.textColor = W; a.centerAlignText();
    const b = w.addText(last[S.key] == null ? '–' : String(last[S.key]));
    b.font = F.num(22, 'li'); b.textColor = W; b.centerAlignText(); b.minimumScaleFactor = 0.5;
    return;
  }
  // accessoryRectangular
  const top = w.addStack(); top.layoutHorizontally();
  const tt = top.addText(S.title.replace(' 추이', '')); tt.font = F.txt(10);
  top.addSpacer();
  const v = top.addText(last[S.key] == null ? '–' : last[S.key] + S.unit); v.font = F.num(13, 'me');
  const ser = exams.filter((e) => e[S.key] != null).slice(-8);
  if (ser.length > 1) {
    const P = { line: '#ffffff', good: '#ffffff', accent: '#ffffff', dot: '#000000', text: '#ffffff', sub: '#ffffff', faint: '#ffffff' };
    const img = w.addImage(lineImg(ser.map((e) => e[S.key]), null, { W: 150, H: 34, P, F, invert: S.invert, values: false, dates: false, base: false, dots: false, pad: 4, lw: 2 }));
    img.imageSize = new Size(150, 34);
  }
}

// ---------- 조립 ----------
async function build(o) {
  const fam = config.widgetFamily || 'medium';
  const w = new ListWidget();
  w.url = APP_URL;
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);
  const F = fonts(o.face);
  let data;
  try {
    if (!hasToken()) throw new Error('앱에서 기기 연동을 켠 뒤 설정 → 홈 화면 위젯에서 스크립트를 다시 복사해 주세요');
    data = await load();
  } catch (e) {
    w.backgroundColor = C(DEF.card);
    text(w, String(e.message || e), F.txt(11), '#6c6d73');
    return w;
  }
  const s = data.settings || {};
  const exams = (data.exams || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const ctx = { o, fam, s, exams, F };
  if (fam.indexOf('accessory') === 0) { lock(w, ctx); return w; }
  ctx.P = palette(s.theme, o.style);
  w.backgroundColor = C(ctx.P.bg);
  w.setPadding(13, 15, 11, 15);
  if (o.type === 'rule') rule(w, ctx);
  else if (o.type === 'summary') summary(w, ctx);
  else if (o.type === 'wrong') wrong(w, ctx);
  else trend(w, ctx, o.type);
  return w;
}

async function main() {
  let o = parseParam(args.widgetParameter);
  if (!config.runsInWidget) {
    const m = new Alert();
    m.title = '국어 대시보드 위젯';
    m.message = '미리볼 종류를 고르세요. 위젯에서는 Parameter 칸으로 정합니다.';
    const names = ['등급', '백분위', '원점수', '행동강령', '요약', '오답'];
    names.forEach((n) => m.addAction(n));
    m.addCancelAction('닫기');
    const i = await m.present();
    if (i === -1) return;
    o = parseParam(names[i]);
  }
  const widget = await build(o);
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentMedium();
}

await main();
Script.complete();
