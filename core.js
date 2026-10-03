/* core.js — 저장소 + 코드 로그인 + 라우터
   ※ 기록은 코드별로 따로 저장됩니다. (kor-dash:d0 ~ kor-dash:d9)
   ※ 필드를 추가할 땐 DEFAULTS()와 migrate()만 손보면 기존 기록이 유지됩니다. */
'use strict';

var APP_KEY = 'kor-dash';
var SCHEMA = 2;
var APP_VER = 'kor-v12';   // sw.js의 CACHE와 같게
var CODE = null;

/* 저장 공간 (사파리 비공개 모드·미리보기에서도 죽지 않도록 감쌈) */
var LS = (function () {
  try {
    localStorage.setItem('__t', '1'); localStorage.removeItem('__t');
    return localStorage;
  } catch (e) {
    var m = {};
    return {
      getItem: function (k) { return k in m ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; },
      key: function (i) { return Object.keys(m)[i] || null; },
      get length() { return Object.keys(m).length; }
    };
  }
})();

function dataKey() { return APP_KEY + ':d' + CODE; }
function snapKey(day) { return APP_KEY + ':s' + CODE + ':' + day; }

/* ---- 고정 상수 ---- */
var AREAS = ['독서', '문학'];
var GENRES = {
  '독서': ['인문', '사회', '경제', '과학', '기술'],
  '문학': ['고전소설', '현대소설', '현대시', '고전시가', '극/수필']
};
/* 이전 이름 → 현재 이름 (기존 기록 자동 변환) */
var GENRE_ALIAS = { '철학': '인문', '고전산문': '고전소설', '현대산문': '현대소설' };
var ALL_GENRES = GENRES['독서'].concat(GENRES['문학']);
var GENRE_AREA = {};
AREAS.forEach(function (a) { GENRES[a].forEach(function (g) { GENRE_AREA[g] = a; }); });

var DEFAULT_COLORS = {
  '인문': '#6E7C99', '사회': '#7A8465', '경제': '#8C8768',
  '과학': '#6E8C8A', '기술': '#8A7E72',
  '고전소설': '#99857A', '현대소설': '#A08A8A', '현대시': '#8085A0',
  '고전시가': '#85956E', '극/수필': '#7C7A99',
  /* 영역별 오답 그래프 색 */
  '영역:독서': '#5b6b85', '영역:문학': '#8f8aae', '영역:선택': '#b3a78a'
};
var SWATCHES = ['#6E7C99', '#8085A0', '#7C7A99', '#A08A8A', '#99857A',
  '#7A8465', '#85956E', '#8C8768', '#6E8C8A', '#8A8A90'];

var ORGS = ['평가원', '교육청', '사설', '기타'];
var SELECTS = ['언매', '화작'];
var READ_CATS = ['독서', '문학', '선택과목', '시간운영', '기타'];
var WRONG_TYPES = ['시간 부족', '근거 못 찾음', '추론 실패', '선지 비교 실패',
  '지문 이해 부족', '어휘·개념', '문법 개념', '배경지식', '단순 실수'];

/* ---- 기본 데이터 ---- */
function DEFAULTS() {
  return {
    v: SCHEMA,
    t: 0,          // 마지막 저장 시각
    reading: [],   // {id,cat,title,body,pin,u}
    exams: [],     // {id,date,org,name,sel,raw,std,pct,grade,w:{독서,문학,선택},time,memo,u}
    passages: [],  // {id,date,area,genre,title,source,examId,qn,wrong,diff,types[],method,note,u}
    tomb: [],      // 삭제 기록 {id,u} — 기기 간 병합용, 90일 보관
    settings: { colors: {}, targetGrade: 1, targetPct: 96, examDate: '2026.11.19', u: 0 }
  };
}

