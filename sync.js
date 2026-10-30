/* sync.js — 기록을 깃허브 Gist(비공개)에 저장해 아이폰↔아이패드 연동
   토큰은 기기에만 저장되고 어디로도 전송되지 않습니다(깃허브 API 제외). */
'use strict';

var GIST_DESC = 'korean-dashboard-sync';

/* 두 기록을 항목 단위로 병합 (수정 시각이 늦은 쪽 우선, 삭제는 tomb으로 반영) */
function mergeData(a, b) {
  a = migrate(a); b = migrate(b);
  var out = migrate(JSON.parse(JSON.stringify(a)));
  var tomb = {};
  a.tomb.concat(b.tomb).forEach(function (t) {
    if (!tomb[t.id] || (t.u || 0) > (tomb[t.id].u || 0)) tomb[t.id] = t;
  });
  ['reading', 'exams', 'passages'].forEach(function (c) {
    var m = {};
    a[c].forEach(function (x) { m[x.id] = x; });
    b[c].forEach(function (x) {
      var e = m[x.id];
      if (!e || (x.u || 0) > (e.u || 0)) m[x.id] = x;
    });
    out[c] = Object.keys(m).map(function (k) { return m[k]; }).filter(function (x) {
      var t = tomb[x.id];
      return !(t && (t.u || 0) >= (x.u || 0));
    });
  });
  var cut = Date.now() - 90 * 86400000;
  out.tomb = Object.keys(tomb).map(function (k) { return tomb[k]; })
    .filter(function (t) { return (t.u || 0) > cut; });
  out.settings = ((b.settings.u || 0) > (a.settings.u || 0)) ? b.settings : a.settings;
  out.t = Math.max(a.t || 0, b.t || 0);
  return out;
}

