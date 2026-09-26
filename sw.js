/* sw.js — 오프라인 실행용. 파일을 고쳐 올릴 때 CACHE 숫자를 올리면 새 버전으로 교체됩니다. */
'use strict';

var CACHE = 'kor-v1';
var FILES = ['./', 'index.html', 'style.css', 'core.js', 'ui.js', 'sync.js',
  'view-reading.js', 'view-exam.js', 'view-genre.js', 'view-settings.js', 'view-report.js',
  'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* 같은 주소의 파일만: 캐시로 바로 열고, 뒤에서 새 파일 받아 다음 실행에 반영 (깃허브 동기화 요청은 통과) */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) c.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