function migrate(d) {
  var def = DEFAULTS();
  if (!d || typeof d !== 'object') return def;
  var settings = Object.assign({}, def.settings, d.settings || {});
  settings.colors = Object.assign({}, d.settings && d.settings.colors);
  var out = Object.assign(def, d);
  out.settings = settings;
  ['reading', 'exams', 'passages', 'tomb'].forEach(function (k) {
    if (!Array.isArray(out[k])) out[k] = [];
  });
  /* 제재 이름 변경 반영 */
  out.passages.forEach(function (p) {
    if (GENRE_ALIAS[p.genre]) p.genre = GENRE_ALIAS[p.genre];
    if (p.genre && GENRE_AREA[p.genre]) p.area = GENRE_AREA[p.genre];
  });
  Object.keys(GENRE_ALIAS).forEach(function (old) {
    if (out.settings.colors[old]) {
      if (!out.settings.colors[GENRE_ALIAS[old]]) out.settings.colors[GENRE_ALIAS[old]] = out.settings.colors[old];
      delete out.settings.colors[old];
    }
  });
  /* 메모·총평 → 행동강령 1회 이동 (시험마다 m2r 표시, 이후 새로 쓴 메모는 그대로) */
  out.exams.forEach(function (e) {
    if (e.m2r) return;
    var memo = String(e.memo || '').trim(), rule = String(e.rule || '').trim();
    if (memo) {
      e.rule = !rule ? memo : (rule.indexOf(memo) >= 0 ? rule : rule + '\n' + memo);
      e.memo = '';
      e.u = Date.now();   // 다른 기기와 병합할 때 옮긴 쪽이 남도록
    }
    e.m2r = 1;
  });
  out.v = SCHEMA;
  return out;
}

/* ---- 저장소 ---- */
var Store = {
  data: DEFAULTS(),
  load: function () {
    try {
      var raw = LS.getItem(dataKey());
      this.data = raw ? migrate(JSON.parse(raw)) : DEFAULTS();
      /* 메모→행동강령 이동이 처음 일어난 경우 바로 저장 (연동 중이면 다른 기기에도 반영) */
      if (raw && raw.indexOf('"m2r"') < 0 && this.data.exams.length) this.save();
    } catch (e) { this.data = DEFAULTS(); }
  },
  save: function (skipSync) {
    this.data.t = Date.now();
    try {
      LS.setItem(dataKey(), JSON.stringify(this.data));
      this.snapshot();
    } catch (e) {
      alert('저장에 실패했습니다. 설정에서 백업 파일을 내려받아 주세요.');
    }
    if (!skipSync && window.Sync) Sync.queue();
  },
  touchSettings: function () { this.data.settings.u = Date.now(); this.save(); },
  /* 하루 1회 자동 스냅샷, 최근 7일 보관 */
  snapshot: function () {
    try {
      var k = snapKey(new Date().toISOString().slice(0, 10));
      if (LS.getItem(k)) return;
      LS.setItem(k, LS.getItem(dataKey()) || '');
      var keys = this.snapshots().sort();
      while (keys.length > 7) LS.removeItem(snapKey(keys.shift()));
    } catch (e) { }
  },
  snapshots: function () {
    var out = [], p = APP_KEY + ':s' + CODE + ':';
    for (var i = 0; i < LS.length; i++) {
      var k = LS.key(i);
      if (k && k.indexOf(p) === 0) out.push(k.slice(p.length));
    }
    return out.sort().reverse();
  },
  color: function (genre) {
    return (this.data.settings.colors || {})[genre] || DEFAULT_COLORS[genre] || '#8A8A90';
  },
  put: function (coll, obj) {
    var arr = this.data[coll];
    obj.u = Date.now();
    if (!obj.id) { obj.id = uid(); arr.push(obj); }
    else {
      var i = arr.findIndex(function (x) { return x.id === obj.id; });
      if (i < 0) arr.push(obj); else arr[i] = obj;
    }
    this.save();
    return obj;
  },
  del: function (coll, id) {
    this.data[coll] = this.data[coll].filter(function (x) { return x.id !== id; });
    if (!Array.isArray(this.data.tomb)) this.data.tomb = [];
    this.data.tomb.push({ id: id, u: Date.now() });
    this.save();
  },
  get: function (coll, id) {
    return this.data[coll].find(function (x) { return x.id === id; });
  }
};

