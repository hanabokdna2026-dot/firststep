/**
 * Firebase Cloud Messaging Service Worker
 *
 * 백그라운드에서 푸시 메시지를 받아 알림으로 표시.
 * 이 파일은 반드시 앱 루트(firebase-messaging-sw.js)에 있어야 함 — Firebase가 그 자리에서만 찾음.
 */

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

// 백그라운드에서 메시지 받음
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 백그라운드 메시지 받음:', payload);

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
  const targetUrl = self.registration.scope.replace(/firebase-cloud-messaging-push-scope\/?$/, '');
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // 이미 열린 자리가 있으면 그 자리로
      for (const client of clientList) {
        if (client.url.startsWith(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새로 열기
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
