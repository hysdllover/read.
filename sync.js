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

  api: function (path, opt) {
    opt = opt || {};
    var c = this.cfg();
    return fetch('https://api.github.com' + path, {
      method: opt.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + c.token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: opt.body ? JSON.stringify(opt.body) : undefined
    }).then(function (r) {
      if (r.status === 401) throw new Error('토큰이 올바르지 않습니다');
      if (!r.ok) throw new Error('연결 실패 (' + r.status + ')');
      return r.json();
    });
  },

  /* 같은 토큰이면 같은 Gist를 자동으로 찾아 씁니다 */
  ensureGist: function () {
    var self = this, c = this.cfg();
    if (c.gist) return Promise.resolve(c.gist);
    return this.api('/gists?per_page=100').then(function (list) {
      var found = (list || []).find(function (g) { return g.description === GIST_DESC; });
      if (found) return found;
      return self.api('/gists', {
        method: 'POST',
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
    return this.api('/gists/' + gid).then(function (g) {
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
    return this.api('/gists/' + gid, { method: 'PATCH', body: { files: files } });
  },

  /* 전체 동기화: 받아서 병합 → 저장 → 올리기 */
  run: function (manual) {
    var self = this;
    if (!this.on() || CODE === null) { if (manual) toast('먼저 깃허브 토큰을 연결해 주세요'); return Promise.resolve(); }
    if (this.busy) return Promise.resolve();
    if (!manual && Date.now() - this.lastRun < 20000) return Promise.resolve();
    this.busy = true; this.lastRun = Date.now(); this.state = '동기화 중';
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
      self.busy = false; self.state = '';
      self.paint();
      /* 다른 기기에서 받은 변경이 있을 때만 다시 그림 (설정 중 화면이 튀지 않게) */
      if (manual || self.switched || self.pulledNew) { self.switched = false; self.pulledNew = false; App.dday(); App.refresh(); }
      else if (App.route === 'settings') { var st = document.querySelector('[data-sync-state]'); if (st) st.textContent = '방금'; }
      if (manual) toast('동기화 완료');
    }).catch(function (e) {
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

  disconnect: function () { LS.removeItem(APP_KEY + ':gh'); }
};