/* ---- 유틸 ---- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function num(v, d) { var n = parseFloat(v); return isNaN(n) ? (d === undefined ? null : d) : n; }
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function today() {
  var d = new Date();
  return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate());
}
function toDate(s) {
  var m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function dLeft(s) {
  var d = toDate(s); if (!d) return null;
  var t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
function byDateDesc(a, b) { return (b.date || '').localeCompare(a.date || '') || (b.u || 0) - (a.u || 0); }
function avg(arr) { return arr.length ? arr.reduce(function (s, v) { return s + v; }, 0) / arr.length : null; }
function r1(n) { return n == null ? '–' : (Math.round(n * 10) / 10); }
function timeAgo(ts) {
  if (!ts) return '없음';
  var m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return m + '분 전';
  if (m < 1440) return Math.round(m / 60) + '시간 전';
  return Math.round(m / 1440) + '일 전';
}

/* ---- 로그인 화면 ---- */
function showGate() {
  var old = document.getElementById('gate');
  if (old) old.remove();
  var g = document.createElement('div');
  g.id = 'gate';
  g.innerHTML = '<div class="gate-h"><div class="eyebrow">수능 국어</div>' +
    '<div class="gate-t">코드를 눌러 시작</div>' +
    '<div class="gate-s">코드마다 기록이 따로 저장됩니다</div></div>';
  var keys = document.createElement('div');
  keys.className = 'keys';
  for (var i = 0; i <= 9; i++) {
    (function (n) {
      var has = !!LS.getItem(APP_KEY + ':d' + n);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'key';
      b.innerHTML = '<span>' + n + '</span>' + (has ? '<span class="has"></span>' : '<span class="has" style="opacity:0"></span>');
      b.onclick = function () { App.login(String(n)); };
      keys.appendChild(b);
    })(i);
  }
  g.appendChild(keys);
  document.body.appendChild(g);
  document.getElementById('main').hidden = true;
  document.getElementById('topbar').hidden = true;
  document.getElementById('tabbar').hidden = true;
}

