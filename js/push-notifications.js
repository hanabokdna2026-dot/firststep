/**
 * 푸시 알림 짜임
 *
 * 사용자에게 알림 허용 받기, FCM 토큰 받기,
 * Firestore에 약속 시간 저장하기.
 */

import Storage from './storage.js';
import { firebaseConfig, VAPID_KEY } from './firebase-config.js';

let firebaseApp = null;
let messaging = null;
let firestore = null;

/**
 * 약속 시간 → cron이 짚는 자리들
 *
 * cron이 1분마다 도니까 — 약속 시간 그 자체가 자리.
 * 예) "04:30" → ["04:30"]
 *     "14:23" → ["14:23"]
 *
 * 짜임 결로 그저 약속 시간을 정규화해서 돌려줌.
 *
 * @param {string} time HH:MM 짜임
 * @returns {string[]} 닿는 cron 자리들
 */
function timeToSlots(time) {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return [];
  const [h, m] = time.split(':').map(Number);
  // 짜임 정규화 (예: "4:30" → "04:30")
  const slotStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  return [slotStr];
}

/**
 * 사용자의 모든 약속 시간 → cron 자리들로 변환
 *
 * @param {{morning: string, midday: string, evening: string}} meetingTimes
 * @returns {string[]} 모든 닿는 cron 자리들 (중복 없음, 정렬됨)
 */
function buildScheduledSlots(meetingTimes) {
  const allSlots = new Set();
  for (const time of Object.values(meetingTimes)) {
    if (!time) continue;
    timeToSlots(time).forEach(s => allSlots.add(s));
  }
  return Array.from(allSlots).sort();
}

/**
 * Firebase SDK 동적으로 로드 + 초기화
 * 처음 한 번만 실행됨
 */
