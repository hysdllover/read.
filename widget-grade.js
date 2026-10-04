// 국어 대시보드 — 등급 추이 위젯 (iOS Scriptable 앱용)
// 사용법: Scriptable 앱에서 새 스크립트에 이 내용을 붙여 넣고 한 번 실행 → 깃허브 토큰 입력
//        홈 화면에 Scriptable 위젯 추가 → 길게 눌러 위젯 편집 → Script에서 이 스크립트 선택
// 기록은 앱의 '기기 연동'(깃허브 비공개 Gist)에서 읽어 옵니다. 앱에서 연동을 켜 두어야 합니다.

const APP_URL = 'https://hysdllover.github.io/read./';
const GIST_DESC = 'korean-dashboard-sync';
const KEY_TOKEN = 'kor-dash-token';
const DEF = { accent: '#5b6b85', good: '#7a8465', bad: '#a8868a', bg: '#f5f5f7', card: '#ffffff', text: '#1f2023' };

// ---- 설정 (앱에서 직접 실행할 때만 묻기) ----
async function ask(force) {
  if (!force && Keychain.contains(KEY_TOKEN)) return;
  const a = new Alert();
  a.title = '국어 대시보드 위젯';
  a.message = '앱 설정 → 기기 연동에서 쓰는 깃허브 토큰을 붙여 넣으세요.';
  a.addSecureTextField('깃허브 토큰 (ghp_…)', Keychain.contains(KEY_TOKEN) ? Keychain.get(KEY_TOKEN) : '');
  a.addAction('저장');
  a.addCancelAction('취소');
  if (await a.present() === -1) return;
  Keychain.set(KEY_TOKEN, a.textFieldValue(0).trim());
}

// ---- 기록 불러오기 (실패하면 마지막 저장본) ----
const fm = FileManager.local();
const cachePath = () => fm.joinPath(fm.documentsDirectory(), 'kor-dash.json');

async function gh(path) {
  const r = new Request('https://api.github.com' + path);
  r.headers = { Authorization: 'Bearer ' + Keychain.get(KEY_TOKEN), Accept: 'application/vnd.github+json' };
  return await r.loadJSON();
}
async function load() {
  try {
    const list = await gh('/gists?per_page=100');
    const g = (list || []).find((x) => x.description === GIST_DESC);
    if (!g) throw new Error('연동 Gist 없음 — 앱에서 기기 연동을 켜 주세요');
    const full = await gh('/gists/' + g.id);
    // 기록 파일(korean-N.json)이 여럿이면 가장 최근에 저장된 것
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
      rr.headers = { Authorization: 'Bearer ' + Keychain.get(KEY_TOKEN) };
      text = await rr.loadString();
    }
    fm.writeString(cachePath(), text);
    return JSON.parse(text);
  } catch (e) {
    if (fm.fileExists(cachePath())) return JSON.parse(fm.readString(cachePath()));
    throw e;
  }
}

// ---- 그리기 ----
const C = (hex, a) => new Color(hex, a == null ? 1 : a);
function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.replace('#', '').padEnd(6, '0').substr(i - 1, 2), 16));
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const shortDate = (d) => (d || '').slice(5).replace('.', '/');

function chart(rows, target, th, W, H, showDates) {
  const dc = new DrawContext();
  dc.size = new Size(W, H); dc.opaque = false; dc.respectScreenScale = true;
  const n = rows.length, L = 12, R = 12, T = 14, B = showDates ? 16 : 6;
  const gs = rows.map((r) => r.grade);
  let lo = Math.min(...gs), hi = Math.max(...gs);
  if (target != null) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
  lo -= 0.45; hi += 0.45;
  const X = (i) => n === 1 ? W / 2 : L + i * (W - L - R) / (n - 1);
  const gap = n > 1 ? (W - L - R) / (n - 1) : W;
  const Y = (g) => T + (g - lo) / (hi - lo) * (H - T - B);   // 1등급이 위
  const P = gs.map((g, i) => ({ x: X(i), y: Y(g) }));
  const pt = (q) => new Point(q.x, q.y);
  const line = mix(th.card, th.text, 0.12), sub = mix(th.text, th.card, 0.55);

  // 바닥선 · 목표선(점선)
  dc.setStrokeColor(C(line)); dc.setLineWidth(0.6);
  let p = new Path(); p.move(new Point(0, H - B)); p.addLine(new Point(W, H - B)); dc.addPath(p); dc.strokePath();
  if (target != null) {
    dc.setStrokeColor(C(th.good, 0.8)); dc.setLineWidth(0.8);
    for (let x = 0; x < W; x += 5) { p = new Path(); p.move(new Point(x, Y(target))); p.addLine(new Point(Math.min(x + 2, W), Y(target))); dc.addPath(p); dc.strokePath(); }
  }
  // 부드러운 선
  if (n > 1) {
    p = new Path(); p.move(pt(P[0]));
    for (let i = 0; i < n - 1; i++) {
      const dx = (P[i + 1].x - P[i].x) / 2;
      p.addCurve(pt(P[i + 1]), new Point(P[i].x + dx, P[i].y), new Point(P[i + 1].x - dx, P[i + 1].y));
    }
    dc.setStrokeColor(C(th.accent)); dc.setLineWidth(1.5); dc.addPath(p); dc.strokePath();
  }
  // 점 · 숫자 · 날짜
  dc.setFont(Font.systemFont(9));
  P.forEach((pt, i) => {
    const last = i === n - 1, hit = target != null && gs[i] <= target, r = last ? 3.2 : 2.3;
    dc.setFillColor(C(hit ? th.good : (last ? th.accent : th.card)));
    dc.fillEllipse(new Rect(pt.x - r, pt.y - r, r * 2, r * 2));
    if (!hit && !last) { dc.setStrokeColor(C(th.accent)); dc.setLineWidth(1); dc.strokeEllipse(new Rect(pt.x - r, pt.y - r, r * 2, r * 2)); }
    dc.setTextAlignedCenter();
    dc.setFont(last ? Font.semiboldSystemFont(9) : Font.systemFont(9));
    dc.setTextColor(C(hit ? th.good : (last ? th.text : sub)));
    dc.drawTextInRect(String(gs[i]), new Rect(pt.x - 12, pt.y - 15, 24, 11));
    if (showDates && (gap >= 26 || i % 2 === 0 || last)) {
      dc.setFont(Font.systemFont(7.5)); dc.setTextColor(C(sub, 0.85));
      dc.drawTextInRect(shortDate(rows[i].date), new Rect(pt.x - 16, H - B + 4, 32, 10));
    }
  });
  return dc.getImage();
}

