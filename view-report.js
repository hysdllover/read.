/* view-report.js — A4 인쇄용 리포트 (탭 아님, 설정·모의고사 화면에서 열기) */
'use strict';

var Report = (function () {
  function table(head, rows) {
    return '<table class="rp-t"><thead><tr>' + head.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr>' + r.map(function (x) { return '<td>' + esc(x == null ? '–' : x) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  function sec(title, body, sub) {
    return '<section class="rp-s"><div class="sec-h"><h2>' + esc(title) + '</h2>' +
      (sub ? '<span class="more">' + sub + '</span>' : '') + '</div>' + body + '</section>';
  }

  function build() {
    var d = Store.data, s = d.settings;
    var exams = d.exams.slice().sort(byDateDesc);
    var chron = exams.slice().reverse();
    var raws = exams.filter(function (e) { return e.raw != null; }).map(function (e) { return e.raw; });
    var pcts = exams.filter(function (e) { return e.pct != null; }).map(function (e) { return e.pct; });
    var st = ExamView.targetStats(exams, s);
    var out = '';

    out += '<header class="rp-h"><div><div class="eyebrow">수능 국어 · 학습 리포트</div>' +
      '<h1>코드 ' + esc(CODE) + '</h1></div><div class="rp-meta">출력 ' + esc(today()) +
      (st.dday != null && st.dday >= 0 ? ' · 수능 D-' + st.dday : '') + '<br>목표 ' +
      (s.targetGrade != null ? esc(s.targetGrade) + '등급' : '–') + ' · 백분위 ' + (s.targetPct != null ? esc(s.targetPct) : '–') +
      '</div></header>';

    out += sec('요약', '<div class="grid4">' +
      statCard('모의고사', exams.length, '회') +
      statCard('평균 원점수', r1(avg(raws)), '점') +
      statCard('평균 백분위', r1(avg(pcts)), '') +
      statCard('기록한 지문', d.passages.length, '편') + '</div>');

    out += sec('목표 대비', '<div class="grid4">' +
      ExamView.gapCard('백분위 차이', st.pctGap, '') +
      ExamView.gapCard('등급 차이', st.gradeGap, '등급') +
      statCard('목표 달성', st.hitN + '/' + st.pctN, '회') +
      statCard('최근 등급', exams.filter(function (e) { return e.grade != null; }).map(function (e) { return e.grade; })[0] || '–', '등급') +
      '</div>');

    var cr = chron.filter(function (e) { return e.raw != null; });
    var cp = chron.filter(function (e) { return e.pct != null; });
    if (cr.length || cp.length) {
      out += '<div class="rp-2">' +
        sec('원점수 추이', '<div class="card">' + lineChart(cr.map(function (e) { return e.raw; }), cr.map(ExamView.shortDate), {}) + '</div>') +
        sec('백분위 추이', '<div class="card">' + lineChart(cp.map(function (e) { return e.pct; }), cp.map(ExamView.shortDate), { target: s.targetPct }) + '</div>',
          s.targetPct != null ? '<span class="tg-key"></span>목표 ' + esc(s.targetPct) : '') +
        '</div>';
    }

    if (exams.length) {
      out += sec('모의고사 기록', table(
        ['시행일', '시험', '출제', '원점수', '백분위', '등급', '독서', '문학', '선택', '시간'],
        exams.map(function (e) {
          var w = e.w || {};
          return [e.date, ExamView.label(e), e.org, e.raw, e.pct, e.grade, w['독서'], w['문학'], w['선택'], e.time != null ? e.time + '분' : null];
        })), '오답 수 기준');
    }

    if (d.passages.length) {
      var rows = [];
      AREAS.forEach(function (a) {
        GENRES[a].forEach(function (g) {
          var ps = d.passages.filter(function (p) { return p.genre === g; });
          if (!ps.length) return;
          var qn = ps.reduce(function (t, p) { return t + num(p.qn, 0); }, 0);
          var wr = ps.reduce(function (t, p) { return t + num(p.wrong, 0); }, 0);
          var df = avg(ps.filter(function (p) { return p.diff; }).map(function (p) { return p.diff; }));
          rows.push([a, g, ps.length, qn, wr, qn ? Math.round(wr / qn * 100) + '%' : null, df ? r1(df) : null]);
        });
      });
      out += sec('제재별 기록', table(['영역', '제재', '지문', '문항', '오답', '오답률', '난도'], rows));

      var cnt = {};
      d.passages.forEach(function (p) { (p.types || []).forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; }); });
      var keys = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 5);
      if (keys.length) {
        out += sec('오답 원인 상위 5', '<div class="card">' + keys.map(function (k) {
          return barRow(k, cnt[k], cnt[keys[0]], 'var(--accent)', '회');
        }).join('') + '</div>');
      }
    }

    if (!exams.length && !d.passages.length) out += emptyBox('아직 기록이 없습니다', '모의고사나 지문을 기록하면 리포트가 채워집니다');
    return out;
  }

  function open() {
    close();
    var wrap = h('<div id="report"><div class="rp-bar"><button type="button" class="rp-x">닫기</button>' +
      '<b>A4 리포트</b><button type="button" class="rp-p">인쇄</button></div>' +
      '<div class="rp-scroll"><div class="rp-page">' + build() + '</div></div></div>');
    wrap.querySelector('.rp-x').onclick = close;
    wrap.querySelector('.rp-p').onclick = function () {
      try { window.print(); } catch (e) { toast('Safari 공유 → 프린트를 이용해 주세요'); }
    };
    document.body.appendChild(wrap);
    document.body.classList.add('report-open');
    scrollCharts(wrap);
  }
  function close() {
    var old = document.getElementById('report');
    if (old) old.remove();
    document.body.classList.remove('report-open');
  }

  return { open: open, close: close };
})();
