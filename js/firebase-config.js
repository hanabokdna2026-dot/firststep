/**
 * Firebase 자리 짜임
 *
 * Firebase Cloud Messaging (FCM) 으로 푸시 알림 받기 위한 설정.
 * GitHub Pages에서도 잘 작동하도록 CDN을 통해 Firebase SDK 로드.
 */

// Firebase 자리 정보
export const firebaseConfig = {
  apiKey: "AIzaSyCQenR46EhF8BCkGLZPZ6UOL1qruxZK6XM",
  authDomain: "firststep-app-73a1c.firebaseapp.com",
  projectId: "firststep-app-73a1c",
  storageBucket: "firststep-app-73a1c.firebasestorage.app",
  messagingSenderId: "933745057465",
  appId: "1:933745057465:web:8a0cadcf772be0828f8568"
};

// 웹 푸시 인증서 (VAPID 키)
export const VAPID_KEY = "BCSioVHEtyNF0fUgG5DUtVyriFrpl8dpqzCxYgkiv0DN7-FNd9-SnO0UDIcZ7OszWlAJM2f19fh3QMtHeZ90adw";