function dLeft(s) {
  const m = /(\d{4})\D(\d{1,2})\D(\d{1,2})/.exec(s || '');
  if (!m) return null;
  const t = new Date(+m[1], +m[2] - 1, +m[3]), now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((t - now) / 86400000);
}

async function build() {
  const fam = config.widgetFamily || 'medium';
  const w = new ListWidget();
  w.url = APP_URL;
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);
  let data;
  try {
    if (!Keychain.contains(KEY_TOKEN)) throw new Error('Scriptable에서 스크립트를 한 번 실행해 토큰을 입력하세요');
    data = await load();
  } catch (e) {
    w.backgroundColor = C(DEF.bg);
    const t = w.addText(String(e.message || e)); t.font = Font.systemFont(11); t.textColor = C('#6c6d73');
    return w;
  }
  const s = data.settings || {};
  const th = Object.assign({}, DEF, s.theme || {});
  w.backgroundColor = C(th.card);
  w.setPadding(12, 14, 10, 14);

  const all = (data.exams || []).filter((e) => e.grade != null)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const N = fam === 'small' ? 6 : fam === 'large' ? 16 : 10;
  const rows = all.slice(-N);
  const last = rows[rows.length - 1];

  // 머리줄: 제목 · 최근 등급 · D-day
  const top = w.addStack(); top.layoutHorizontally(); top.centerAlignContent();
  const ttl = top.addText('등급 추이'); ttl.font = Font.systemFont(10); ttl.textColor = C(mix(th.text, th.card, 0.5));
  top.addSpacer();
  const dd = dLeft(s.examDate);
  if (dd != null && dd >= 0 && fam !== 'small') {
    const d = top.addText('D-' + dd); d.font = Font.lightSystemFont(10); d.textColor = C(th.accent);
  }
  w.addSpacer(2);
  const row = w.addStack(); row.layoutHorizontally(); row.bottomAlignContent();
  const big = row.addText(last ? String(last.grade) : '–'); big.font = Font.ultraLightSystemFont(fam === 'small' ? 30 : 34); big.textColor = C(th.text);
  const unit = row.addText(' 등급'); unit.font = Font.systemFont(10); unit.textColor = C(mix(th.text, th.card, 0.55));
  if (s.targetGrade != null && last) {
    row.addSpacer(6);
    const gap = s.targetGrade - last.grade;   // 0 이상 = 달성
    const tg = row.addText(gap >= 0 ? '목표 달성' : '목표 ' + s.targetGrade + '등급');
    tg.font = Font.systemFont(9); tg.textColor = C(gap >= 0 ? th.good : th.bad);
  }
  w.addSpacer();

  if (!rows.length) {
    const t = w.addText('등급 기록이 없습니다'); t.font = Font.systemFont(10); t.textColor = C(mix(th.text, th.card, 0.55));
    return w;
  }
  const size = fam === 'small' ? [130, 58] : fam === 'large' ? [300, 210] : [300, 70];
  const img = w.addImage(chart(rows, s.targetGrade, th, size[0], size[1], fam !== 'small'));
  img.imageSize = new Size(size[0], size[1]);
  img.centerAlignImage();
  return w;
}

async function main() {
  if (!config.runsInWidget) {
    if (!Keychain.contains(KEY_TOKEN)) await ask(true);
    else {
      const m = new Alert();
      m.title = '등급 추이 위젯';
      m.addAction('위젯 미리보기');
      m.addAction('토큰 바꾸기');
      m.addCancelAction('닫기');
      const i = await m.present();
      if (i === -1) return;
      if (i === 1) await ask(true);
    }
  }
  const widget = await build();
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentMedium();
}

await main();
Script.complete();
