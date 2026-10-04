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
  var NAMED = {
    'Didot': [400, '"Didot","Bodoni 72",serif'], 'Didot-Bold': [700, '"Didot","Bodoni 72",serif'],
    'AppleMyungjo': [400, '"AppleMyungjo","Nanum Myeongjo",serif'],
    'HelveticaNeue-Thin': [100, '"Helvetica Neue",' + SYS], 'HelveticaNeue-Light': [300, '"Helvetica Neue",' + SYS],
    'AppleSDGothicNeo-Light': [300, '"Apple SD Gothic Neo",' + SYS], 'AppleSDGothicNeo-Regular': [400, '"Apple SD Gothic Neo",' + SYS]
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
        centerAlignContent: function () { el.style.alignItems = 'center'; },
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
        addStack: function () { var d = document.createElement('div'); d.style.alignSelf = 'stretch'; el.appendChild(d); return makeStack(d, false); },
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
    var m = mocks(data, family, param), names = Object.keys(m.env);
    var fn = new Function(names.join(','), '"use strict"; return (async () => {\n' + src + '\n})();');
    return fn.apply(null, names.map(function (k) { return m.env[k]; })).then(function () { return m.out.root; });
  }

  return { render: render, SIZES: SIZES };
})();
