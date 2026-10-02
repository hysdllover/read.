/* view-exam.js — 2. 모의고사 기록 */
'use strict';

var ExamView = (function () {
  var filter = '전체';

  function label(e) { return (e.name || e.org || '모의고사'); }

  function editor(item) {
    var it = item || {
      date: today(), org: '평가원', name: '', sel: Store.data.settings.lastSel || '언매',
      raw: '', pct: '', grade: '', w: {}, time: '', memo: '', rule: ''
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
      fArea('메모 · 총평', 'memo', it.memo, '시간 배분, 무너진 지점, 느낀 점', true) +
      fArea('행동강령 · 다음 시험에서 지킬 것', 'rule', it.rule, '예) 독서 첫 지문 8분 넘기면 표시하고 넘어간다\n예) 문학 <보기> 먼저 읽기', true)
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
          grade: num(v.grade), time: num(v.time), memo: v.memo, rule: v.rule, m2r: 1,
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
    var cc = cols(root), A = cc[0], B = cc[1];
    var sec = h('<section></section>');
    sec.innerHTML = '<div class="grid4">' +
      statCard('평균 원점수', r1(avg(raws)), '점') +
      statCard('평균 백분위', r1(avg(pcts)), '') +
      statCard('최근 백분위', recent ? recent.pct : '–', '') +
      statCard('최근 등급', grades.length ? grades[0].grade : '–', '등급') +
      '</div>';
    A.appendChild(sec);

    /* 목표 대비 */
    A.appendChild(targetSection(all, s));

    /* 원점수 추이 */
    var chron = all.slice().reverse().filter(function (e) { return e.raw != null; });
    var ch = h('<section><div class="sec-h"><h2>원점수 추이</h2><span class="more">전체 ' +
      chron.length + '회</span></div></section>');
    var box = h('<div class="card"></div>');
    box.innerHTML = lineChart(
      chron.map(function (e) { return e.raw; }),
      chron.map(shortDate),
      {}
    );
    ch.appendChild(box);
    A.appendChild(ch);

    /* 백분위 추이 (목표선) */
    var pc = all.slice().reverse().filter(function (e) { return e.pct != null; });
    if (pc.length) {
      var ph = h('<section><div class="sec-h"><h2>백분위 추이</h2><span class="more">' +
        (s.targetPct != null ? '<span class="tg-key"></span>목표 ' + esc(s.targetPct) : '') + '</span></div></section>');
      var pbox = h('<div class="card"></div>');
      pbox.innerHTML = lineChart(pc.map(function (e) { return e.pct; }), pc.map(shortDate), { target: s.targetPct });
      ph.appendChild(pbox);
      A.appendChild(ph);
    }

    /* 영역별 오답 추이 */
    A.appendChild(wrongTrend(all));

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
        (e.rule ? '<div class="item-rule clamp3">' + esc(e.rule) + '</div>' : '') +
        (e.memo ? '<div class="item-body clamp3">' + esc(e.memo) + '</div>' : '') +
        '</button>');
      it.onclick = function () { editor(e); };
      ul.appendChild(it);
    });
    sec3.appendChild(ul);
    B.appendChild(sec3);

    var pr = h('<button type="button" class="btn full">그래프 인쇄 (A4)</button>');
    pr.onclick = function () { Report.open('graph'); };
    B.appendChild(pr);
  }

  /* 시험별 독서·문학·선택 오답 누적 막대 */
  var AREA_KEYS = ['독서', '문학', '선택'];
  var AREA_COLORS = ['var(--navy)', 'var(--violet)', 'var(--sand)'];
  function wrongTrend(all, lg) {
    var chron = all.slice().reverse();
    var avgs = AREA_KEYS.map(function (k) { return r1(avg(all.map(function (e) { return num((e.w || {})[k], 0); }))); });
    var sec = h('<section><div class="sec-h"><h2>영역별 오답 추이</h2><span class="more">' + legend(AREA_KEYS, AREA_COLORS) + '</span></div></section>');
    var box = h('<div class="card' + (lg ? ' rp-c' : '') + '"></div>');
    box.innerHTML = stackChart(chron.map(function (e) {
      var w = e.w || {};
      return AREA_KEYS.map(function (k) { return num(w[k], 0); });
    }), chron.map(shortDate), AREA_COLORS, { size: lg ? 'lg' : '' }) +
      '<div class="avg-row">' + AREA_KEYS.map(function (k, i) {
        return '<span>' + k + ' 평균 <b>' + avgs[i] + '</b>개</span>';
      }).join('') + '</div>';
    sec.appendChild(box);
    return sec;
  }

  function shortDate(e) { return (e.date || '').slice(5).replace('.', '/'); }

  /* 목표 대비: 최근 백분위·등급 차이, 달성 횟수, D-day */
  function targetSection(all, s, noDday) {
    var st = targetStats(all, s);
    var sec = h('<section><div class="sec-h"><h2>목표 대비</h2><span class="more">목표 ' +
      (s.targetGrade != null ? esc(s.targetGrade) + '등급' : '') +
      (s.targetPct != null ? ' · 백분위 ' + esc(s.targetPct) : '') + '</span></div></section>');
    sec.appendChild(h('<div class="grid4">' +
      gapCard('백분위 차이', st.pctGap, '') +
      gapCard('등급 차이', st.gradeGap, '등급') +
      statCard('목표 달성', st.hitN + '/' + st.pctN, '회') +
      (noDday ? statCard('평균 백분위', r1(avg(all.filter(function (e) { return e.pct != null; }).map(function (e) { return e.pct; }))), '')
        : statCard('수능까지', st.dday != null && st.dday >= 0 ? 'D-' + st.dday : '–', '')) +
      '</div>'));
    return sec;
  }
  function targetStats(all, s) {
    var withPct = all.filter(function (e) { return e.pct != null; });
    var withGrade = all.filter(function (e) { return e.grade != null; });
    return {
      pctGap: withPct.length && s.targetPct != null ? Math.round((withPct[0].pct - s.targetPct) * 10) / 10 : null,
      /* 등급은 숫자가 작을수록 좋음 → 목표 − 최근 */
      gradeGap: withGrade.length && s.targetGrade != null ? s.targetGrade - withGrade[0].grade : null,
      hitN: s.targetPct != null ? withPct.filter(function (e) { return e.pct >= s.targetPct; }).length : 0,
      pctN: withPct.length,
      dday: dLeft(s.examDate)
    };
  }
  function gapCard(k, v, unit) {
    if (v == null) return statCard(k, '–', '');
    var cls = v > 0 ? 'gap-up' : (v < 0 ? 'gap-dn' : '');
    return '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v ' + cls + '">' +
      (v > 0 ? '+' : '') + esc(v) + (unit ? '<small>' + esc(unit) + '</small>' : '') + '</div></div>';
  }

  return { render: render, editor: editor, label: label, targetStats: targetStats, gapCard: gapCard, shortDate: shortDate, targetSection: targetSection, wrongTrend: wrongTrend };
})();

App.register({
  id: 'exam', label: '모의고사', title: '모의고사 기록', icon: '◫',
  render: ExamView.render,
  add: function () { ExamView.editor(null); }
});
