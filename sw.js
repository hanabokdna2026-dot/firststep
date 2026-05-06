/**
 * Service Worker
 *
 * 풍성한 삶으로 첫걸음 PWA의 캐시 전략:
 *
 * 1. 앱 셸 (HTML/CSS/JS/JSON/icons): network-first 시도, 실패 시 cache
 *    → 새 버전이 있으면 받아오고, 오프라인이면 캐시로 작동
 *
 * 2. 폰트, 사운드: cache-first
 *    → 한 번 받으면 빠르게 재사용
 *
 * 버전 변경 시:
 *   CACHE_VERSION 숫자 올리면 옛 캐시 자동 삭제됨.
 */

const CACHE_VERSION = 'firststep-v8';
const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './data/lessons.json',
  './data/john1.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/hanabok-mark.svg',
  './assets/sounds/bell-medium.mp3',
];

// 설치 - 앱 셸 캐시
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 활성화 - 옛 버전 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// fetch 인터셉트
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 외부 도메인은 캐시 안 함 (구글 폰트 등)
  if (url.origin !== self.location.origin) {
    return;
  }

  // POST 등 다른 메소드는 그대로 통과
  if (event.request.method !== 'GET') {
    return;
  }

  // 폰트, 사운드는 cache-first
  if (url.pathname.match(/\.(mp3|woff2|woff|ttf|otf)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 그 외 (HTML/CSS/JS/JSON): network-first
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 성공 시 캐시 업데이트
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시 사용
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // 캐시도 없으면 index.html (SPA fallback)
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
