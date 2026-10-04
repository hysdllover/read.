/* widget-preview.js — 설정 화면용 위젯 미리보기
   widget.js(Scriptable 스크립트)를 그대로 실행하되, Scriptable 기능을 브라우저(DOM·캔버스)로 흉내 냅니다.
   실제 위젯과 여백·글꼴이 조금 다를 수 있습니다. */
'use strict';

var WidgetPreview = (function () {
  var SIZES = {
    small: [158, 158], medium: [338, 158], large: [338, 354],
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
      el.style.alignItems = vertical ? 'flex-start' : 'center';
      el.style.minWidth = '0';
      var st = {
        el: el,
        layoutHorizontally: function () { el.style.flexDirection = 'row'; el.style.alignItems = 'center'; },
        layoutVertically: function () { el.style.flexDirection = 'column'; el.style.alignItems = 'flex-start'; },
        centerAlignContent: function () { el.style.alignItems = 'center'; el.dataset.center = '1'; },
        topAlignContent: function () { el.style.alignItems = 'flex-start'; },
        bottomAlignContent: function () { el.style.alignItems = 'baseline'; },
        setPadding: function (t, l, b, r) { el.style.padding = t + 'px ' + r + 'px ' + b + 'px ' + l + 'px'; },
        addText: function (s) {
          var sp = document.createElement('div'); sp.textContent = s;
          sp.style.whiteSpace = 'pre-wrap'; sp.style.lineHeight = '1.2'; sp.style.wordBreak = 'keep-all'; sp.style.overflowWrap = 'anywhere';
          el.appendChild(sp);
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
        },
        addStack: function () { var d = document.createElement('div'); if (!(el.dataset.center && el.style.flexDirection === 'column')) d.style.alignSelf = 'stretch'; el.appendChild(d); return makeStack(d, false); },
        addImage: function (c) {
          el.appendChild(c); c.style.display = 'block';
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
    kind: [['추이 그래프', 'trend'], ['큰 숫자', 'number'], ['요약', 'summary'], ['목표 달성', 'goal'], ['최근 기록', 'recent'], ['영역별 오답', 'wrong'], ['약점 제재', 'weak'], ['행동강령', 'rule']],
    metric: [['등급', 'grade'], ['백분위', 'pct'], ['원점수', 'raw'], ['오답 합계', 'wrong'], ['독서 오답', 'w독서'], ['문학 오답', 'w문학'], ['선택 오답', 'w선택']],
    count: [['5회', 5], ['8회', 8], ['10회', 10], ['15회', 15], ['20회', 20], ['전체', 0]],
    shape: [['곡선', 'curve'], ['직선', 'line'], ['막대', 'bar'], ['점', 'dot']],
    style: [['기본', 'card'], ['배경', 'bg'], ['다크', 'dark'], ['컬러', 'color'], ['종이', 'paper'], ['파스텔', 'pastel']],
    align: [['왼쪽', 'left'], ['가운데', 'center']],
    textFont: [['시스템', 'sys'], ['둥근', 'round'], ['얇은 고딕', 'sdlight'], ['가는 고딕', 'sdthin'], ['명조', 'myungjo'], ['모노', 'mono']],
    numFont: [['시스템', 'sys'], ['둥근', 'round'], ['모노', 'mono'], ['헬베티카', 'helv'], ['아베니르', 'avenir'], ['디도', 'didot'], ['퓨추라', 'futura'], ['조지아', 'georgia'], ['옵티마', 'optima'], ['길 산스', 'gill']],
    weight: [['가늘게', 'thin'], ['얇게', 'light'], ['보통', 'regular']],
    scale: [['작게', 0.9], ['보통', 1], ['크게', 1.15]]
  };
  var SHOW = [['제목', 'title'], ['최근 값', 'value'], ['변화', 'delta'], ['목표', 'target'], ['점수', 'labels'], ['날짜', 'dates'], ['통계', 'stats'], ['시험명', 'exam']];
  var GROUPS = [
    ['kind', '종류', 'all'], ['metric', '지표', 'trend number summary goal'], ['count', '기록 수', 'trend number summary goal wrong recent'],
    ['shape', '그래프 모양', 'trend number summary goal'], ['style', '디자인', 'all'], ['align', '정렬', 'number goal rule'],
    ['textFont', '한글 글꼴', 'all'], ['numFont', '숫자 글꼴', 'all'], ['weight', '숫자 굵기', 'all'], ['scale', '글자 크기', 'all']
  ];
  var DEF = {
    kind: 'trend', metric: 'grade', count: 10, shape: 'curve', style: 'card', align: 'left',
    textFont: 'sys', numFont: 'sys', weight: 'light', scale: 1,
    show: { title: true, value: true, delta: true, target: true, labels: true, dates: true, stats: true, exam: true }
  };
  var SIZE_KEY = { '작게': 'small', '중간': 'medium', '크게': 'large', '잠금 원형': 'accessoryCircular', '잠금 사각': 'accessoryRectangular', '잠금 한 줄': 'accessoryInline' };
  var sel = 0, size = '중간', scriptText = '';

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

  function mount(box) {
    box.innerHTML = '';
    var ws = list();
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
    var stage = h('<div class="wp-stage"><div class="t-xs dim">미리보기를 준비하는 중…</div></div>');
    box.appendChild(stage);
    var sz = form(fSeg('미리보기 크기', 'wsize', Object.keys(SIZE_KEY), size));
    bindForm(sz);
    sz.querySelector('[data-seg=wsize]').addEventListener('pick', function (e) { size = e.detail; draw(); });
    box.appendChild(sz);

    /* 구성 */
    var html = '';
    GROUPS.forEach(function (g) {
      html += '<div data-for="' + g[2] + '">' + fSeg(g[1], g[0], OPTS[g[0]].map(function (x) { return x[0]; }), labelOf(g[0], cfg[g[0]])) + '</div>';
    });
    html += fChips('표시 항목', 'show', SHOW.map(function (x) { return x[0]; }), SHOW.filter(function (x) { return cfg.show[x[1]]; }).map(function (x) { return x[0]; }));
    var f = form(html);
    bindForm(f);
    function vis() {
      f.querySelectorAll('[data-for]').forEach(function (d) {
        var t = d.dataset.for; d.hidden = !(t === 'all' || t.split(' ').indexOf(cfg.kind) >= 0);
      });
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
    vis();
    box.appendChild(f);

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
        var s2 = WidgetPreview.SIZES[fam], room = stage.clientWidth - 24, k = Math.min(1, room / s2[0]);
        var holder = h('<div style="width:' + s2[0] * k + 'px;height:' + s2[1] * k + 'px"></div>');
        el.style.transform = 'scale(' + k + ')'; el.style.transformOrigin = '0 0';
        holder.appendChild(el);
        stage.appendChild(holder);
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
