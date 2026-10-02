/* view-home.js — 홈: D-day · 최근 시험 · 행동강령 · 목표 대비 · 추이 · 약점 */
'use strict';

var HomeView = (function () {

  /* 오답률 높은 제재 (문항 4개 이상 기록된 것만) */
  function weakGenres() {
    var out = [];
    ALL_GENRES.forEach(function (g) {
      var ps = Store.data.passages.filter(function (p) { return p.genre === g; });
      var qn = ps.reduce(function (t, p) { return t + num(p.qn, 0); }, 0);
      var wr = ps.reduce(function (t, p) { return t + num(p.wrong, 0); }, 0);
      if (qn >= 4) out.push({ g: g, rate: wr / qn, wr: wr, qn: qn });
    });
    return out.sort(function (a, b) { return b.rate - a.rate; }).slice(0, 3);
  }
  function topCauses() {
    var cnt = {};
    Store.data.passages.forEach(function (p) { (p.types || []).forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; }); });
    return Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 3).map(function (k) { return { k: k, n: cnt[k] }; });
  }

  function render(root) {
    var s = Store.data.settings;
    var exams = Store.data.exams.slice().sort(byDateDesc);
    var last = exams[0];
    var st = ExamView.targetStats(exams, s);
    var cc = cols(root), A = cc[0], B = cc[1];

    /* 상단: D-day + 최근 시험 */
    var dd = st.dday;
    var hero = h('<section class="hero card">' +
      '<div class="hero-l"><div class="k">수능까지</div>' +
      '<div class="big">' + (dd != null && dd >= 0 ? (dd === 0 ? 'D-DAY' : 'D-' + dd) : '–') + '</div>' +
      '<div class="t-xs dim num">' + esc(s.examDate || '') + '</div></div>' +
      '<div class="hero-r">' + (last ?
        '<div class="k">' + esc(ExamView.label(last)) + '</div>' +
        '<div class="big-s num">' + (last.raw != null ? esc(last.raw) + '<small>점</small>' : '–') + '</div>' +
        '<div class="t-xs muted num">' + (last.grade ? esc(last.grade) + '등급' : '') +
        (last.pct != null ? ' · 백분위 ' + esc(last.pct) : '') + '</div>' +
        (st.pctGap != null ? '<div class="chip ' + (st.pctGap >= 0 ? 'good' : 'bad') + '">목표 ' + (st.pctGap >= 0 ? '+' : '') + st.pctGap + '</div>' : '')
        : '<div class="k">최근 시험</div><div class="t-s dim">아직 기록이 없습니다</div>') +
      '</div></section>');
    A.appendChild(hero);

    /* 행동강령: 가장 최근에 적은 것 */
    var withRule = exams.filter(function (e) { return e.rule; })[0];
    var rs = h('<section><div class="sec-h"><h2>다음 시험 행동강령</h2>' +
      (withRule ? '<span class="more">' + esc(ExamView.label(withRule)) + '에서</span>' : '') + '</div></section>');
    var rc = h('<button type="button" class="card rule-card">' + (withRule ?
      '<div class="rule-body">' + esc(withRule.rule) + '</div>' :
      '<div class="t-s dim">모의고사 기록에 행동강령을 적으면 여기에 늘 보입니다</div>') + '</button>');
    rc.onclick = function () { if (withRule) ExamView.editor(withRule); else if (last) ExamView.editor(last); else ExamView.editor(null); };
    rs.appendChild(rc);
    A.appendChild(rs);

    if (!exams.length) {
      var add = h('<button type="button" class="btn full dark">첫 모의고사 기록하기</button>');
      add.onclick = function () { ExamView.editor(null); };
      A.appendChild(add);
    } else {
      A.appendChild(ExamView.targetSection(exams, s, true));

      var pc = exams.slice().reverse().filter(function (e) { return e.pct != null; }).slice(-10);
      if (pc.length) {
        var ps = h('<section><div class="sec-h"><h2>백분위 추이</h2><span class="more">' +
          (s.targetPct != null ? '<span class="tg-key"></span>목표 ' + esc(s.targetPct) : '') + (pc.length === 10 ? ' · 최근 10회' : '') + '</span></div></section>');
        var pb = h('<div class="card"></div>');
        pb.innerHTML = lineChart(pc.map(function (e) { return e.pct; }), pc.map(ExamView.shortDate), { target: s.targetPct });
        ps.appendChild(pb);
        B.appendChild(ps);
      }
      B.appendChild(ExamView.wrongTrend(exams.slice(0, 10)));
    }

    /* 약점 요약 */
    var wg = weakGenres(), tc = topCauses();
    if (wg.length || tc.length) {
      var ws = h('<section><div class="sec-h"><h2>약점 요약</h2><span class="more">지문 기록 기준</span></div></section>');
      var wc = h('<div class="card weak"></div>');
      wc.innerHTML =
        (wg.length ? '<div class="weak-h">오답률 높은 제재</div>' + wg.map(function (x) {
          return barRow(x.g, Math.round(x.rate * 100), 100, Store.color(x.g), '%');
        }).join('') : '') +
        (tc.length ? '<div class="weak-h">자주 나온 오답 원인</div>' + tc.map(function (x) {
          return barRow(x.k, x.n, tc[0].n, 'var(--rose)', '회');
        }).join('') : '');
      ws.appendChild(wc);
      B.appendChild(ws);
    }
  }

  return { render: render };
})();

App.register({
  id: 'home', label: '홈', title: '오늘', icon: '⌂',
  render: HomeView.render
});