var Sync = {
  busy: false,
  state: '',       // '', '동기화 중', '완료', 오류 메시지
  timer: null,
  lastRun: 0,

  cfg: function () { try { return JSON.parse(LS.getItem(APP_KEY + ':gh') || '{}'); } catch (e) { return {}; } },
  setCfg: function (c) { LS.setItem(APP_KEY + ':gh', JSON.stringify(c)); },
  on: function () { return !!this.cfg().token; },
  file: function () { return 'korean-' + CODE + '.json'; },

  /* 연결 상태 기록: 마지막 시도·성공, 단계, 오류 코드, 토큰 권한, API 한도 */
  diag: function () { try { return JSON.parse(LS.getItem(APP_KEY + ':ghdiag') || '{}'); } catch (e) { return {}; } },
  setDiag: function (o) { var d = Object.assign(this.diag(), o); LS.setItem(APP_KEY + ':ghdiag', JSON.stringify(d)); return d; },
  step: '',

  api: function (path, opt) {
    opt = opt || {};
    var self = this, c = this.cfg(), step = opt.step || this.step || path;
    return fetch('https://api.github.com' + path, {
      method: opt.method || 'GET',
      cache: 'no-store',
      headers: {
        'Authorization': 'Bearer ' + c.token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: opt.body ? JSON.stringify(opt.body) : undefined
    }).then(function (r) {
      var hd = function (k) { return r.headers.get(k); }, info = {};
      if (hd('x-ratelimit-limit')) info.rl = { rem: +hd('x-ratelimit-remaining'), lim: +hd('x-ratelimit-limit'), reset: +hd('x-ratelimit-reset') * 1000 };
      if (hd('x-oauth-scopes') != null) info.scopes = hd('x-oauth-scopes') || '(없음 · 세분화 토큰)';
      if (hd('github-authentication-token-expiration')) info.exp = hd('github-authentication-token-expiration');
      self.setDiag(info);
      if (r.ok) return r.json();
      return r.json().catch(function () { return {}; }).then(function (b) {
        var e = new Error(r.status === 401 ? '토큰이 올바르지 않습니다' : '연결 실패 (' + r.status + ')');
        e.status = r.status; e.gh = b && b.message || ''; e.step = step;
        throw e;
      });
    }, function (err) {
      var e = new Error(navigator.onLine === false ? '인터넷 연결 없음' : '깃허브에 접속할 수 없음');
      e.status = 0; e.gh = String(err && err.message || err); e.step = step;
      throw e;
    });
  },

  /* 오류 코드 → 원인 · 해결 방법 */
  explain: function (d) {
    var st = d.status, gh = (d.gh || '').toLowerCase();
    if (!d.err) return null;
    if (st === 0) return ['네트워크 문제', '와이파이·데이터 연결을 확인한 뒤 다시 시도하세요. 저장된 기록은 기기에 그대로 있습니다.'];
    if (st === 401) return ['토큰 만료 또는 삭제됨', '깃허브에서 새 토큰(gist 권한)을 만들어 “연동 끄기” 후 다시 연결하세요. 아이폰·아이패드 모두 같은 토큰으로 바꿔야 합니다.'];
    if (st === 403 && (d.rl && d.rl.rem === 0 || gh.indexOf('rate limit') >= 0))
      return ['깃허브 사용 한도 초과', (d.rl && d.rl.reset ? fmtTime(d.rl.reset) + ' 이후 ' : '잠시 후 ') + '자동으로 다시 됩니다.'];
    if (st === 403 && gh.indexOf('secondary') >= 0) return ['요청이 너무 잦음 (일시 차단)', '몇 분 기다린 뒤 “지금 동기화”를 누르세요.'];
    if (st === 403) return ['토큰 권한 부족', '토큰에 gist 권한이 없거나 막혀 있습니다. Tokens (classic)에서 gist를 체크해 새로 만들고 다시 연결하세요.'];
    if (st === 404) return ['동기화 파일(Gist)을 찾을 수 없음', 'Gist가 지워졌거나 다른 계정의 토큰입니다. “Gist 다시 찾기”를 누르세요.'];
    if (st === 409 || st === 422) return ['저장 충돌 · 형식 오류', '“지금 동기화”를 한 번 더 누르세요. 계속되면 백업 후 Gist 다시 찾기.'];
    if (st >= 500) return ['깃허브 서버 오류', '깃허브 쪽 일시 문제입니다. 잠시 후 자동으로 다시 시도합니다.'];
    return ['알 수 없는 오류', '“연결 점검”으로 자세한 내용을 확인하세요.'];
  },

  /* 연결 점검: 계정 · 토큰 권한 · 한도 · Gist 접근을 차례로 확인 */
  check: function () {
    var self = this, c = this.cfg(), res = [];
    function t(name, p) {
      return p.then(function (v) { res.push([name, true, v]); }, function (e) { res.push([name, false, (e.status ? e.status + ' ' : '') + (e.gh || e.message)]); });
    }
    return t('계정', this.api('/user', { step: '계정 확인' }).then(function (u) { return u.login; }))
      .then(function () { return t('API 한도', self.api('/rate_limit', { step: '한도 확인' }).then(function (r) { var x = r.resources && r.resources.core || r.rate || {}; return x.remaining + ' / ' + x.limit; })); })
      .then(function () { return c.gist ? t('Gist 읽기', self.api('/gists/' + c.gist, { step: 'Gist 읽기' }).then(function (g) { var f = (g.files || {})[self.file()]; return f ? self.file() + ' · ' + Math.round((f.size || 0) / 1024) + 'KB' : '파일 없음 (첫 동기화 전)'; })) : null; })
      .then(function () { self.setDiag({ check: res, checkAt: Date.now() }); return res; });
  },

  /* 같은 토큰이면 같은 Gist를 자동으로 찾아 씁니다 */
  ensureGist: function () {
    var self = this, c = this.cfg();
    if (c.gist) return Promise.resolve(c.gist);
    this.step = 'Gist 찾기';
    return this.api('/gists?per_page=100').then(function (list) {
      var found = (list || []).find(function (g) { return g.description === GIST_DESC; });
      if (found) return found;
      return self.api('/gists', {
        method: 'POST', step: 'Gist 만들기',
        body: {
          description: GIST_DESC, public: false,
          files: { 'about.txt': { content: '국어 학습 대시보드 동기화 파일' } }
        }
      });
    }).then(function (g) {
      c = self.cfg(); c.gist = g.id; self.setCfg(c);
      return g.id;
    });
  },

  pull: function (gid) {
    var self = this;
    return this.api('/gists/' + gid, { step: '받기' }).then(function (g) {
      var files = g.files || {};
      var f = files[self.file()];
      /* 이 칸의 파일이 없으면 Gist에 있는 다른 칸 기록으로 맞춤 (코드 기능을 없앤 뒤 기기 간 칸 번호 차이 보정) */
      if (!f && !Store.data.exams.length && !Store.data.passages.length && !Store.data.reading.length) {
        var best = null, bt = -1;
        Object.keys(files).forEach(function (name) {
          var m = /^korean-(\d)\.json$/.exec(name);
          if (!m) return;
          var t = 0;
          try { t = JSON.parse(files[name].content || '{}').t || 0; } catch (e) { t = 0; }
          if (t >= bt) { bt = t; best = m[1]; }
        });
        if (best !== null) {
          CODE = best; LS.setItem(APP_KEY + ':code', CODE); Store.load(); self.switched = true;
          f = files[self.file()];
        }
      }
      if (!f) return null;
      if (f.truncated && f.raw_url) {
        return fetch(f.raw_url).then(function (r) { return r.text(); }).then(function (t) { return JSON.parse(t); });
      }
      return JSON.parse(f.content || 'null');
    });
  },

  push: function (gid, data) {
    var files = {};
    files[this.file()] = { content: JSON.stringify(data) };
    return this.api('/gists/' + gid, { method: 'PATCH', body: { files: files }, step: '올리기' });
  },

  /* 전체 동기화: 받아서 병합 → 저장 → 올리기 */
  run: function (manual) {
    var self = this;
    if (!this.on() || CODE === null) { if (manual) toast('먼저 깃허브 토큰을 연결해 주세요'); return Promise.resolve(); }
    if (this.busy) return Promise.resolve();
    if (!manual && Date.now() - this.lastRun < 20000) return Promise.resolve();
    this.busy = true; this.lastRun = Date.now(); this.state = '동기화 중';
    this.setDiag({ tryAt: Date.now() });
    this.paint();
    return this.ensureGist().then(function (gid) {
      return self.pull(gid).then(function (remote) {
        var before = JSON.stringify(Store.data);
        var merged = remote ? mergeData(Store.data, remote) : Store.data;
        self.pulledNew = before !== JSON.stringify(merged);
        var changed = !remote || JSON.stringify(remote) !== JSON.stringify(merged);
        Store.data = merged;
        Store.save(true);
        if (!changed) return null;
        return self.push(gid, merged);
      });
    }).then(function () {
      var c = self.cfg(); c.last = Date.now(); self.setCfg(c);
      self.setDiag({ okAt: c.last, err: null, status: null, gh: '', step: '' });
      self.busy = false; self.state = '';
      self.paint();
      /* 다른 기기에서 받은 변경이 있을 때만 다시 그림 (설정 중 화면이 튀지 않게) */
      if (manual || self.switched || self.pulledNew) { self.switched = false; self.pulledNew = false; App.dday(); App.refresh(); }
      if (manual) toast('동기화 완료');
    }).catch(function (e) {
      self.setDiag({ err: e.message || '동기화 실패', errAt: Date.now(), status: e.status == null ? -1 : e.status, gh: e.gh || '', step: e.step || '' });
      self.busy = false; self.state = e.message || '동기화 실패';
      self.paint();
      if (manual) toast(self.state);
    });
  },

  /* 저장 후 자동 올리기 (묶어서 4초 뒤 1회) */
  queue: function () {
    var self = this;
    if (!this.on()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(function () { self.lastRun = 0; self.run(false); }, 4000);
  },

  paint: function () {
    var el = document.getElementById('syncDot');
    if (!el) return;
    el.hidden = !this.on();
    el.textContent = this.busy ? '···' : (this.state ? '!' : '·');
    el.title = this.state || '동기화됨';
    var dg = document.querySelector('[data-sync-diag]');
    if (dg) dg.innerHTML = this.diagHTML();
  },

  diagHTML: function () {
    var d = this.diag(), c = this.cfg(), ex = this.explain(d), rows = [];
    function row(k, v, cls) { rows.push('<div class="kv"><span>' + k + '</span><b' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</b></div>'); }
    var stTxt = this.busy ? '동기화 중…' : d.err ? '오류' : d.okAt ? '정상' : '아직 동기화 전';
    /* k는 고정 문구(HTML 허용), v는 호출부에서 esc 처리 */
    row('상태', esc(stTxt), d.err && !this.busy ? 'bad' : 'good');
    row('마지막 성공', d.okAt || c.last ? esc(fmtTime(d.okAt || c.last)) + ' <small>(' + esc(timeAgo(d.okAt || c.last)) + ')</small>' : '–');
    if (d.tryAt) row('마지막 시도', esc(fmtTime(d.tryAt)));
    if (d.err) {
      row('실패 단계', esc(d.step || '–'));
      row('오류', esc((d.status > 0 ? d.status + ' · ' : '') + (d.gh || d.err)), 'bad');
    }
    row('계정', esc(c.user || '–'));
    if (d.scopes) row('토큰 권한', esc(d.scopes), /gist/.test(d.scopes) || /세분화/.test(d.scopes) ? '' : 'bad');
    if (d.exp) row('토큰 만료', esc(d.exp));
    if (d.rl) row('API 한도', d.rl.rem + ' / ' + d.rl.lim + (d.rl.rem < 50 ? ' <small>· ' + esc(fmtTime(d.rl.reset)) + ' 초기화</small>' : ''), d.rl.rem === 0 ? 'bad' : '');
    row('Gist', c.gist ? '<a href="https://gist.github.com/' + esc(c.gist) + '" target="_blank" rel="noopener">' + esc(c.gist.slice(0, 8)) + '…</a>' : '–');
    row('파일', esc(this.file()));
    row('네트워크', navigator.onLine === false ? '오프라인' : '온라인', navigator.onLine === false ? 'bad' : '');
    if (d.check) row('연결 점검 <small>' + esc(timeAgo(d.checkAt)) + '</small>', d.check.map(function (x) { return '<span class="' + (x[1] ? 'good' : 'bad') + '">' + (x[1] ? '✓ ' : '✕ ') + esc(x[0]) + '</span> <small>' + esc(x[2] == null ? '' : x[2]) + '</small>'; }).join('<br>'));
    return (ex && !this.busy ? '<div class="sync-help"><b>' + esc(ex[0]) + '</b><div>' + esc(ex[1]) + '</div></div>' : '') + rows.join('');
  },

  connect: function (token) {
    var self = this;
    var c = this.cfg(); c.token = token.trim(); c.gist = null; this.setCfg(c);
    return this.api('/user').then(function (u) {
      c = self.cfg(); c.user = u.login; self.setCfg(c);
      return self.run(true);
    }).catch(function (e) {
      var cc = self.cfg(); delete cc.token; self.setCfg(cc);
      toast(e.message || '연결 실패');
      throw e;
    });
  },

  disconnect: function () { LS.removeItem(APP_KEY + ':gh'); LS.removeItem(APP_KEY + ':ghdiag'); },
  regist: function () { var c = this.cfg(); c.gist = null; this.setCfg(c); this.lastRun = 0; return this.run(true); }
};
