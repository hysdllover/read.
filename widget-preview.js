/* widget-preview.js — 설정 화면용 위젯 미리보기
   widget.js(Scriptable 스크립트)를 그대로 실행하되, Scriptable 기능을 브라우저(DOM·캔버스)로 흉내 냅니다.
   실제 위젯과 여백·글꼴이 조금 다를 수 있습니다. */
'use strict';

var WidgetPreview = (function () {
  /* 위젯 크기: 이 앱을 보고 있는 기기(아이폰) 화면에 맞춤 — widget.js의 WSIZE와 같은 표 */
  var WSIZE = [[320, 141, 292, 311], [360, 155, 329, 345], [375, 155, 329, 345], [390, 158, 338, 354], [393, 158, 338, 354],
    [402, 162, 344, 366], [414, 169, 360, 379], [428, 170, 364, 382], [430, 170, 364, 382], [440, 170, 364, 382]];
  var SW = Math.min(screen.width, screen.height);
  if (SW >= 700 || SW < 300) SW = 390;   // 아이패드·데스크톱은 아이폰 기준
  var BEST = WSIZE[3];
  WSIZE.forEach(function (r) { if (Math.abs(r[0] - SW) < Math.abs(BEST[0] - SW)) BEST = r; });
  var SIZES = {
    small: [BEST[1], BEST[1]], medium: [BEST[2], BEST[1]], large: [BEST[2], BEST[3]],
    accessoryCircular: [72, 72], accessoryRectangular: [160, 72], accessoryInline: [240, 22]
  };
  var SYS = '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif';
  var WEIGHT = { ultraLight: 100, thin: 200, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 };
  var SD = '"Apple SD Gothic Neo",' + SYS, HV = '"Helvetica Neue",Helvetica,' + SYS, AV = '"Avenir Next",Avenir,' + SYS;
  var NAMED = {
    'AppleSDGothicNeo-Thin': [200, SD], 'AppleSDGothicNeo-Light': [300, SD], 'AppleSDGothicNeo-Regular': [400, SD], 'AppleSDGothicNeo-Medium': [500, SD],
    'AppleMyungjo': [400, '"AppleMyungjo","Nanum Myeongjo",serif'],
    'HelveticaNeue-UltraLight': [100, HV], 'HelveticaNeue-Thin': [200, HV], 'HelveticaNeue-Light': [300, HV], 'HelveticaNeue': [400, HV],
    'AvenirNext-UltraLight': [200, AV], 'AvenirNext-Regular': [400, AV], 'AvenirNext-Medium': [500, AV],
    'Didot': [400, '"Didot","Bodoni 72",serif'], 'Didot-Bold': [700, '"Didot","Bodoni 72",serif'],
    'Futura-Medium': [500, 'Futura,"Trebuchet MS",sans-serif'], 'Futura-Bold': [700, 'Futura,"Trebuchet MS",sans-serif'],
    'Georgia': [400, 'Georgia,serif'], 'Georgia-Bold': [700, 'Georgia,serif'],
    'Optima-Regular': [400, 'Optima,Candara,sans-serif'], 'Optima-Bold': [700, 'Optima,Candara,sans-serif'],
    'GillSans-Light': [300, '"Gill Sans","Gill Sans MT",sans-serif'], 'GillSans': [400, '"Gill Sans","Gill Sans MT",sans-serif'], 'GillSans-SemiBold': [600, '"Gill Sans","Gill Sans MT",sans-serif']
  };

  function mocks(data, family, param) {
    function FontC(name, size) { var n = NAMED[name] || [400, SYS]; this.css = n[0] + ' ' + size + 'px ' + n[1]; this.size = size; }
    var Font = new Proxy(FontC, {
      get: function (t, k) {
        if (typeof k !== 'string') return t[k];
        var m = /^(\w+?)(Rounded|Monospaced)?SystemFont$/.exec(k);
        if (!m) return t[k];
        var fam = m[2] === 'Rounded' ? 'ui-rounded,' + SYS : m[2] === 'Monospaced' ? 'ui-monospace,"SF Mono",Menlo,monospace' : SYS;
        var w = WEIGHT[m[1]] || 400;
        return function (s) { return { css: w + ' ' + s + 'px ' + fam, size: s }; };
      }
    });
    function Color(hex, a) {
      var h = String(hex).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&');
      var n = parseInt(h, 16) || 0;
      this.css = 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + (a == null ? 1 : a) + ')';
    }
    function Size(w, h) { this.width = w; this.height = h; }
    function Rect(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; }
    function Point(x, y) { this.x = x; this.y = y; }
    function Path() { this.ops = []; }
    Path.prototype.move = function (p) { this.ops.push(['moveTo', p.x, p.y]); };
    Path.prototype.addLine = function (p) { this.ops.push(['lineTo', p.x, p.y]); };
    Path.prototype.addCurve = function (p, a, b) { this.ops.push(['bezierCurveTo', a.x, a.y, b.x, b.y, p.x, p.y]); };
    Path.prototype.addRoundedRect = function (r, rx) {
      var x = r.x, y = r.y, w = r.w, h = r.h, k = Math.min(rx, w / 2, h / 2);
      this.ops.push(['moveTo', x + k, y], ['lineTo', x + w - k, y], ['quadraticCurveTo', x + w, y, x + w, y + k], ['lineTo', x + w, y + h - k],
        ['quadraticCurveTo', x + w, y + h, x + w - k, y + h], ['lineTo', x + k, y + h], ['quadraticCurveTo', x, y + h, x, y + h - k],
        ['lineTo', x, y + k], ['quadraticCurveTo', x, y, x + k, y]);
    };
    function DrawContext() { this.al = 'left'; }
    Object.defineProperty(DrawContext.prototype, 'size', {
      set: function (s) {
        this.c = document.createElement('canvas');
        var r = 3; this.c.width = s.width * r; this.c.height = s.height * r;
        this.g = this.c.getContext('2d'); this.g.scale(r, r);
      }
    });
    var D = DrawContext.prototype;
    D.setStrokeColor = function (c) { this.g.strokeStyle = c.css; };
    D.setFillColor = function (c) { this.g.fillStyle = c.css; };
    D.setLineWidth = function (w) { this.g.lineWidth = w; };
    D.setTextColor = function (c) { this.tc = c.css; };
    D.setFont = function (f) { this.g.font = f.css; };
    D.setTextAlignedCenter = function () { this.al = 'center'; };
    D.setTextAlignedLeft = function () { this.al = 'left'; };
    D.addPath = function (p) { this.p = p; };
    D.trace = function () { var g = this.g; g.beginPath(); this.p.ops.forEach(function (o) { g[o[0]].apply(g, o.slice(1)); }); };
    D.strokePath = function () { this.trace(); this.g.stroke(); };
    D.fillPath = function () { this.trace(); this.g.fill(); };
    D.fillRect = function (r) { this.g.fillRect(r.x, r.y, r.w, r.h); };
    D.fillEllipse = function (r) { this.g.beginPath(); this.g.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, 7); this.g.fill(); };
    D.strokeEllipse = function (r) { this.g.beginPath(); this.g.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, 7); this.g.stroke(); };
    D.drawTextInRect = function (t, r) {
      this.g.fillStyle = this.tc; this.g.textAlign = this.al; this.g.textBaseline = 'top';
      this.g.fillText(t, this.al === 'center' ? r.x + r.w / 2 : r.x, r.y);
    };
    D.getImage = function () { return this.c; };

    /* 위젯 요소 (ListWidget / WidgetStack / WidgetText / WidgetImage) */
    function makeStack(el, vertical) {
      el.style.display = 'flex';
      el.style.flexDirection = vertical ? 'column' : 'row';
      el.style.alignItems = 'center';   // iOS(SwiftUI) 기본: 가운데
      el.style.minWidth = '0';
      var st = {
        el: el,
        layoutHorizontally: function () { el.style.flexDirection = 'row'; el.style.alignItems = 'center'; },
        layoutVertically: function () { el.style.flexDirection = 'column'; el.style.alignItems = 'center'; },
        centerAlignContent: function () { el.style.alignItems = 'center'; },
        topAlignContent: function () { el.style.alignItems = 'flex-start'; },
        bottomAlignContent: function () { el.style.alignItems = 'baseline'; },
        setPadding: function (t, l, b, r) { el.style.padding = t + 'px ' + r + 'px ' + b + 'px ' + l + 'px'; },
        addText: function (s) {
          var sp = document.createElement('div'); sp.textContent = s;
          sp.style.flexShrink = '0'; sp.style.whiteSpace = 'pre-wrap'; sp.style.lineHeight = '1.2'; sp.style.wordBreak = 'keep-all'; sp.style.overflowWrap = 'anywhere';
          el.appendChild(sp);
          /* 줄(가로) 안의 글은 줄어들며 줄바꿈 (iOS와 같게) */
          if (el.style.flexDirection === 'row') { sp.style.flexShrink = '1'; sp.style.minWidth = '0'; }
          var o = {};
          Object.defineProperty(o, 'font', { set: function (f) { sp.style.font = f.css; sp.style.lineHeight = '1.2'; } });
          Object.defineProperty(o, 'textColor', { set: function (c) { sp.style.color = c.css; } });
          Object.defineProperty(o, 'lineLimit', {
            set: function (n) { sp.style.display = '-webkit-box'; sp.style.webkitLineClamp = n; sp.style.webkitBoxOrient = 'vertical'; sp.style.overflow = 'hidden'; }
          });
          Object.defineProperty(o, 'minimumScaleFactor', { set: function () { } });
          o.centerAlignText = function () { sp.style.textAlign = 'center'; sp.style.alignSelf = 'stretch'; };
          return o;
        },
        addSpacer: function (n) {
          var d = document.createElement('div');
          d.style.flex = n == null ? '1 1 0' : '0 0 ' + n + 'px';
          el.appendChild(d);
          /* 늘어나는 여백이 있으면 그 묶음이 남은 공간을 모두 차지 (iOS와 같게) */
          if (n == null) {
            var par = el.parentElement, parRow = par && par.style.flexDirection === 'row', row = el.style.flexDirection === 'row';
            if (row === parRow) el.style.flexGrow = '1'; else el.style.alignSelf = 'stretch';
          }
        },
        addStack: function () { var d = document.createElement('div'); d.style.flexShrink = '0'; el.appendChild(d); return makeStack(d, false); },
        addImage: function (c) {
          el.appendChild(c); c.style.display = 'block'; c.style.flexShrink = '0';
          var o = {};
          Object.defineProperty(o, 'imageSize', { set: function (s) { c.style.width = s.width + 'px'; c.style.height = s.height + 'px'; c.style.maxWidth = '100%'; c.style.objectFit = 'contain'; } });
          o.centerAlignImage = function () { c.style.alignSelf = 'center'; };
          return o;
        }
      };
      Object.defineProperty(st, 'size', { set: function (s) { if (s.width) el.style.width = s.width + 'px'; if (s.height) el.style.height = s.height + 'px'; el.style.flex = '0 0 auto'; } });
      Object.defineProperty(st, 'backgroundColor', { set: function (c) { el.style.background = c.css; } });
      Object.defineProperty(st, 'cornerRadius', { set: function (r) { el.style.borderRadius = r + 'px'; } });
      return st;
    }
    var out = {};
    function ListWidget() {
      var sz = SIZES[family] || SIZES.medium, lockW = family.indexOf('accessory') === 0;
      var d = document.createElement('div');
      d.className = 'wp-widget' + (lockW ? ' wp-lock' : '');
      d.style.width = sz[0] + 'px'; d.style.height = sz[1] + 'px';
      d.style.boxSizing = 'border-box'; d.style.overflow = 'hidden';
      d.style.borderRadius = family === 'accessoryCircular' ? '50%' : lockW ? '12px' : '22px';
      d.style.padding = lockW ? '6px 8px' : '16px';
      d.style.color = '#fff';
      var st = makeStack(d, true);
      if (family === 'accessoryCircular') { d.style.alignItems = 'center'; d.style.justifyContent = 'center'; }
      Object.defineProperty(st, 'backgroundGradient', { set: function (g) { d.style.background = 'linear-gradient(180deg,' + g.colors.map(function (c) { return c.css; }).join(',') + ')'; } });
      Object.defineProperty(st, 'backgroundImage', { set: function (c) { d.style.background = 'url(' + c.toDataURL() + ') center/cover'; } });
      Object.defineProperty(st, 'url', { set: function () { } });
      Object.defineProperty(st, 'refreshAfterDate', { set: function () { } });
      Object.defineProperty(st, 'addAccessoryWidgetBackground', { set: function (v) { if (v) d.style.background = 'rgba(255,255,255,.18)'; } });
      out.root = d;
      return st;
    }
    var payload = JSON.stringify(data);
    function Request(url) { this.url = url; }
    Request.prototype.loadJSON = function () {
      var u = this.url;
      return Promise.resolve(u.indexOf('per_page') >= 0 ? [{ id: 'p', description: 'korean-dashboard-sync' }] : { files: { 'korean-0.json': { content: payload } } });
    };
    Request.prototype.loadString = function () { return Promise.resolve(payload); };
    return {
      out: out,
      env: {
        LinearGradient: function () { this.colors = []; this.locations = []; },
        Device: { screenSize: function () { return new Size(SW, 844); }, isPad: function () { return false; } },
        Font: Font, Color: Color, Size: Size, Rect: Rect, Point: Point, Path: Path, DrawContext: DrawContext,
        ListWidget: ListWidget, Request: Request,
        Keychain: { contains: function () { return true; }, get: function () { return 'preview'; }, set: function () { } },
        FileManager: { local: function () { return { joinPath: function (a, b) { return b; }, documentsDirectory: function () { return ''; }, writeString: function () { }, readString: function () { return payload; }, fileExists: function () { return false; } }; } },
        Alert: function () { },
        Script: { setWidget: function () { }, complete: function () { } },
        config: { runsInWidget: true, widgetFamily: family },
        args: { widgetParameter: param }
      }
    };
  }

  /* src: widget.js 내용, data: 기록, param: 'Parameter 문자열', family: 크기 */
  function render(src, data, param, family) {
    src = src.replace('__KOR_DASH_TOKEN__', 'preview');   // 미리보기는 실제 연결 없이 앱의 기록으로 그림
    var m = mocks(data, family, param), names = Object.keys(m.env);
    var fn = new Function(names.join(','), '"use strict"; return (async () => {\n' + src + '\n})();');
    return fn.apply(null, names.map(function (k) { return m.env[k]; })).then(function () { return m.out.root; });
  }

  return { render: render, SIZES: SIZES };
})();

