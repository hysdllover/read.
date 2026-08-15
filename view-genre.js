/* view-genre.js — 3. 제재별 기록 (독서 6제재 / 문학 4갈래) */
'use strict';

var GenreView = (function () {
  var area = '독서';
  var pick = null; // 선택한 제재 (null = 전체)

  function editor(item, pre) {
    pre = pre || {};
    var it = item || {
      date: pre.date || today(),
      area: pre.area || area,
      genre: pre.genre || '',
      title: '', source: pre.source || '', examId: pre.examId || '',
      qn: '', wrong: '', diff: null, types: [], method: '', note: ''
    };
    var f = form(
      fSeg('영역', 'area', AREAS, it.area) +
      '<div data-gwrap="독서"' + (it.area === '독서' ? '' : ' hidden') + '>' +
      fSeg('제재', 'g독서', GENRES['독서'], it.area === '독서' ? it.genre : '') + '</div>' +
      '<div data-gwrap="문학"' + (it.area === '문학' ? '' : ' hidden') + '>' +
      fSeg('갈래', 'g문학', GENRES['문학'], it.area === '문학' ? it.genre : '') + '</div>' +
      fText('지문 / 작품명', 'title', it.title, '예: 이차 전지의 원리 · 사씨남정기') +
      '<div class="f-row">' + fText('출처', 'source', it.source, '예: 9월 모평') + fDate('푼 날짜', 'date', it.date) + '</div>' +
      '<div class="f-row">' + fNum('문항 수', 'qn', it.qn, '개') + fNum('틀린 개수', 'wrong', it.wrong, '개') + '</div>' +
      fStars('체감 난이도', 'diff', it.diff) +
      fChips('오답 원인', 'types', WRONG_TYPES, it.types) +
      fArea('풀이 방식', 'method', it.method, '어떻게 읽고 어떤 순서로 풀었는지') +
      fArea('오답 정리 / 배운 점', 'note', it.note, '틀린 문항 번호, 근거 문장, 다음에 적용할 규칙')
    );
    bindForm(f);
    var aseg = f.querySelector('[data-seg="area"]');
    aseg.addEventListener('pick', function (e) {
      f.querySelectorAll('[data-gwrap]').forEach(function (d) {
        d.hidden = d.dataset.gwrap !== e.detail;
      });
    });

    openSheet({
      title: item ? '지문 기록 수정' : '지문 기록',
      body: f,
      onOk: function () {
        var v = readForm(f);
        var g = v.area === '독서' ? v['g독서'] : v['g문학'];
        if (!g) { toast(v.area === '독서' ? '제재를 선택해 주세요' : '갈래를 선택해 주세요'); return false; }
        Store.put('passages', Object.assign({}, it, {
          area: v.area, genre: g, title: v.title || '(제목 없음)', source: v.source,
          date: v.date, qn: num(v.qn), wrong: num(v.wrong), diff: v.diff,
          types: v.types, method: v.method, note: v.note
        }));
        area = v.area;
        App.refresh();
      },
      onDelete: item ? function () { Store.del('passages', it.id); App.refresh(); toast('삭제했습니다'); } : null
    });
  }

  function render(root) {
    var all = Store.data.passages.slice().sort(byDateDesc);
    var inArea = all.filter(function (p) { return p.area === area; });

    /* 영역 전환 */
    var seg = h('<div class="chips" style="margin-bottom:4px"></div>');
    AREAS.forEach(function (a) {
      var b = h('<button type="button" class="pill' + (a === area ? ' on' : '') + '">' + esc(a) + '</button>');
      b.onclick = function () { area = a; pick = null; App.refresh(); };
      seg.appendChild(b);
    });
    root.appendChild(seg);

    /* 제재별 요약 */
    var sec = h('<section><div class="sec-h"><h2>' + (area === '독서' ? '제재별 현황' : '갈래별 현황') +
      '</h2><span class="more">기록 ' + inArea.length + '</span></div></section>');
    var grid = h('<div class="grid3"></div>');
    GENRES[area].forEach(function (g) {
      var rows = inArea.filter(function (p) { return p.genre === g; });
      var wsum = rows.reduce(function (s, p) { return s + num(p.wrong, 0); }, 0);
      var d = avg(rows.filter(function (p) { return p.diff; }).map(function (p) { return p.diff; }));
      var c = h('<button type="button" class="stat" style="text-align:left' +
        (pick === g ? ';border-color:' + Store.color(g) : '') + '">' +
        '<div class="k row" style="gap:5px"><span class="dot" style="background:' + Store.color(g) + '"></span>' + esc(g) + '</div>' +
        '<div class="v">' + rows.length + '<small>편</small></div>' +
        '<div class="t-xs dim num">오답 ' + wsum + ' · 난도 ' + (d ? r1(d) : '–') + '</div></button>');
      c.onclick = function () { pick = (pick === g ? null : g); App.refresh(); };
      grid.appendChild(c);
    });
    sec.appendChild(grid);
    root.appendChild(sec);

    /* 오답 원인 분포 */
    var cnt = {};
    inArea.forEach(function (p) { (p.types || []).forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; }); });
    var keys = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 5);
    if (keys.length) {
      var s2 = h('<section><div class="sec-h"><h2>오답 원인</h2></div></section>');
      var b2 = h('<div class="card"></div>');
      b2.innerHTML = keys.map(function (k) {
        return barRow(k, cnt[k], cnt[keys[0]], 'var(--accent)', '회');
      }).join('');
      b2.querySelectorAll('.bar-row .lb').forEach(function (el) { el.style.fontSize = '10px'; });
      s2.appendChild(b2);
      root.appendChild(s2);
    }

    /* 목록 */
    var list = pick ? inArea.filter(function (p) { return p.genre === pick; }) : inArea;
    var s3 = h('<section><div class="sec-h"><h2>' + (pick ? esc(pick) : '전체') + ' 기록</h2>' +
      (pick ? '<span class="more">탭하여 필터 해제</span>' : '') + '</div></section>');
    if (!list.length) {
      s3.appendChild(h(emptyBox('아직 기록이 없습니다', '＋로 지문 하나씩 남겨 두면 약한 제재가 보입니다')));
      root.appendChild(s3);
      return;
    }
    var ul = h('<div class="list"></div>');
    list.forEach(function (p) {
      var it = h('<button type="button" class="item">' +
        '<div class="row-b"><div class="row" style="gap:6px;min-width:0">' +
        '<span class="dot" style="background:' + Store.color(p.genre) + '"></span>' +
        '<div class="item-t" style="word-break:break-all">' + esc(p.title) + '</div></div>' +
        '<span class="badge">' + esc(p.genre) + '</span></div>' +
        '<div class="item-s num">' + esc(p.date || '') + (p.source ? ' · ' + esc(p.source) : '') +
        (p.wrong != null ? ' · 오답 ' + esc(p.wrong) + (p.qn ? '/' + esc(p.qn) : '') : '') +
        (p.diff ? ' · 난도 ' + esc(p.diff) : '') + '</div>' +
        ((p.types && p.types.length) ? '<div class="item-s">' + esc(p.types.join(' · ')) + '</div>' : '') +
        (p.note || p.method ? '<div class="item-body clamp3">' + esc(p.note || p.method) + '</div>' : '') +
        '</button>');
      it.onclick = function () { editor(p); };
      ul.appendChild(it);
    });
    s3.appendChild(ul);
    root.appendChild(s3);
  }

  return { render: render, editor: editor };
})();

App.register({
  id: 'genre', label: '제재별', title: '제재별 기록', icon: '◈',
  render: GenreView.render,
  add: function () { GenreView.editor(null); }
});
