/* sw.js — 오프라인 실행용.
   저장본으로 바로 열고(빠름), 새 버전 확인은 앱이 sw.js를 다시 받아 비교해서 합니다.
   파일을 고쳐 올릴 때 CACHE 숫자를 올리면 새 버전을 설치한 뒤 앱이 자동으로 새로고침합니다. */
'use strict';

var CACHE = 'kor-v41';
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

/* 같은 주소의 파일만: 저장본 우선 → 없으면 네트워크 (깃허브 동기화 요청은 통과).
   매번 네트워크를 기다리지 않아 느린 연결에서도 바로 열림 */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  var nav = req.mode === 'navigate';
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(nav ? 'index.html' : req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok && !nav) c.put(req, res.clone());
          return res;
        }).catch(function () { return c.match('index.html'); });
      });
    })
  );
});
