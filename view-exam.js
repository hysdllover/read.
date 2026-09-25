/* view-exam.js — 2. 모의고사 기록 */
'use strict';

var ExamView = (function () {
  var filter = '전체';

  function label(e) { return (e.name || e.org || '모의고사'); }
  function wrongSum(e) {
    var w = e.w || {};
    return (num(w['독서'], 0)) + (num(w['문학'], 0)) + (num(w['선택'], 0));
  }

  function editor(item) {
    var it = item || {
      date: today(), org: '평가원', name: '', sel: Store.data.settings.lastSel || '언매',
      raw: '', pct: '', grade: '', w: {}, time: '', memo: ''
    };
    var w = it.w || {};
    var f = form(
      '<div class="f-row">' + fDate('시행일', 'date', it.date) + fText('시험명', 'name', it.name, '예: 9월 모평') + '</div>' +
      fSeg('출제', 'org', ORGS, it.org) +
      fSeg('선택과목', 'sel', SELECTS, it.sel) +
      '<div class="f-row">' + fNum('원점수', 'raw', it.raw, '/100') + fNum('백분위', 'pct', it.pct, '') + '</div>' +
      fSeg('등급', 'grade', ['1', '2', '3', '4', '5', '6', '7', '8', '9'], it.grade ? String(it.grade) : '') +
      '<div class="f-row3">' + fNum('독서 오답', 'w독서', w['독서'], '개') + fNum('문학 오답', 'w문학', w['문학'], '개') + fNum('선택 오답', 'w선택', w['선택'], '개') + '</div>' +
      fNum('소요 시간', 'time', it.time, '분') +
      fArea('총평 / 다음에 고칠 것', 'memo', it.memo, '시간 배분, 무너진 지점, 다음 시험 목표')
    );
    bindForm(f);

    if (item) {
      var link = h('<button type="button" class="btn full" style="margin-bottom:12px">이 시험의 지문 기록 추가</button>');
      link.onclick = function () {
        document.querySelectorAll('.sheet-wrap').forEach(function (x) { x.remove(); });
        App.go('genre');
        GenreView.editor(null, { source: label(it), date: it.date, examId: it.id });
      };
      f.insertBefore(link, f.firstChild);
    }

    openSheet({
      title: item ? '모의고사 수정' : '모의고사 기록',
      body: f,
      onOk: function () {
        var v = readForm(f);
        if (!v.date) { toast('시행일을 입력해 주세요'); return false; }
        Store.data.settings.lastSel = v.sel;
        Store.put('exams', Object.assign({}, it, {
          date: v.date, org: v.org, name: v.name, sel: v.sel,
          raw: num(v.raw), pct: num(v.pct),
          grade: num(v.grade), time: num(v.time), memo: v.memo,
          w: { '독서': num(v['w독서']), '문학': num(v['w문학']), '선택': num(v['w선택']) }
        }));
        App.refresh();
      },
      onDelete: item ? function () { Store.del('exams', it.id); App.refresh(); toast('삭제했습니다'); } : null
    });
  }

  function render(root) {
    var all = Store.data.exams.slice().sort(byDateDesc);
    var list = filter === '전체' ? all : all.filter(function (x) { return x.org === filter; });
    var s = Store.data.settings;

    if (!all.length) {
      root.appendChild(h(emptyBox('첫 모의고사를 기록해 보세요', '＋를 눌러 점수·등급·영역별 오답을 남깁니다')));
      return;
    }

    /* 요약 */
    var raws = all.filter(function (e) { return e.raw != null; }).map(function (e) { return e.raw; });
    var pcts = all.filter(function (e) { return e.pct != null; }).map(function (e) { return e.pct; });
    var grades = all.filter(function (e) { return e.grade != null; });
    var recent = all.filter(function (e) { return e.pct != null; })[0];
    var wr = all.map(wrongSum);
    var sec = h('<section></section>');
    sec.innerHTML = '<div class="grid4">' +
      statCard('평균 원점수', r1(avg(raws)), '점') +
      statCard('평균 백분위', r1(avg(pcts)), '') +
      statCard('최근 백분위', recent ? recent.pct : '–', '') +
      statCard('최근 등급', grades.length ? grades[0].grade : '–', '등급') +
      '</div>';
    root.appendChild(sec);

    /* 원점수 추이 */
    var chron = all.slice().reverse().filter(function (e) { return e.raw != null; });
    var ch = h('<section><div class="sec-h"><h2>원점수 추이</h2><span class="more">전체 ' +
      chron.length + '회</span></div></section>');
    var box = h('<div class="card"></div>');
    box.innerHTML = lineChart(
      chron.map(function (e) { return e.raw; }),
      chron.map(function (e) { return (e.date || '').slice(5).replace('.', '/'); }),
      {}
    );
    ch.appendChild(box);
    root.appendChild(ch);

    /* 영역별 평균 오답 */
    var areas = [['독서', '독서'], ['문학', '문학'], ['선택', '선택']];
    var avgs = areas.map(function (a) {
      return avg(all.map(function (e) { return num((e.w || {})[a[0]], 0); }));
    });
    var mx = Math.max.apply(null, avgs.map(function (v) { return v || 0; })) || 1;
    var sec2 = h('<section><div class="sec-h"><h2>영역별 평균 오답</h2><span class="more">전체 평균 ' + r1(avg(wr)) + '개</span></div></section>');
    var b2 = h('<div class="card"></div>');
    b2.innerHTML = areas.map(function (a, i) {
      return barRow(a[1], r1(avgs[i]), mx, i === 0 ? '#6E7C99' : (i === 1 ? '#A08A8A' : '#7A8465'), '개');
    }).join('');
    sec2.appendChild(b2);
    root.appendChild(sec2);

    /* 필터 + 목록 */
    var chips = h('<div class="chips"></div>');
    ['전체'].concat(ORGS).forEach(function (c) {
      var b = h('<button type="button" class="pill' + (c === filter ? ' on' : '') + '">' + esc(c) + '</button>');
      b.onclick = function () { filter = c; App.refresh(); };
      chips.appendChild(b);
    });
    var sec3 = h('<section></section>');
    sec3.appendChild(chips);

    var ul = h('<div class="list"></div>');
    list.forEach(function (e) {
      var w = e.w || {};
      var it = h('<button type="button" class="item">' +
        '<div class="row-b">' +
        '<div><div class="item-t">' + esc(label(e)) + '</div>' +
        '<div class="item-s num">' + esc(e.date || '') + ' · ' + esc(e.sel || '') +
        (e.time ? ' · ' + esc(e.time) + '분' : '') + '</div></div>' +
        '<div style="text-align:right"><div class="item-t num">' +
        (e.raw != null ? esc(e.raw) + '<span class="dim t-s">점</span>' : '–') + '</div>' +
        '<div class="item-s num">' + (e.grade ? esc(e.grade) + '등급' : '') +
        (e.pct != null ? (e.grade ? ' · ' : '') + '백분위 ' + esc(e.pct) : '') + '</div></div></div>' +
        '<div class="item-s num">오답 독서 ' + (w['독서'] != null ? w['독서'] : 0) +
        ' · 문학 ' + (w['문학'] != null ? w['문학'] : 0) +
        ' · 선택 ' + (w['선택'] != null ? w['선택'] : 0) + '</div>' +
        (e.memo ? '<div class="item-body clamp3">' + esc(e.memo) + '</div>' : '') +
        '</button>');
      it.onclick = function () { editor(e); };
      ul.appendChild(it);
    });
    sec3.appendChild(ul);
    root.appendChild(sec3);
  }

  return { render: render, editor: editor, label: label };
})();

App.register({
  id: 'exam', label: '모의고사', title: '모의고사 기록', icon: '◫',
  render: ExamView.render,
  add: function () { ExamView.editor(null); }
});
