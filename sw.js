/**
 * Service Worker
 *
 * 풍성한 삶으로 첫걸음 PWA의 캐시 + 알림 짜임:
 *
 * 1. 앱 셸 (HTML/CSS/JS/JSON/icons): network-first 시도, 실패 시 cache
 *    → 새 버전이 있으면 받아오고, 오프라인이면 캐시로 작동
 *
 * 2. 폰트, 사운드: cache-first
 *    → 한 번 받으면 빠르게 재사용
 *
 * 3. Firebase Cloud Messaging — 백그라운드 푸시 받기
 *    → 사용자가 다른 자리에 있어도 알림이 옴
 *
 * 버전 변경 시:
 *   CACHE_VERSION 숫자 올리면 옛 캐시 자동 삭제됨.
 */

// Firebase SDK — 푸시 받기 위해
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCQenR46EhF8BCkGLZPZ6UOL1qruxZK6XM",
  authDomain: "firststep-app-73a1c.firebaseapp.com",
  projectId: "firststep-app-73a1c",
  storageBucket: "firststep-app-73a1c.firebasestorage.app",
  messagingSenderId: "933745057465",
  appId: "1:933745057465:web:8a0cadcf772be0828f8568"
});

const messaging = firebase.messaging();

// 백그라운드에서 푸시 받음
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] 백그라운드 푸시 받음:', payload);
  const title = payload.notification?.title || '풍성한 첫걸음';
  const body = payload.notification?.body || '오늘의 자리에 오세요.';
  self.registration.showNotification(title, {
    body: body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    tag: 'firststep-meeting',
    data: payload.data || {},
  });
});

// 알림 누르면 앱 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = self.registration.scope;
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

const CACHE_VERSION = 'firststep-v24';
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
