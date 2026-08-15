/* view-reading.js — 1. 독해 (독해 방식·원칙 정리) */
'use strict';

var ReadingView = (function () {
  var filter = '전체';

  function editor(item) {
    var it = item || { cat: '독서', title: '', body: '', pin: false };
    var f = form(
      fSeg('구분', 'cat', READ_CATS, it.cat) +
      fText('제목', 'title', it.title, '예: 독서 지문 3단계 처리법') +
      fArea('내용', 'body', it.body, '읽는 순서, 표시 규칙, 선지 판단 기준 등') +
      fSeg('상단 고정', 'pin', ['고정', '보통'], it.pin ? '고정' : '보통')
    );
    bindForm(f);
    openSheet({
      title: item ? '독해 노트 수정' : '독해 노트',
      body: f,
      onOk: function () {
        var v = readForm(f);
        if (!v.title && !v.body) { toast('제목이나 내용을 입력해 주세요'); return false; }
        Store.put('reading', Object.assign({}, it, {
          cat: v.cat, title: v.title || '(제목 없음)', body: v.body, pin: v.pin === '고정'
        }));
        App.refresh();
      },
      onDelete: item ? function () { Store.del('reading', it.id); App.refresh(); toast('삭제했습니다'); } : null
    });
  }

  function seed() {
    var t = [
      { cat: '독서', title: '독서 지문 3단계 처리', body: '1) 첫 문단에서 화제·글의 방향 확정\n2) 문단마다 핵심어 1개 표시, 대조·인과·조건 표현에 표시\n3) 문제로 가기 전에 구조 한 줄 요약' },
      { cat: '독서', title: '선지 판단 기준', body: '· 근거 문장 위치를 반드시 지문에 표시\n· 범위(모두/일부), 시점, 인과 방향을 먼저 확인\n· 매력적 오답은 대체로 지문 표현을 재조합한 것' },
      { cat: '문학', title: '작품 감상 기본', body: '· 화자/서술자의 태도와 정서 → 변화 지점 표시\n· 시간·공간 이동, 대립 구도 표시\n· <보기>는 읽기 전에 먼저 확인해 관점 고정' },
      { cat: '시간운영', title: '시간 배분 기준', body: '선택과목 22분 → 문학 25분 → 독서 30분\n난도 높은 지문 1개는 과감히 후순위\n마킹 4분 확보' }
    ];
    t.forEach(function (x) { Store.put('reading', x); });
    App.refresh();
    toast('기본 템플릿을 넣었습니다');
  }

  function render(root) {
    var all = Store.data.reading.slice().sort(function (a, b) {
      return (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.u || 0) - (a.u || 0);
    });
    var list = filter === '전체' ? all : all.filter(function (x) { return x.cat === filter; });

    var chips = h('<div class="chips"></div>');
    ['전체'].concat(READ_CATS).forEach(function (c) {
      var n = c === '전체' ? all.length : all.filter(function (x) { return x.cat === c; }).length;
      var b = h('<button type="button" class="pill' + (c === filter ? ' on' : '') + '">' +
        esc(c) + (n ? ' <span class="t-xs">' + n + '</span>' : '') + '</button>');
      b.onclick = function () { filter = c; App.refresh(); };
      chips.appendChild(b);
    });
    root.appendChild(chips);

    if (!all.length) {
      var e = h('<div></div>');
      e.innerHTML = emptyBox('독해 노트가 비어 있습니다', '＋로 직접 쓰거나, 아래 템플릿으로 시작하세요');
      var b = h('<button type="button" class="btn full" style="margin-top:8px">기본 템플릿 넣기</button>');
      b.onclick = seed;
      e.appendChild(b);
      root.appendChild(e);
      return;
    }
    if (!list.length) { root.appendChild(h(emptyBox('이 구분에는 기록이 없습니다', ''))); return; }

    list.forEach(function (it) {
      var c = h('<div class="card card-tap" style="margin-bottom:8px">' +
        '<div class="row-b"><div class="item-t">' + (it.pin ? '· ' : '') + esc(it.title) + '</div>' +
        '<span class="badge">' + esc(it.cat) + '</span></div>' +
        (it.body ? '<div class="item-body clamp3">' + esc(it.body) + '</div>' : '') +
        '</div>');
      c.onclick = function () { editor(it); };
      root.appendChild(c);
    });
  }

  return { render: render, editor: editor };
})();

App.register({
  id: 'reading', label: '독해', title: '독해', icon: '☰',
  render: ReadingView.render,
  add: function () { ReadingView.editor(null); }
});
