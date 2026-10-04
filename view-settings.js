/* view-settings.js — 목표 / 색상 / 기기 연동 / 백업 */
'use strict';

var SettingsView = (function () {

  function exportJSON() {
    var txt = JSON.stringify(Store.data, null, 1);
    var name = 'korean-' + today().replace(/\./g, '') + '.json';
    try {
      var url = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('백업 파일을 내려받았습니다');
    } catch (e) {
      if (navigator.clipboard) { navigator.clipboard.writeText(txt); toast('백업 내용을 복사했습니다'); }
    }
  }

  function importJSON(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = migrate(JSON.parse(r.result));
        confirmSheet('불러온 파일로 현재 기록을 모두 덮어씁니다.\n계속할까요?', '불러오기').then(function (ok) {
          if (!ok) return;
          Store.data = d; Store.save(); App.dday(); App.refresh();
          toast('불러왔습니다');
        });
      } catch (e) { toast('파일 형식을 읽을 수 없습니다'); }
    };
    r.readAsText(file);
  }

  function restore(day) {
    confirmSheet(day + ' 자동 저장본으로 되돌립니다.\n현재 기록은 사라집니다.', '되돌리기').then(function (ok) {
      if (!ok) return;
      try {
        Store.data = migrate(JSON.parse(LS.getItem(APP_KEY + ':s' + CODE + ':' + day)));
        Store.save(); App.dday(); App.refresh(); toast('되돌렸습니다');
      } catch (e) { toast('복원할 수 없습니다'); }
    });
  }

  function saveTheme(t) {
    Store.data.settings.theme = t; Store.touchSettings(); applyTheme(t);
  }

  function colorSheet(g, title) {
    var cur = Store.color(g);
    var body = h('<div></div>');
    body.innerHTML = '<div class="f"><label>색상 선택</label><div class="seg">' +
      SWATCHES.map(function (c) {
        return '<button type="button" data-c="' + c + '" style="width:32px;height:32px;border-radius:50%;background:' + c +
          ';border:2px solid ' + (c.toLowerCase() === cur.toLowerCase() ? 'var(--t1)' : 'var(--line)') + '"></button>';
      }).join('') + '</div></div>' +
      '<div class="f"><label>직접 지정</label><input type="color" value="' + esc(cur) + '" data-pick style="width:100%;height:40px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2)"></div>';
    var chosen = cur;
    body.querySelectorAll('[data-c]').forEach(function (b) {
      b.onclick = function () {
        chosen = b.dataset.c;
        body.querySelectorAll('[data-c]').forEach(function (x) { x.style.borderColor = 'var(--line)'; });
        b.style.borderColor = 'var(--t1)';
        body.querySelector('[data-pick]').value = chosen;
      };
    });
    body.querySelector('[data-pick]').oninput = function (e) { chosen = e.target.value; };
    openSheet({
      title: (title || g) + ' 색상', body: body,
      onOk: function () { Store.data.settings.colors[g] = chosen; Store.touchSettings(); App.refresh(); },
      onDelete: function () {
        delete Store.data.settings.colors[g]; Store.touchSettings(); App.refresh(); toast('기본 색상으로 되돌렸습니다');
      }
    });
  }

  function tokenSheet() {
    var body = h('<div></div>');
    body.innerHTML =
      '<div class="t-s muted" style="margin-bottom:12px;line-height:1.7">' +
      'GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → ' +
      'Generate new token → 권한은 <b>gist</b> 하나만 체크 → 생성된 토큰 복사.<br>' +
      '아이패드에도 <b>같은 토큰</b>을 넣으면 같은 저장소를 자동으로 찾습니다.</div>' +
      '<div class="f"><label>토큰</label><input type="password" data-tok placeholder="ghp_…" autocapitalize="off" autocorrect="off" spellcheck="false"></div>';
    openSheet({
      title: '기기 연동', body: body, okLabel: '연결',
      onOk: function () {
        var t = body.querySelector('[data-tok]').value.trim();
        if (!t) { toast('토큰을 붙여넣어 주세요'); return false; }
        toast('연결 중…');
        Sync.connect(t).then(function () { App.refresh(); }, function () { App.refresh(); });
      }
    });
  }

  function render(root) {
    var s = Store.data.settings;

    /* 기록 현황 */
    root.appendChild(h('<section><div class="card"><div class="item-s">독해 노트 ' + Store.data.reading.length +
      ' · 모의고사 ' + Store.data.exams.length + ' · 지문 ' + Store.data.passages.length + '</div></div></section>'));

    /* 기기 연동 */
    var cfg = Sync.cfg();
    var g4 = h('<section><div class="sec-h"><h2>기기 연동</h2><span class="more">' +
      (Sync.on() ? '연결됨' : '꺼짐') + '</span></div></section>');
    var c4 = h('<div class="card"></div>');
    if (Sync.on()) {
      c4.innerHTML = '<div class="t-s muted" style="margin-bottom:10px">' +
        esc(cfg.user || 'GitHub') + ' · 마지막 동기화 ' + esc(timeAgo(cfg.last)) +
        (Sync.state ? ' · ' + esc(Sync.state) : '') + '</div>';
      var now = h('<button type="button" class="btn full" style="margin-bottom:8px">지금 동기화</button>');
      now.onclick = function () { Sync.run(true); };
      var off = h('<button type="button" class="btn full warn">연동 끄기</button>');
      off.onclick = function () {
        confirmSheet('이 기기에서 연동을 끕니다.\n기록은 그대로 남습니다.', '끄기').then(function (ok) {
          if (!ok) return; Sync.disconnect(); App.refresh();
        });
      };
      c4.appendChild(now); c4.appendChild(off);
    } else {
      c4.innerHTML = '<div class="t-s muted" style="margin-bottom:10px">깃허브 비공개 Gist에 기록을 올려 아이폰·아이패드에서 같이 씁니다. 저장할 때마다 자동으로 올라갑니다.</div>';
      var conn = h('<button type="button" class="btn full dark">깃허브로 연결</button>');
      conn.onclick = tokenSheet;
      c4.appendChild(conn);
    }
    g4.appendChild(c4);
    root.appendChild(g4);

    /* 목표 */
    var g1 = h('<section><div class="sec-h"><h2>목표</h2></div></section>');
    var f = form(
      '<div class="f-row">' + fNum('목표 등급', 'targetGrade', s.targetGrade, '1~9') + fNum('목표 백분위', 'targetPct', s.targetPct, '/100') + '</div>' +
      fDate('수능 시행일', 'examDate', s.examDate)
    );
    bindForm(f);
    var save = h('<button type="button" class="btn full dark">목표 저장</button>');
    save.onclick = function () {
      var v = readForm(f);
      s.targetGrade = num(v.targetGrade); s.targetPct = num(v.targetPct); s.examDate = v.examDate;
      Store.touchSettings(); App.dday(); toast('저장했습니다');
    };
    var c1 = h('<div class="card"></div>');
    c1.appendChild(f); c1.appendChild(save);
    g1.appendChild(c1);
    root.appendChild(g1);

    /* 테마 색상 */
    var g9 = h('<section><div class="sec-h"><h2>테마 색상</h2><span class="more">프리셋 선택 후 하나씩 바꿀 수 있음</span></div></section>');
    var c9 = h('<div class="card"></div>');
    var presets = Object.assign({ '내 제재 톤': themeFromGenres() }, THEME_PRESETS);
    var pw = h('<div class="th-presets"></div>');
    Object.keys(presets).forEach(function (name) {
      var t = presets[name];
      var b = h('<button type="button" class="th-p"><i>' + ['accent', 'good', 'bad', 'hl'].map(function (k) {
        return '<b style="background:' + t[k] + '"></b>';
      }).join('') + '</i>' + esc(name) + '</button>');
      b.onclick = function () { var y = window.scrollY; saveTheme(Object.assign({}, presets[name])); App.refresh(); window.scrollTo(0, y); toast(name + ' 적용'); };
      pw.appendChild(b);
    });
    c9.appendChild(pw);
    var cur = currentTheme();
    var rows = h('<div class="th-rows"></div>');
    THEME_KEYS.forEach(function (kv) {
      var r = h('<label class="th-row"><span>' + esc(kv[1]) + '</span><input type="color" value="' + esc(cur[kv[0]]) + '"></label>');
      var inp = r.querySelector('input');
      inp.addEventListener('input', function () { cur[kv[0]] = inp.value; applyTheme(cur); });
      inp.addEventListener('change', function () { cur[kv[0]] = inp.value; saveTheme(cur); });
      rows.appendChild(r);
    });
    c9.appendChild(rows);
    var th0 = h('<button type="button" class="btn full" style="margin-top:12px">기본 테마로</button>');
    th0.onclick = function () { var y = window.scrollY; delete Store.data.settings.theme; Store.touchSettings(); App.refresh(); window.scrollTo(0, y); };
    c9.appendChild(th0);
    g9.appendChild(c9);
    root.appendChild(g9);

    /* 색상 */
    var g2 = h('<section><div class="sec-h"><h2>제재 색상</h2><span class="more">탭하여 변경</span></div></section>');
    var grid = h('<div class="grid3"></div>');
    ALL_GENRES.forEach(function (g) {
      var b = h('<button type="button" class="stat row" style="gap:7px;align-items:center">' +
        '<span class="dot" style="width:10px;height:10px;background:' + Store.color(g) + '"></span>' +
        '<span class="t-s muted">' + esc(g) + '</span></button>');
      b.onclick = function () { colorSheet(g); };
      grid.appendChild(b);
    });
    g2.appendChild(grid);
    root.appendChild(g2);

    var g8 = h('<section><div class="sec-h"><h2>영역별 오답 색상</h2><span class="more">그래프 · 탭하여 변경</span></div></section>');
    var grid8 = h('<div class="grid3"></div>');
    ['독서', '문학', '선택'].forEach(function (a) {
      var b = h('<button type="button" class="stat row" style="gap:7px;align-items:center">' +
        '<span class="dot" style="width:10px;height:10px;border-radius:3px;background:' + Store.color('영역:' + a) + '"></span>' +
        '<span class="t-s muted">' + a + ' 오답</span></button>');
      b.onclick = function () { colorSheet('영역:' + a, a + ' 오답'); };
      grid8.appendChild(b);
    });
    g8.appendChild(grid8);
    root.appendChild(g8);

    /* 화면 (기기별) */
    var g6 = h('<section><div class="sec-h"><h2>화면</h2><span class="more">이 기기에만 적용</span></div></section>');
    var c6 = h('<div class="card"></div>');
    var ft = App.font();
    var fsf = form(
      '<div class="f"><label>글자 크기 <span class="fs-val num"></span></label>' +
      '<input type="range" class="range" min="13" max="20" step="0.5" value="' + ft.size + '" data-fsize></div>' +
      fSeg('굵기', 'weight', Object.keys(App.WEIGHTS), ft.weight) +
      fSeg('글꼴', 'family', Object.keys(App.FONTS).concat(['내 글꼴', '직접 입력']), ft.family || '시스템') +
      '<div class="my-font">' +
      '<div class="mf-row"><label class="btn">글꼴 파일 올리기<input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" hidden data-ffile></label>' +
      '<span class="t-xs dim mf-name"></span><button type="button" class="t-xs dim mf-del" hidden>삭제</button></div>' +
      '<div class="mf-row"><input type="text" class="mf-in" data-fcustom placeholder="구글 폰트 이름 (예: Gowun Batang)" value="' + esc(ft.custom || '') + '">' +
      '<button type="button" class="btn" data-fapply>적용</button></div>' +
      '<div class="t-xs dim">파일은 이 기기에만 저장되고 인터넷 없이도 쓸 수 있습니다. 아이폰에 설치한 글꼴은 Safari 웹앱에서 쓸 수 없어 파일로 올려 주세요.</div>' +
      '</div>' +
      '<div class="font-prev"><div class="fp-n num">D-48 · 백분위 96</div>' +
      '<div class="fp-t">첫 문단에서 화제와 글의 방향을 확정한다. 근거 문장은 반드시 지문에 표시한다.</div></div>'
    );
    bindForm(fsf);
    var rng = fsf.querySelector('[data-fsize]'), val = fsf.querySelector('.fs-val');
    function showSize(v) { val.textContent = '· 본문 ' + (Math.round(v * 0.8125 * 10) / 10) + 'px'; }
    showSize(ft.size);
    rng.addEventListener('input', function () { App.font({ size: +rng.value }); showSize(+rng.value); });
    fsf.querySelector('[data-seg="weight"]').addEventListener('pick', function (e) { App.font({ weight: e.detail }); });
    var famSeg = fsf.querySelector('[data-seg="family"]');
    function pickFam(name) {
      famSeg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === name); });
    }
    famSeg.addEventListener('pick', function (e) {
      if (e.detail === '내 글꼴') {
        App.fontDB('get').then(function (rec) {
          if (!rec) { toast('먼저 글꼴 파일을 올려 주세요'); pickFam(App.font().family || '시스템'); return; }
          App.font({ family: '내 글꼴' });
        });
      } else if (e.detail === '직접 입력') {
        var v = fsf.querySelector('[data-fcustom]').value.trim();
        if (!v) { toast('아래 칸에 구글 폰트 이름을 입력해 주세요'); pickFam(App.font().family || '시스템'); return; }
        App.font({ family: '직접 입력', custom: v });
      } else App.font({ family: e.detail });
    });
    var mfName = fsf.querySelector('.mf-name'), mfDel = fsf.querySelector('.mf-del');
    function showMine() {
      App.fontDB('get').then(function (rec) {
        mfName.textContent = rec ? rec.name : '';
        mfDel.hidden = !rec;
      });
    }
    showMine();
    fsf.querySelector('[data-ffile]').onchange = function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) { toast('ttf · otf · woff 파일만 쓸 수 있습니다'); return; }
      App.fontDB('put', { name: file.name, blob: file }).then(function (ok) {
        if (!ok) { toast('저장할 수 없습니다'); return; }
        App._myFont = false;
        document.fonts && document.fonts.forEach(function (f) { if (f.family === 'MyFont') document.fonts.delete(f); });
        App.loadMyFont().then(function (loaded) {
          if (!loaded) { toast('글꼴 파일을 읽을 수 없습니다'); return; }
          App.font({ family: '내 글꼴' }); pickFam('내 글꼴'); showMine(); toast('내 글꼴을 적용했습니다');
        });
      });
    };
    mfDel.onclick = function () {
      App.fontDB('del').then(function () {
        if (App.font().family === '내 글꼴') { App.font({ family: '시스템' }); pickFam('시스템'); }
        showMine(); toast('글꼴 파일을 지웠습니다');
      });
    };
    fsf.querySelector('[data-fapply]').onclick = function () {
      var v = fsf.querySelector('[data-fcustom]').value.trim();
      if (!v) { toast('구글 폰트 이름을 입력해 주세요'); return; }
      App.font({ family: '직접 입력', custom: v }); pickFam('직접 입력'); toast(v + ' 적용');
    };
    var fsReset = h('<button type="button" class="btn full" style="margin-top:10px">기본값 (작고 얇게)</button>');
    fsReset.onclick = function () { LS.removeItem(APP_KEY + ':font'); App.font(); App.refresh(); };
    fsf.appendChild(fsReset);
    c6.appendChild(fsf);
    g6.appendChild(c6);
    root.appendChild(g6);

    /* 기록 정리 */
    var g7 = h('<section><div class="sec-h"><h2>기록 정리</h2></div></section>');
    var mv = h('<button type="button" class="btn full">모의고사 메모·총평 → 행동강령으로 옮기기</button>');
    mv.onclick = function () {
      var list = Store.data.exams.filter(function (e) { return String(e.memo || '').trim(); });
      if (!list.length) { toast('옮길 메모가 없습니다'); return; }
      confirmSheet(list.length + '개 시험의 메모·총평을 행동강령으로 옮깁니다.\n(행동강령이 있으면 아래에 덧붙임)', '옮기기').then(function (ok) {
        if (!ok) return;
        list.forEach(function (e) {
          var memo = String(e.memo).trim(), rule = String(e.rule || '').trim();
          Store.put('exams', Object.assign({}, e, {
            rule: !rule ? memo : (rule.indexOf(memo) >= 0 ? rule : rule + '\n' + memo), memo: '', m2r: 1
          }));
        });
        App.refresh(); toast(list.length + '개 옮겼습니다');
      });
    };
    g7.appendChild(mv);
    root.appendChild(g7);

    /* 홈 화면 위젯 (Scriptable) */
    var gw = h('<section><div class="sec-h"><h2>홈 화면 위젯</h2><span class="more">Scriptable 앱</span></div></section>');
    var cw = h('<div class="card"></div>');
    var wopt = { type: '등급', style: '기본', face: '고딕', size: '중간' };
    var SIZE_KEY = { '작게': 'small', '중간': 'medium', '크게': 'large', '잠금 원형': 'accessoryCircular', '잠금 사각': 'accessoryRectangular', '잠금 한 줄': 'accessoryInline' };
    var wf = form(
      fSeg('종류', 'wtype', ['등급', '백분위', '원점수', '디데이', '행동강령', '요약', '오답'], wopt.type) +
      fSeg('디자인', 'wstyle', ['기본', '배경', '다크', '컬러'], wopt.style) +
      fSeg('글꼴', 'wface', ['고딕', '얇게', '둥근', '명조', '모노'], wopt.face) +
      fSeg('크기 (미리보기)', 'wsize', Object.keys(SIZE_KEY), wopt.size)
    );
    bindForm(wf);
    cw.appendChild(wf);
    var stage = h('<div class="wp-stage"><div class="t-xs dim">미리보기를 준비하는 중…</div></div>');
    cw.appendChild(stage);
    var prm = h('<div class="wp-param"><span class="t-xs dim">Parameter</span><b class="num"></b><button type="button" class="btn">복사</button></div>');
    cw.appendChild(prm);
    var scriptText = '';
    function paramText() { return wopt.type + ' ' + wopt.style + ' ' + wopt.face; }
    function draw() {
      prm.querySelector('b').textContent = paramText();
      if (!scriptText || !window.WidgetPreview) return;
      var fam = SIZE_KEY[wopt.size];
      WidgetPreview.render(scriptText, Store.data, paramText(), fam).then(function (el) {
        stage.innerHTML = '';
        stage.classList.toggle('lock', fam.indexOf('accessory') === 0);
        /* 화면이 좁으면 비율 그대로 줄여서 보여 줌 */
        var sz = WidgetPreview.SIZES[fam], room = stage.clientWidth - 24, k = Math.min(1, room / sz[0]);
        var box = h('<div style="width:' + sz[0] * k + 'px;height:' + sz[1] * k + 'px"></div>');
        el.style.transform = 'scale(' + k + ')'; el.style.transformOrigin = '0 0';
        box.appendChild(el);
        stage.appendChild(box);
      }).catch(function (e) { stage.innerHTML = '<div class="t-xs dim">미리보기를 그릴 수 없습니다 (' + esc(e.message || e) + ')</div>'; });
    }
    [['wtype', 'type'], ['wstyle', 'style'], ['wface', 'face'], ['wsize', 'size']].forEach(function (kv) {
      wf.querySelector('[data-seg="' + kv[0] + '"]').addEventListener('pick', function (e) { wopt[kv[1]] = e.detail; draw(); });
    });
    fetch('widget.js', { cache: 'no-cache' }).then(function (r) { return r.text(); }).then(function (t) { scriptText = t; draw(); }).catch(function () {
      stage.innerHTML = '<div class="t-xs dim">인터넷 연결 후 미리볼 수 있습니다</div>';
    });
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
    prm.querySelector('button').onclick = function () { copy(paramText(), 'Parameter를 복사했습니다'); };

    var steps = h('<div></div>');
    steps.innerHTML = '<ol class="steps">' +
      '<li>앱스토어에서 무료 앱 <b>Scriptable</b> 설치</li>' +
      '<li><b>스크립트 복사</b> → Scriptable에서 ＋ 눌러 붙여 넣고 한 번 실행 → 토큰 입력 (토큰 복사 버튼)</li>' +
      '<li>홈 화면(또는 잠금 화면) 길게 누르기 → ＋ → Scriptable 위젯 추가</li>' +
      '<li>위젯 길게 눌러 편집 → Script 선택, <b>Parameter</b>에 위에서 복사한 글 붙여 넣기</li>' +
      '</ol><div class="t-xs dim" style="margin:6px 0 10px">스크립트 하나로 여러 위젯을 만들 수 있습니다 (위젯마다 Parameter만 다르게). 기기 연동이 켜져 있어야 하고 약 1시간마다 새로 그려집니다.</div>';
    cw.appendChild(steps);
    var wrow = h('<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>');
    var cpS = h('<button type="button" class="btn">스크립트 복사</button>');
    var cpT = h('<button type="button" class="btn">토큰 복사</button>');
    cpS.onclick = function () {
      if (!scriptText) { toast('스크립트를 불러오는 중입니다. 잠시 후 다시 눌러 주세요'); return; }
      copy(scriptText, '스크립트를 복사했습니다');
    };
    cpT.onclick = function () {
      var tk = window.Sync && Sync.cfg().token;
      if (!tk) { toast('먼저 기기 연동을 켜 주세요'); return; }
      copy(tk, '토큰을 복사했습니다');
    };
    wrow.appendChild(cpS); wrow.appendChild(cpT);
    cw.appendChild(wrow);
    cw.appendChild(h('<a class="btn full" style="margin-top:8px" href="https://apps.apple.com/app/scriptable/id1405459188" target="_blank" rel="noopener">Scriptable 앱 받기</a>'));
    gw.appendChild(cw);
    root.appendChild(gw);

    /* 인쇄 */
    var g5 = h('<section><div class="sec-h"><h2>인쇄</h2><span class="more">A4</span></div></section>');
    var rp = h('<button type="button" class="btn full">A4 리포트 (그래프 · 전체)</button>');
    rp.onclick = function () { Report.open('full'); };
    g5.appendChild(rp);
    root.appendChild(g5);

    /* 백업 */
    var g3 = h('<section><div class="sec-h"><h2>백업</h2><span class="more">자동 저장됨</span></div></section>');
    var c3 = h('<div class="card"></div>');
    var be = h('<button type="button" class="btn full" style="margin-bottom:8px">백업 파일 내려받기</button>');
    be.onclick = exportJSON;
    var lb = h('<label class="btn full">백업 파일 불러오기<input type="file" accept="application/json,.json" hidden></label>');
    lb.querySelector('input').onchange = function (e) { if (e.target.files[0]) importJSON(e.target.files[0]); };
    c3.appendChild(be); c3.appendChild(lb);

    var snaps = Store.snapshots();
    if (snaps.length) {
      c3.appendChild(h('<div class="t-xs dim" style="margin:12px 2px 6px">자동 저장본 (최근 7일)</div>'));
      var row = h('<div class="chips"></div>');
      snaps.forEach(function (day) {
        var b = h('<button type="button" class="pill">' + esc(day.slice(5)) + '</button>');
        b.onclick = function () { restore(day); };
        row.appendChild(b);
      });
      c3.appendChild(row);
    }
    g3.appendChild(c3);
    root.appendChild(g3);

    /* 초기화 */
    var reset = h('<button type="button" class="btn full warn">기록 전부 지우기</button>');
    reset.onclick = function () {
      confirmSheet('모든 기록이 삭제됩니다.\n되돌릴 수 없습니다.', '삭제').then(function (ok) {
        if (!ok) return;
        Store.data = DEFAULTS(); Store.save(); App.dday(); App.refresh(); toast('초기화했습니다');
      });
    };
    root.appendChild(reset);
    root.appendChild(h('<div class="t-xs dim" style="text-align:center;margin-top:12px">기록은 이 기기에 저장되며, 연동을 켜면 깃허브 비공개 Gist에도 함께 보관됩니다.<br>앱 버전 ' + APP_VER + '</div>'));
  }

  return { render: render };
})();

App.register({
  id: 'settings', label: '설정', title: '설정', icon: '◌', hidden: true,
  render: SettingsView.render
});
