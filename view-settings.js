/* view-settings.js — 목표 / 색상 / 코드 / 기기 연동 / 백업 */
'use strict';

var SettingsView = (function () {

  function exportJSON() {
    var txt = JSON.stringify(Store.data, null, 1);
    var name = 'korean-' + CODE + '-' + today().replace(/\./g, '') + '.json';
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

  function colorSheet(g) {
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
      title: g + ' 색상', body: body,
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

    /* 코드 */
    var g0 = h('<section><div class="sec-h"><h2>코드</h2></div></section>');
    var c0 = h('<div class="card spread"><div><div class="item-t num">코드 ' + esc(CODE) + '</div>' +
      '<div class="item-s">독해 ' + Store.data.reading.length + ' · 모의고사 ' + Store.data.exams.length +
      ' · 지문 ' + Store.data.passages.length + '</div></div></div>');
    var out = h('<button type="button" class="btn">코드 바꾸기</button>');
    out.onclick = function () { App.logout(); };
    c0.appendChild(out);
    g0.appendChild(c0);
    root.appendChild(g0);

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
    var reset = h('<button type="button" class="btn full warn">이 코드의 기록 지우기</button>');
    reset.onclick = function () {
      confirmSheet('코드 ' + CODE + '의 기록이 모두 삭제됩니다.\n되돌릴 수 없습니다.', '삭제').then(function (ok) {
        if (!ok) return;
        Store.data = DEFAULTS(); Store.save(); App.dday(); App.refresh(); toast('초기화했습니다');
      });
    };
    root.appendChild(reset);
    root.appendChild(h('<div class="t-xs dim" style="text-align:center;margin-top:12px">기록은 이 기기에 저장되며, 연동을 켜면 깃허브 비공개 Gist에도 함께 보관됩니다.</div>'));
  }

  return { render: render };
})();

App.register({
  id: 'settings', label: '설정', title: '설정', icon: '◌',
  render: SettingsView.render
});