async function ensureFirebase() {
  if (firebaseApp) return { firebaseApp, messaging, firestore };

  // Firebase SDK CDN에서 로드 (모듈로)
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js');
  const { getMessaging, getToken, isSupported } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js');
  const { getFirestore, doc, setDoc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js');

  firebaseApp = initializeApp(firebaseConfig);

  // 환경이 푸시 지원하는지 (iOS 16.4+, Android, 데스크톱 등)
  const supported = await isSupported();
  if (!supported) {
    throw new Error('이 브라우저에서는 푸시 알림이 지원되지 않아요.');
  }

  messaging = getMessaging(firebaseApp);
  firestore = getFirestore(firebaseApp);

  // helper 함수 보관
  ensureFirebase._helpers = { getToken, doc, setDoc, deleteDoc };

  return { firebaseApp, messaging, firestore };
}

/**
 * 알림이 이 환경에서 사용 가능한지 점검
 */
export function isPushSupported() {
  if (!('serviceWorker' in navigator)) return false;
  if (!('PushManager' in window)) return false;
  if (!('Notification' in window)) return false;
  return true;
}

/**
 * 사용자가 이미 알림을 허용했는지
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;  // 'default' | 'granted' | 'denied'
}

/**
 * 알림 허용 받기 + FCM 토큰 받기 + Firestore에 저장
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function enablePushNotifications() {
  if (!isPushSupported()) {
    return { success: false, message: '이 브라우저는 푸시 알림을 지원하지 않아요.' };
  }

  // iOS PWA는 홈 화면에 추가된 자리에서만 푸시 가능
  // standalone 모드인지 점검
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS && !isStandalone) {
    return {
      success: false,
      message: 'iOS에서는 홈 화면에 추가한 자리에서만 알림을 받을 수 있어요. 먼저 공유 버튼 → "홈 화면에 추가"를 눌러주세요.'
    };
  }

  // 알림 허용 받기
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    return { success: false, message: '알림 허용을 거절하셨어요. 휴대폰 설정에서 허용으로 바꾸실 수 있어요.' };
  }

  try {
    // Firebase 초기화
    const { messaging, firestore } = await ensureFirebase();
    const { getToken, doc, setDoc } = ensureFirebase._helpers;

    // 메인 SW 자리 받기 (sw.js에 Firebase 짜임이 같이 들어 있음)
    let swRegistration;
    try {
      swRegistration = await navigator.serviceWorker.ready;
      if (!swRegistration) {
        throw new Error('Service Worker가 등록되어 있지 않아요');
      }
    } catch (swErr) {
      console.error('Service Worker 자리 받기 실패:', swErr);
      return { success: false, message: '알림 자리를 만들지 못했어요. (SW 자리 받기 실패: ' + swErr.message + ')' };
    }

    // FCM 토큰 받기
    let token;
    try {
      token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });
    } catch (tokenErr) {
      console.error('토큰 받기 실패:', tokenErr);
      return { success: false, message: '알림 자리를 받지 못했어요. (' + tokenErr.message + ')' };
    }

    if (!token) {
      return { success: false, message: '알림 자리를 받지 못했어요. 잠시 후 다시 시도해 주세요.' };
    }

    // 사용자 ID — 토큰을 그대로 ID로 (사용자별로 고유함)
    // 토큰 길이가 길어서, 짧게 해시하지 말고 그냥 토큰을 키로 쓰기
    Storage.setPushToken(token);

    // Firestore에 토큰 + 약속 시간 + cron 자리 저장
    const meetingTimes = Storage.getNotifyTimes();
    const userName = Storage.getUserName() || '';
    const userDoc = doc(firestore, 'pushUsers', token);

    const meetingTimesObj = {
      morning: meetingTimes.morning || '04:30',
      midday: meetingTimes.midday || '12:00',
      evening: meetingTimes.evening || '18:00',
    };

    await setDoc(userDoc, {
      token: token,
      userName: userName,
      meetingTimes: meetingTimesObj,
      scheduledSlots: buildScheduledSlots(meetingTimesObj),  // cron 자리들 미리 짜둠
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
      enabled: true,
      lastUpdated: new Date().toISOString(),
    });

    Storage.setPushEnabled(true);
    return { success: true, message: '알림이 켜졌어요. 약속하신 시간에 부드럽게 알려드릴게요.' };
  } catch (err) {
    console.error('푸시 허용 실패:', err);
    return { success: false, message: '알림 자리를 만들지 못했어요. 잠시 후 다시 시도해 주세요.' };
  }
}

/**
 * 알림 끄기 — Firestore에서 사용자 자리 삭제
 */
export async function disablePushNotifications() {
  const token = Storage.getPushToken();
  if (!token) {
    Storage.setPushEnabled(false);
    return { success: true, message: '알림이 꺼졌어요.' };
  }

  try {
    const { firestore } = await ensureFirebase();
    const { doc, deleteDoc } = ensureFirebase._helpers;
    const userDoc = doc(firestore, 'pushUsers', token);
    await deleteDoc(userDoc);
  } catch (err) {
    console.warn('Firestore에서 사용자 자리 삭제 실패:', err);
    // 삭제 실패해도 로컬 자리는 끔
  }

  Storage.setPushEnabled(false);
  Storage.setPushToken('');
  return { success: true, message: '알림이 꺼졌어요.' };
}

/**
 * 약속 시간 갱신 — 사용자가 시간을 바꾸면 Firestore도 갱신
 */
export async function updateMeetingTimes() {
  if (!Storage.isPushEnabled()) return;

  const token = Storage.getPushToken();
  if (!token) return;

  try {
    const { firestore } = await ensureFirebase();
    const { doc, setDoc } = ensureFirebase._helpers;
    const meetingTimes = Storage.getNotifyTimes();
    const userDoc = doc(firestore, 'pushUsers', token);

    const meetingTimesObj = {
      morning: meetingTimes.morning || '04:30',
      midday: meetingTimes.midday || '12:00',
      evening: meetingTimes.evening || '18:00',
    };

    await setDoc(userDoc, {
      meetingTimes: meetingTimesObj,
      scheduledSlots: buildScheduledSlots(meetingTimesObj),  // cron 자리도 같이 갱신
      lastUpdated: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('약속 시간 갱신 실패:', err);
  }
}
