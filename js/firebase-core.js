/**
 * Firebase 한 곳에서 불러오기
 *
 * 알림(push-notifications.js)과 계정·동기화(cloud.js)가 같은 앱 인스턴스를 씀.
 * SDK는 필요할 때만 CDN에서 불러옴 — 로그인도 알림도 안 쓰면 아예 안 불러옴.
 *
 * 개발용: localhost에서 localStorage 'firststep-dev:emulator' = '1'이면
 * 로컬 에뮬레이터(인증 9099, Firestore 8080)에 붙음. 실제 사이트에서는 동작하지 않음.
 */

import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.13.2/';

let appPromise = null;
let authPromise = null;
let dbPromise = null;

function useEmulator() {
  try {
    return ['localhost', '127.0.0.1'].includes(location.hostname)
      && localStorage.getItem('firststep-dev:emulator') === '1';
  } catch (e) {
    return false;
  }
}

// 실패하면 다음 번에 다시 시도할 수 있게 비워둠 (오프라인 등)
function retryable(factory, reset) {
  const p = factory();
  p.catch(() => reset());
  return p;
}

export function getFirebaseApp() {
  if (!appPromise) {
    appPromise = retryable(async () => {
      const m = await import(SDK + 'firebase-app.js');
      if (m.getApps().length) return m.getApp();
      // 에뮬레이터로 시험할 때는 실제 프로젝트와 섞이지 않도록 시험용 프로젝트 이름을 씀
      const config = useEmulator() ? { ...firebaseConfig, projectId: 'demo-firststep' } : firebaseConfig;
      return m.initializeApp(config);
    }, () => { appPromise = null; });
  }
  return appPromise;
}

export function loadSdk(name) {
  return import(SDK + name + '.js');
}

export function getAuthKit() {
  if (!authPromise) {
    authPromise = retryable(async () => {
      const app = await getFirebaseApp();
      const A = await loadSdk('firebase-auth');
      let auth;
      try {
        // 팝업·리디렉션 로그인을 쓰지 않으니 그 부분은 빼고 초기화 (외부 창 불러오지 않음)
        auth = A.initializeAuth(app, {
          persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence],
        });
      } catch (e) {
        auth = A.getAuth(app);
      }
      auth.languageCode = 'ko';
      if (useEmulator()) A.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      return { auth, A };
    }, () => { authPromise = null; });
  }
  return authPromise;
}

export function getDbKit() {
  if (!dbPromise) {
    dbPromise = retryable(async () => {
      const app = await getFirebaseApp();
      const F = await loadSdk('firebase-firestore');
      const db = F.getFirestore(app);
      if (useEmulator()) {
        try { F.connectFirestoreEmulator(db, '127.0.0.1', 8080); } catch (e) { /* 이미 연결됨 */ }
      }
      return { db, F };
    }, () => { dbPromise = null; });
  }
  return dbPromise;
}