/* ---- 위젯 편집기 (설정 → 홈 화면 위젯) ----
   위젯 구성은 settings.widgets에 저장 → 기기 연동으로 Scriptable 위젯이 읽어 감 */
var WidgetBuilder = (function () {
  var OPTS = {
    kind: [['직접 구성', 'custom'], ['추이 그래프', 'trend'], ['큰 숫자', 'number'], ['요약', 'summary'], ['목표 달성', 'goal'], ['최근 기록', 'recent'], ['영역별 오답', 'wrong'], ['약점 제재', 'weak'], ['행동강령', 'rule']],
    metric: [['등급', 'grade'], ['백분위', 'pct'], ['원점수', 'raw'], ['오답 합계', 'wrong'], ['독서 오답', 'w독서'], ['문학 오답', 'w문학'], ['선택 오답', 'w선택']],
    count: [['5회', 5], ['8회', 8], ['10회', 10], ['15회', 15], ['20회', 20], ['전체', 0]],
    shape: [['곡선', 'curve'], ['직선', 'line'], ['막대', 'bar'], ['점', 'dot']],
    style: [['기본', 'card'], ['배경', 'bg'], ['다크', 'dark'], ['컬러', 'color'], ['종이', 'paper'], ['파스텔', 'pastel'], ['직접', 'custom']],
    pad: [['좁게', 'tight'], ['보통', 'normal'], ['넓게', 'wide']],
    texture: [['끔', 0], ['약하게', 1], ['보통', 2], ['진하게', 3]],
    note: [['없음', ''], ['줄노트', 'lined'], ['모눈', 'grid'], ['점', 'dot']],
    margin: [['끔', false], ['켬', true]],
    align: [['왼쪽', 'left'], ['가운데', 'center']],
    textFont: [['시스템', 'sys'], ['둥근', 'round'], ['얇은 고딕', 'sdlight'], ['가는 고딕', 'sdthin'], ['명조', 'myungjo'], ['모노', 'mono']],
    numFont: [['시스템', 'sys'], ['둥근', 'round'], ['모노', 'mono'], ['헬베티카', 'helv'], ['아베니르', 'avenir'], ['디도', 'didot'], ['퓨추라', 'futura'], ['조지아', 'georgia'], ['옵티마', 'optima'], ['길 산스', 'gill']],
    weight: [['가늘게', 'thin'], ['얇게', 'light'], ['보통', 'regular']],
    scale: [['작게', 0.9], ['보통', 1], ['크게', 1.15]]
  };
  var SHOW = [['제목', 'title'], ['최근 값', 'value'], ['변화', 'delta'], ['목표', 'target'], ['점수', 'labels'], ['날짜', 'dates'], ['통계', 'stats'], ['시험명', 'exam']];
  var GROUPS = [
    ['kind', '종류', 'all'], ['metric', '지표', 'trend number summary goal'], ['count', '기록 수', 'trend number summary goal wrong recent'],
    ['shape', '그래프 모양', 'trend number summary goal'], ['style', '디자인', 'all'], ['texture', '종이 질감', 'all'], ['note', '노트 무늬', 'all'], ['margin', '왼쪽 여백선', 'all'], ['pad', '여백', 'all'], ['align', '정렬', 'number goal rule'],
    ['textFont', '한글 글꼴', 'all'], ['numFont', '숫자 글꼴', 'all'], ['weight', '숫자 굵기', 'all'], ['scale', '글자 크기', 'all']
  ];
  var DEF = {
    kind: 'trend', metric: 'grade', count: 10, shape: 'curve', style: 'card', align: 'left',
    textFont: 'sys', numFont: 'sys', weight: 'light', scale: 1, pad: 'normal',
    show: { title: true, value: true, delta: true, target: true, labels: true, dates: true, stats: true, exam: true }
  };
  var SIZE_KEY = { '작게': 'small', '중간': 'medium', '크게': 'large', '잠금 원형': 'accessoryCircular', '잠금 사각': 'accessoryRectangular', '잠금 한 줄': 'accessoryInline' };
  var sel = 0, size = '중간', scriptText = '', look = '기본';

  /* 구성요소 종류와 옵션 */
  var MET = [['등급', 'grade'], ['백분위', 'pct'], ['원점수', 'raw'], ['오답 합계', 'wrong'], ['독서 오답', 'w독서'], ['문학 오답', 'w문학'], ['선택 오답', 'w선택']];
  var SML = [['작게', 's'], ['보통', 'm'], ['크게', 'l']];
  var FIELD = {
    text: { type: 'text', l: '글', ph: '예: 오늘도 한 지문 더' },
    metric: { l: '지표', o: MET, def: 'pct' },
    size: { l: '크기', o: SML, def: 'm' },
    h: { l: '높이', o: [['낮게', 's'], ['보통', 'm'], ['높게', 'l']], def: 'm' },
    shape: { l: '모양', o: [['곡선', 'curve'], ['직선', 'line'], ['막대', 'bar'], ['점', 'dot']], def: 'curve' },
    count: { l: '기록 수', o: [['5회', 5], ['8회', 8], ['10회', 10], ['15회', 15], ['20회', 20], ['전체', 0]], def: 10 },
    n: { l: '개수', o: [['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['8', 8]], def: 3 },
    lines: { l: '최대 줄 수', o: [['2', 2], ['3', 3], ['4', 4], ['6', 6], ['8', 8], ['12', 12]], def: 4 },
    align: { l: '정렬', o: [['왼쪽', 'left'], ['가운데', 'center']], def: 'left' },
    color: { l: '글자색', o: [['연하게', 'sub'], ['진하게', 'text'], ['강조색', 'accent'], ['포인트', 'hl']], def: 'sub' },
    keys: { type: 'multi', l: '보여줄 숫자', o: [['원점수', 'raw'], ['백분위', 'pct'], ['등급', 'grade'], ['오답 합계', 'wrong']], def: ['raw', 'pct', 'grade'] }
  };
  var TOG = {
    label: ['이름 표시', true], delta: ['변화 ▲▼', true], target: ['목표', true], labels: ['점수', true],
    dates: ['날짜', true], exam: ['시험명', true], bold: ['굵게', false], flex: ['남은 공간 채우기', false]
  };
  var BT = {
    title: { n: '제목', d: '직접 쓴 제목', f: ['text', 'size', 'color', 'align'], tg: ['bold'], def: { text: '국어 성적' } },
    big: { n: '큰 숫자', d: '최근 값 하나를 크게', f: ['metric', 'size', 'align'], tg: ['label', 'delta', 'target'], def: { metric: 'pct' } },
    chart: { n: '그래프', d: '추이 그래프', f: ['metric', 'shape', 'h', 'count'], tg: ['labels', 'dates', 'target'], def: { metric: 'grade', h: 'm' } },
    tiles: { n: '숫자 줄', d: '원점수·백분위·등급을 나란히', f: ['keys', 'size'], tg: ['delta'], def: {} },
    ring: { n: '목표 고리', d: '목표 달성률', f: ['metric', 'size', 'align'], tg: [], def: { metric: 'pct' } },
    recent: { n: '최근 기록', d: '최근 시험 몇 줄', f: ['n'], tg: ['exam'], def: { n: 3 } },
    wrong: { n: '영역별 오답', d: '독서·문학·선택 막대', f: ['h', 'count'], tg: ['labels', 'dates'], def: { h: 'm' } },
    weak: { n: '약점 제재', d: '오답률 높은 제재', f: ['n'], tg: [], def: { n: 3 } },
    rule: { n: '행동강령', d: '최근 행동강령', f: ['size', 'lines', 'align'], tg: [], def: { lines: 4 } },
    note: { n: '문구', d: '내가 쓴 한마디', f: ['text', 'size', 'color', 'align'], tg: ['bold'], def: { text: '', color: 'hl' } },
    line: { n: '구분선', d: '가는 선', f: [], tg: [], def: {} },
    gap: { n: '여백', d: '띄우기 · 아래로 밀기', f: ['size'], tg: ['flex'], def: { size: 'm' } }
  };
  function blockSummary(b) {
    var p = [];
    if (b.text) p.push('“' + b.text.slice(0, 14) + '”');
    if (b.metric) p.push((MET.find(function (x) { return x[1] === b.metric; }) || ['', ''])[0]);
    if (b.shape) p.push(FIELD.shape.o.find(function (x) { return x[1] === b.shape; })[0]);
    if (b.keys) p.push(b.keys.length + '개');
    if (b.n) p.push(b.n + '개');
    if (b.flex) p.push('채우기');
    return p.join(' · ');
  }

  function labelOf(key, v) { var o = OPTS[key].find(function (x) { return x[1] === v; }); return o ? o[0] : OPTS[key][0][0]; }
  function valueOf(key, l) { var o = OPTS[key].find(function (x) { return x[0] === l; }); return o ? o[1] : OPTS[key][0][1]; }
  function list() {
    var s = Store.data.settings;
    if (!Array.isArray(s.widgets) || !s.widgets.length) {
      s.widgets = [Object.assign(JSON.parse(JSON.stringify(DEF)), { name: '위젯 1' })];
      Store.touchSettings();
    }
    return s.widgets;
  }
  function save() { Store.touchSettings(); }
  function newName(ws) { var i = ws.length + 1; while (ws.some(function (w) { return w.name === '위젯 ' + i; })) i++; return '위젯 ' + i; }

  function copy(text, done) {
    var settled = false;
    var t = setTimeout(function () { if (!settled) { settled = true; fallback(text); } }, 1500);
    try {
      navigator.clipboard.writeText(text).then(function () {
        if (!settled) { settled = true; clearTimeout(t); toast(done); }
      }, function () { if (!settled) { settled = true; clearTimeout(t); fallback(text); } });
    } catch (e) { settled = true; clearTimeout(t); fallback(text); }
  }
  function fallback(text) {
    var ta = h('<textarea style="width:100%;height:160px;font-size:12px"></textarea>');
    ta.value = text;
    openSheet({ title: '길게 눌러 전체 선택 → 복사', body: ta, okLabel: '닫기' });
  }

  var SCRIPT_VER = 23;   // widget.js의 SCRIPT_VER와 같게 (올리면 예전 위젯에 '다시 복사' 안내)
  function mount(box) {
    box.innerHTML = '';
    var ws = list();
    if ((Store.data.settings.widgetScriptVer || 0) < SCRIPT_VER) { Store.data.settings.widgetScriptVer = SCRIPT_VER; save(); }
    if (sel >= ws.length) sel = 0;
    var cfg = ws[sel];
    cfg.show = Object.assign({}, DEF.show, cfg.show || {});

    /* 위젯 목록 */
    var bar = h('<div class="chips wb-list"></div>');
    ws.forEach(function (w, i) {
      var b = h('<button type="button" class="pill' + (i === sel ? ' on' : '') + '">' + esc(w.name) + '</button>');
      b.onclick = function () { sel = i; mount(box); };
      bar.appendChild(b);
    });
    var add = h('<button type="button" class="pill">＋ 새 위젯</button>');
    add.onclick = function () {
      ws.push(Object.assign(JSON.parse(JSON.stringify(DEF)), { name: newName(ws) }));
      sel = ws.length - 1; save(); mount(box);
    };
    bar.appendChild(add);
    box.appendChild(bar);

    var tools = h('<div class="wb-tools"><button type="button" class="btn" data-a="rename">이름 바꾸기</button>' +
      '<button type="button" class="btn" data-a="dup">복제</button><button type="button" class="btn warn" data-a="del">삭제</button></div>');
    tools.querySelector('[data-a=rename]').onclick = function () {
      var f = form(fText('위젯 이름 (Parameter에 적는 이름)', 'name', cfg.name, '예: 등급 그래프'));
      openSheet({
        title: '이름 바꾸기', body: f,
        onOk: function () {
          var v = readForm(f).name.trim();
          if (!v) { toast('이름을 입력해 주세요'); return false; }
          if (ws.some(function (w, i) { return i !== sel && w.name === v; })) { toast('같은 이름이 있습니다'); return false; }
          cfg.name = v; save(); mount(box);
        }
      });
    };
    tools.querySelector('[data-a=dup]').onclick = function () {
      var c = JSON.parse(JSON.stringify(cfg)); c.name = newName(ws);
      ws.push(c); sel = ws.length - 1; save(); mount(box);
    };
    tools.querySelector('[data-a=del]').onclick = function () {
      if (ws.length === 1) { toast('위젯이 하나뿐이라 지울 수 없습니다'); return; }
      confirmSheet(cfg.name + ' 위젯을 지울까요?', '삭제').then(function (ok) {
        if (!ok) return;
        ws.splice(sel, 1); sel = 0; save(); mount(box);
      });
    };
    box.appendChild(tools);

    /* 미리보기 */
    var stage = h('<div class="wp-stage wb-sticky"><div class="t-xs dim">미리보기를 준비하는 중…</div></div>');
    box.appendChild(stage);
    var sz = form(fSeg('미리보기 크기', 'wsize', Object.keys(SIZE_KEY), size) +
      fSeg('홈 화면 모양 (아이폰 설정과 같게)', 'wlook', ['기본', '투명'], look));
    bindForm(sz);
    sz.querySelector('[data-seg=wsize]').addEventListener('pick', function (e) { size = e.detail; draw(); });
    sz.querySelector('[data-seg=wlook]').addEventListener('pick', function (e) { look = e.detail; draw(); });
    box.appendChild(sz);

    /* 구성 */
    var html = '';
    GROUPS.forEach(function (g) {
      html += '<div data-for="' + g[2] + '">' + fSeg(g[1], g[0], OPTS[g[0]].map(function (x) { return x[0]; }), labelOf(g[0], cfg[g[0]])) + '</div>';
    });
    html += '<div data-for="trend number summary goal recent wrong weak rule">' + fChips('표시 항목', 'show', SHOW.map(function (x) { return x[0]; }), SHOW.filter(function (x) { return cfg.show[x[1]]; }).map(function (x) { return x[0]; })) + '</div>';
    var f = form(html);
    bindForm(f);
    var designBox, blockBox;
    function vis() {
      f.querySelectorAll('[data-for]').forEach(function (d) {
        var t = d.dataset.for; d.hidden = !(t === 'all' || t.split(' ').indexOf(cfg.kind) >= 0);
      });
      if (designBox) designBox.hidden = cfg.style !== 'custom';
      if (blockBox) { blockBox.hidden = cfg.kind !== 'custom'; if (!blockBox.hidden && !blockBox.firstChild) drawBlocks(); }
    }
    GROUPS.forEach(function (g) {
      f.querySelector('[data-seg="' + g[0] + '"]').addEventListener('pick', function (e) {
        cfg[g[0]] = valueOf(g[0], e.detail); save(); vis(); draw();
      });
    });
    f.querySelector('[data-multi=show]').addEventListener('click', function () {
      var on = [].map.call(f.querySelectorAll('[data-multi=show] button.on'), function (b) { return b.dataset.v; });
      SHOW.forEach(function (x) { cfg.show[x[1]] = on.indexOf(x[0]) >= 0; });
      save(); draw();
    });
    box.appendChild(f);

    /* 직접 디자인: 색 · 그라데이션 */
    designBox = h('<div class="wb-sub"><div class="wb-h">직접 디자인</div><div class="th-rows"></div></div>');
    var th = (typeof currentTheme === 'function') ? currentTheme() : {};
    cfg.design = Object.assign({ bg: th.card || '#ffffff', bg2: th.bg || '#f5f5f7', grad: false, text: th.text || '#1f2023', accent: th.accent || '#5b6b85', good: th.good || '#7a8465', bad: th.bad || '#a8868a', hl: th.hl || '#8f8aae' }, cfg.design || {});
    var rowsEl = designBox.querySelector('.th-rows');
    [['bg', '배경'], ['bg2', '아래쪽 색 (그라데이션)'], ['text', '글자'], ['accent', '그래프 · 강조'], ['good', '달성 · 오름'], ['bad', '미달 · 내림'], ['hl', '포인트']].forEach(function (kv) {
      var r = h('<label class="th-row"><span>' + kv[1] + '</span><input type="color" value="' + esc(cfg.design[kv[0]]) + '"></label>');
      var inp = r.querySelector('input');
      inp.addEventListener('input', function () { cfg.design[kv[0]] = inp.value; if (kv[0] === 'bg2') { cfg.design.grad = true; gchk.checked = true; } draw(); });
      inp.addEventListener('change', function () { save(); });
      rowsEl.appendChild(r);
    });
    var gl = h('<label class="th-row"><span>그라데이션 배경</span><input type="checkbox" class="wb-chk"></label>');
    var gchk = gl.querySelector('input'); gchk.checked = !!cfg.design.grad;
    gchk.onchange = function () { cfg.design.grad = gchk.checked; save(); draw(); };
    rowsEl.appendChild(gl);
    box.appendChild(designBox);

    /* 직접 구성: 구성요소 목록 */
    blockBox = h('<div class="wb-sub"></div>');
    if (!Array.isArray(cfg.blocks) || !cfg.blocks.length) cfg.blocks = [{ t: 'title', text: '국어 성적' }, { t: 'big', metric: 'pct' }, { t: 'chart', metric: 'grade', h: 'm' }];
    function drawBlocks() {
      blockBox.innerHTML = '<div class="wb-h">구성요소 <span class="t-xs dim">위에서부터 차례로 쌓입니다</span></div>';
      cfg.blocks.forEach(function (b, i) {
        var meta = BT[b.t] || { n: b.t };
        var r = h('<div class="wb-block"><div class="wb-bn"><b>' + esc(meta.n) + '</b><span class="t-xs dim">' + esc(blockSummary(b)) + '</span></div>' +
          '<button type="button" data-a="up" aria-label="위로">↑</button><button type="button" data-a="down" aria-label="아래로">↓</button>' +
          '<button type="button" data-a="edit">편집</button><button type="button" data-a="del" aria-label="삭제">✕</button></div>');
        r.querySelector('[data-a=up]').onclick = function () { if (!i) return; var t = cfg.blocks[i - 1]; cfg.blocks[i - 1] = b; cfg.blocks[i] = t; save(); drawBlocks(); draw(); };
        r.querySelector('[data-a=down]').onclick = function () { if (i === cfg.blocks.length - 1) return; var t = cfg.blocks[i + 1]; cfg.blocks[i + 1] = b; cfg.blocks[i] = t; save(); drawBlocks(); draw(); };
        r.querySelector('[data-a=edit]').onclick = function () { editBlock(b); };
        r.querySelector('[data-a=del]').onclick = function () { cfg.blocks.splice(i, 1); save(); drawBlocks(); draw(); };
        blockBox.appendChild(r);
      });
      var addB = h('<button type="button" class="btn full" style="margin-top:8px">＋ 구성요소 추가</button>');
      addB.onclick = function () {
        var body = h('<div class="wb-types"></div>');
        var sheet;
        Object.keys(BT).forEach(function (k) {
          var bt = h('<button type="button" class="btn"><b>' + esc(BT[k].n) + '</b><span class="t-xs dim">' + esc(BT[k].d) + '</span></button>');
          bt.onclick = function () {
            sheet.close();
            var nb = Object.assign({ t: k }, BT[k].def || {});
            cfg.blocks.push(nb); save(); drawBlocks(); draw();
            if ((BT[k].f || []).length || (BT[k].tg || []).length) editBlock(nb);
          };
          body.appendChild(bt);
        });
        sheet = openSheet({ title: '구성요소 추가', body: body, okLabel: '닫기' });
      };
      blockBox.appendChild(addB);
    }
    function editBlock(b) {
      var meta = BT[b.t];
      var html2 = '';
      (meta.f || []).forEach(function (k) {
        var F = FIELD[k];
        if (F.type === 'text') html2 += fText(F.l, k, b[k] || '', F.ph || '');
        else if (F.type === 'multi') html2 += fChips(F.l, k, F.o.map(function (x) { return x[0]; }), F.o.filter(function (x) { return (b[k] || F.def).indexOf(x[1]) >= 0; }).map(function (x) { return x[0]; }));
        else html2 += fSeg(F.l, k, F.o.map(function (x) { return x[0]; }), (F.o.find(function (x) { return x[1] === (b[k] == null ? F.def : b[k]); }) || F.o[0])[0]);
      });
      if ((meta.tg || []).length) {
        html2 += fChips('켜고 끄기', '_tg', meta.tg.map(function (k) { return TOG[k][0]; }), meta.tg.filter(function (k) { return b[k] == null ? TOG[k][1] : b[k]; }).map(function (k) { return TOG[k][0]; }));
      }
      var bf = form(html2);
      bindForm(bf);
      openSheet({
        title: meta.n + ' 설정', body: bf,
        onOk: function () {
          var v = readForm(bf);
          (meta.f || []).forEach(function (k) {
            var F = FIELD[k];
            if (F.type === 'text') b[k] = v[k];
            else if (F.type === 'multi') b[k] = F.o.filter(function (x) { return (v[k] || []).indexOf(x[0]) >= 0; }).map(function (x) { return x[1]; });
            else { var o = F.o.find(function (x) { return x[0] === v[k]; }); if (o) b[k] = o[1]; }
          });
          (meta.tg || []).forEach(function (k) { b[k] = (v._tg || []).indexOf(TOG[k][0]) >= 0; });
          save(); drawBlocks(); draw();
        }
      });
    }
    box.appendChild(blockBox);
    vis();

    /* Parameter · 스크립트 */
    var prm = h('<div class="wp-param"><span class="t-xs dim">Parameter</span><b></b><button type="button" class="btn">복사</button></div>');
    prm.querySelector('b').textContent = cfg.name;
    prm.querySelector('button').onclick = function () { copy(cfg.name, 'Parameter를 복사했습니다'); };
    box.appendChild(prm);

    function draw() {
      if (!scriptText) return;
      var fam = SIZE_KEY[size];
      WidgetPreview.render(scriptText, Store.data, cfg.name, fam).then(function (el) {
        stage.innerHTML = '';
        stage.classList.toggle('lock', fam.indexOf('accessory') === 0);
        /* 투명(Clear) 모양: iOS가 배경을 지우고 내용을 흰색으로 그림 */
        var clear = look === '투명' && fam.indexOf('accessory') !== 0;
        stage.classList.toggle('clear', clear);
        if (clear) el.classList.add('wp-clear');
        /* 편집하는 동안 위에 붙어 따라오므로 높이도 제한 */
        var s2 = WidgetPreview.SIZES[fam], room = stage.clientWidth - 24, k = Math.min(1, room / s2[0], (window.innerWidth < 700 ? 190 : 300) / s2[1]);
        var holder = h('<div style="width:' + s2[0] * k + 'px;height:' + s2[1] * k + 'px"></div>');
        el.style.transform = 'scale(' + k + ')'; el.style.transformOrigin = '0 0';
        holder.appendChild(el);
        stage.appendChild(holder);
        /* 내용이 위젯 크기를 넘으면 알려 줌 */
        if (el.scrollHeight > el.clientHeight + 2) stage.appendChild(h('<div class="wp-over">아래가 잘립니다 · 구성요소를 줄이거나 더 큰 크기로</div>'));
      }).catch(function (e) { stage.innerHTML = '<div class="t-xs dim">미리보기를 그릴 수 없습니다 (' + esc(e.message || e) + ')</div>'; });
    }
    if (scriptText) draw();
    else fetch('widget.js', { cache: 'no-cache' }).then(function (r) { return r.text(); }).then(function (t) { scriptText = t; draw(); })
      .catch(function () { stage.innerHTML = '<div class="t-xs dim">인터넷 연결 후 미리볼 수 있습니다</div>'; });
  }

  function copyScript() {
    function go() {
      var tk = window.Sync && Sync.cfg().token;
      if (!tk) { toast('먼저 위의 기기 연동(깃허브)을 켜 주세요'); return; }
      copy(scriptText.replace('__KOR_DASH_TOKEN__', tk.replace(/[^\w-]/g, '')), '스크립트를 복사했습니다');
    }
    if (scriptText) go(); else toast('스크립트를 불러오는 중입니다. 잠시 후 다시 눌러 주세요');
  }

  return { mount: mount, copyScript: copyScript };
})();
