/* core.js — 저장소 + 코드 로그인 + 라우터
   ※ 기록은 코드별로 따로 저장됩니다. (kor-dash:d0 ~ kor-dash:d9)
   ※ 필드를 추가할 땐 DEFAULTS()와 migrate()만 손보면 기존 기록이 유지됩니다. */
'use strict';

var APP_KEY = 'kor-dash';
var SCHEMA = 2;
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
  '고전시가': '#85956E', '극/수필': '#7C7A99'
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
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
    window.scrollTo(0, 0);
  },
  buildTabs: function () {
    var nav = document.getElementById('tabbar');
    nav.innerHTML = '';
    var self = this;
    this.views.forEach(function (v) {
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
  start: function () {
    this.buildTabs();
    var saved = LS.getItem(APP_KEY + ':code');
    if (saved !== null && saved !== '') this.login(saved);
    else showGate();
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && CODE !== null && window.Sync) Sync.run(false);
    });
    /* 오프라인 실행 (지원 안 하는 환경은 그냥 넘어감) */
    try {
      if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () { });
    } catch (e) { }
  }
};
