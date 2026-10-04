/* sw.js — 오프라인 실행용.
   온라인이면 항상 서버의 최신 파일을 받고(받은 것은 저장), 오프라인일 때만 저장본으로 엽니다.
   파일을 고쳐 올릴 때 CACHE 숫자를 올리면 앱이 새 버전을 감지해 자동으로 새로고침합니다. */
'use strict';

var CACHE = 'kor-v18';
var FILES = ['./', 'index.html', 'style.css', 'core.js', 'ui.js', 'sync.js',
  'view-home.js', 'view-reading.js', 'view-exam.js', 'view-genre.js', 'view-settings.js', 'view-report.js', 'widget-preview.js', 'widget.js',
  'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  /* cache:'reload' — 브라우저 HTTP 캐시(깃허브 10분)를 건너뛰고 서버에서 직접 */
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* 같은 주소의 파일만: 네트워크 우선 → 실패하면 저장본 (깃허브 동기화 요청은 통과) */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('index.html');
      });
    })
  );
});