/* ---- 테마 색상 (설정에 저장, 기기 연동) ---- */
var THEME_KEYS = [
  ['accent', '기본 · 그래프'], ['good', '목표 달성'], ['bad', '목표 미달'], ['hl', '강조 · 행동강령'],
  ['bg', '배경'], ['card', '카드'], ['text', '글자']
];
var THEME_DEFAULT = { accent: '#5b6b85', good: '#7a8465', bad: '#a8868a', hl: '#8f8aae', bg: '#f5f5f7', card: '#ffffff', text: '#1f2023' };
var THEME_PRESETS = {
  '기본': THEME_DEFAULT,
  '라벤더': { accent: '#7c7a99', good: '#85956e', bad: '#a08a8a', hl: '#9a8fb8', bg: '#f6f5f9', card: '#ffffff', text: '#25242b' },
  '세이지': { accent: '#6e8c8a', good: '#7a8465', bad: '#99857a', hl: '#8085a0', bg: '#f3f5f3', card: '#ffffff', text: '#202422' },
  '로즈': { accent: '#8f7782', good: '#7f8a6a', bad: '#a07070', hl: '#8f8aae', bg: '#f8f5f5', card: '#ffffff', text: '#2a2325' },
  '샌드': { accent: '#857d66', good: '#7a8465', bad: '#a08a8a', hl: '#8085a0', bg: '#f6f5f1', card: '#fffefb', text: '#26251f' },
  '나이트': { accent: '#8fa0bd', good: '#9aa883', bad: '#c39ca0', hl: '#aaa5c8', bg: '#1b1f27', card: '#242933', text: '#e4e6ec' }
};
function hexRgb(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbHex(c) { return '#' + c.map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join(''); }
function mixHex(a, b, t) { var x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
function hueOf(h) {
  var c = hexRgb(h).map(function (v) { return v / 255; }), mx = Math.max.apply(null, c), mn = Math.min.apply(null, c), d = mx - mn;
  if (!d) return { h: 0, s: 0 };
  var hu = mx === c[0] ? ((c[1] - c[2]) / d) % 6 : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4;
  return { h: (hu * 60 + 360) % 360, s: d / (1 - Math.abs(mx + mn - 1) || 1) };
}
/* '내 제재 톤': 설정한 제재 색 중 목표 색상(파랑·초록·빨강·보라)에 가장 가까운 것을 골라 테마로 */
function themeFromGenres() {
  var cs = ALL_GENRES.map(function (g) { return Store.color(g); });
  function near(target) {
    var best = cs[0], bd = 999;
    cs.forEach(function (c) { var hh = hueOf(c), d = Math.min(Math.abs(hh.h - target), 360 - Math.abs(hh.h - target)) - hh.s * 20; if (d < bd) { bd = d; best = c; } });
    return best;
  }
  var accent = near(222);
  return { accent: accent, good: near(85), bad: near(355), hl: near(265),
    bg: mixHex(accent, '#ffffff', 0.94), card: '#ffffff', text: mixHex(accent, '#121317', 0.82) };
}
function currentTheme() { return Object.assign({}, THEME_DEFAULT, (Store.data && Store.data.settings.theme) || {}); }
function applyTheme(t) {
  t = t || currentTheme();
  var r = document.documentElement.style, dark = hexRgb(t.bg).reduce(function (a, v) { return a + v; }, 0) < 384;
  var set = function (k, v) { r.setProperty(k, v); };
  set('--accent', t.accent); set('--navy', t.accent);
  set('--good', t.good); set('--olive', t.good);
  set('--bad', t.bad); set('--rose', t.bad); set('--danger', t.bad);
  set('--violet', t.hl);
  set('--bg', t.bg); set('--surface', t.card); set('--surface-2', mixHex(t.card, t.bg, 0.5));
  set('--t1', t.text); set('--t2', mixHex(t.text, t.card, 0.45)); set('--t3', mixHex(t.text, t.card, 0.62));
  set('--line', mixHex(t.card, t.text, dark ? 0.16 : 0.1)); set('--line-2', mixHex(t.card, t.text, dark ? 0.09 : 0.055));
  var bc = hexRgb(t.bg), cc = hexRgb(t.card);
  set('--bar', 'rgba(' + bc.join(',') + ',.92)'); set('--tab', 'rgba(' + cc.join(',') + ',.94)');
  set('--on-t1', t.card);
  var m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t.bg;
}

/* ---- 라우터 ---- */
var App = {
  views: [],
  route: null,
  register: function (v) { this.views.push(v); },
  view: function () {
    var self = this;
    return this.views.find(function (v) { return v.id === self.route; }) || this.views[0];
  },
  go: function (id) { this.route = id; this.refresh(); },
  /* 렌더마다 컨테이너를 새로 만들어 이벤트 리스너 누적을 차단 */
  refresh: function () {
    if (CODE === null) return;
    var cur = this.view();
    this.route = cur.id;
    applyTheme();
    var old = document.getElementById('main');
    var main = document.createElement('main');
    main.id = 'main';
    old.replaceWith(main);
    document.getElementById('viewTitle').textContent = cur.title;
    var add = document.getElementById('btnAdd');
    add.hidden = !cur.add;
    add.onclick = cur.add || null;
    cur.render(main);
    if (window.scrollCharts) scrollCharts(main);
    document.querySelectorAll('#tabbar button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.id === cur.id);
    });
    document.getElementById('btnSet').classList.toggle('on', cur.id === 'settings');
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
    window.scrollTo(0, 0);
  },
  buildTabs: function () {
    var nav = document.getElementById('tabbar');
    nav.innerHTML = '';
    var self = this;
    this.views.forEach(function (v) {
      if (v.hidden) return;   // 설정 등 탭바에 없는 화면 (상단 아이콘으로 진입)
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.id = v.id;
      b.innerHTML = '<span class="tb-i">' + v.icon + '</span><span>' + esc(v.label) + '</span>';
      b.onclick = function () { self.go(v.id); };
      nav.appendChild(b);
    });
  },
  dday: function () {
    var n = dLeft(Store.data.settings.examDate);
    var el = document.getElementById('dday');
    el.textContent = n == null ? '' : (n > 0 ? '수능 D-' + n : (n === 0 ? '수능 D-DAY' : ''));
  },
  login: function (code) {
    CODE = String(code);
    LS.setItem(APP_KEY + ':code', CODE);
    Store.load();
    var g = document.getElementById('gate'); if (g) g.remove();
    document.getElementById('main').hidden = false;
    document.getElementById('topbar').hidden = false;
    document.getElementById('tabbar').hidden = false;
    this.dday();
    this.route = this.views[0].id;
    this.refresh();
    if (window.Sync) Sync.run(false);
  },
  logout: function () {
    LS.removeItem(APP_KEY + ':code');
    CODE = null;
    showGate();
  },
  /* 글꼴 · 크기 · 굵기 (기기별 저장). 기본: 작고 얇게 */
  FONTS: {
    '시스템': { css: '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",system-ui,sans-serif' },
    '프리텐다드': { css: '"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo",sans-serif',
      url: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css' },
    /* 얇고 단정한 고딕 */
    'SUIT': { css: '"SUIT Variable",SUIT,-apple-system,"Apple SD Gothic Neo",sans-serif',
      url: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css' },
    '원티드 산스': { css: '"Wanted Sans Variable","Wanted Sans",-apple-system,"Apple SD Gothic Neo",sans-serif',
      url: 'https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.min.css' },
    '스포카 한 산스': { css: '"Spoqa Han Sans Neo",-apple-system,"Apple SD Gothic Neo",sans-serif',
      url: 'https://spoqa.github.io/spoqa-han-sans/css/SpoqaHanSansNeo.css' },
    '고딕 A1': { css: '"Gothic A1",-apple-system,"Apple SD Gothic Neo",sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Gothic+A1:wght@100;200;300;400;500;600&display=swap' },
    'IBM 플렉스': { css: '"IBM Plex Sans KR",-apple-system,"Apple SD Gothic Neo",sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@100;200;300;400;500;600&display=swap' },
    '노토 산스': { css: '"Noto Sans KR",-apple-system,"Apple SD Gothic Neo",sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100..700&display=swap' },
    '고운 돋움': { css: '"Gowun Dodum",-apple-system,"Apple SD Gothic Neo",sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap' },
    /* 얇은 명조 (고급스러운 느낌) */
    '노토 세리프': { css: '"Noto Serif KR","AppleMyungjo",serif',
      url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@200..700&display=swap' },
    '함렛': { css: '"Hahmlet","AppleMyungjo",serif',
      url: 'https://fonts.googleapis.com/css2?family=Hahmlet:wght@100..700&display=swap' },
    '마루부리': { css: '"MaruBuri","AppleMyungjo",serif',
      url: 'https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css' },
    '나눔 명조': { css: '"Nanum Myeongjo","AppleMyungjo",serif',
      url: 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&display=swap' }
  },
  WEIGHTS: { '가늘게': 200, '얇게': 300, '보통': 400 },
  /* 내 글꼴 파일은 용량이 커서 IndexedDB에 보관 (이 기기에만) */
  fontDB: function (mode, blob) {
    return new Promise(function (res) {
      try {
        var rq = indexedDB.open(APP_KEY + '-font', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('f'); };
        rq.onerror = function () { res(null); };
        rq.onsuccess = function () {
          var tx = rq.result.transaction('f', mode === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('f');
          var r = mode === 'get' ? st.get('my') : (mode === 'put' ? st.put(blob, 'my') : st.delete('my'));
          r.onsuccess = function () { res(mode === 'get' ? r.result || null : true); };
          r.onerror = function () { res(null); };
        };
      } catch (e) { res(null); }
    });
  },
  loadMyFont: function () {
    if (this._myFont) return Promise.resolve(true);
    var self = this;
    return this.fontDB('get').then(function (rec) {
      if (!rec || !window.FontFace) return false;
      return rec.blob.arrayBuffer().then(function (buf) {
        var ff = new FontFace('MyFont', buf, { weight: '100 900' });
        return ff.load().then(function (f) { document.fonts.add(f); self._myFont = true; return true; });
      }).catch(function () { return false; });
    });
  },
  font: function (patch) {
    var f = {};
    try { f = JSON.parse(LS.getItem(APP_KEY + ':font')) || {}; } catch (e) { }
    if (patch) { f = Object.assign(f, patch); LS.setItem(APP_KEY + ':font', JSON.stringify(f)); }
    if (!f.size) f.size = 15;                      // 기준 크기(px) — 본문은 이 값의 81%
    if (!this.WEIGHTS[f.weight]) f.weight = '얇게';
    var fallback = '-apple-system,"Apple SD Gothic Neo",sans-serif', css, url;
    if (f.family === '내 글꼴') {
      css = '"MyFont",' + fallback;
      this.loadMyFont();
    } else if (f.family === '직접 입력' && f.custom) {
      /* 구글 폰트 이름(예: Gowun Batang). 없는 이름이면 기본 글꼴로 보임 */
      css = '"' + f.custom.replace(/["\\]/g, '') + '",' + fallback;
      url = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f.custom.trim()).replace(/%20/g, '+') + ':wght@100;200;300;400;500;600;700&display=swap';
    } else {
      if (!this.FONTS[f.family]) f.family = '시스템';
      css = this.FONTS[f.family].css; url = this.FONTS[f.family].url;
    }
    var root = document.documentElement, w = this.WEIGHTS[f.weight];
    root.style.fontSize = f.size + 'px';
    root.style.setProperty('--w', w);
    root.style.setProperty('--wb', w + 150);
    root.style.setProperty('--font', css);
    if (url && !document.querySelector('link[data-font="' + url + '"]')) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = url; l.dataset.font = url;
      document.head.appendChild(l);
    }
    return f;
  },
  start: function () {
    LS.removeItem(APP_KEY + ':fs');   // 이전 3단계 설정은 정리
    this.font();
    this.buildTabs();
    var self = this;
    document.getElementById('btnSet').onclick = function () { self.go(self.route === 'settings' ? self.views[0].id : 'settings'); };
    var saved = LS.getItem(APP_KEY + ':code');
    if (saved !== null && saved !== '') this.login(saved);
    else showGate();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && CODE !== null && window.Sync) Sync.run(false);
    });
    /* 오프라인 실행 (지원 안 하는 환경은 그냥 넘어감) */
    try {
      if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        var hadCtrl = !!navigator.serviceWorker.controller, reloaded = false;
        /* 새 버전이 설치되면 한 번 새로고침해 최신 파일로 다시 연다 */
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (hadCtrl && !reloaded) { reloaded = true; location.reload(); }
        });
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
          /* 앱으로 돌아올 때마다 새 버전 확인 (홈 화면 앱은 완전히 닫히지 않는 경우가 많음) */
          document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () { }); });
        }).catch(function () { });
      }
    } catch (e) { }
  }
};
